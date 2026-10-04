const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const authRepository = require('../repositories/auth.repository');
const db = require('../config/db');
const emailService = require('./email.service');
const ApiError = require('../utils/error.util');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const BCRYPT_ROUNDS = 12;

class AuthService {
  generateToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role, token_version: user.token_version ?? 1 },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  hashToken(rawToken) {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /** Ne renvoie le lien de vérification qu'en développement. */
  _devPayload(link) {
    return process.env.NODE_ENV === 'production' ? {} : { dev: { verificationLink: link } };
  }

  async login(email, password) {
    const user = await authRepository.findUserByEmail(email);
    if (!user) {
      throw new ApiError(401, 'Email ou mot de passe incorrect.');
    }

    const valid = await bcrypt.compare(password, user.mot_de_passe);
    if (!valid) {
      throw new ApiError(401, 'Email ou mot de passe incorrect.');
    }

    if (!user.actif) {
      throw new ApiError(403, 'Compte désactivé.');
    }

    if (user.role === 'CANDIDAT' && !user.email_verifie) {
      throw new ApiError(403, 'Veuillez vérifier votre adresse email avant de vous connecter.');
    }

    const token = this.generateToken(user);

    return {
      message: 'Connexion réussie',
      token,
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        role: user.role
      }
    };
  }

  async getMe(userId) {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new ApiError(404, 'Utilisateur introuvable.');
    }
    return { user };
  }

  /**
   * Inscription d'un candidat (portail public).
   * Le compte est créé avec le rôle CANDIDAT uniquement — jamais
   * un STAGIAIRE. L'email doit être vérifié avant la connexion.
   */
  async register(payload) {
    if (await authRepository.emailExists(payload.email)) {
      throw new ApiError(409, 'Un compte existe déjà avec cet email.');
    }

    const passwordHash = await bcrypt.hash(payload.password, BCRYPT_ROUNDS);
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.withTransaction(async (client) => {
      await authRepository.createCandidat(payload, passwordHash, tokenHash, expiresAt, client);
    });

    const link = await emailService.sendVerificationEmail(payload.email, rawToken);

    // Email de bienvenue (best effort : ne bloque jamais l'inscription).
    try {
      await emailService.sendWelcomeEmail(payload.email, {
        prenom: payload.prenom,
        nom: payload.nom
      });
    } catch (err) {
      // sendEmail ne lève jamais, mais on garde une sécurité supplémentaire.
    }

    return {
      message: 'Compte créé. Vérifiez votre email pour activer votre compte.',
      ...this._devPayload(link)
    };
  }

  async verifyEmail(token) {
    const user = await authRepository.findByVerificationTokenHash(this.hashToken(token));
    if (!user || (user.email_verification_expires_at && user.email_verification_expires_at < new Date())) {
      throw new ApiError(400, 'Lien de vérification invalide ou expiré.');
    }

    await authRepository.confirmEmail(user.id);
    return { message: 'Adresse email vérifiée. Vous pouvez maintenant vous connecter.' };
  }

  async resendVerification(email) {
    const user = await authRepository.findUserByEmail(email);
    if (!user) {
      return { message: 'Si un compte existe avec cet email, un lien de vérification a été envoyé.' };
    }
    if (user.email_verifie) {
      return { message: 'Ce compte est déjà vérifié.' };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    await authRepository.setVerificationToken(
      user.id,
      this.hashToken(rawToken),
      new Date(Date.now() + 24 * 60 * 60 * 1000)
    );
    const link = await emailService.sendVerificationEmail(user.email, rawToken);

    return {
      message: 'Un nouveau lien de vérification a été envoyé.',
      ...this._devPayload(link)
    };
  }

  async forgotPassword(email) {
    const user = await authRepository.findUserByEmail(email);
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      await authRepository.setResetToken(
        user.id,
        this.hashToken(rawToken),
        new Date(Date.now() + 60 * 60 * 1000)
      );
      const link = await emailService.sendPasswordResetEmail(user.email, rawToken);
      return {
        message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.',
        ...this._devPayload(link)
      };
    }

    return { message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.' };
  }

  async resetPassword(token, newPassword) {
    const user = await authRepository.findByResetTokenHash(this.hashToken(token));
    if (!user || (user.reset_token_expires_at && user.reset_token_expires_at < new Date())) {
      throw new ApiError(400, 'Lien de réinitialisation invalide ou expiré.');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await authRepository.resetPassword(user.id, passwordHash);
    return { message: 'Mot de passe réinitialisé avec succès.' };
  }

  async updateProfile(userId, fields) {
    const allowed = {};
    if (fields.nom !== undefined) allowed.nom = fields.nom;
    if (fields.prenom !== undefined) allowed.prenom = fields.prenom;
    if (fields.telephone !== undefined) allowed.telephone = fields.telephone;
    if (fields.adresse !== undefined) allowed.adresse = fields.adresse;

    if (Object.keys(allowed).length === 0) {
      throw new ApiError(400, 'Aucun champ à modifier.');
    }

    await authRepository.updateProfile(userId, allowed);
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new ApiError(404, 'Utilisateur introuvable.');
    }
    return { message: 'Profil mis à jour avec succès.', user };
  }

  async changePassword(userId, currentPassword, newPassword) {
    if (currentPassword === newPassword) {
      throw new ApiError(400, 'Le nouveau mot de passe doit être différent de l\'actuel.');
    }

    const currentHash = await authRepository.getPasswordHash(userId);
    if (!currentHash) {
      throw new ApiError(404, 'Utilisateur introuvable.');
    }

    const valid = await bcrypt.compare(currentPassword, currentHash);
    if (!valid) {
      throw new ApiError(401, 'Le mot de passe actuel est incorrect.');
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await authRepository.changePassword(userId, newHash);
    return { message: 'Mot de passe modifié avec succès. Veuillez vous reconnecter.' };
  }
}

module.exports = new AuthService();
