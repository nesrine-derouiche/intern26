const db = require('../config/db');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const candidatureRepository = require('../repositories/candidature.repository');
const candidatureDocumentRepository = require('../repositories/candidature-document.repository');
const encadrantRepository = require('../repositories/encadrant.repository');
const offreRepository = require('../repositories/offre.repository');
const stageRepository = require('../repositories/stage.repository');
const stagiaireRepository = require('../repositories/stagiaire.repository');
const candidatRepository = require('../repositories/candidat.repository');
const aiInterviewRepository = require('../repositories/ai-interview.repository');
const humanInterviewRepository = require('../repositories/human-interview.repository');
const cvAnalyseRepository = require('../repositories/cv_analyse.repository');
const notificationService = require('./notification.service');
const emailService = require('./email.service');
const { documentVerificationService } = require('./document-verification.service');
const logger = require('../utils/logger');
const { UPLOAD_DIR } = require('../config/uploads');
const { buildPaginatedResult } = require('../utils/pagination.util');
const { buildIntegritySummary } = require('../utils/integrity.util');
const ApiError = require('../utils/error.util');
const { weeksToMonths, computeStagePeriodFromToday, dateFromIso } = require('../utils/stage-period.util');

class CandidatureService {
  /** Documents exigés du dossier de candidature (onboarding, pré-création du stage). */
  static get ONBOARDING_DOCUMENT_TYPES() {
    return ['CV', 'CIN', 'DEMANDE_STAGE', 'LETTRE_AFFECTATION'];
  }

  async getAllCandidatures(options = null, scope = null) {
    const rows = await candidatureRepository.findAll(options, scope);
    if (options && options.enabled) return buildPaginatedResult(rows.data, rows.total, options.page, options.limit);
    return rows;
  }

  /** Offres (id) auxquelles le candidat connecté a déjà postulé. */
  async getMyAppliedOffers(currentUser) {
    if (!currentUser || currentUser.role !== 'CANDIDAT') return { offre_ids: [] };
    const offreIds = await candidatureRepository.findOfferIdsByCandidat(currentUser.id);
    return { offre_ids: offreIds };
  }

  /**
   * Candidatures du candidat connecté (lecture seule, portail candidat).
   * La liste est filtrée par le candidat : aucune candidature d'un autre
   * candidat ne peut être renvoyée. L'entretien humain est chargé séparément
   * via GET /candidatures/:id/entretien-humain (endpoint existant, testé).
   *
   * `documents_onboarding` est renseigné uniquement pour la candidature en
   * cours d'onboarding (statut HUMAN_INTERVIEW_ACCEPTED + période validée) :
   * c'est l'état du dossier de documents utilisé par le portail candidat.
   */
  async getMyCandidatures(currentUser) {
    if (!currentUser || currentUser.role !== 'CANDIDAT') return { candidatures: [] };
    const rows = await candidatureRepository.findByCandidat(currentUser.id);
    const profile = await candidatRepository.getProfile(currentUser.id);
    const cv = profile && profile.cv_path
      ? { path: profile.cv_path, originalName: profile.cv_original_name || null }
      : null;

    const candidatures = rows.map((row) => ({
      id: row.id,
      offre_id: row.offre_id,
      offre_titre: row.offre_titre,
      departement_nom: row.departement_nom,
      statut: row.statut,
      date_candidature: row.date_candidature,
      internship_start_date: row.internship_start_date ? this._formatIsoDate(row.internship_start_date) : null,
      internship_duration_months: row.internship_duration_months != null ? Number(row.internship_duration_months) : null,
      internship_details_submitted_at: row.internship_details_submitted_at || null,
      internship_period_validated_at: row.internship_period_validated_at || null,
      internship_period_validated_by: row.internship_period_validated_by || null,
      internship_modification_requested_at: row.internship_modification_requested_at || null,
      mobile_access: this._shapeMobileAccess(row),
      documents_onboarding: this._isOnboardingWindow(row)
        ? this._buildOnboardingSummary(row.id, [], cv)
        : null
    }));

    if (candidatures.some((c) => c.documents_onboarding)) {
      const activeIds = candidatures.filter((c) => c.documents_onboarding).map((c) => c.id);
      const documents = await candidatureDocumentRepository.findByCandidatureIds(activeIds);
      for (const candidature of candidatures) {
        if (!candidature.documents_onboarding) continue;
        candidature.documents_onboarding = this._buildOnboardingSummary(
          candidature.id,
          documents[candidature.id] || [],
          cv
        );
      }
    }

    return { candidatures };
  }

  /** La candidature est-elle dans la fenêtre d'onboarding (dépôt des documents requis) ? */
  _isOnboardingWindow(row) {
    return !!row && row.statut === 'HUMAN_INTERVIEW_ACCEPTED' && !!row.internship_period_validated_at;
  }

  /**
   * État du dossier de candidature (4 documents requis). Un document déjà
   * soumis est EN_ATTENTE (vérification manuelle RH : étape ultérieure).
   * Le CV posté lors de la candidature (candidat.cv_path) compte comme soumis
   * (from_application) tant que le candidat n'a pas déposé un CV explicite.
   */
  _buildOnboardingSummary(candidatureId, rows, cv) {
    const byType = new Map((rows || []).map((d) => [d.type, d]));
    const documents = CandidatureService.ONBOARDING_DOCUMENT_TYPES.map((type) => {
      const row = byType.get(type);
      if (type === 'CV' && !row && cv && cv.path) {
        return {
          id: null,
          type,
          statut: 'EN_ATTENTE',
          nom: cv.originalName || cv.path.split('/').pop(),
          date_depot: null,
          from_application: true,
          rejected_reason: null,
          verification_status: null
        };
      }
      return {
        id: row ? row.id : null,
        type,
        statut: row ? row.statut : 'MANQUANT',
        nom: row ? row.nom : null,
        date_depot: row ? row.date_depot : null,
        from_application: false,
        rejected_reason: row ? row.rejected_reason : null,
        verification_status: row ? row.verification_status : null
      };
    });
    return {
      candidature_id: candidatureId,
      required_types: [...CandidatureService.ONBOARDING_DOCUMENT_TYPES],
      documents,
      submitted: documents.filter((d) => d.statut !== 'MANQUANT').length,
      total: CandidatureService.ONBOARDING_DOCUMENT_TYPES.length
    };
  }

  /**
   * Dépôt d'un document du dossier de candidature par le candidat.
   *
   * Sécurité :
   *  - réservé au candidat / stagiaire (vérifié aussi par la route) ;
   *  - la candidature doit appartenir au candidat connecté (403 sinon) ;
   *  - la candidature doit être en HUMAN_INTERVIEW_ACCEPTED avec une période
   *    de stage validée : c'est la fenêtre d'onboarding (400 sinon) ;
   *  - le type doit être un des 4 documents requis (400 sinon).
   *
    * Un nouveau dépôt remplace le précédent pour le même type (upsert → statut
    * EN_ATTENTE, verification_status PENDING) ; l'ancien fichier physique est
    * supprimé. Le RH est notifié best effort, puis le document est envoyé au
    * service Python de vérification documentaire : le verdict (VALID,
    * REVIEW_REQUIRED ou REJECTED) est persisté dans `verification_status`.
    * En cas d'indisponibilité du service, le document reste déposé en PENDING
    * (re-vérifiable plus tard) : l'upload n'est jamais invalidé.
    */
  async uploadOnboardingDocument(id, type, file, currentUser) {
    if (!currentUser || (currentUser.role !== 'CANDIDAT' && currentUser.role !== 'STAGIAIRE')) {
      if (file && file.filename) this._removeUploadedFile(file.filename);
      throw new ApiError(403, 'Seul le candidat propriétaire du dossier peut déposer ses documents.');
    }
    if (!file || !file.filename) throw new ApiError(400, 'Aucun fichier fourni.');
    if (!CandidatureService.ONBOARDING_DOCUMENT_TYPES.includes(type)) {
      this._removeUploadedFile(file.filename);
      throw new ApiError(400, 'Type de document invalide.');
    }

    const candidature = await candidatureRepository.findByIdWithOffer(id);
    if (!candidature) {
      this._removeUploadedFile(file.filename);
      throw new ApiError(404, 'Candidature introuvable.');
    }

    const applicantId = candidature.stagiaire_id || candidature.candidat_id;
    if (!applicantId || applicantId !== currentUser.id) {
      this._removeUploadedFile(file.filename);
      throw new ApiError(403, 'Accès refusé : cette candidature ne vous appartient pas.');
    }

    if (candidature.statut !== 'HUMAN_INTERVIEW_ACCEPTED') {
      this._removeUploadedFile(file.filename);
      throw new ApiError(400, 'Le dépôt de documents n\'est possible qu\'après acceptation de la candidature.');
    }
    if (!candidature.internship_period_validated_at) {
      this._removeUploadedFile(file.filename);
      throw new ApiError(400, 'Le dépôt de documents n\'est possible qu\'après validation de la période de stage.');
    }

    const existing = await candidatureDocumentRepository.findByCandidatureIdAndType(id, type);
    if (existing && existing.chemin && existing.chemin !== file.filename) {
      this._removeUploadedFile(existing.chemin);
    }

    let document;
    try {
      document = await candidatureDocumentRepository.upsert(id, type, file.originalname, file.filename);
    } catch (err) {
      this._removeUploadedFile(file.filename);
      throw err;
    }

    await this._notifyRHDocumentSubmitted(candidature, type, file.originalname);

    await this._runAutomaticDocumentVerification(id, type, file, candidature);

    const rows = await candidatureDocumentRepository.findByCandidatureId(id);
    const profile = candidature.candidat_id ? await candidatRepository.getProfile(candidature.candidat_id) : null;
    const cv = profile && profile.cv_path ? { path: profile.cv_path, originalName: profile.cv_original_name || null } : null;

    return {
      document: {
        id: document.id,
        type: document.type,
        nom: document.nom,
        date_depot: document.date_depot,
        statut: document.statut
      },
      documents_onboarding: this._buildOnboardingSummary(id, rows, cv)
    };
  }

  /** Notification best effort « Document du dossier déposé » aux utilisateurs RH. */
  async _notifyRHDocumentSubmitted(candidature, type, filename) {
    try {
      const nom = (await this._applicantName(candidature)) || 'Un candidat';
      await notificationService.notifyRoleBestEffort(
        'RH',
        'Document du dossier déposé',
        `${nom} a déposé "${filename}" (${type}) pour son dossier de candidature.`,
        'CANDIDATURE',
        `/candidatures/${candidature.id}`
      );
    } catch (err) {
      logger.error('Échec de la notification RH :', err.message);
    }
  }

  /**
   * Vérification automatique BEST EFFORT du document déposé via le microservice
   * Python de vérification documentaire.
   *
   * Le fichier est lu depuis le disque et envoyé à Python avec le profil
   * minimal du candidat (chargé côté serveur). Le verdict reçu (VALID /
   * REVIEW_REQUIRED / REJECTED) est persisté dans `verification_status`.
   * En cas d'échec (Python indisponible, délai dépassé, réponse invalide),
   * le document reste déposé avec `verification_status = PENDING` : l'upload
   * n'est jamais invalidé, aucun détail technique n'est exposé au client, et
   * la vérification pourra être retentée ultérieurement.
   */
  async _runAutomaticDocumentVerification(candidatureId, type, file, candidature) {
    try {
      const filePath = path.join(UPLOAD_DIR, file.filename);
      if (!fs.existsSync(filePath)) {
        logger.warn(`[DOC-VERIFY] Fichier introuvable pour la vérification (${file.filename}).`);
        return;
      }

      const fileBuffer = fs.readFileSync(filePath);
      const candidate = await documentVerificationService.loadCandidateProfile(candidature);
      const result = await documentVerificationService.verifyDocument({
        candidatureId,
        documentType: type,
        filename: file.originalname,
        fileBuffer,
        candidate
      });

      await candidatureDocumentRepository.updateVerificationStatus(candidatureId, type, result.status);

      logger.info(
        `[DOC-VERIFY] candidature=${candidatureId} type=${type} verdict=${result.status} confidence=${result.confidence == null ? '-' : result.confidence}`
      );

      if (result.status === 'REVIEW_REQUIRED') {
        await this._notifyRHVerificationRequired(candidature, type, file.originalname);
      }
    } catch (err) {
      logger.warn(
        `[DOC-VERIFY] Vérification impossible (candidature ${candidatureId}, ${type}) : ${err && err.message ? err.message : 'erreur inconnue'}`
      );
    }
  }

  /** Notification best effort aux RH : un document du dossier nécessite une vérification manuelle. */
  async _notifyRHVerificationRequired(candidature, type, filename) {
    try {
      const nom = (await this._applicantName(candidature)) || 'Un candidat';
      await notificationService.notifyRoleBestEffort(
        'RH',
        'Document à vérifier',
        `Le document ${type} de ${nom} nécessite une vérification manuelle.`,
        'CANDIDATURE',
        `/candidatures/${candidature.id}`
      );
    } catch (err) {
      logger.error('Échec de la notification RH (document à vérifier) :', err.message);
    }
  }

  /**
   * Décision RH de vérification manuelle d'un document du dossier
   * (verification_status REVIEW_REQUIRED → VALID ou REJECTED).
   *
   * Sécurité :
   *  - réservé au RH / Administrateur (vérifié aussi par la route) ;
   *  - la candidature doit exister (404) et le document lui appartenir (404) ;
   *  - seul un document en REVIEW_REQUIRED peut être tranché manuellement :
   *    PENDING (vérification automatique en cours), VALID (déjà tranché) ou
   *    REJECTED (déjà rejeté) sont refusés (409).
   *
   * L'update est appliqué AVANT l'audit et la notification : un échec de
   * notification ne peut jamais invalider la décision du RH.
   */
  async decideDocumentVerification(candidatureId, documentId, body, currentUser) {
    if (!currentUser || (currentUser.role !== 'RH' && currentUser.role !== 'ADMIN')) {
      throw new ApiError(403, 'Seul un RH ou un Administrateur peut valider ou rejeter un document du dossier.');
    }

    const candidature = await candidatureRepository.findByIdWithOffer(candidatureId);
    if (!candidature) throw new ApiError(404, 'Candidature introuvable.');

    const document = await candidatureDocumentRepository.findByIdAndCandidature(candidatureId, documentId);
    if (!document) throw new ApiError(404, 'Document introuvable.');

    if (document.verification_status !== 'REVIEW_REQUIRED') {
      throw new ApiError(409, 'Ce document ne requiert pas de vérification manuelle : seul un document à vérifier peut être validé ou rejeté.');
    }

    const status = body.status;
    const rejectedReason = status === 'REJECTED' ? (body.rejected_reason || null) : null;

    const updated = await candidatureDocumentRepository.applyManualDecision(candidatureId, documentId, {
      verificationStatus: status,
      statut: status === 'VALID' ? 'VALIDE' : 'REJETE',
      rejectedReason
    });

    await candidatureRepository.insertDocumentDecisionAudit(candidatureId, {
      documentId,
      decision: status,
      action: 'DOCUMENT_REVIEW',
      decidedBy: currentUser.id,
      previousStatus: 'REVIEW_REQUIRED',
      newStatus: status
    });

    await this._notifyCandidateDocumentDecision(candidature, document, status);

    return {
      document: {
        id: updated.id,
        type: updated.type,
        nom: updated.nom,
        verification_status: updated.verification_status,
        statut: updated.statut,
        rejected_reason: updated.rejected_reason
      },
      message: status === 'VALID'
        ? `Le document ${document.type} a été validé.`
        : `Le document ${document.type} a été rejeté.`
    };
  }

  /** Notification best effort au candidat : décision RH sur un document du dossier. */
  async _notifyCandidateDocumentDecision(candidature, document, status) {
    try {
      const titre = status === 'VALID' ? 'Document validé' : 'Document rejeté';
      const message = status === 'VALID'
        ? `Votre document ${document.type} a été validé.`
        : `Votre document ${document.type} nécessite une nouvelle action.`;
      await this._notifyAndEmailApplicant(candidature, { titre, message });
    } catch (err) {
      logger.error('Échec de la notification du candidat (document) :', err.message);
    }
  }

  /** Fichier physique d'un document du dossier (téléchargement RH). */
  async getOnboardingDocumentFile(candidatureId, documentId) {
    const document = await candidatureDocumentRepository.findByIdAndCandidature(candidatureId, documentId);
    if (!document) throw new ApiError(404, 'Document introuvable.');
    const filePath = path.join(UPLOAD_DIR, document.chemin);
    if (!fs.existsSync(filePath)) throw new ApiError(404, 'Fichier physique introuvable.');
    return { filePath, nom: document.nom, contentType: this._contentTypeFor(document.nom) };
  }

  _contentTypeFor(nom) {
    const ext = path.extname(nom || '').toLowerCase();
    if (ext === '.pdf') return 'application/pdf';
    if (['.jpg', '.jpeg'].includes(ext)) return 'image/jpeg';
    if (ext === '.png') return 'image/png';
    if (ext === '.doc') return 'application/msword';
    if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    return 'application/octet-stream';
  }

  /** Suppression best effort du fichier physique déposé dans le répertoire d'upload. */
  _removeUploadedFile(filename) {
    if (!filename) return;
    try {
      const filePath = path.join(UPLOAD_DIR, filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
      logger.warn('Échec de la suppression du fichier uploadé :', err.message);
    }
  }

  async updateCandidatureStatut(id, statut, userRole) {
    if (userRole !== 'RH' && userRole !== 'ADMIN') {
      throw new ApiError(403, 'Seul un RH ou un Administrateur peut accepter ou refuser une candidature.');
    }

    const candidature = await candidatureRepository.findByIdWithOffer(id);
    if (!candidature) throw new ApiError(404, 'Candidature introuvable.');
    if (candidature.statut !== 'EN_ATTENTE') throw new ApiError(400, 'Cette candidature a déjà été traitée.');

    if (statut === 'EN_ENTRETIEN_IA') {
      await this._selectForInterview(id, candidature);
      return { message: 'Candidature présélectionnée pour l\'entretien IA.' };
    }

    if (statut === 'RH_ACCEPTED') {
      await this._acceptForAiInterview(id, candidature);
      return { message: 'Candidature acceptée pour l\'entretien IA.' };
    }

    if (statut === 'REFUSEE') {
      await this._refuseCandidature(id, candidature);
      return { message: 'Candidature refusée.' };
    }

    if (statut === 'ACCEPTEE') {
      await this._acceptCandidature(id, candidature);
      return { message: 'Candidature acceptée et stage créé.' };
    }
  }

  /**
   * Présélection pour l'entretien IA : met à jour le statut et prévient le
   * candidat. Ne crée NI le stage NI un compte : le candidat reste en attente
   * de l'étape suivante du processus de recrutement.
   */
  async _selectForInterview(id, candidature) {
    await candidatureRepository.updateStatut(id, 'EN_ENTRETIEN_IA');
    await this._notifyAndEmailApplicant(candidature, {
      titre: 'Candidature présélectionnée',
      message: `Votre candidature pour le stage "${candidature.offre_titre}" a été présélectionnée pour un entretien IA. Le service RH vous contactera pour la suite.`,
      buildEmail: (to, data) => emailService.sendRhPreselectionEmail(to, data)
    });
  }

  /**
   * Acceptation RH pour l'entretien IA : met à jour le statut puis prévient
   * le candidat (notification + email avec le lien de l'entretien IA).
   * La mise à jour du statut est faite AVANT toute notification : un échec
   * d'envoi d'email ne peut donc jamais annuler la décision du RH.
   * Ne crée NI le stage NI un compte : le candidat reste en attente de
   * l'étape « entretien IA ».
   */
  async _acceptForAiInterview(id, candidature) {
    await candidatureRepository.updateStatut(id, 'RH_ACCEPTED');
    const token = await this._createAiInterviewSession(id);
    const lienEntretien = this._buildAiInterviewLink(token);
    await this._notifyAndEmailApplicant(candidature, {
      titre: 'Candidature présélectionnée',
      message: `Votre candidature pour le stage "${candidature.offre_titre}" a été présélectionnée. Cliquez pour commencer votre entretien IA.`,
      lien: `/entretien-ia/${token}`,
      emailData: { lienEntretien },
      buildEmail: (to, data) => emailService.sendRhPreselectedEmail(to, data)
    });
  }

  /**
   * Crée la session d'entretien IA associée à la candidature et génère son
   * jeton d'accès sécurisé (aucun identifiant interne exposé dans le lien).
   */
  async _createAiInterviewSession(candidatureId) {
    const existing = await aiInterviewRepository.findByCandidatureId(candidatureId);
    if (existing) return existing.token;
    const token = crypto.randomBytes(32).toString('hex');
    await aiInterviewRepository.create(candidatureId, token);
    return token;
  }

  /** Lien sécurisé de l'entretien IA (basé sur le jeton, jamais sur l'id interne). */
  _buildAiInterviewLink(token) {
    return `${emailService.frontendUrl()}/entretien-ia/${token}`;
  }

  /**
   * Notification + email best effort vers le candidat concerné par une
   * candidature (stagiaire interne ou candidat du portail). Ne lève jamais :
   * un échec d'email ou de notification ne doit pas faire échouer le statut.
   * `lien` (facultatif) est le chemin de navigation de la notification ;
   * `emailData` (facultatif) enrichit les données transmises au gabarit d'email.
   */
  async _notifyAndEmailApplicant(candidature, { titre, message, buildEmail, lien = null, emailData = {} }) {
    try {
      const applicantId = candidature.stagiaire_id || candidature.candidat_id;
      if (!applicantId) return;
      const profile = candidature.stagiaire_id
        ? await stagiaireRepository.findById(candidature.stagiaire_id)
        : await candidatRepository.getProfile(candidature.candidat_id);
      if (!profile) return;
      const nom = [profile.prenom, profile.nom].filter(Boolean).join(' ') || 'candidat';
      if (profile.email && buildEmail) {
        try {
          await buildEmail(profile.email, { nom, titreOffre: candidature.offre_titre, ...emailData });
        } catch (err) {
          logger.error('Échec de l\'envoi de l\'email de candidature :', err.message);
        }
      }
      const notifArgs = [applicantId, titre, message, 'CANDIDATURE'];
      if (lien) notifArgs.push(lien);
      await notificationService.notifyBestEffort(...notifArgs);
    } catch (err) {
      logger.error('Échec de la notification du candidat :', err.message);
    }
  }

  /**
   * Entretien IA pour le portail candidat. Accès réservé au candidat associé
   * à la candidature : 404 si la candidature n'existe pas (ou n'est pas en
   * attente d'un entretien IA), 403 si le candidat connecté n'est pas
   * l'auteur de la candidature.
   */
  async getAiInterview(id, currentUser) {
    const row = await candidatureRepository.findAiInterviewById(id);
    if (!row) throw new ApiError(404, 'Entretien IA introuvable.');
    if (row.statut !== 'RH_ACCEPTED') throw new ApiError(404, 'Entretien IA introuvable.');
    if (!row.candidat_id || row.candidat_id !== currentUser.id) {
      throw new ApiError(403, 'Accès refusé : cet entretien ne vous est pas destiné.');
    }
    return {
      id: row.id,
      statut: row.statut,
      date_candidature: row.date_candidature,
      candidat: { prenom: row.candidat_prenom ?? '', nom: row.candidat_nom ?? '' },
      offre: {
        id: row.offre_id,
        titre: row.offre_titre,
        departement_nom: row.departement_nom
      }
    };
  }

  /**
   * Lecture de l'entretien humain par le candidat propriétaire de la
   * candidature. Lecture seule : aucune modification possible ici, et un
   * candidat ne peut jamais consulter l'entretien d'une candidature qui ne
   * lui appartient pas (403). Retourne `interview: null` si rien n'est
   * planifié — le client ne doit alors afficher aucun rendez-vous.
   */
  async getCandidateHumanInterview(id, currentUser) {
    const row = await candidatureRepository.findByIdWithOffer(id);
    if (!row) throw new ApiError(404, 'Candidature introuvable.');
    const applicantId = row.stagiaire_id || row.candidat_id;
    if (!applicantId || applicantId !== currentUser.id) {
      throw new ApiError(403, 'Accès refusé : cette candidature ne vous appartient pas.');
    }
    const human = await humanInterviewRepository.findByCandidatureId(id);
    return { interview: this._shapeInterview(human) };
  }

  /**
   * Soumission des préférences de stage du candidat accepté après son
   * entretien humain (date de début souhaitée + durée en mois).
   *
   * Sécurité :
   *  - réservé au candidat (route CANDIDAT, vérifié aussi ici) ;
   *  - la candidature doit appartenir au candidat connecté (403 sinon) ;
   *  - la candidature doit être en HUMAN_INTERVIEW_ACCEPTED : un candidat
   *    non encore accepté, refusé ou en attente d'un entretien ne peut pas
   *    soumettre de préférences (400).
   *
   * La date de début doit être dans le futur (fuseau Africa/Tunis, même
   * convention que la planification des entretiens) et la durée un entier
   * positif en mois. L'enregistrement est idempotent (PUT) : le candidat
   * peut ajuster ses préférences tant que le RH n'a pas validé.
   */
  async submitStagePreferences(id, payload, currentUser) {
    if (!currentUser || currentUser.role !== 'CANDIDAT') {
      throw new ApiError(403, 'Seul le candidat propriétaire de la candidature peut renseigner ses préférences de stage.');
    }

    const candidature = await candidatureRepository.findByIdWithOffer(id);
    if (!candidature) throw new ApiError(404, 'Candidature introuvable.');

    const applicantId = candidature.stagiaire_id || candidature.candidat_id;
    if (!applicantId || applicantId !== currentUser.id) {
      throw new ApiError(403, 'Accès refusé : cette candidature ne vous appartient pas.');
    }

    if (candidature.statut !== 'HUMAN_INTERVIEW_ACCEPTED') {
      throw new ApiError(400, 'Les préférences de stage ne peuvent être renseignées qu\'après acceptation de la candidature suite à l\'entretien humain.');
    }

    if (candidature.internship_period_validated_at) {
      throw new ApiError(400, 'Votre période de stage a été validée par le RH et ne peut plus être modifiée.');
    }

    const { startDate, durationMonths } = this._validateStagePreferences(payload);

    const updated = await candidatureRepository.updateStagePreferences(id, {
      startDate,
      durationMonths
    });
    if (!updated) throw new ApiError(404, 'Candidature introuvable.');

    await this._notifyRHStagePreferences(candidature);

    return this._shapeStagePreferences(updated);
  }

  /** Valide les préférences de stage (date future + durée positive en mois). */
  _validateStagePreferences(payload = {}) {
    const startDate = String(payload.internship_start_date ?? '').trim();
    if (!startDate) throw new ApiError(400, 'La date de début du stage est requise.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || Number.isNaN(Date.parse(startDate))) {
      throw new ApiError(400, 'La date de début du stage est invalide (format YYYY-MM-DD).');
    }
    if (!this._isFutureDate(startDate)) {
      throw new ApiError(400, 'La date de début du stage doit être dans le futur.');
    }

    const rawDuration = payload.internship_duration_months;
    if (rawDuration === undefined || rawDuration === null || rawDuration === '') {
      throw new ApiError(400, 'La durée du stage est requise.');
    }
    const durationMonths = Number(rawDuration);
    if (!Number.isInteger(durationMonths) || durationMonths <= 0) {
      throw new ApiError(400, 'La durée du stage doit être un nombre de mois entier positif.');
    }
    if (durationMonths > 24) {
      throw new ApiError(400, 'La durée du stage ne peut pas dépasser 24 mois.');
    }

    return { startDate, durationMonths };
  }

  /** Notification best effort « Préférences de stage renseignées » aux utilisateurs RH. */
  async _notifyRHStagePreferences(candidature) {
    try {
      const nom = (await this._applicantName(candidature)) || 'Le candidat';
      await notificationService.notifyRoleBestEffort(
        'RH',
        'Préférences de stage renseignées',
        `${nom} a renseigné sa date de début et la durée de son stage.`,
        'CANDIDATURE',
        `/candidatures/${candidature.id}`
      );
    } catch (err) {
      logger.error('Échec de la notification RH :', err.message);
    }
  }

  /** Forme normalisée des préférences de stage pour les réponses API. */
  _shapeStagePreferences(updated) {
    return {
      id: updated.id,
      statut: updated.statut,
      internship_start_date: updated.internship_start_date ? this._formatIsoDate(updated.internship_start_date) : null,
      internship_duration_months: updated.internship_duration_months != null ? Number(updated.internship_duration_months) : null,
      internship_details_submitted_at: updated.internship_details_submitted_at || null,
      internship_period_validated_at: updated.internship_period_validated_at || null,
      internship_period_validated_by: updated.internship_period_validated_by || null,
      internship_modification_requested_at: updated.internship_modification_requested_at || null
    };
  }

  /**
   * Validation RH de la période de stage du candidat accepté (étape suivante
   * de la soumission des préférences).
   *
   * Sécurité :
   *  - réservé au RH / Administrateur (403, vérifié aussi par la route) ;
   *  - la candidature doit être en HUMAN_INTERVIEW_ACCEPTED (400 sinon) ;
   *  - le candidat doit avoir renseigné sa période (400 sinon) ;
   *  - la période ne doit pas déjà être validée (400, pas de double validation).
   *
   * Effets : horodatage de validation + RH validateur sur la candidature, entrée
   * d'audit (action STAGE_PERIOD_VALIDATED) dans candidature_decisions, et
   * notification au candidat. La période devient figée : le candidat ne peut
   * plus la modifier (submitStagePreferences renvoie 400).
   */
  async validateStagePreferences(id, currentUser) {
    if (!currentUser || (currentUser.role !== 'RH' && currentUser.role !== 'ADMIN')) {
      throw new ApiError(403, 'Seul un RH ou un Administrateur peut valider la période de stage.');
    }

    const candidature = await candidatureRepository.findByIdWithOffer(id);
    if (!candidature) throw new ApiError(404, 'Candidature introuvable.');
    if (candidature.statut !== 'HUMAN_INTERVIEW_ACCEPTED') {
      throw new ApiError(400, 'La période de stage ne peut être validée qu\'après acceptation de la candidature suite à l\'entretien humain.');
    }
    if (!candidature.internship_start_date || candidature.internship_duration_months == null) {
      throw new ApiError(400, 'Le candidat n\'a pas encore renseigné sa période de stage.');
    }
    if (candidature.internship_period_validated_at) {
      throw new ApiError(400, 'La période de stage a déjà été validée.');
    }

    const updated = await candidatureRepository.validateStagePreferences(id, currentUser.id);
    if (!updated) throw new ApiError(404, 'Candidature introuvable.');

    await candidatureRepository.insertStagePeriodAudit(id, {
      decision: 'VALIDATED',
      action: 'STAGE_PERIOD_VALIDATED',
      decidedBy: currentUser.id,
      previousStatus: candidature.statut,
      newStatus: candidature.statut,
      startDate: candidature.internship_start_date,
      durationMonths: Number(candidature.internship_duration_months)
    });

    // Préparation de l'accès à l'application mobile (compte existant réutilisé).
    // Best effort : un échec ici ne doit jamais annuler la validation RH.
    try {
      await candidatureRepository.prepareMobileAccess(id);
    } catch (err) {
      logger.error('Échec de la préparation de l\'accès mobile :', err.message);
    }

    await this._notifyCandidateStagePreferences(candidature, 'validated');

    return this._shapeStagePreferences(updated);
  }

  /**
   * Demande RH de modification de la période de stage : le candidat doit revoir
   * sa date de début / durée et resoumettre. La période redevient éditable.
   *
   * Sécurité :
   *  - réservé au RH / Administrateur (403) ;
   *  - la candidature doit être en HUMAN_INTERVIEW_ACCEPTED (400) ;
   *  - le candidat doit avoir renseigné sa période (400) ;
   *  - une période déjà validée est verrouillée : aucune demande de
   *    modification possible (400).
   *
   * Effets : marque `internship_modification_requested_at`, entrée d'audit
   * (action STAGE_PERIOD_MODIFICATION_REQUESTED) et notification au candidat.
   * La prochaine soumission du candidat lève cette demande (retour en attente).
   */
  async requestStagePreferencesModification(id, currentUser) {
    if (!currentUser || (currentUser.role !== 'RH' && currentUser.role !== 'ADMIN')) {
      throw new ApiError(403, 'Seul un RH ou un Administrateur peut demander une modification de la période de stage.');
    }

    const candidature = await candidatureRepository.findByIdWithOffer(id);
    if (!candidature) throw new ApiError(404, 'Candidature introuvable.');
    if (candidature.statut !== 'HUMAN_INTERVIEW_ACCEPTED') {
      throw new ApiError(400, 'La demande de modification n\'est possible qu\'après acceptation de la candidature suite à l\'entretien humain.');
    }
    if (!candidature.internship_start_date || candidature.internship_duration_months == null) {
      throw new ApiError(400, 'Le candidat n\'a pas encore renseigné sa période de stage.');
    }
    if (candidature.internship_period_validated_at) {
      throw new ApiError(400, 'La période de stage a été validée et ne peut plus être modifiée.');
    }

    const updated = await candidatureRepository.requestStagePreferencesModification(id);
    if (!updated) throw new ApiError(404, 'Candidature introuvable.');

    await candidatureRepository.insertStagePeriodAudit(id, {
      decision: 'MODIFICATION_REQUESTED',
      action: 'STAGE_PERIOD_MODIFICATION_REQUESTED',
      decidedBy: currentUser.id,
      previousStatus: candidature.statut,
      newStatus: candidature.statut,
      startDate: candidature.internship_start_date,
      durationMonths: Number(candidature.internship_duration_months)
    });

    await this._notifyCandidateStagePreferences(candidature, 'modification');

    return this._shapeStagePreferences(updated);
  }

  /** Notification best effort au candidat après validation ou demande de modification de sa période de stage. */
  async _notifyCandidateStagePreferences(candidature, kind) {
    const duration = Number(candidature.internship_duration_months);
    const durationLabel = duration === 1 ? '1 mois' : `${duration} mois`;
    const start = this._formatIsoDate(candidature.internship_start_date);

    if (kind === 'validated') {
      await this._notifyAndEmailApplicant(candidature, {
        titre: 'Période de stage validée',
        message: `Votre période de stage a été validée par RH : début le ${start}, durée ${durationLabel}.`,
        lien: '/mes-candidatures'
      });
      return;
    }

    await this._notifyAndEmailApplicant(candidature, {
      titre: 'Modification de période de stage demandée',
      message: 'Votre période de stage doit être modifiée. Le RH vous demande de revoir votre date de début et la durée de votre stage, puis de resoumettre.',
      lien: '/mes-candidatures'
    });
  }

  /**
   * Traitement du résultat de l'entretien IA.
   *
   * Contrat avec le futur moteur IA (isolé dans `services/ai/`) :
   *   { score: number, status: 'PASSED' | 'FAILED' }
   * Ce workflow ne connaît que ce contrat : il applique la décision métier,
   * les notifications et les emails. Il ne crée JAMAIS de stage ni de compte
   * mobile : le candidat reste en attente d'un entretien humain (PASSED) ou
   * est écarté (FAILED). La mise à jour du statut est faite avant toute
   * notification : un échec d'envoi ne peut jamais annuler la décision.
   */
  async submitAiInterviewResult(id, result, currentUser) {
    if (!currentUser || (currentUser.role !== 'RH' && currentUser.role !== 'ADMIN')) {
      throw new ApiError(403, 'Seul un RH ou un Administrateur peut valider un résultat d\'entretien IA.');
    }

    const candidature = await candidatureRepository.findByIdWithOffer(id);
    if (!candidature) throw new ApiError(404, 'Candidature introuvable.');
    if (candidature.statut !== 'RH_ACCEPTED') {
      throw new ApiError(400, 'La candidature n\'est pas en attente d\'un résultat d\'entretien IA.');
    }

    const { score, status } = this._validateAiResult(result);
    return this._applyAiResult(id, candidature, { score, status });
  }

  /**
   * Application d'un résultat d'entretien IA produit par le workflow
   * d'entretien (fin d'entretien par le candidat). Pas de garde de rôle :
   * la décision découle de l'évaluation automatique, pas d'une action RH.
   */
  async applyAiInterviewResult(id, result) {
    const candidature = await candidatureRepository.findByIdWithOffer(id);
    if (!candidature) throw new ApiError(404, 'Candidature introuvable.');
    if (candidature.statut !== 'RH_ACCEPTED') {
      throw new ApiError(400, 'La candidature n\'est pas en attente d\'un résultat d\'entretien IA.');
    }
    const { score, status } = this._validateAiResult(result);
    return this._applyAiResult(id, candidature, { score, status });
  }

  /** Application de la décision métier (statut + notifications + emails), jamais de stage ni de compte. */
  async _applyAiResult(id, candidature, { score, status }) {
    if (status === 'PASSED') {
      await candidatureRepository.updateStatut(id, 'AI_INTERVIEW_PASSED');
      await this._notifyRHInterviewPassed(candidature);
      await this._notifyAndEmailApplicant(candidature, {
        titre: 'Entretien IA réussi',
        message: `Félicitations ! Vous avez réussi l'entretien IA pour le stage "${candidature.offre_titre}". Vous êtes désormais éligible pour un entretien humain.`,
        lien: '/mon-profil',
        emailData: { score },
        buildEmail: (to, data) => emailService.sendAiInterviewPassedEmail(to, data)
      });
      return { id, statut: 'AI_INTERVIEW_PASSED', score };
    }

    await candidatureRepository.updateStatut(id, 'AI_INTERVIEW_FAILED');
    await this._notifyAndEmailApplicant(candidature, {
      titre: 'Entretien IA non réussi',
      message: `Nous regrettons de vous informer que votre entretien IA pour le stage "${candidature.offre_titre}" n'a pas abouti à une sélection.`,
      buildEmail: (to, data) => emailService.sendAiInterviewFailedEmail(to, data)
    });
    return { id, statut: 'AI_INTERVIEW_FAILED', score };
  }

  /** Valide le contrat de résultat renvoyé par le moteur d'entretien IA. */
  _validateAiResult(result) {
    const status = result && result.status;
    const score = Number(result && result.score);
    if (status !== 'PASSED' && status !== 'FAILED') {
      throw new ApiError(400, 'Le statut du résultat doit être PASSED ou FAILED.');
    }
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      throw new ApiError(400, 'Le score doit être un nombre entre 0 et 100.');
    }
    return { score, status };
  }

  /** Notification best effort « Entretien IA réussi » aux utilisateurs RH. */
  async _notifyRHInterviewPassed(candidature) {
    try {
      const nom = (await this._applicantName(candidature)) || 'Un candidat';
      await notificationService.notifyRoleBestEffort(
        'RH',
        'Entretien IA réussi',
        `${nom} a réussi l'entretien IA pour l'offre "${candidature.offre_titre}". Il est éligible pour un entretien humain.`,
        'CANDIDATURE',
        `/candidatures/${candidature.id}`
      );
    } catch (err) {
      logger.error('Échec de la notification RH :', err.message);
    }
  }

  /** Nom du candidat concerné par une candidature (stagiaire interne ou portail), best effort. */
  async _applicantName(candidature) {
    try {
      const applicantId = candidature.stagiaire_id || candidature.candidat_id;
      if (!applicantId) return null;
      const profile = candidature.stagiaire_id
        ? await stagiaireRepository.findById(candidature.stagiaire_id)
        : await candidatRepository.getProfile(candidature.candidat_id);
      if (!profile) return null;
      return [profile.prenom, profile.nom].filter(Boolean).join(' ') || null;
    } catch (err) {
      logger.error('Échec de la récupération du nom du candidat :', err.message);
      return null;
    }
  }

  /** Accès public au nom du candidat (best effort), utilisé par d'autres workflows. */
  async applicantName(candidature) {
    return this._applicantName(candidature);
  }

  /** Détails complets d'une candidature — RH/ADMIN voient tout, CANDIDAT uniquement la sienne. */
  async getCandidatureDetails(id, currentUser = null) {
    const row = await candidatureRepository.findDetailsById(id);
    if (!row) throw new ApiError(404, 'Candidature introuvable.');
    this._assertCandidatureOwnership(row, currentUser);
    const hasCandidat = !!row.candidat_id;
    const cvFilename = row.cv_path ? row.cv_path.split('/').pop() : null;
    const aiSession = await aiInterviewRepository.findByCandidatureId(id);
    const human = await humanInterviewRepository.findByCandidatureId(id);
    const cvAnalyse = hasCandidat ? await cvAnalyseRepository.findByCandidat(row.candidat_id) : null;
    const decisions = await candidatureRepository.findDecisionsByCandidature(id);
    const onboardingRows = row.statut === 'HUMAN_INTERVIEW_ACCEPTED'
      ? await candidatureDocumentRepository.findByCandidatureId(id)
      : [];
    const cvForOnboarding = row.cv_path ? { path: row.cv_path, originalName: row.cv_original_name || null } : null;
    return {
      id: row.id,
      stagiaire_id: row.stagiaire_id,
      candidat_id: row.candidat_id,
      offre_id: row.offre_id,
      date_candidature: row.date_candidature,
      statut: row.statut,
      decision: row.decision || null,
      decided_by: row.decided_by || null,
      decided_at: row.decided_at || null,
      internship_start_date: row.internship_start_date ? this._formatIsoDate(row.internship_start_date) : null,
      internship_duration_months: row.internship_duration_months != null ? Number(row.internship_duration_months) : null,
      internship_details_submitted_at: row.internship_details_submitted_at || null,
      internship_period_validated_at: row.internship_period_validated_at || null,
      internship_period_validated_by: row.internship_period_validated_by || null,
      internship_modification_requested_at: row.internship_modification_requested_at || null,
      validated_by_name: row.validated_by_prenom && row.validated_by_nom
        ? `${row.validated_by_prenom} ${row.validated_by_nom}`
        : null,
      decision_history: decisions.map((d) => ({
        id: d.id,
        decision: d.decision,
        action: d.action || null,
        document_id: d.document_id || null,
        decided_by: d.decided_by,
        decided_at: d.decided_at,
        previous_status: d.previous_status,
        new_status: d.new_status,
        internship_start_date: d.internship_start_date ? this._formatIsoDate(d.internship_start_date) : null,
        internship_duration_months: d.internship_duration_months != null ? Number(d.internship_duration_months) : null,
        decided_by_name: d.decided_by_prenom && d.decided_by_nom
          ? `${d.decided_by_prenom} ${d.decided_by_nom}`
          : null
      })),
      offre_titre: row.offre_titre,
      departement_nom: row.departement_nom,
      nom: hasCandidat ? row.candidat_nom : row.stagiaire_nom,
      prenom: hasCandidat ? row.candidat_prenom : row.stagiaire_prenom,
      email: hasCandidat ? row.candidat_email : row.stagiaire_email,
      telephone: hasCandidat ? row.candidat_telephone : row.stagiaire_telephone,
      universite: row.universite,
      specialite: row.specialite,
      niveau: row.niveau,
      cv: row.cv_path
        ? {
            filename: cvFilename,
            originalName: row.cv_original_name || cvFilename,
            size: row.cv_size != null ? Number(row.cv_size) : null,
            uploadedAt: row.cv_uploaded_at || null
          }
        : null,
      cvUrl: row.cv_path ? `/candidatures/${row.id}/cv` : null,
      cv_analyse: cvAnalyse
        ? {
            statut: cvAnalyse.statut,
            ai_provider: cvAnalyse.ai_provider,
            erreur: cvAnalyse.erreur,
            cv_filename: cvAnalyse.cv_filename,
            resultat: cvAnalyse.resultat
          }
        : null,
      ai_interview: aiSession
        ? {
            statut: aiSession.statut,
            evaluation_status: aiSession.evaluation_status,
            evaluation: aiSession.evaluation,
            started_at: aiSession.started_at,
            completed_at: aiSession.completed_at,
            integrity: buildIntegritySummary(aiSession)
          }
        : null,
      human_interview: human
        ? {
            date: this._formatIsoDate(human.date),
            heure: human.heure,
            duree: human.duree != null ? Number(human.duree) : null,
            interviewer: human.interviewer,
            interviewer_email: human.interviewer_email,
            lien_visio: human.lien_visio,
            statut: human.statut,
            completed_at: human.completed_at || null,
            completed_by: human.completed_by || null
          }
        : null,
      mobile_access: this._shapeMobileAccess(row),
      stage_created: row.statut === 'STAGIAIRE_CREATED'
        ? await this._shapeStageCreated(row.id)
        : null,
      documents_onboarding: row.statut === 'HUMAN_INTERVIEW_ACCEPTED'
        ? this._buildOnboardingSummary(id, onboardingRows, cvForOnboarding)
        : null
    };
  }

  /**
   * État de l'accès à l'application mobile d'une candidature. Ne contient
   * JAMAIS le mot de passe (ni sa version chiffrée) : la préparation du compte
   * et l'envoi de l'email D-1 sont traités par le job `mobile-access-email.job.js`.
   */
  _shapeMobileAccess(row) {
    if (!row) return null;
    return {
      prepared_at: row.mobile_access_prepared_at || null,
      email_state: row.mobile_access_email_state || 'PENDING',
      email_sent_at: row.mobile_access_email_sent_at || null,
      email_error: row.mobile_access_email_error || null,
      email_planned_for: row.internship_start_date ? this._minusOneDay(row.internship_start_date) : null
    };
  }

  /**
   * Contrôle d'accès défensif pour les endpoints de détail candidature.
   * RH / ADMIN : accès total. CANDIDAT : uniquement sa propre candidature.
   */
  _assertCandidatureOwnership(candidature, currentUser) {
    if (!currentUser) return;
    if (currentUser.role === 'RH' || currentUser.role === 'ADMIN') return;
    const applicantId = candidature.stagiaire_id || candidature.candidat_id;
    if (!applicantId || applicantId !== currentUser.id) {
      throw new ApiError(403, 'Accès refusé : cette candidature ne vous appartient pas.');
    }
  }

  /**
   * Stage créé par la conversion d'une candidature en stagiaire (affichage RH).
   * Ne contient aucune donnée sensible (mot de passe, identifiants mobiles).
   */
  async _shapeStageCreated(candidatureId) {
    const stage = await stageRepository.findByCandidatureId(candidatureId);
    if (!stage) return null;
    return {
      stage_id: stage.id,
      stagiaire_id: stage.stagiaire_id,
      date_debut: this._formatIsoDate(stage.date_debut),
      date_fin: this._formatIsoDate(stage.date_fin),
      statut: stage.statut,
      offre_titre: stage.offre_titre,
      departement_nom: stage.departement_nom,
      encadrant: stage.encadrant_id
        ? { id: stage.encadrant_id, nom: stage.encadrant_nom, prenom: stage.encadrant_prenom }
        : null
    };
  }

  /** Jour (YYYY-MM-DD) précédant une date de début de stage : date d'envoi prévue de l'email d'accès. */
  _minusOneDay(value) {
    if (!value) return null;
    const iso = this._formatIsoDate(value);
    if (!iso) return null;
    const d = new Date(`${iso}T12:00:00Z`);
    if (Number.isNaN(d.getTime())) return null;
    d.setUTCDate(d.getUTCDate() - 1);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }

  /** Fichier CV d'un candidat (examen RH + portail candidat). */
  async getCandidatureCvFile(id, currentUser = null) {
    const row = await candidatureRepository.findDetailsById(id);
    if (!row) throw new ApiError(404, 'Candidature introuvable.');
    this._assertCandidatureOwnership(row, currentUser);
    if (!row.candidat_id || !row.cv_path || !fs.existsSync(row.cv_path)) {
      throw new ApiError(404, 'CV introuvable.');
    }
    return {
      filePath: row.cv_path,
      filename: row.cv_original_name || row.cv_path.split('/').pop()
    };
  }

  async _refuseCandidature(id, candidature) {
    await candidatureRepository.updateStatut(id, 'REFUSEE');
    await notificationService.notifyBestEffort(
      candidature.stagiaire_id,
      'Candidature Refusée',
      `Nous regrettons de vous informer que votre candidature pour l'offre de stage "${candidature.offre_titre}" n'a pas été retenue.`,
      'CANDIDATURE'
    );
    await this._sendApplicantEmail(candidature, (to, data) =>
      emailService.sendApplicationRejectedEmail(to, data)
    );
  }

  async _acceptCandidature(id, candidature) {
    const encadrant = await this._findAvailableEncadrant(candidature.departement_id);
    const { date_debut, date_fin } = this._computeStageDates(this._dureeEnMois(candidature));

    await db.withTransaction(async (client) => {
      await candidatureRepository.updateStatut(id, 'ACCEPTEE', client);
      await candidatureRepository.refuseOtherCandidatures(candidature.stagiaire_id, candidature.offre_id, id, client);
      await stageRepository.createWithProject(
        id, candidature.stagiaire_id, encadrant.id,
        candidature.departement_id, candidature.offre_id,
        date_debut, date_fin, candidature.offre_titre, client
      );
      await offreRepository.decrementPlaces(candidature.offre_id, client);
    });

    await notificationService.notifyBestEffort(
      candidature.stagiaire_id,
      'Candidature Acceptée 🎉',
      `Félicitations ! Votre candidature pour le stage "${candidature.offre_titre}" a été acceptée.`,
      'CANDIDATURE'
    );
    await this._sendApplicantEmail(candidature, (to, data) =>
      emailService.sendInternshipAcceptedEmail(to, {
        ...data,
        dateDebut: date_debut.toLocaleDateString('fr-FR')
      })
    );
  }

  /**
   * Envoi best effort d'un email vers le stagiaire candidat.
   * Un échec d'envoi (ou un profil manquant) ne doit jamais bloquer
   * la mise à jour du statut ni la création du stage.
   */
  async _sendApplicantEmail(candidature, buildEmail) {
    try {
      if (!candidature.stagiaire_id) return;
      const profile = await stagiaireRepository.findById(candidature.stagiaire_id);
      if (!profile || !profile.email) return;
      const nom = [profile.prenom, profile.nom].filter(Boolean).join(' ') || 'candidat';
      await buildEmail(profile.email, { nom, titreOffre: candidature.offre_titre });
    } catch (err) {
      logger.error('Échec de l’envoi de l’email de candidature :', err.message);
    }
  }

  async _findAvailableEncadrant(departementId) {
    const match = await encadrantRepository.findAvailableByDepartment(departementId);
    if (match) return match;
    const fallback = await encadrantRepository.findAnyAvailable();
    if (fallback) return fallback;
    throw new ApiError(400, 'Impossible d\'accepter la candidature : aucun encadrant disponible.');
  }

  /**
   * Période de stage débutant aujourd'hui, pour une durée en MOIS CALENDAIRES.
   * Délègue au module canonique `stage-period.util` (le calcul « semaines × 7 »
   * est obsolète : la durée est exprimée en mois calendaires, pas en semaines).
   * Retourne des Date JS locales (minuit) pour les consommateurs `.toLocaleDateString`.
   */
  _computeStageDates(dureeMois) {
    const period = computeStagePeriodFromToday(dureeMois);
    return {
      date_debut: dateFromIso(period.date_debut),
      date_fin: dateFromIso(period.date_fin)
    };
  }

  /**
   * Durée (mois calendaires) pour la période de stage d'une candidature.
   * La durée autoritaire du modèle moderne est `internship_duration_months`
   * (renseignée par le candidat en préférences de stage). À défaut (voie
   * historique d'acceptation `ACCEPTEE`), on part de la durée de l'offre,
   * exprimée en SEMAINES, convertie en mois (arrondi, min 1 mois).
   */
  _dureeEnMois(candidature) {
    const months = candidature && candidature.internship_duration_months != null
      ? Number(candidature.internship_duration_months)
      : weeksToMonths(candidature && candidature.duree || 12);
    return Number.isFinite(months) && months > 0 ? months : 6;
  }

  /**
   * Planification d'un entretien humain par le RH (après réussite de
   * l'entretien IA). Crée la ligne `human_interviews`, passe la candidature
   * en `EN_ENTRETIEN_HUMAIN` et prévient le candidat (notification + email).
   *
   * Champs requis : date (future), heure de début (HH:MM), durée (minutes),
   * intervieweur (nom + email) et lien de visioconférence (URL http(s)).
   * Le lien est saisi manuellement par le RH (aucune intégration API métier).
   */
  async scheduleHumanInterview(id, payload, userRole) {
    if (userRole !== 'RH' && userRole !== 'ADMIN') {
      throw new ApiError(403, 'Seul un RH ou un Administrateur peut planifier un entretien humain.');
    }

    const candidature = await candidatureRepository.findByIdWithOffer(id);
    if (!candidature) throw new ApiError(404, 'Candidature introuvable.');
    if (!['AI_INTERVIEW_PASSED', 'RH_ACCEPTED'].includes(candidature.statut)) {
      throw new ApiError(400, 'La candidature doit être en AI_INTERVIEW_PASSED ou RH_ACCEPTED pour planifier un entretien humain.');
    }

    const data = this._validateHumanInterviewPayload(payload);

    const existing = await humanInterviewRepository.findByCandidatureId(id);
    if (existing && existing.statut === 'PLANIFIE') {
      throw new ApiError(400, 'Un entretien humain est déjà planifié pour cette candidature.');
    }

    let interview;
    await db.withTransaction(async (client) => {
      await candidatureRepository.updateStatut(id, 'EN_ENTRETIEN_HUMAIN', client);
      interview = existing
        ? await humanInterviewRepository.update(existing.id, data, client)
        : await humanInterviewRepository.create({ candidatureId: id, ...data }, client);
    });

    await this._notifyAndEmailApplicant(candidature, {
      titre: 'Entretien humain planifié',
      message: `Votre entretien humain pour le stage "${candidature.offre_titre}" est planifié le ${this._formatDate(data.date)} à ${data.heure} (${data.duree} min) avec ${data.interviewer}.`,
      emailData: { date: this._formatDate(data.date), heure: data.heure, interviewer: data.interviewer, lienVisio: data.lien_visio },
      buildEmail: (to, data) => emailService.sendHumanInterviewInvitationEmail(to, data)
    });

    return { message: 'Entretien humain planifié.', interview: this._shapeInterview(interview) };
  }

  /**
   * Raccourci DEMO « planifier + envoyer l'email en un clic ».
   * Planifie un entretien humain avec des valeurs par défaut (date = demain,
   * durée 45 min, intervieweur = le RH connecté, lien visio Teams générique)
   * puis envoie l'email d'invitation, sans ouvrir le formulaire.
   */
  async scheduleExpressHumanInterview(id, currentUser) {
    if (!currentUser || (currentUser.role !== 'RH' && currentUser.role !== 'ADMIN')) {
      throw new ApiError(403, 'Seul un RH ou un Administrateur peut planifier un entretien humain.');
    }

    const candidature = await candidatureRepository.findByIdWithOffer(id);
    if (!candidature) throw new ApiError(404, 'Candidature introuvable.');
    if (!['AI_INTERVIEW_PASSED', 'RH_ACCEPTED'].includes(candidature.statut)) {
      throw new ApiError(400, 'La candidature doit être en AI_INTERVIEW_PASSED ou RH_ACCEPTED pour planifier un entretien humain.');
    }

    const profile = await this._loadIntervieweeProfile(currentUser);
    const tomorrow = this._tomorrowInTunis();
    const payload = {
      date: tomorrow,
      heure: '10:00',
      duree: 45,
      interviewer: profile?.nom || 'Service RH STEG',
      interviewer_email: currentUser.email || 'rh@steg.tn',
      lien_visio: process.env.HUMAN_INTERVIEW_DEFAULT_VISIO
        || 'https://teams.microsoft.com/l/meetup-join/meeting/default'
    };

    const result = await this.scheduleHumanInterview(id, payload, currentUser.role);
    return { ...result, express: true };
  }

  /** Profil du RH/Admin connecté (pour préremplir l'intervieweur). */
  async _loadIntervieweeProfile(currentUser) {
    try {
      const result = await db.query(
        'SELECT nom, prenom, email FROM utilisateur WHERE id = $1',
        [currentUser.id]
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        ...row,
        nom: [row.prenom, row.nom].filter(Boolean).join(' ') || row.nom || 'Service RH STEG'
      };
    } catch (err) {
      logger.error('Impossible de charger le profil de l\'intervieweur :', err.message);
      return null;
    }
  }

  /** Date du lendemain au format YYYY-MM-DD (fuseau Africa/Tunis). */
  _tomorrowInTunis() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }));
    now.setDate(now.getDate() + 1);
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * Modification de l'entretien humain planifié par le RH. La candidature
   * reste en `EN_ENTRETIEN_HUMAIN` ; seules les informations de l'entretien
   * sont mises à jour.
   */
  async updateHumanInterview(id, payload, userRole) {
    if (userRole !== 'RH' && userRole !== 'ADMIN') {
      throw new ApiError(403, 'Seul un RH ou un Administrateur peut modifier un entretien humain.');
    }

    const candidature = await candidatureRepository.findByIdWithOffer(id);
    if (!candidature) throw new ApiError(404, 'Candidature introuvable.');
    if (candidature.statut !== 'EN_ENTRETIEN_HUMAIN') {
      throw new ApiError(400, 'Aucun entretien humain planifié à modifier pour cette candidature.');
    }

    const existing = await humanInterviewRepository.findByCandidatureId(id);
    if (!existing || existing.statut !== 'PLANIFIE') {
      throw new ApiError(400, 'Aucun entretien humain planifié à modifier pour cette candidature.');
    }

    const data = this._validateHumanInterviewPayload(payload);
    const interview = await humanInterviewRepository.update(existing.id, data);
    return { message: 'Entretien humain modifié.', interview: this._shapeInterview(interview) };
  }

  /**
   * Annulation de l'entretien humain planifié par le RH. L'entretien passe en
   * `ANNULE` et la candidature redevient `AI_INTERVIEW_PASSED` (le RH peut
   * ensuite en planifier un autre).
   */
  async cancelHumanInterview(id, userRole) {
    if (userRole !== 'RH' && userRole !== 'ADMIN') {
      throw new ApiError(403, 'Seul un RH ou un Administrateur peut annuler un entretien humain.');
    }

    const candidature = await candidatureRepository.findByIdWithOffer(id);
    if (!candidature) throw new ApiError(404, 'Candidature introuvable.');
    if (candidature.statut !== 'EN_ENTRETIEN_HUMAIN') {
      throw new ApiError(400, 'Aucun entretien humain planifié à annuler pour cette candidature.');
    }

    const existing = await humanInterviewRepository.findByCandidatureId(id);
    if (!existing || existing.statut !== 'PLANIFIE') {
      throw new ApiError(400, 'Aucun entretien humain planifié à annuler pour cette candidature.');
    }

    await db.withTransaction(async (client) => {
      await candidatureRepository.updateStatut(id, 'AI_INTERVIEW_PASSED', client);
      await humanInterviewRepository.setStatus(existing.id, 'ANNULE', client);
    });

    return { message: 'Entretien humain annulé.', statut: 'AI_INTERVIEW_PASSED' };
  }

  /**
   * Achèvement de l'entretien humain par le RH : enregistre uniquement que
   * l'entretien a eu lieu (statut HUMAN_INTERVIEW_COMPLETED sur l'entretien
   * et la candidature, avec completed_at / completed_by).
   *
   * AUCUNE décision finale n'est prise ici : le RH reste libre d'accepter ou
   * de refuser le candidat dans l'étape suivante du workflow.
   *
   * Gardes de sécurité :
   *  - réservé au RH / Administrateur (403) ;
   *  - la candidature doit être dans le workflow en cours (EN_ENTRETIEN_HUMAIN) ;
   *  - l'entretien doit être PLANIFIE (un entretien annulé ou déjà complété
   *    ne peut pas être complété, 400).
   */
  async completeHumanInterview(id, currentUser) {
    if (!currentUser || (currentUser.role !== 'RH' && currentUser.role !== 'ADMIN')) {
      throw new ApiError(403, 'Seul un RH ou un Administrateur peut marquer un entretien humain comme terminé.');
    }

    const candidature = await candidatureRepository.findByIdWithOffer(id);
    if (!candidature) throw new ApiError(404, 'Candidature introuvable.');
    if (candidature.statut !== 'EN_ENTRETIEN_HUMAIN') {
      throw new ApiError(400, 'Aucun entretien humain à compléter pour cette candidature.');
    }

    const existing = await humanInterviewRepository.findByCandidatureId(id);
    if (!existing || existing.statut !== 'PLANIFIE') {
      throw new ApiError(400, 'Aucun entretien humain planifié à compléter (annulé ou déjà complété).');
    }

    let interview;
    await db.withTransaction(async (client) => {
      await candidatureRepository.updateStatut(id, 'HUMAN_INTERVIEW_COMPLETED', client);
      interview = await humanInterviewRepository.markCompleted(existing.id, currentUser.id, client);
    });

    return { message: 'Entretien humain complété.', interview: this._shapeInterview(interview) };
  }

  /**
   * Décision finale du RH après l'entretien humain complété.
   *
   * ACCEPTED  → candidature HUMAN_INTERVIEW_ACCEPTED : la candidature est prête
   *             pour la conversion en stagiaire, mais AUCUN stagiaire n'est créé
   *             ici (création du trainee + collecte des documents : étapes
   *             suivantes, hors périmètre).
   * REJECTED  → candidature HUMAN_INTERVIEW_REJECTED + envoi automatique de
   *             l'email de refus existant (sendApplicationRejectedEmail) et
   *             notification du candidat.
   *
   * Sécurité :
   *  - réservé au RH / Administrateur (403) ;
   *  - la candidature doit être en HUMAN_INTERVIEW_COMPLETED (une décision avant
   *    complétion, ou une candidature déjà décidée, renvoie 400) ;
   *  - l'entretien humain doit être HUMAN_INTERVIEW_COMPLETED (un entretien
   *    annulé ou non complété renvoie 400).
   *
   * Audit : chaque décision est enregistrée (décision, RH, horodatage, statut
   * précédent et nouveau) dans candidature_decisions.
   */
  async decideHumanInterview(id, { decision }, currentUser) {
    if (!currentUser || (currentUser.role !== 'RH' && currentUser.role !== 'ADMIN')) {
      throw new ApiError(403, 'Seul un RH ou un Administrateur peut prendre la décision finale après l\'entretien humain.');
    }

    if (decision !== 'ACCEPTED' && decision !== 'REJECTED') {
      throw new ApiError(400, 'La décision doit être ACCEPTED ou REJECTED.');
    }

    const candidature = await candidatureRepository.findByIdWithOffer(id);
    if (!candidature) throw new ApiError(404, 'Candidature introuvable.');
    if (candidature.statut !== 'HUMAN_INTERVIEW_COMPLETED') {
      throw new ApiError(400, 'La décision finale n\'est possible qu\'après un entretien humain complété.');
    }

    const human = await humanInterviewRepository.findByCandidatureId(id);
    if (!human || human.statut !== 'HUMAN_INTERVIEW_COMPLETED') {
      throw new ApiError(400, 'Aucun entretien humain complété pour cette candidature.');
    }

    const newStatus = decision === 'ACCEPTED' ? 'HUMAN_INTERVIEW_ACCEPTED' : 'HUMAN_INTERVIEW_REJECTED';

    await db.withTransaction(async (client) => {
      await candidatureRepository.updateStatut(id, newStatus, client);
      await candidatureRepository.decide(id, { statut: newStatus, decision, decidedBy: currentUser.id }, client);
      await candidatureRepository.insertDecisionAudit(id, {
        decision,
        decidedBy: currentUser.id,
        previousStatus: candidature.statut,
        newStatus
      }, client);
    });

    if (decision === 'REJECTED') {
      await this._notifyAndEmailApplicant(candidature, {
        titre: 'Candidature non retenue',
        message: 'Your application was not selected after the human interview.',
        buildEmail: (to, data) => emailService.sendApplicationRejectedEmail(to, data)
      });
    }

    return {
      id,
      statut: newStatus,
      decision,
      decided_by: currentUser.id,
      decided_at: new Date().toISOString(),
      message: decision === 'ACCEPTED'
        ? 'Candidate accepted after human interview.'
        : 'Candidate rejected after human interview.'
    };
  }

  /** Forme normalisée d'un entretien humain pour la réponse API (date YYYY-MM-DD, heure HH:MM). */
  _shapeInterview(row) {
    if (!row) return null;
    return {
      id: row.id,
      candidature_id: row.candidature_id,
      date: this._formatIsoDate(row.date),
      heure: this._normalizeTime(row.heure),
      duree: row.duree != null ? Number(row.duree) : null,
      interviewer: row.interviewer,
      interviewer_email: row.interviewer_email,
      lien_visio: row.lien_visio,
      statut: row.statut,
      completed_at: row.completed_at || null,
      completed_by: row.completed_by || null,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /**
   * Validation du formulaire de planification d'un entretien humain.
   * Retourne les valeurs normalisées (heure HH:MM, durée entière, emails/URLs
   * nettoyés) ou lève un ApiError(400) décrivant le premier champ invalide.
   */
  _validateHumanInterviewPayload(payload = {}) {
    const { date, heure, duree, interviewer, interviewer_email, lien_visio } = payload;

    if (!date) throw new ApiError(400, 'La date de l\'entretien est requise.');
    if (!heure) throw new ApiError(400, 'L\'heure de début de l\'entretien est requise.');
    if (duree === undefined || duree === null || duree === '') {
      throw new ApiError(400, 'La durée de l\'entretien est requise.');
    }
    if (!interviewer) throw new ApiError(400, 'Le nom de l\'intervieweur est requis.');
    if (!interviewer_email) throw new ApiError(400, 'L\'email de l\'intervieweur est requis.');
    if (!lien_visio) throw new ApiError(400, 'Le lien de visioconférence est requis.');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
      throw new ApiError(400, 'La date de l\'entretien est invalide.');
    }
    if (!this._isFutureDate(date)) {
      throw new ApiError(400, 'La date de l\'entretien doit être dans le futur.');
    }
    if (!this._isValidTime(heure)) {
      throw new ApiError(400, 'L\'heure de début est invalide (format HH:MM).');
    }

    const duration = Number(duree);
    if (!Number.isInteger(duration) || duration <= 0 || duration > 600) {
      throw new ApiError(400, 'La durée de l\'entretien doit être un nombre de minutes entre 1 et 600.');
    }

    const normalizedEmail = String(interviewer_email).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new ApiError(400, 'L\'email de l\'intervieweur est invalide.');
    }

    let url;
    try {
      url = new URL(String(lien_visio));
    } catch {
      throw new ApiError(400, 'Le lien de visioconférence doit être une URL valide.');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new ApiError(400, 'Le lien de visioconférence doit être une URL http(s) valide.');
    }

    return {
      date,
      heure: this._normalizeTime(heure),
      duree: duration,
      interviewer: String(interviewer).trim(),
      interviewer_email: normalizedEmail,
      lien_visio: String(lien_visio).trim()
    };
  }

  /** Une date (YYYY-MM-DD) est-elle strictement postérieure à aujourd'hui (fuseau Africa/Tunis) ? */
  _isFutureDate(date) {
    const d = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }));
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return d.getTime() > today;
  }

  /** Heure valide au format HH:MM (secondes optionnelles acceptées à l'entrée). */
  _isValidTime(value) {
    return /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/.test(String(value));
  }

  /** Normalise l'heure en HH:MM (supprime les secondes éventuelles). */
  _normalizeTime(value) {
    const s = String(value);
    return /^\d{2}:\d{2}:\d{2}$/.test(s) ? s.slice(0, 5) : s;
  }

  /**
   * Décision finale du RH après l'entretien humain : ACCEPTED (acceptation +
   * création du stage et démarrage de la collecte des documents) ou REJECTED.
   */
  async recordHumanInterviewDecision(id, { decision }, currentUser) {
    if (!currentUser || (currentUser.role !== 'RH' && currentUser.role !== 'ADMIN')) {
      throw new ApiError(403, 'Seul un RH ou un Administrateur peut valider la décision d\'un entretien humain.');
    }

    const candidature = await candidatureRepository.findByIdWithOffer(id);
    if (!candidature) throw new ApiError(404, 'Candidature introuvable.');

    if (decision !== 'ACCEPTED' && decision !== 'REJECTED') {
      throw new ApiError(400, 'La décision doit être ACCEPTED ou REJECTED.');
    }

    const { internshipConversionService } = require('./internship-conversion.service');

    if (candidature.statut === 'EN_ENTRETIEN_HUMAIN') {
      await this.completeHumanInterview(id, currentUser);
    }

    const decideResult = await this.decideHumanInterview(id, { decision }, currentUser);

    if (decision === 'ACCEPTED') {
      const conversionResult = await internshipConversionService.convertCandidatureToStagiaire(id, currentUser);
      return {
        statut: 'ACCEPTEE',
        ...conversionResult
      };
    }

    return { statut: 'HUMAN_INTERVIEW_REJECTED', ...decideResult };
  }

  /**
   * ACCEPTATION DIRECTE — raccourci de démonstration (SANS entretien humain).
   *
   * 🔹 Pourquoi : lors de la soutenance / démo, on veut pouvoir accepter
   *    immédiatement un candidat qui a réussi l'entretien IA, sans avoir à
   *    planifier puis conclure l'entretien humain (gain de temps).
   *
   * 🔹 État requis : la candidature doit être `AI_INTERVIEW_PASSED` (entretien
   *    IA réussi, posé par `submitAiInterviewResult`).
   *
   * 🔹 Quoi : réutilise `_finalAcceptance` (méthode existante de l'ancien
   *    workflow, initialement sans appelant) avec `human = null`. Cette méthode
   *    fait : promotion candidat → stagiaire si nécessaire, statut `ACCEPTEE`,
   *    refus des autres candidatures du même stagiaire, création du stage + du
   *    projet initial, décrément des places de l'offre, notification + email au
   *    candidat, puis lancement de la collecte des documents.
   *
   * ⚠️ NB : AUCUNE logique existante n'est modifiée ni supprimée. Ce raccourci
   *    NE remplace PAS le flux officiel (entretien humain → `decision-finale` →
   *    `convertCandidatureToStagiaire`) ; il en est un accès accéléré réservé à
   *    la démonstration, à garder ou retirer après la soutenance.
   */
  async acceptAfterAiInterview(id, currentUser) {
    if (!currentUser || (currentUser.role !== 'RH' && currentUser.role !== 'ADMIN')) {
      throw new ApiError(403, 'Seul un RH ou un Administrateur peut accepter directement une candidature.');
    }

    const candidature = await candidatureRepository.findByIdWithOffer(id);
    if (!candidature) throw new ApiError(404, 'Candidature introuvable.');

    // Garde : on n'autorise le raccourci qu'immédiatement après la réussite de l'entretien IA.
    if (candidature.statut !== 'AI_INTERVIEW_PASSED') {
      throw new ApiError(400, 'L\'acceptation directe n\'est possible qu\'après un entretien IA réussi (statut AI_INTERVIEW_PASSED).');
    }

    // Réutilisation de l'acceptation finale « v1 » (logique inchangée, human = null).
    await this._finalAcceptance(id, candidature, null);

    const stage = await stageRepository.findByCandidatureId(id);
    return {
      statut: 'ACCEPTEE',
      candidature_id: id,
      stage_id: stage ? stage.id : null,
      shortcut: true
    };
  }

  /**
   * Acceptation finale : promeut le candidat (portail) en stagiaire si besoin,
   * met à jour le statut, crée le stage (encadrant, département, offre), refuse
   * les autres candidatures, décrémente les places, puis notifie le candidat et
   * démarre la collecte des documents requis.
   */
  async _finalAcceptance(id, candidature, human) {
    const offre = await offreRepository.findPublicById(candidature.offre_id);
    const capacity = await offreRepository.findById(candidature.offre_id);
    if (!capacity || capacity.statut !== 'OUVERTE' || capacity.nombre_places <= 0) {
      throw new ApiError(400, 'Impossible d\'accepter la candidature : l\'offre de stage est complète ou fermée.');
    }
    const encadrantId = (offre && offre.encadrant_id) || (await this._findAvailableEncadrant(candidature.departement_id)).id;
    const { date_debut, date_fin } = this._computeStageDates(this._dureeEnMois(candidature));

    await db.withTransaction(async (client) => {
      let stagiaireId = candidature.stagiaire_id;
      if (!stagiaireId && candidature.candidat_id) {
        const profile = await candidatRepository.getProfile(candidature.candidat_id);
        if (profile) {
          await candidatRepository.createStagiaire(candidature.candidat_id, profile, client);
          await this._promoteRole(candidature.candidat_id, client);
          stagiaireId = candidature.candidat_id;
        }
      }
      if (!stagiaireId) throw new ApiError(400, 'Impossible d\'accepter la candidature : aucun stagiaire associé.');

      await candidatureRepository.updateStatut(id, 'ACCEPTEE', client);
      await candidatureRepository.updateStagiaire(id, stagiaireId, client);
      await candidatureRepository.refuseOtherCandidatures(stagiaireId, candidature.offre_id, id, client);
      await stageRepository.createWithProject(
        id, stagiaireId, encadrantId,
        candidature.departement_id, candidature.offre_id,
        date_debut, date_fin, candidature.offre_titre, client
      );
      await offreRepository.decrementPlaces(candidature.offre_id, client);
      if (human) await humanInterviewRepository.setStatus(human.id, 'TERMINE', client);
    });

    await this._notifyAndEmailApplicant(candidature, {
      titre: 'Candidature acceptée 🎉',
      message: `Félicitations ! Votre candidature pour le stage "${candidature.offre_titre}" a été acceptée. Votre stage débutera le ${date_debut.toLocaleDateString('fr-FR')}.`,
      emailData: { dateDebut: date_debut.toLocaleDateString('fr-FR') },
      buildEmail: (to, data) => emailService.sendInternshipAcceptedEmail(to, data)
    });

    await this._requestDocuments(candidature, offre, date_debut);
  }

  /** Promotion d'un candidat du portail en stagiaire (même utilisateur). */
  async _promoteRole(userId, client) {
    const q = client || db;
    await q.query("UPDATE utilisateur SET role = 'STAGIAIRE', token_version = token_version + 1 WHERE id = $1", [userId]);
  }

  /** Démarre la collecte des documents requis (email + notification). */
  async _requestDocuments(candidature, offre, dateDebut) {
    const configured = offre && offre.documents_demandes
      ? String(offre.documents_demandes).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
      : [];
    const documents = configured.length
      ? configured
      : [
          'Carte d\'identité nationale (CIN)',
          'Demande de stage / lettre de demande',
          'Lettre d\'affectation (si applicable)'
        ];
    await this._notifyAndEmailApplicant(candidature, {
      titre: 'Documents requis pour votre stage',
      message: `Félicitations pour votre acceptation ! Merci de fournir les documents suivants pour finaliser votre stage "${candidature.offre_titre}" : ${documents.join(', ')}.`,
      emailData: { documents, dateDebut: dateDebut.toLocaleDateString('fr-FR') },
      buildEmail: (to, data) => emailService.sendDocumentsRequestEmail(to, data)
    });
  }

  _formatDate(value) {
    if (!value) return '';
    try {
      return new Date(value).toLocaleDateString('fr-FR');
    } catch {
      return String(value);
    }
  }

  _formatIsoDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  async createCandidature(body, currentUser) {
    let candidature;
    let candidatId = null;
    let stagiaireId = null;

    if (currentUser.role === 'CANDIDAT') {
      candidatId = currentUser.id;
      await this._validateOffre(body.offre_id);
      await this._validateCandidatCandidature(candidatId, body.offre_id);
      candidature = await candidatureRepository.create(null, body.offre_id, candidatId);
    } else {
      const { stagiaire_id, offre_id } = body;
      stagiaireId = currentUser.role === 'STAGIAIRE' ? currentUser.id : stagiaire_id;
      await this._validateCandidature(stagiaireId, offre_id);
      candidature = await candidatureRepository.create(stagiaireId, offre_id);
    }

    await this._sendCandidatureReceivedEmail(candidature, { candidatId, stagiaireId });
    return candidature;
  }

  /**
   * Email de confirmation « candidature bien reçue » + notification RH.
   * Best effort : un échec d'envoi ne doit jamais faire échouer la création.
   */
  async _sendCandidatureReceivedEmail(candidature, { candidatId, stagiaireId }) {
    let nom = null;
    let offreTitre = null;
    try {
      const row = await candidatureRepository.findByIdWithOffer(candidature.id);
      if (!row) return;
      offreTitre = row.offre_titre;
      const profile = candidatId
        ? await candidatRepository.getProfile(candidatId)
        : await stagiaireRepository.findById(stagiaireId);
      if (!profile) return;
      nom = [profile.prenom, profile.nom].filter(Boolean).join(' ') || 'candidat';
      if (profile.email) {
        await emailService.sendCandidatureReceivedEmail(profile.email, { nom, titreOffre: offreTitre });
      }
    } catch (err) {
      logger.error('Échec de l’envoi de l’email de confirmation de candidature :', err.message);
    }
    if (nom) {
      await this._notifyRHNewCandidature(nom, offreTitre, candidature.id);
    }
  }

  /** Notification best effort « Nouvelle candidature » aux utilisateurs RH. */
  async _notifyRHNewCandidature(studentName, offerTitle, candidatureId) {
    try {
      await notificationService.notifyRoleBestEffort(
        'RH',
        'Nouvelle candidature',
        `${studentName} a postulé à l'offre ${offerTitle}`,
        'CANDIDATURE',
        candidatureId ? `/candidatures/${candidatureId}` : null
      );
    } catch (err) {
      logger.error('Échec de la notification RH :', err.message);
    }
  }

  async _validateOffre(offreId) {
    const offre = await offreRepository.findById(offreId);
    if (!offre) throw new ApiError(400, 'L\'offre de stage spécifiée n\'existe pas.');
    if (offre.statut !== 'OUVERTE') throw new ApiError(400, 'Cette offre de stage n\'est pas ouverte aux candidatures.');
    if (offre.nombre_places <= 0) throw new ApiError(400, 'Cette offre n\'a plus de places disponibles.');
  }

  async _validateCandidatCandidature(candidatId, offreId) {
    const isCandidat = await candidatRepository.existsById(candidatId);
    if (!isCandidat) throw new ApiError(400, 'Le candidat n\'existe pas.');

    const exists = await candidatureRepository.findByCandidatAndOffre(candidatId, offreId);
    if (exists) throw new ApiError(409, 'Vous avez déjà postulé à cette offre.');
  }

  async _validateCandidature(stagiaireId, offreId) {
    const isStagiaire = await stagiaireRepository.existsById(stagiaireId);
    if (!isStagiaire) throw new ApiError(400, 'Le candidat doit être un stagiaire.');

    await this._validateOffre(offreId);

    const exists = await candidatureRepository.findByStagiaireAndOffre(stagiaireId, offreId);
    if (exists) throw new ApiError(409, 'Vous avez déjà postulé à cette offre.');
  }

  async deleteCandidature(id) {
    await candidatureRepository.delete(id);
  }
}

module.exports = new CandidatureService();
