const pool = require('../config/db');

const CERTIFICATION_COLUMNS =
  'id, stage_id, stagiaire_id, statut, reviewer_id, reason, document_concerne, submitted_at, decided_at, attestation_chemin, created_at, updated_at';
const DOCUMENT_COLUMNS =
  'id, certification_id, kind, version, nom, chemin, taille, created_at';
const DECISION_COLUMNS =
  'id, certification_id, from_statut, to_statut, reviewer_id, reason, document_concerne, created_at';

class CertificationRepository {
  async findByStageId(stageId) {
    const result = await pool.query(
      `SELECT ${CERTIFICATION_COLUMNS} FROM certification WHERE stage_id = $1`,
      [stageId]
    );
    return result.rows[0] || null;
  }

  async createCertification(stageId, stagiaireId) {
    const result = await pool.query(
      `INSERT INTO certification (stage_id, stagiaire_id)
       VALUES ($1, $2)
       RETURNING ${CERTIFICATION_COLUMNS}`,
      [stageId, stagiaireId]
    );
    return result.rows[0];
  }

  async updateCertification(id, data) {
    const { statut, reviewer_id, reason, document_concerne, submitted_at, decided_at } = data;
    const result = await pool.query(
      `UPDATE certification SET
         statut = COALESCE($1, statut),
         reviewer_id = $2,
         reason = $3,
         document_concerne = $4,
         submitted_at = COALESCE($5, submitted_at),
         decided_at = COALESCE($6, decided_at)
       WHERE id = $7
       RETURNING ${CERTIFICATION_COLUMNS}`,
      [
        statut === undefined ? null : statut,
        reviewer_id === undefined ? null : reviewer_id,
        reason === undefined ? null : reason,
        document_concerne === undefined ? null : document_concerne,
        submitted_at === undefined ? null : submitted_at,
        decided_at === undefined ? null : decided_at,
        id
      ]
    );
    return result.rows[0] || null;
  }

  async findDocuments(certificationId) {
    const result = await pool.query(
      `SELECT ${DOCUMENT_COLUMNS} FROM certification_document
        WHERE certification_id = $1
        ORDER BY kind ASC, version ASC`,
      [certificationId]
    );
    return result.rows;
  }

  async nextVersion(certificationId, kind) {
    const result = await pool.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
         FROM certification_document
        WHERE certification_id = $1 AND kind = $2`,
      [certificationId, kind]
    );
    return result.rows[0].next_version;
  }

  async createDocument(data) {
    const { certification_id, kind, version, nom, chemin, taille } = data;
    const result = await pool.query(
      `INSERT INTO certification_document (certification_id, kind, version, nom, chemin, taille)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${DOCUMENT_COLUMNS}`,
      [certification_id, kind, version, nom, chemin, taille]
    );
    return result.rows[0];
  }

  async findDocumentById(id) {
    const result = await pool.query(
      `SELECT d.${DOCUMENT_COLUMNS.replaceAll(', ', ', d.')}
         FROM certification_document d
        WHERE d.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findCertificationIdByDocumentId(id) {
    const result = await pool.query(
      `SELECT certification_id FROM certification_document WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? result.rows[0].certification_id : null;
  }

  async logDecision(data) {
    const { certification_id, from_statut, to_statut, reviewer_id, reason, document_concerne } = data;
    const result = await pool.query(
      `INSERT INTO certification_decision
         (certification_id, from_statut, to_statut, reviewer_id, reason, document_concerne)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${DECISION_COLUMNS}`,
      [
        certification_id,
        from_statut,
        to_statut,
        reviewer_id === undefined ? null : reviewer_id,
        reason === undefined ? null : reason,
        document_concerne === undefined ? null : document_concerne
      ]
    );
    return result.rows[0];
  }

  async findDecisions(certificationId) {
    const result = await pool.query(
      `SELECT ${DECISION_COLUMNS} FROM certification_decision
        WHERE certification_id = $1
        ORDER BY created_at ASC`,
      [certificationId]
    );
    return result.rows;
  }

  async removeByStageId(stageId) {
    await pool.query('DELETE FROM certification WHERE stage_id = $1', [stageId]);
  }

  /**
   * P2-TASK8 — Bascule atomique vers CERTIFICATE_GENERATED avec
   * enregistrement du fichier : la clause WHERE statut = 'VALIDATED'
   * rend la génération idempotente même en cas d'appels concurrents
   * (une seule ligne mise à jour, les autres reçoivent null).
   */
  async markAttestationGenerated(id, chemin) {
    const result = await pool.query(
      `UPDATE certification SET
         statut = 'CERTIFICATE_GENERATED',
         attestation_chemin = $2
       WHERE id = $1 AND statut = 'VALIDATED'
       RETURNING ${CERTIFICATION_COLUMNS}`,
      [id, chemin]
    );
    return result.rows[0] || null;
  }

  /**
   * P2-TASK8 — Dossiers avec contexte stage/stagiaire/département et
   * présence des derniers documents, pour la table de suivi.
   * Filtres : scope SQL ({ stageIds?: null } = sans filtre),
   * recherche insensible à la casse, statut, pagination optionnelle.
   */
  async listCertifications({ whereClause = '', params = [], search, statut, limit, offset } = {}) {
    const conditions = [];
    const values = [...params];
    if (whereClause) conditions.push(whereClause);
    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(su.nom ILIKE $${values.length} OR su.prenom ILIKE $${values.length})`);
    }
    if (statut) {
      values.push(statut);
      conditions.push(`c.statut = $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT count(DISTINCT s.id)::int AS total
         FROM stage s
         JOIN utilisateur su ON su.id = s.stagiaire_id
         LEFT JOIN certification c ON c.stage_id = s.id
        ${where}`,
      values
    );

    let pagination = '';
    if (limit !== undefined && offset !== undefined) {
      values.push(limit);
      pagination += ` LIMIT $${values.length}`;
      values.push(offset);
      pagination += ` OFFSET $${values.length}`;
    }

    const result = await pool.query(
      `SELECT s.id AS stage_id,
              su.nom AS stagiaire_nom, su.prenom AS stagiaire_prenom,
              d.nom AS departement_nom,
              s.date_debut, s.date_fin,
              c.id AS certification_id, c.statut, c.submitted_at,
              c.reason, c.document_concerne, c.attestation_chemin,
              EXISTS (
                SELECT 1 FROM certification_document cd
                 WHERE cd.certification_id = c.id AND cd.kind = 'JOURNAL'
              ) AS journal_present,
              EXISTS (
                SELECT 1 FROM certification_document cd
                 WHERE cd.certification_id = c.id AND cd.kind = 'RAPPORT'
              ) AS rapport_present,
              (SELECT MAX(version) FROM certification_document cd
                WHERE cd.certification_id = c.id AND cd.kind = 'JOURNAL') AS journal_version,
              (SELECT MAX(version) FROM certification_document cd
                WHERE cd.certification_id = c.id AND cd.kind = 'RAPPORT') AS rapport_version
         FROM stage s
         JOIN utilisateur su ON su.id = s.stagiaire_id
         JOIN departement d ON d.id = s.departement_id
         LEFT JOIN certification c ON c.stage_id = s.id
        ${where}
        ORDER BY s.date_debut DESC NULLS LAST, su.nom ASC
        ${pagination}`,
      values
    );
    return { rows: result.rows, total: countResult.rows[0].total };
  }
}

module.exports = new CertificationRepository();
