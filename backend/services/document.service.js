const path = require('path');
const fs = require('fs');
const multer = require('multer');
const documentRepository = require('../repositories/document.repository');
const stageRepository = require('../repositories/stage.repository');
const notificationService = require('./notification.service');
const { buildPaginatedResult } = require('../utils/pagination.util');
const { UPLOAD_DIR } = require('../config/uploads');
const { validate } = require('../validators');
const logger = require('../utils/logger');
const ApiError = require('../utils/error.util');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const allowedExtensions = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return cb(new Error('Extension non autorisée. Seuls PDF, DOC, DOCX, PNG, JPG, JPEG sont acceptés.'));
    }
    cb(null, true);
  }
});

function removeFile(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (e) {}
}

class DocumentService {
  getUploadMiddleware() {
    return upload.single('file');
  }

  /**
   * Middleware d'upload avec traduction des erreurs multer en 400
   * « user-friendly » (extension non autorisée, fichier trop volumineux).
   * Partage la même configuration que `getUploadMiddleware`.
   */
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

  /**
   * Exécute la validation (express-validator) puis supprime le fichier déjà
   * écrit sur disque lorsque la validation a échoué (réponse déjà envoyée).
   */
  validateUpload(req, res, next) {
    validate(req, res, next);
    if (res.headersSent && req.file && req.file.filename) {
      removeFile(path.join(UPLOAD_DIR, req.file.filename));
    }
  }

  async uploadDocument(req, stageId) {
    if (!req.file) throw new ApiError(400, 'Aucun fichier fourni.');

    const { type } = req.body;

    const stageOwner = await stageRepository.findParticipants(stageId);
    if (!stageOwner) {
      this._removeFile(req.file.path);
      throw new ApiError(404, 'Stage introuvable.');
    }

    const { stagiaire_id, encadrant_id } = stageOwner;

    let document;
    try {
      document = await documentRepository.create(stagiaire_id, stageId, type, req.file.originalname, req.file.filename);
    } catch (err) {
      this._removeFile(req.file.path);
      throw err;
    }

    const notifyUserId = req.user.id === stagiaire_id ? encadrant_id : stagiaire_id;
    await notificationService.notifyBestEffort(
      notifyUserId,
      'Nouveau document déposé 📄',
      `Le document "${req.file.originalname}" (${type}) a été mis en ligne.`,
      'DOCUMENT'
    );

    return document;
  }

  _removeFile(filePath) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {}
  }

  async getDocumentsByStage(stageId, options = null) {
    const rows = await documentRepository.findByStageId(stageId, options);
    if (options && options.enabled) return buildPaginatedResult(rows.data, rows.total, options.page, options.limit);
    return rows;
  }

  async downloadDocument(id) {
    const doc = await this._getDocumentOrThrow(id);
    const filePath = path.join(UPLOAD_DIR, doc.chemin);
    if (!fs.existsSync(filePath)) throw new ApiError(404, 'Fichier physique introuvable.');
    return { filePath, nom: doc.nom };
  }

  async previewDocument(id) {
    const doc = await this._getDocumentOrThrow(id);
    const filePath = path.join(UPLOAD_DIR, doc.chemin);
    if (!fs.existsSync(filePath)) throw new ApiError(404, 'Fichier physique introuvable.');
    return { filePath, nom: doc.nom, contentType: this._getContentType(doc.nom) };
  }

  async deleteDocument(id) {
    const doc = await this._getDocumentOrThrow(id);
    await documentRepository.delete(id);
    try {
      const filePath = path.join(UPLOAD_DIR, doc.chemin);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (fsErr) {
      logger.error('Erreur de suppression du fichier physique:', fsErr);
    }
  }

  async _getDocumentOrThrow(id) {
    const doc = await documentRepository.findById(id);
    if (!doc) throw new ApiError(404, 'Document introuvable.');
    return doc;
  }

  _getContentType(nom) {
    const ext = path.extname(nom).toLowerCase();
    if (ext === '.pdf') return 'application/pdf';
    if (['.jpg', '.jpeg'].includes(ext)) return 'image/jpeg';
    if (ext === '.png') return 'image/png';
    return 'application/octet-stream';
  }
}

module.exports = new DocumentService();
