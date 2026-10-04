const ApiError = require('../utils/error.util');
const logger = require('../utils/logger');
const engineRepository = require('../repositories/ai-interview-engine.repository');
const candidatureRepository = require('../repositories/candidature.repository');
const offreRepository = require('../repositories/offre.repository');

const SPLIT = /[,;\n]+/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);

const toList = (value) =>
  value
    ? String(value)
        .split(SPLIT)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

/**
 * SERVICE D'ENTRETIEN IA VOCAL — PONT NODE <-> PYTHON.
 *
 * Node.js reste le backend principal ; le microservice Python (ai-service)
 * est le MOTEUR de l'entretien. Ce service :
 *  - appelle Python (client HTTP avec timeout + jeton de service) ;
 *  - orchestre le cycle de vie (create → start → complete → report) ;
 *  - vérifie les permissions (RH/ADMIN, candidat propriétaire) ;
 *  - gère proprement les erreurs : Python indisponible (503), timeout (504),
 *    jeton de service invalide (502), entretien inexistant (404),
 *    entretien déjà terminé / déjà démarré (409).
 *
 * Le frontend ne parle JAMAIS directement à Python : les opérations
 * sensibles transitent par Node (routes /api/ai-interviews/...).
 */
class AiInterviewEngineService {
  // ───────────────────────── Client HTTP vers Python ─────────────────────────

  async _request(method, path, body) {
    const base = process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:8001';
    const token = process.env.PYTHON_SERVICE_TOKEN || '';
    const timeoutMs = Number(process.env.PYTHON_AI_TIMEOUT_MS || 8000);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Token': token,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      const raw = await res.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new ApiError(
            502,
            'Authentification du service IA refusée (jeton de service invalide).'
          );
        }
        const detail = data && data.detail;
        const message = Array.isArray(detail)
          ? detail.map((d) => d.msg || JSON.stringify(d)).join(' ; ')
          : detail || 'Le service d\'entretien IA a retourné une erreur.';
        throw new ApiError(res.status, message);
      }

      return data;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err.name === 'AbortError') {
        throw new ApiError(
          504,
          'Le service d\'entretien IA (Python) a mis trop de temps à répondre.'
        );
      }
      logger.warn('[AI-ENGINE] Service Python injoignable :', err.message);
      throw new ApiError(
        503,
        'Le service d\'entretien IA (Python) est indisponible. Réessayez dans quelques instants.'
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async _pythonCreate(candidatureId, offre, cv) {
    return this._request('POST', '/api/v1/interviews', { candidature_id: candidatureId, offre, cv: cv || undefined });
  }

  async _pythonStart(sessionId, offre) {
    return this._request('POST', `/api/v1/interviews/${sessionId}/start`, { offre });
  }
  async _pythonAnswer(sessionId, questionNumber, answer) {
    return this._request('POST', `/api/v1/interviews/${sessionId}/answer`, {
      question_number: questionNumber,
      answer
    });
  }

  async _pythonComplete(sessionId) {
    return this._request('POST', `/api/v1/interviews/${sessionId}/complete`);
  }

  // ─────────────────────────────── Orchestration ─────────────────────────────

  /** Crée un entretien IA vocal pour une candidature (RH/ADMIN). */
  async createInterview(candidatureId, currentUser) {
    if (!['RH', 'ADMIN'].includes(currentUser.role)) {
      throw new ApiError(403, 'Seul un responsable RH peut créer un entretien IA vocal.');
    }
    if (!isUuid(candidatureId)) {
      throw new ApiError(404, 'Candidature introuvable.');
    }

    const candidature = await candidatureRepository.findByIdWithOffer(candidatureId);
    if (!candidature) {
      throw new ApiError(404, 'Candidature introuvable.');
    }

    const existing = await engineRepository.findActiveByCandidature(candidatureId);
    if (existing) {
      throw new ApiError(409, 'Un entretien IA est déjà en cours pour cette candidature.');
    }

    const offre = await this._offreContext(candidature.offre_id);
    const created = await this._pythonCreate(candidatureId, offre);
    const row = await engineRepository.create(candidatureId, created.session_id);
    logger.info(`[AI-ENGINE] Entretien ${row.id} créé (Python session ${created.session_id})`);
    return this._toDto(row);
  }

  /** Détail d'un entretien (RH/ADMIN ou candidat propriétaire). */
  async getInterview(id, currentUser) {
    const row = await this._loadOwned(id, currentUser);
    return this._toDto(row);
  }

  /** Démarre l'entretien : le moteur Python génère la première question. */
  async startInterview(id, currentUser) {
    const row = await this._loadOwned(id, currentUser);
    this._assertStartable(row);

    const candidature = await candidatureRepository.findByIdWithOffer(row.candidature_id);
    const offre = await this._offreContext(candidature ? candidature.offre_id : null);
    const started = await this._pythonStart(row.python_session_id, offre);

    const firstQuestion = started.question;
    await engineRepository.markStarted(row.id);
    if (firstQuestion) {
      await engineRepository.appendQuestion(row.id, firstQuestion);
    }
    const updated = await engineRepository.findById(row.id);
    return this._toDto(updated);
  }

  /** Enregistre la réponse à la question courante et génère la suivante. */
  async answerInterview(id, currentUser, questionNumber, answer) {
    const row = await this._loadOwned(id, currentUser);
    if (row.statut !== 'STARTED') {
      throw new ApiError(400, 'L\'entretien doit être démarré avant de répondre.');
    }
    if (typeof answer !== 'string' || !answer.trim()) {
      throw new ApiError(400, 'La réponse ne peut pas être vide.');
    }

    const answered = await this._pythonAnswer(row.python_session_id, questionNumber, answer);
    await engineRepository.appendQuestion(row.id, answered.next_question);
    const updated = await engineRepository.findById(row.id);
    return this._toDto(updated);
  }

  /** Termine l'entretien : le moteur Python évalue et renvoie le rapport. */
  async completeInterview(id, currentUser) {
    const row = await this._loadOwned(id, currentUser);
    if (row.statut === 'COMPLETED') {
      throw new ApiError(409, 'Cet entretien IA est déjà terminé.');
    }
    if (row.statut !== 'STARTED') {
      throw new ApiError(400, 'L\'entretien doit être démarré avant d\'être terminé.');
    }

    const completed = await this._pythonComplete(row.python_session_id);
    const updated = await engineRepository.markCompleted(row.id, completed.report);
    logger.info(`[AI-ENGINE] Entretien ${row.id} terminé (score ${completed.report?.score ?? '?'})`);
    return this._toDto(updated);
  }

  /** Rapport d'évaluation — réservé aux RH/ADMIN (données sensibles). */
  async getReport(id, currentUser) {
    if (['RH', 'ADMIN'].includes(currentUser.role)) {
      if (!isUuid(id)) {
        throw new ApiError(404, 'Entretien IA introuvable.');
      }
      const row = await engineRepository.findById(id);
      if (!row) {
        throw new ApiError(404, 'Entretien IA introuvable.');
      }
      if (row.statut !== 'COMPLETED') {
        throw new ApiError(409, 'Le rapport d\'entretien n\'est pas encore disponible.');
      }
      return {
        id: row.id,
        candidature_id: row.candidature_id,
        statut: row.statut,
        completed_at: row.completed_at,
        report: row.report,
      };
    }
    throw new ApiError(403, 'Le rapport d\'entretien est réservé aux responsables RH.');
  }

  // ─────────────────────────────── Contrôles ─────────────────────────────

  /** Charge un entretien et vérifie le droit d'accès (candidat propriétaire). */
  async _loadOwned(id, currentUser) {
    if (!isUuid(id)) {
      throw new ApiError(404, 'Entretien IA introuvable.');
    }
    const row = await engineRepository.findById(id);
    if (!row) {
      throw new ApiError(404, 'Entretien IA introuvable.');
    }

    if (currentUser.role === 'CANDIDAT') {
      const candidature = await candidatureRepository.findByIdWithOffer(row.candidature_id);
      const ownerId = candidature ? candidature.candidat_id || candidature.stagiaire_id : null;
      if (!candidature || !ownerId || ownerId !== currentUser.id) {
        throw new ApiError(403, 'Accès refusé : cet entretien ne vous est pas destiné.');
      }
    }

    return row;
  }

  _assertStartable(row) {
    if (row.statut === 'COMPLETED') {
      throw new ApiError(409, 'Cet entretien IA est déjà terminé.');
    }
    if (row.statut !== 'CREATED') {
      throw new ApiError(409, 'Cet entretien IA est déjà démarré.');
    }
  }

  async _offreContext(offreId) {
    if (!offreId) return {};
    const offre = await offreRepository.findPublicById(offreId);
    if (!offre) return {};
    return {
      titre: offre.titre,
      description: offre.description,
      missions: offre.missions,
      departement_nom: offre.departement_nom,
      duree: offre.duree,
      niveau: offre.niveau,
      localisation: offre.localisation,
      technologies: toList(offre.technologies),
      competences: toList(offre.competences_demandees),
    };
  }

  _toDto(row) {
    if (!row) return null;
    return {
      id: row.id,
      candidature_id: row.candidature_id,
      statut: row.statut,
      questions: row.questions,
      created_at: row.created_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
      updated_at: row.updated_at,
    };
  }
}

module.exports = new AiInterviewEngineService();
