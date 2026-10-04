const pool = require('../config/db');

class CandidatRepository {
  async existsById(id) {
    const result = await pool.query('SELECT id FROM candidat WHERE id = $1', [id]);
    return !!result.rows[0];
  }

  async getProfile(userId) {
    const result = await pool.query(
      `SELECT u.id, u.nom, u.prenom, u.email, u.telephone, u.adresse, u.role, u.email_verifie,
              c.universite, c.specialite, c.niveau, c.competences, c.langues,
              c.github, c.linkedin, c.portfolio, c.photo_path, c.cv_path,
              c.cv_original_name, c.cv_size, c.cv_uploaded_at,
              c.created_at
       FROM utilisateur u
       JOIN candidat c ON c.id = u.id
       WHERE u.id = $1`,
      [userId]
    );
    return result.rows[0];
  }

  async updateProfile(userId, fields) {
    const result = await pool.query(
      `UPDATE candidat SET
         universite = COALESCE($1, universite),
         specialite = COALESCE($2, specialite),
         niveau     = COALESCE($3, niveau),
         competences = COALESCE($4, competences),
         langues     = COALESCE($5, langues),
         github      = COALESCE($6, github),
         linkedin    = COALESCE($7, linkedin),
         portfolio   = COALESCE($8, portfolio),
         updated_at  = now()
       WHERE id = $9
       RETURNING id`,
      [
        fields.universite || null,
        fields.specialite || null,
        fields.niveau || null,
        fields.competences || null,
        fields.langues || null,
        fields.github || null,
        fields.linkedin || null,
        fields.portfolio || null,
        userId,
      ]
    );
    return result.rows[0];
  }

  async setPhotoPath(userId, photoPath) {
    await pool.query('UPDATE candidat SET photo_path = $1, updated_at = now() WHERE id = $2', [photoPath, userId]);
  }

  async setCvPath(userId, cvPath) {
    await pool.query('UPDATE candidat SET cv_path = $1, updated_at = now() WHERE id = $2', [cvPath, userId]);
  }

  async setCvInfo(userId, cvPath, originalName, size) {
    await pool.query(
      `UPDATE candidat
       SET cv_path = $1, cv_original_name = $2, cv_size = $3, cv_uploaded_at = now(), updated_at = now()
       WHERE id = $4`,
      [cvPath, originalName, size, userId]
    );
  }

  async clearCv(userId) {
    const result = await pool.query(
      `UPDATE candidat
       SET cv_path = NULL, cv_original_name = NULL, cv_size = NULL, cv_uploaded_at = NULL,
           updated_at = now()
       WHERE id = $1
       RETURNING cv_path`,
      [userId]
    );
    return result.rows[0];
  }

  /** Promotion d'un candidat (sur décision RH) : fiche stagiaire à partir du profil. */
  async createStagiaire(id, profile, client) {
    const q = client || pool;
    await q.query(
      `INSERT INTO stagiaire (id, ecole, specialite, niveau, competences, disponibilite)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (id) DO NOTHING`,
      [id, profile.universite || null, profile.specialite || null, profile.niveau || null, profile.competences || null]
    );
  }
}

module.exports = new CandidatRepository();
