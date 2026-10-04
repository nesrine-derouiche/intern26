const pool = require('../config/db');

class DocumentRepository {
  async create(stagiaireId, stageId, type, nom, chemin) {
    const result = await pool.query(
      `INSERT INTO document (stagiaire_id, stage_id, type, nom, chemin)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, stagiaire_id, stage_id, type, nom, chemin, date_depot`,
      [stagiaireId, stageId, type, nom, chemin]
    );
    return result.rows[0];
  }

  async findByStageId(stageId, options = null) {
    const isPaginated = !!(options && options.enabled);
    const limit = isPaginated ? options.limit : null;
    const offset = isPaginated ? options.offset : null;

    const query = `
      SELECT id, stagiaire_id, stage_id, type, nom, chemin, date_depot
      FROM document
      WHERE stage_id = $1
      ORDER BY date_depot DESC
      ${isPaginated ? 'LIMIT $2 OFFSET $3' : ''}
    `;

    const params = isPaginated ? [stageId, limit, offset] : [stageId];
    const result = await pool.query(query, params);

    if (!isPaginated) return result.rows;

    const countRes = await pool.query(
      'SELECT COUNT(*) as total FROM document WHERE stage_id = $1',
      [stageId]
    );
    return { data: result.rows, total: parseInt(countRes.rows[0].total) };
  }

  async findById(id) {
    const result = await pool.query(
      'SELECT id, stagiaire_id, stage_id, type, nom, chemin, date_depot FROM document WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  async delete(id) {
    await pool.query('DELETE FROM document WHERE id = $1', [id]);
  }
}

module.exports = new DocumentRepository();
