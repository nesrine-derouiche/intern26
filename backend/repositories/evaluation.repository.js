const pool = require('../config/db');
const { scopeFilter } = require('../utils/scope.util');

class EvaluationRepository {
  async findAll(options = null, scope = null) {
    const isPaginated = !!(options && options.enabled);
    const limit = isPaginated ? options.limit : null;
    const offset = isPaginated ? options.offset : null;
    const filter = scopeFilter(scope, 'evaluations');
    const filterSql = filter.sql;
    const baseParams = filter.params;

    const query = `
      SELECT e.id, e.stage_id, e.encadrant_id, e.technique, e.communication, e.autonomie,
             e.ponctualite, e.qualite, e.note_finale, e.commentaire, e.date_evaluation, e.validee,
             e.created_at, e.updated_at,
             su.nom as stagiaire_nom, su.prenom as stagiaire_prenom,
             eu.nom as encadrant_nom, eu.prenom as encadrant_prenom
      FROM evaluation e
      JOIN stage st ON st.id = e.stage_id
      JOIN utilisateur su ON su.id = st.stagiaire_id
      JOIN utilisateur eu ON eu.id = e.encadrant_id
      WHERE 1 = 1${filterSql}
      ORDER BY e.date_evaluation DESC
      ${isPaginated ? `LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}` : ''}
    `;

    const params = isPaginated ? [...baseParams, limit, offset] : baseParams;
    const result = await pool.query(query, params);

    if (!isPaginated) return result.rows;

    const countFilter = scopeFilter(scope, 'evaluations');
    const countRes = await pool.query(
      'SELECT COUNT(*) as total FROM evaluation e JOIN stage st ON st.id = e.stage_id WHERE 1 = 1' + countFilter.sql,
      countFilter.params
    );
    return { data: result.rows, total: parseInt(countRes.rows[0].total) };
  }

  async findById(id) {
    const result = await pool.query(
      'SELECT id, stage_id, encadrant_id, technique, communication, autonomie, ponctualite, qualite, note_finale, commentaire, date_evaluation, validee, created_at, updated_at FROM evaluation WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findByStageId(stageId) {
    const result = await pool.query('SELECT id FROM evaluation WHERE stage_id = $1', [stageId]);
    return result.rows[0];
  }

  async findPdfData(stageId) {
    const result = await pool.query(`
      SELECT e.id, e.stage_id, e.encadrant_id, e.technique, e.communication, e.autonomie,
             e.ponctualite, e.qualite, e.note_finale, e.commentaire, e.date_evaluation, e.validee,
             su.nom as stagiaire_nom, su.prenom as stagiaire_prenom,
             eu.nom as encadrant_nom, eu.prenom as encadrant_prenom,
             d.nom as departement_nom, o.titre as offre_titre
      FROM evaluation e
      JOIN stage st ON st.id = e.stage_id
      JOIN utilisateur su ON su.id = st.stagiaire_id
      JOIN utilisateur eu ON eu.id = e.encadrant_id
      JOIN departement d ON d.id = st.departement_id
      JOIN offre_stage o ON o.id = st.offre_id
      WHERE e.stage_id = $1
    `, [stageId]);
    return result.rows[0];
  }

  async create(evaluation) {
    const { stage_id, encadrant_id, technique, communication, autonomie, ponctualite, qualite, note_finale, commentaire } = evaluation;
    const result = await pool.query(
      `INSERT INTO evaluation (stage_id, encadrant_id, technique, communication, autonomie, ponctualite, qualite, note_finale, commentaire, validee)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       RETURNING id, stage_id, encadrant_id, technique, communication, autonomie, ponctualite, qualite, note_finale, commentaire, date_evaluation, validee, created_at, updated_at`,
      [stage_id, encadrant_id, technique, communication, autonomie, ponctualite, qualite, note_finale, commentaire || '']
    );
    return result.rows[0];
  }

  async delete(id) {
    await pool.query('DELETE FROM evaluation WHERE id = $1', [id]);
  }
}

module.exports = new EvaluationRepository();
