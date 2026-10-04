const ApiError = require('../utils/error.util');
const logger = require('../utils/logger');
const candidatRepository = require('../repositories/candidat.repository');
const stagiaireRepository = require('../repositories/stagiaire.repository');

/**
 * PONT NODE <-> PYTHON POUR LA VÉRIFICATION DOCUMENTAIRE.
 *
 * Le microservice Python (ai-service) expose ``POST /api/documents/verify``
 * (protégé par ``X-Service-Token``) qui analyse un document d'onboarding
 * (CV, CIN, DEMANDE_STAGE, LETTRE_AFFECTATION) et renvoie un verdict :
 * VALID / REVIEW_REQUIRED / REJECTED.
 *
 * Ce service est le SEUL point d'appel de ce endpoint côté Node : ni les
 * contrôleurs, ni les repositories ne parlent à Python. Le frontend (Flutter)
 * n'appelle jamais Python directement.
 *
 * Configuration (lue à chaque appel pour rester testable) :
 *   - AI_DOCUMENT_SERVICE_URL  (fallback : PYTHON_AI_SERVICE_URL, puis http://localhost:8001)
 *   - AI_DOCUMENT_SERVICE_TOKEN (fallback : PYTHON_SERVICE_TOKEN)
 *   - AI_DOCUMENT_TIMEOUT_MS    (défaut : 10000)
 *
 * Erreurs normalisées (DocumentVerificationError, jamais de stack trace /
 * données personnelles propagées) :
 *   - code "timeout"         : Python met trop de temps à répondre ;
 *   - code "unavailable"     : Python injoignable (connexion refusée, réseau) ;
 *   - code "auth"            : jeton de service refusé par Python (401/403) ;
 *   - code "python_error"    : Python a répondu en erreur (4xx/5xx) ;
 *   - code "invalid_response": réponse illisible, shape invalide ou verdict
 *                              inconnu (aucun statut arbitraire n'est accepté).
 */
class DocumentVerificationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DocumentVerificationError';
    this.code = code;
  }
}

const ACCEPTED_VERDICTS = new Set(['VALID', 'REVIEW_REQUIRED', 'REJECTED']);

class DocumentVerificationService {
  _baseUrl() {
    return (
      process.env.AI_DOCUMENT_SERVICE_URL ||
      process.env.PYTHON_AI_SERVICE_URL ||
      'http://localhost:8001'
    );
  }

  _token() {
    return process.env.AI_DOCUMENT_SERVICE_TOKEN || process.env.PYTHON_SERVICE_TOKEN || '';
  }

  _timeoutMs() {
    return Number(process.env.AI_DOCUMENT_TIMEOUT_MS || 10000);
  }

  /**
   * Profil minimal du candidat depuis la base (nom/prénom/email) à envoyer au
   * service Python pour la vérification de cohérence. Toujours chargé côté
   * serveur depuis la candidature authentifiée : jamais depuis le client.
   */
  async loadCandidateProfile(candidature) {
    const applicantId = candidature && (candidature.stagiaire_id || candidature.candidat_id);
    if (!applicantId) return null;
    const profile = candidature.stagiaire_id
      ? await stagiaireRepository.findById(candidature.stagiaire_id)
      : await candidatRepository.getProfile(candidature.candidat_id);
    if (!profile) return null;
    return {
      nom: profile.nom || null,
      prenom: profile.prenom || null,
      email: profile.email || null
    };
  }

  /**
   * Envoie le document au microservice Python et renvoie un résultat normalisé.
   *
   * @param {object} params
   * @param {string} params.candidatureId - identifiant de la candidature.
   * @param {string} params.documentType - type attendu (CV, CIN, ...).
   * @param {string} params.filename - nom d'origine du fichier.
   * @param {Buffer} params.fileBuffer - contenu du document.
   * @param {object|null} params.candidate - { nom, prenom, email, cin }.
   * @returns {Promise<{status: string, confidence: number|null, summary: string, issues: string[]}>}
   */
  async verifyDocument({ candidatureId, documentType, filename, fileBuffer, candidate = null }) {
    const form = new FormData();
    form.append('file', new Blob([fileBuffer]), filename || 'document.pdf');
    form.append('document_type', documentType);
    form.append('candidature_id', candidatureId || '');
    form.append(
      'candidate',
      JSON.stringify({
        nom: (candidate && candidate.nom) || null,
        prenom: (candidate && candidate.prenom) || null,
        email: (candidate && candidate.email) || null,
        cin: (candidate && candidate.cin) || null
      })
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this._timeoutMs());

    let res;
    try {
      res = await fetch(`${this._baseUrl()}/api/documents/verify`, {
        method: 'POST',
        headers: { 'X-Service-Token': this._token() },
        body: form,
        signal: controller.signal
      });
    } catch (err) {
      if (err && err.name === 'AbortError') {
        throw new DocumentVerificationError(
          'timeout',
          'Le service de vérification documentaire (Python) a mis trop de temps à répondre.'
        );
      }
      logger.warn('[DOC-VERIFY] Service Python injoignable :', err && err.message);
      throw new DocumentVerificationError(
        'unavailable',
        'Le service de vérification documentaire (Python) est indisponible.'
      );
    } finally {
      clearTimeout(timer);
    }

    let data;
    try {
      data = await res.json();
    } catch {
      throw new DocumentVerificationError(
        'invalid_response',
        'Réponse illisible du service de vérification documentaire.'
      );
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new DocumentVerificationError(
          'auth',
          'Authentification du service de vérification documentaire refusée.'
        );
      }
      const detail = data && (data.detail || data.message);
      throw new DocumentVerificationError(
        'python_error',
        detail
          ? `Le service de vérification documentaire a retourné : ${String(detail).slice(0, 300)}`
          : 'Le service de vérification documentaire a retourné une erreur.'
      );
    }

    const status = data && data.status;
    if (!ACCEPTED_VERDICTS.has(status)) {
      throw new DocumentVerificationError(
        'invalid_response',
        'Réponse de vérification documentaire invalide (statut inconnu).'
      );
    }

    return {
      status,
      confidence: Number.isFinite(Number(data.confidence)) ? Number(data.confidence) : null,
      summary: typeof data.summary === 'string' ? data.summary : '',
      issues: Array.isArray(data.issues) ? data.issues.map((i) => String(i)) : []
    };
  }
}

module.exports = {
  DocumentVerificationService,
  DocumentVerificationError,
  documentVerificationService: new DocumentVerificationService()
};
