const pool = require('../config/db');

/**
 * Accès aux données d'analyse de CV.
 *
 * L'analyse IA n'est pas encore intégrée : la table sert à enregistrer la
 * volonté d'analyse (statut « EN_ATTENTE ») dès le dépôt du CV, prête à
 * être traitée par un futur moteur d'analyse.
 */
class CvAnalyseRepository {
  async create(candidatId, cvFilename) {
    const result = await pool.query(
      `INSERT INTO cv_analyse (candidat_id, cv_filename)
       VALUES ($1, $2)
       RETURNING id, candidat_id, cv_filename, statut, ai_provider, created_at, updated_at`,
      [candidatId, cvFilename]
    );
    return result.rows[0];
  }

  /** Dernière analyse (ou analyse en attente) d'un candidat. */
  async findByCandidat(candidatId) {
    const result = await pool.query(
      `SELECT id, candidat_id, cv_filename, statut, resultat, ai_provider, erreur,
              created_at, updated_at
       FROM cv_analyse
       WHERE candidat_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [candidatId]
    );
    return result.rows[0] || null;
  }

  /** Suppression des analyses d'un candidat (lors de la suppression du CV). */
  async clearByCandidat(candidatId) {
    await pool.query('DELETE FROM cv_analyse WHERE candidat_id = $1', [candidatId]);
  }

  /** Point d'extension pour le futur moteur d'analyse IA. */
  async updateResult(id, statut, resultat, aiProvider, erreur = null) {
    await pool.query(
      `UPDATE cv_analyse
       SET statut = $2, resultat = $3, ai_provider = $4, erreur = $5, updated_at = now()
       WHERE id = $1`,
      [id, statut, resultat, aiProvider, erreur]
    );
  }
}

module.exports = new CvAnalyseRepository();
