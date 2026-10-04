const pool = require('../config/db');

class CandidatureDocumentRepository {
  async findByCandidatureId(candidatureId) {
    const result = await pool.query(
      `SELECT id, candidature_id, type, nom, chemin, date_depot, statut, rejected_reason, verification_status
       FROM candidature_document
       WHERE candidature_id = $1
       ORDER BY type`,
      [candidatureId]
    );
    return result.rows;
  }

  /** Regroupe les documents par candidature (clé = candidature_id). */
  async findByCandidatureIds(candidatureIds) {
    if (!candidatureIds || candidatureIds.length === 0) return {};
    const result = await pool.query(
      `SELECT id, candidature_id, type, nom, chemin, date_depot, statut, rejected_reason, verification_status
       FROM candidature_document
       WHERE candidature_id = ANY($1::uuid[])
       ORDER BY type`,
      [candidatureIds]
    );
    const grouped = {};
    for (const row of result.rows) {
      if (!grouped[row.candidature_id]) grouped[row.candidature_id] = [];
      grouped[row.candidature_id].push(row);
    }
    return grouped;
  }

  async findByCandidatureIdAndType(candidatureId, type) {
    const result = await pool.query(
      `SELECT id, candidature_id, type, nom, chemin, date_depot, statut, rejected_reason, verification_status
       FROM candidature_document
       WHERE candidature_id = $1 AND type = $2`,
      [candidatureId, type]
    );
    return result.rows[0];
  }

  /** Document du dossier par son id, rattaché à une candidature donnée. */
  async findByIdAndCandidature(candidatureId, documentId) {
    const result = await pool.query(
      `SELECT id, candidature_id, type, nom, chemin, date_depot, statut, rejected_reason, verification_status
       FROM candidature_document
       WHERE id = $1 AND candidature_id = $2`,
      [documentId, candidatureId]
    );
    return result.rows[0];
  }

  async upsert(candidatureId, type, nom, chemin) {
    const result = await pool.query(
      `INSERT INTO candidature_document (candidature_id, type, nom, chemin, date_depot, statut, verification_status)
       VALUES ($1, $2, $3, $4, now(), 'EN_ATTENTE', 'PENDING')
   ON CONFLICT (candidature_id, type)
   DO UPDATE SET nom = EXCLUDED.nom,
                 chemin = EXCLUDED.chemin,
                 date_depot = now(),
                 statut = 'EN_ATTENTE',
                 rejected_reason = NULL,
                 verification_status = 'PENDING'
   RETURNING id, candidature_id, type, nom, chemin, date_depot, statut, rejected_reason, verification_status`,
      [candidatureId, type, nom, chemin]
    );
    return result.rows[0];
  }

  /** Persiste le verdict de la vérification automatique (PENDING/VALID/REVIEW_REQUIRED/REJECTED). */
  async updateVerificationStatus(candidatureId, type, status) {
    const result = await pool.query(
      `UPDATE candidature_document
       SET verification_status = $1
       WHERE candidature_id = $2 AND type = $3
       RETURNING id, candidature_id, type, verification_status`,
      [status, candidatureId, type]
    );
    return result.rows[0];
  }

  /**
   * Décision manuelle RH (VALID/REJECTED) sur un document du dossier.
   * Met à jour `verification_status` ET le `statut` métier (VALIDE/REJETE),
   * et (re)positionne `rejected_reason` (effacé en cas de validation).
   */
  async applyManualDecision(candidatureId, documentId, { verificationStatus, statut, rejectedReason = null }) {
    const result = await pool.query(
      `UPDATE candidature_document
       SET verification_status = $1,
           statut = $2,
           rejected_reason = $3
       WHERE candidature_id = $4 AND id = $5
       RETURNING id, candidature_id, type, nom, date_depot, statut, rejected_reason, verification_status`,
      [verificationStatus, statut, rejectedReason, candidatureId, documentId]
    );
    return result.rows[0] || null;
  }
}

module.exports = new CandidatureDocumentRepository();
