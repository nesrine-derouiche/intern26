const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const multer = require('multer');
const authRepository = require('../repositories/auth.repository');
const candidatRepository = require('../repositories/candidat.repository');
const emailService = require('./email.service');
const cvAnalysisService = require('./cv-analysis.service');
const { UPLOAD_DIR } = require('../config/uploads');
const ApiError = require('../utils/error.util');

const BCRYPT_ROUNDS = 12;

const CANDIDAT_UPLOAD_DIR = path.join(UPLOAD_DIR, 'candidats');
if (!fs.existsSync(CANDIDAT_UPLOAD_DIR)) fs.mkdirSync(CANDIDAT_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CANDIDAT_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${req.user.id}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const photoUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      return cb(new Error('Extension non autorisée. Seuls PNG, JPG, JPEG, WEBP sont acceptés.'));
    }
    cb(null, true);
  }
});

const cvUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf') {
      return cb(new Error('Seuls les fichiers PDF sont acceptés pour le CV.'));
    }
    cb(null, true);
  }
});

const toList = (value) => (value ? value.split(',').map((s) => s.trim()).filter(Boolean) : []);

const toCsv = (value) => (Array.isArray(value) ? value.join(', ') : value || null);

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

class CandidatService {
  getPhotoMiddleware() {
    return photoUpload.single('photo');
  }

  getCvMiddleware() {
    return cvUpload.single('cv');
  }

  _removeFile(filePath) {
    try {
      if (filePath) fs.unlinkSync(filePath);
    } catch (e) {
      /* fichier déjà absent */
    }
  }

  _devPayload(link) {
    return process.env.NODE_ENV === 'production' ? {} : { dev: { verificationLink: link } };
  }

  async getMe(userId) {
    const profile = await candidatRepository.getProfile(userId);
    if (!profile) throw new ApiError(404, 'Profil candidat introuvable.');
    return { candidat: { ...this._mapProfile(profile), cv: await this._mapCv(profile, userId) } };
  }

  _mapProfile(row) {
    return {
      id: row.id,
      nom: row.nom,
      prenom: row.prenom,
      email: row.email,
      telephone: row.telephone,
      adresse: row.adresse,
      emailVerifie: row.email_verifie,
      universite: row.universite,
      specialite: row.specialite,
      niveau: row.niveau,
      competences: toList(row.competences),
      langues: toList(row.langues),
      github: row.github,
      linkedin: row.linkedin,
      portfolio: row.portfolio,
      photo: row.photo_path ? { filename: path.basename(row.photo_path) } : null,
      createdAt: row.created_at
    };
  }

  /** Informations du CV du candidat (métadonnées + état d'analyse IA). */
  async _mapCv(row, userId) {
    if (!row.cv_path) return null;
    const analysis = await cvAnalysisService.getStatus(userId);
    return {
      filename: path.basename(row.cv_path),
      originalName: row.cv_original_name || path.basename(row.cv_path),
      size: row.cv_size != null ? Number(row.cv_size) : null,
      uploadedAt: row.cv_uploaded_at || null,
      analysis: analysis ? { statut: analysis.statut, aiProvider: analysis.ai_provider } : null
    };
  }

  async updateMe(userId, payload) {
    const current = await candidatRepository.getProfile(userId);
    if (!current) throw new ApiError(404, 'Profil candidat introuvable.');

    let emailChanged = false;
    let devPayload = {};

    if (payload.email) {
      const newEmail = payload.email.toLowerCase();
      if (newEmail !== current.email.toLowerCase()) {
        if (await authRepository.emailExists(newEmail)) {
          throw new ApiError(409, 'Un compte existe déjà avec cet email.');
        }
        const rawToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await authRepository.updateIdentity(userId, payload, hashToken(rawToken), expiresAt);
        const link = await emailService.sendVerificationEmail(newEmail, rawToken);
        emailChanged = true;
        devPayload = this._devPayload(link);
      } else {
        await authRepository.updateIdentity(userId, { ...payload, email: undefined }, null, null);
      }
    } else {
      await authRepository.updateIdentity(userId, payload, null, null);
    }

    await candidatRepository.updateProfile(userId, {
      universite: payload.universite,
      specialite: payload.specialite,
      niveau: payload.niveau,
      competences: toCsv(payload.competences),
      langues: toCsv(payload.langues),
      github: payload.github,
      linkedin: payload.linkedin,
      portfolio: payload.portfolio
    });

    return {
      message: 'Profil mis à jour avec succès.',
      emailChanged,
      ...devPayload
    };
  }

  async changePassword(userId, currentPassword, newPassword) {
    const currentHash = await authRepository.getPasswordHash(userId);
    if (!currentHash) {
      throw new ApiError(404, 'Compte introuvable.');
    }

    const valid = await bcrypt.compare(currentPassword, currentHash);
    if (!valid) {
      throw new ApiError(400, 'Le mot de passe actuel est incorrect.');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await authRepository.changePassword(userId, passwordHash);
    return { message: 'Mot de passe modifié avec succès.' };
  }

  async uploadPhoto(req) {
    if (!req.file) throw new ApiError(400, 'Aucune photo fournie.');

    const current = await candidatRepository.getProfile(req.user.id);
    if (current && current.photo_path && current.photo_path !== req.file.path) {
      this._removeFile(current.photo_path);
    }

    await candidatRepository.setPhotoPath(req.user.id, req.file.path);
    return { photo: { filename: req.file.filename } };
  }

  async uploadCv(req) {
    if (!req.file) throw new ApiError(400, 'Aucun fichier CV fourni.');

    this._assertPdfContent(req.file.path);

    const current = await candidatRepository.getProfile(req.user.id);
    if (current && current.cv_path && current.cv_path !== req.file.path) {
      this._removeFile(current.cv_path);
    }

    const size = fs.statSync(req.file.path).size;
    await candidatRepository.setCvInfo(req.user.id, req.file.path, req.file.originalname, size);
    await cvAnalysisService.register(req.user.id, req.file.filename);

    const cv = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size,
      uploadedAt: new Date().toISOString(),
      analysis: { statut: 'EN_ATTENTE', aiProvider: null }
    };
    return { cv };
  }

  /**
   * Vérifie que le fichier est réellement un PDF (en-tête "%PDF-"),
   * indépendamment de son extension. Supprime le fichier rejeté.
   */
  _assertPdfContent(filePath) {
    let fd;
    try {
      fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(5);
      const read = fs.readSync(fd, buffer, 0, 5, 0);
      fs.closeSync(fd);
      fd = null;
      if (read < 5 || buffer.toString('latin1') !== '%PDF-') {
        this._removeFile(filePath);
        throw new ApiError(400, 'Seuls les fichiers PDF sont acceptés pour le CV.');
      }
    } catch (error) {
      if (fd) fs.closeSync(fd);
      if (error instanceof ApiError) throw error;
      throw new ApiError(400, 'Fichier CV illisible.');
    }
  }

  async deleteCv(userId) {
    const current = await candidatRepository.getProfile(userId);
    if (current && current.cv_path) {
      this._removeFile(current.cv_path);
      await candidatRepository.clearCv(userId);
    }
    await cvAnalysisService.clear(userId);
    return { message: 'CV supprimé.' };
  }

  async getCvInfo(userId) {
    const profile = await candidatRepository.getProfile(userId);
    if (!profile) throw new ApiError(404, 'Profil candidat introuvable.');
    return { cv: await this._mapCv(profile, userId) };
  }

  async getPhotoFile(userId) {
    const profile = await candidatRepository.getProfile(userId);
    if (!profile || !profile.photo_path || !fs.existsSync(profile.photo_path)) {
      throw new ApiError(404, 'Photo introuvable.');
    }
    return { filePath: profile.photo_path, filename: path.basename(profile.photo_path) };
  }

  async getCvFile(userId) {
    const profile = await candidatRepository.getProfile(userId);
    if (!profile || !profile.cv_path || !fs.existsSync(profile.cv_path)) {
      throw new ApiError(404, 'CV introuvable.');
    }
    return { filePath: profile.cv_path, filename: path.basename(profile.cv_path) };
  }
}

module.exports = new CandidatService();
