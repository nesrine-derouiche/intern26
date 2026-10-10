const path = require('path');
const fs = require('fs');
const multer = require('multer');
const certificationRepository = require('../repositories/certification.repository');
const stageRepository = require('../repositories/stage.repository');
const documentGenerationService = require('./document-generation.service');
const pdfService = require('./pdf.service');
const notificationService = require('./notification.service');
const { UPLOAD_DIR } = require('../config/uploads');
const ApiError = require('../utils/error.util');
const logger = require('../utils/logger');

/**
 * P2-TASK6 — Certification de fin de stage (journal + rapport PDF).
 *
 * Machine à états : NOT_SUBMITTED → SUBMITTED → REDO_REQUESTED / DENIED /
 * VALIDATED (→ CERTIFICATE_GENERATED, produit par l'étape certificat à
 * venir, hors périmètre). Chaque transition est historisée
 * (certification_decision) ; chaque dépôt insère une nouvelle version
 * (jamais d'écrasement) : resoumission = nouvel état + nouvel historique.
 *
 * Upload sécurisé : PDFs uniquement (extension + MIME + signature magique
 * %PDF- lue sur disque, rejet des fichiers vides), 10 Mo max (limite
 * existante explicite), nom serveur unique en .pdf (aucune entrée client
 * dans le chemin), stockage privé UPLOAD_DIR, diffusion uniquement via
 * les endpoints autorisés (jamais de chemin exposé en réponse).
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);
const KINDS = ['JOURNAL', 'RAPPORT'];

const VALID_TRANSITIONS = {
  NOT_SUBMITTED: ['SUBMITTED'],
  SUBMITTED: ['REDO_REQUESTED', 'DENIED', 'VALIDATED'],
  REDO_REQUESTED: ['SUBMITTED'],
  DENIED: ['SUBMITTED'],
  VALIDATED: [],
  CERTIFICATE_GENERATED: []
};

const UPLOADABLE_STATUSES = ['NOT_SUBMITTED', 'REDO_REQUESTED', 'DENIED'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}.pdf`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf') {
      return cb(new Error('Seuls les fichiers PDF sont acceptés.'));
    }
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Type MIME invalide : application/pdf attendu.'));
    }
    cb(null, true);
  }
});

function removeFile(filePath) {
  try {
    if (filePath) fs.unlinkSync(filePath);
  } catch (e) {}
}

function mapDatabaseError(err) {
  switch (err && err.code) {
    case '22P02':
      return new ApiError(404, 'Certification introuvable.');
    case '23503':
      return new ApiError(422, 'Référence invalide.');
    case '23502':
      return new ApiError(400, 'Un champ obligatoire est manquant.');
    default:
      logger.error('[CERTIFICATION] Erreur base de données :', err && err.code, err && err.message);
      return new ApiError(500, 'Opération impossible sur la certification.');
  }
}

async function execute(operation) {
  try {
    return await operation();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw mapDatabaseError(err);
  }
}

class CertificationService {
  getUploadMiddleware() {
    return upload.single('file');
  }

  uploadMiddleware(req, res, next) {
    upload.single('file')(req, res, (err) => {
      if (!err) return next();
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Fichier trop volumineux. Taille maximale : 10 Mo.'
          : err.message;
      removeFile(req.file && req.file.path);
      return res.status(400).json({ success: false, message });
    });
  }

  _assertValidTransition(from, to) {
    const allowed = VALID_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      throw new ApiError(422, `Transition impossible : ${from} → ${to}.`);
    }
  }

  _assertKind(kind) {
    if (!KINDS.includes(kind)) {
      throw new ApiError(400, 'Type de document invalide. Valeurs : JOURNAL, RAPPORT.');
    }
  }

  _assertReviewer(stage, user) {
    if (!user || user.role !== 'ENCADRANT' || stage.encadrant_id !== user.id) {
      throw new ApiError(403, 'Seul l\'encadrant assigné à ce stage peut relire ce dossier.');
    }
  }

  _assertOwner(stage, user) {
    if (!user || user.role !== 'STAGIAIRE' || stage.stagiaire_id !== user.id) {
      throw new ApiError(403, 'Seul le stagiaire de ce stage peut soumettre ce dossier.');
    }
  }

  /**
   * Validation réelle du contenu : signature magique %PDF- en tête de
   * fichier + fichier non vide. Le fichier est supprimé en cas d'échec.
   */
  _assertValidPdf(file) {
    if (!file) throw new ApiError(400, 'Aucun fichier fourni.');
    try {
      const stats = fs.statSync(file.path);
      if (stats.size === 0) {
        throw new ApiError(400, 'Fichier vide rejeté.');
      }
      const fd = fs.openSync(file.path, 'r');
      try {
        const header = Buffer.alloc(PDF_MAGIC.length);
        fs.readSync(fd, header, 0, PDF_MAGIC.length, 0);
        if (!header.equals(PDF_MAGIC)) {
          throw new ApiError(400, 'Contenu invalide : signature PDF absente.');
        }
      } finally {
        fs.closeSync(fd);
      }
    } catch (err) {
      removeFile(file.path);
      if (err instanceof ApiError) throw err;
      throw new ApiError(400, 'Fichier illisible.');
    }
  }

  _publicDocument(doc) {
    if (!doc) return null;
    const { chemin, ...rest } = doc;
    return rest;
  }

  async _buildState(certification) {
    if (!certification) {
      return {
        certification: null,
        statut: 'NOT_SUBMITTED',
        documents: { JOURNAL: null, RAPPORT: null },
        versions: [],
        decisions: []
      };
    }
    const documents = await execute(() =>
      certificationRepository.findDocuments(certification.id)
    );
    const decisions = await execute(() =>
      certificationRepository.findDecisions(certification.id)
    );
    const latest = { JOURNAL: null, RAPPORT: null };
    for (const doc of documents) {
      if (!latest[doc.kind] || doc.version > latest[doc.kind].version) {
        latest[doc.kind] = doc;
      }
    }
    return {
      certification: {
        id: certification.id,
        stage_id: certification.stage_id,
        statut: certification.statut,
        reviewer_id: certification.reviewer_id,
        reason: certification.reason,
        document_concerne: certification.document_concerne,
        submitted_at: certification.submitted_at,
        decided_at: certification.decided_at,
        has_attestation: !!certification.attestation_chemin,
        attestation_nom: certification.attestation_chemin
          ? path.basename(certification.attestation_chemin)
          : null
      },
      statut: certification.statut,
      documents: {
        JOURNAL: this._publicDocument(latest.JOURNAL),
        RAPPORT: this._publicDocument(latest.RAPPORT)
      },
      versions: documents.map((doc) => this._publicDocument(doc)),
      decisions
    };
  }

  async getState(stage, user) {
    const certification = await execute(() =>
      certificationRepository.findByStageId(stage.id)
    );
    return this._buildState(certification);
  }

  async uploadDocument(stage, user, kind, file, originalName) {
    this._assertOwner(stage, user);
    this._assertKind(kind);
    this._assertValidPdf(file);

    let certification = await execute(() =>
      certificationRepository.findByStageId(stage.id)
    );
    if (!certification) {
      certification = await execute(() =>
        certificationRepository.createCertification(stage.id, user.id)
      );
    }
    if (!UPLOADABLE_STATUSES.includes(certification.statut)) {
      removeFile(file.path);
      throw new ApiError(422, `Dépôt impossible au statut « ${certification.statut} ».`);
    }

    const version = await execute(() =>
      certificationRepository.nextVersion(certification.id, kind)
    );
    const doc = await execute(() =>
      certificationRepository.createDocument({
        certification_id: certification.id,
        kind,
        version,
        nom: originalName || file.originalname,
        chemin: file.filename,
        taille: file.size
      })
    );
    return this._publicDocument(doc);
  }

  async submit(stage, user) {
    this._assertOwner(stage, user);
    const certification = await execute(() =>
      certificationRepository.findByStageId(stage.id)
    );
    if (!certification) {
      throw new ApiError(422, 'Aucun document déposé : dépôt requis avant soumission.');
    }
    this._assertValidTransition(certification.statut, 'SUBMITTED');

    const documents = await execute(() =>
      certificationRepository.findDocuments(certification.id)
    );
    const kinds = new Set(documents.map((doc) => doc.kind));
    if (!kinds.has('JOURNAL') || !kinds.has('RAPPORT')) {
      throw new ApiError(422, 'Dossier incomplet : journal et rapport requis.');
    }

    const now = new Date();
    const updated = await execute(() =>
      certificationRepository.updateCertification(certification.id, {
        statut: 'SUBMITTED',
        reviewer_id: null,
        reason: null,
        document_concerne: null,
        submitted_at: now,
        decided_at: null
      })
    );
    await execute(() =>
      certificationRepository.logDecision({
        certification_id: certification.id,
        from_statut: certification.statut,
        to_statut: 'SUBMITTED',
        reviewer_id: user.id,
        reason: null,
        document_concerne: null
      })
    );
    await notificationService.notifyBestEffort(
      stage.encadrant_id,
      'Dossier de certification soumis 📋',
      'Un stagiaire a soumis son dossier de certification pour relecture.',
      'CERTIFICATION'
    );
    return updated;
  }

  async _review(stage, user, to, { reason = null, document_concerne = null } = {}) {
    this._assertReviewer(stage, user);
    const certification = await execute(() =>
      certificationRepository.findByStageId(stage.id)
    );
    if (!certification) {
      throw new ApiError(422, 'Aucun dossier soumis pour ce stage.');
    }
    this._assertValidTransition(certification.statut, to);

    if (to === 'VALIDATED') {
      const documents = await execute(() =>
        certificationRepository.findDocuments(certification.id)
      );
      const kinds = new Set(documents.map((doc) => doc.kind));
      if (!kinds.has('JOURNAL') || !kinds.has('RAPPORT')) {
        throw new ApiError(422, 'Validation impossible : journal et rapport requis.');
      }
    }
    if ((to === 'DENIED' || to === 'REDO_REQUESTED') && (!reason || !String(reason).trim())) {
      throw new ApiError(400, 'Un motif est requis pour cette décision.');
    }
    if (document_concerne !== null && document_concerne !== undefined && !KINDS.includes(document_concerne)) {
      throw new ApiError(400, 'Document concerné invalide. Valeurs : JOURNAL, RAPPORT.');
    }

    const now = new Date();
    const updated = await execute(() =>
      certificationRepository.updateCertification(certification.id, {
        statut: to,
        reviewer_id: user.id,
        reason: reason ? String(reason).trim() : null,
        document_concerne: document_concerne || null,
        decided_at: now
      })
    );
    await execute(() =>
      certificationRepository.logDecision({
        certification_id: certification.id,
        from_statut: certification.statut,
        to_statut: to,
        reviewer_id: user.id,
        reason: reason ? String(reason).trim() : null,
        document_concerne: document_concerne || null
      })
    );
    const labels = { VALIDATED: 'validé', DENIED: 'refusé', REDO_REQUESTED: 'à reprendre' };
    await notificationService.notifyBestEffort(
      stage.stagiaire_id,
      'Certification : dossier ' + (labels[to] || to),
      reason
        ? `Décision sur votre dossier : ${String(reason).trim()}`
        : 'Une décision a été prise sur votre dossier de certification.',
      'CERTIFICATION'
    );
    return updated;
  }

  async validate(stage, user) {
    return this._review(stage, user, 'VALIDATED');
  }

  async deny(stage, user, reason) {
    return this._review(stage, user, 'DENIED', { reason });
  }

  async requestRedo(stage, user, reason, documentConcerne) {
    return this._review(stage, user, 'REDO_REQUESTED', { reason, document_concerne: documentConcerne });
  }

  async downloadDocument(stage, user, docId) {
    const certification = await execute(() =>
      certificationRepository.findByStageId(stage.id)
    );
    if (!certification) throw new ApiError(404, 'Document introuvable.');
    const doc = await execute(() =>
      certificationRepository.findDocumentById(docId)
    );
    if (!doc || doc.certification_id !== certification.id) {
      throw new ApiError(404, 'Document introuvable.');
    }
    const filePath = path.join(UPLOAD_DIR, doc.chemin);
    if (!fs.existsSync(filePath)) throw new ApiError(404, 'Fichier physique introuvable.');
    return { filePath, nom: doc.nom };
  }

  /**
   * P2-TASK8 — Liste paginée des dossiers pour la table de suivi.
   * Périmètre : ENCADRANT = stages assignés, STAGIAIRE = stage propre,
   * CHEF_DEPARTEMENT = département, ADMIN/RH = tout, CANDIDAT = 403.
   */
  async listCertifications(user, scope, filters = {}) {
    if (!user) throw new ApiError(401, 'Authentification requise.');
    let whereClause = '';
    let params = [];
    if (user.role === 'ENCADRANT') {
      whereClause = 's.encadrant_id = $1';
      params = [user.id];
    } else if (user.role === 'STAGIAIRE') {
      whereClause = 's.stagiaire_id = $1';
      params = [user.id];
    } else if (user.role === 'CHEF_DEPARTEMENT') {
      if (!scope || !scope.departementId) {
        throw new ApiError(403, 'Aucun département n\'est associé à votre compte.');
      }
      whereClause = 's.departement_id = $1';
      params = [scope.departementId];
    } else if (user.role === 'ADMIN' || user.role === 'RH') {
      whereClause = '';
      params = [];
    } else {
      throw new ApiError(403, 'Accès refusé.');
    }

    const { search, statut, page, limit } = filters || {};
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offsetNum = (pageNum - 1) * limitNum;
    const { rows, total } = await execute(() =>
      certificationRepository.listCertifications({
        whereClause,
        params,
        search: typeof search === 'string' && search.trim() ? search.trim() : undefined,
        statut: typeof statut === 'string' && statut ? statut : undefined,
        limit: limitNum,
        offset: offsetNum
      })
    );
    const data = rows.map((row) => ({
      stage_id: row.stage_id,
      stagiaire_nom: row.stagiaire_nom,
      stagiaire_prenom: row.stagiaire_prenom,
      departement_nom: row.departement_nom,
      date_debut: row.date_debut,
      date_fin: row.date_fin,
      statut: row.statut || 'NOT_SUBMITTED',
      submitted_at: row.submitted_at || null,
      reason: row.reason || null,
      document_concerne: row.document_concerne || null,
      has_attestation: !!row.attestation_chemin,
      journal: row.journal_present
        ? { present: true, version: row.journal_version }
        : { present: false, version: null },
      rapport: row.rapport_present
        ? { present: true, version: row.rapport_version }
        : { present: false, version: null }
    }));
    return {
      data,
      total,
      page: pageNum,
      pages: Math.max(Math.ceil(total / limitNum), 1)
    };
  }

  /**
   * P2-TASK8 — Génération de l'attestation après validation.
   *
   * Réutilise exactement le pipeline servi par GET /pdf/attestation :
   * template actif → contenu rendu → pdfkit, sinon gabarit historique.
   * Idempotente : si CERTIFICATE_GENERATED, renvoie l'existant sans
   * nouveau fichier ni décision. La bascule est atomique
   * (WHERE statut = 'VALIDATED') contre les générations concurrentes.
   */
  async generateAttestation(stage, user) {
    this._assertReviewer(stage, user);
    const certification = await execute(() =>
      certificationRepository.findByStageId(stage.id)
    );
    if (!certification) {
      throw new ApiError(422, 'Aucun dossier pour ce stage.');
    }
    if (certification.statut === 'CERTIFICATE_GENERATED') {
      return this._attestationInfo(certification, stage);
    }
    if (certification.statut !== 'VALIDATED') {
      throw new ApiError(422, 'Génération possible uniquement après validation.');
    }

    let buffer;
    let templateInfo = null;
    try {
      const prepared = await documentGenerationService.generate({
        stageId: stage.id,
        type: 'ATTESTATION'
      });
      if (prepared.generated) {
        buffer = await pdfService.renderTextToPdfBuffer(prepared.rendered);
        templateInfo = {
          template_id: prepared.template_id,
          template_version: prepared.template_version
        };
      } else {
        buffer = await pdfService.generateAttestationBuffer(stage.id);
      }
    } catch (err) {
      logger.error('[CERTIFICATION] Génération PDF :', err && err.message);
      throw new ApiError(500, 'Génération de l\'attestation impossible.');
    }
    if (!buffer || buffer.length === 0) {
      throw new ApiError(500, 'Génération de l\'attestation impossible.');
    }

    const filename = `attestation-${stage.id}-${Date.now()}.pdf`;
    const filePath = path.join(UPLOAD_DIR, filename);
    try {
      fs.writeFileSync(filePath, buffer);
      const stats = fs.statSync(filePath);
      if (stats.size === 0) throw new Error('Fichier vide.');
    } catch (err) {
      removeFile(filePath);
      logger.error('[CERTIFICATION] Écriture PDF :', err && err.message);
      throw new ApiError(500, 'Génération de l\'attestation impossible.');
    }

    const marked = await execute(() =>
      certificationRepository.markAttestationGenerated(certification.id, filename)
    );
    if (!marked) {
      removeFile(filePath);
      const current = await execute(() =>
        certificationRepository.findByStageId(stage.id)
      );
      return this._attestationInfo(current, stage);
    }

    await execute(() =>
      certificationRepository.logDecision({
        certification_id: certification.id,
        from_statut: 'VALIDATED',
        to_statut: 'CERTIFICATE_GENERATED',
        reviewer_id: user.id,
        reason: null,
        document_concerne: null
      })
    );
    await notificationService.notifyBestEffort(
      stage.stagiaire_id,
      'Attestation générée 🎓',
      'Votre attestation de stage est disponible.',
      'CERTIFICATION'
    );
    return {
      ...(await this._attestationInfo(marked, stage)),
      template: templateInfo
    };
  }

  async _attestationInfo(certification, stage) {
    let taille = null;
    if (certification && certification.attestation_chemin) {
      try {
        taille = fs.statSync(path.join(UPLOAD_DIR, certification.attestation_chemin)).size;
      } catch (err) {
        taille = null;
      }
    }
    const pdfData = await execute(() => stageRepository.findPdfData(stage.id));
    const prenom = pdfData ? pdfData.stagiaire_prenom : 'stage';
    const nom = pdfData ? pdfData.stagiaire_nom : '';
    return {
      statut: certification ? certification.statut : 'NOT_SUBMITTED',
      generated: !!(certification && certification.attestation_chemin),
      nom: `attestation_stage_${nom}_${prenom}.pdf`,
      taille
    };
  }

  async downloadAttestation(stage, user) {
    const certification = await execute(() =>
      certificationRepository.findByStageId(stage.id)
    );
    if (!certification || !certification.attestation_chemin) {
      throw new ApiError(404, 'Attestation introuvable.');
    }
    const filePath = path.join(UPLOAD_DIR, certification.attestation_chemin);
    if (!fs.existsSync(filePath)) throw new ApiError(404, 'Fichier physique introuvable.');
    const info = await this._attestationInfo(certification, stage);
    return { filePath, nom: info.nom };
  }
}

module.exports = new CertificationService();
