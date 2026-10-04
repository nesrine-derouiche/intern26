const pool = require('../config/db');

const toCsv = (value) => (Array.isArray(value) ? value.join(', ') : value || null);

class AuthRepository {
  async findUserByEmail(email) {
    const result = await pool.query(
      `SELECT id, nom, prenom, email, telephone, mot_de_passe, role, actif, email_verifie, token_version
       FROM utilisateur WHERE email = $1`,
      [email.toLowerCase()]
    );
    return result.rows[0];
  }

  async findUserById(id) {
    const result = await pool.query(
      `SELECT id, nom, prenom, email, telephone, adresse, role, actif, email_verifie, created_at
       FROM utilisateur WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  }

  /** Crée un compte candidat + sa fiche profil (jamais un STAGIAIRE). */
  async createCandidat(payload, passwordHash, verifyTokenHash, verifyExpiresAt, client) {
    const q = client || pool;
    const userRes = await q.query(
      `INSERT INTO utilisateur
         (nom, prenom, email, mot_de_passe, telephone, adresse, role,
          email_verification_token, email_verification_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'CANDIDAT', $7, $8)
       RETURNING id`,
      [
        payload.nom,
        payload.prenom,
        payload.email.toLowerCase(),
        passwordHash,
        payload.telephone || null,
        payload.adresse || null,
        verifyTokenHash,
        verifyExpiresAt,
      ]
    );
    await q.query(
      `INSERT INTO candidat (id, universite, specialite, niveau, competences, langues, github, linkedin, portfolio)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        userRes.rows[0].id,
        payload.universite || null,
        payload.specialite || null,
        payload.niveau || null,
        toCsv(payload.competences),
        toCsv(payload.langues),
        payload.github || null,
        payload.linkedin || null,
        payload.portfolio || null,
      ]
    );
    return userRes.rows[0].id;
  }

  async findByVerificationTokenHash(hash) {
    const result = await pool.query(
      `SELECT id, email, email_verification_expires_at
       FROM utilisateur WHERE email_verification_token = $1 AND email_verifie = false`,
      [hash]
    );
    return result.rows[0];
  }

  async setVerificationToken(userId, hash, expiresAt) {
    await pool.query(
      `UPDATE utilisateur
       SET email_verification_token = $1, email_verification_expires_at = $2, email_verifie = false
       WHERE id = $3`,
      [hash, expiresAt, userId]
    );
  }

  async confirmEmail(userId) {
    await pool.query(
      `UPDATE utilisateur
       SET email_verifie = true, email_verification_token = NULL, email_verification_expires_at = NULL
       WHERE id = $1`,
      [userId]
    );
  }

  async findByResetTokenHash(hash) {
    const result = await pool.query(
      `SELECT id, email, reset_token_expires_at
       FROM utilisateur WHERE reset_token = $1`,
      [hash]
    );
    return result.rows[0];
  }

  async setResetToken(userId, hash, expiresAt) {
    await pool.query(
      `UPDATE utilisateur SET reset_token = $1, reset_token_expires_at = $2 WHERE id = $3`,
      [hash, expiresAt, userId]
    );
  }

  async resetPassword(userId, newPasswordHash) {
    // Invalide aussi les jetons émis avant la réinitialisation : un mot de passe
    // réinitialisé (compte compromis récupéré) doit révoquer les sessions existantes.
    await pool.query(
      `UPDATE utilisateur
       SET mot_de_passe = $1, token_version = token_version + 1,
           reset_token = NULL, reset_token_expires_at = NULL
       WHERE id = $2`,
      [newPasswordHash, userId]
    );
  }

  /** Renvoie le hash du mot de passe d'un utilisateur (ou null). */
  async getPasswordHash(userId) {
    const result = await pool.query(
      `SELECT mot_de_passe FROM utilisateur WHERE id = $1`,
      [userId]
    );
    return result.rows[0]?.mot_de_passe || null;
  }

  /** Change le mot de passe d'un utilisateur connecté. */
  async changePassword(userId, newPasswordHash) {
    await pool.query(
      `UPDATE utilisateur SET mot_de_passe = $1, token_version = token_version + 1 WHERE id = $2`,
      [newPasswordHash, userId]
    );
  }

  /** Met à jour email + téléphone + adresse ; marque l'email comme non vérifié si changé. */
  async updateIdentity(userId, fields, verifyTokenHash, verifyExpiresAt, client) {
    const q = client || pool;
    const emailChanged = fields.email ? fields.email.toLowerCase() !== (fields.currentEmail || '').toLowerCase() : false;

    if (emailChanged) {
      await q.query(
        `UPDATE utilisateur
         SET nom = COALESCE($1, nom), prenom = COALESCE($2, prenom),
             telephone = COALESCE($3, telephone), adresse = COALESCE($4, adresse),
             email = $5, email_verifie = false,
             email_verification_token = $6, email_verification_expires_at = $7
         WHERE id = $8`,
        [
          fields.nom || null,
          fields.prenom || null,
          fields.telephone || null,
          fields.adresse || null,
          fields.email.toLowerCase(),
          verifyTokenHash,
          verifyExpiresAt,
          userId,
        ]
      );
      return { emailChanged, newEmail: fields.email.toLowerCase() };
    }

    await q.query(
      `UPDATE utilisateur
       SET nom = COALESCE($1, nom), prenom = COALESCE($2, prenom),
           telephone = COALESCE($3, telephone), adresse = COALESCE($4, adresse)
       WHERE id = $5`,
      [fields.nom || null, fields.prenom || null, fields.telephone || null, fields.adresse || null, userId]
    );
    return { emailChanged: false, newEmail: null };
  }

  async emailExists(email) {
    const result = await pool.query('SELECT id FROM utilisateur WHERE email = $1', [email.toLowerCase()]);
    return !!result.rows[0];
  }

  /** Met à jour uniquement les champs de profil autorisés (nom, prenom, telephone, adresse). */
  async updateProfile(userId, fields) {
    await pool.query(
      `UPDATE utilisateur SET nom = COALESCE($1, nom), prenom = COALESCE($2, prenom),
           telephone = COALESCE($3, telephone), adresse = COALESCE($4, adresse)
       WHERE id = $5`,
      [fields.nom || null, fields.prenom || null, fields.telephone || null, fields.adresse || null, userId]
    );
  }

  async updateRole(userId, role, client) {
    const q = client || pool;
    await q.query('UPDATE utilisateur SET role = $1 WHERE id = $2', [role, userId]);
  }
}

module.exports = new AuthRepository();
