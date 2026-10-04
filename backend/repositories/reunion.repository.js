const pool = require('../config/db');
const { scopeFilter } = require('../utils/scope.util');

class ReunionRepository {
  async findAll(options = null, scope = null) {
    const isPaginated = !!(options && options.enabled);
    const limit = isPaginated ? options.limit : null;
    const offset = isPaginated ? options.offset : null;
    const filter = scopeFilter(scope, 'reunions');
    const filterSql = filter.sql;
    const baseParams = filter.params;

    const query = `
      SELECT r.id, r.stage_id, r.date, r.heure, r.salle, r.lien_visio, r.sujet,
             r.created_at, r.updated_at,
             su.nom as stagiaire_nom, su.prenom as stagiaire_prenom,
             eu.nom as encadrant_nom, eu.prenom as encadrant_prenom
      FROM reunion r
      JOIN stage st ON st.id = r.stage_id
      JOIN utilisateur su ON su.id = st.stagiaire_id
      JOIN utilisateur eu ON eu.id = st.encadrant_id
      WHERE 1 = 1${filterSql}
      ORDER BY r.date DESC, r.heure DESC
      ${isPaginated ? `LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}` : ''}
    `;

    const params = isPaginated ? [...baseParams, limit, offset] : baseParams;
    const result = await pool.query(query, params);

    if (!isPaginated) return result.rows;

    const countFilter = scopeFilter(scope, 'reunions');
    const countRes = await pool.query(
      'SELECT COUNT(*) as total FROM reunion r JOIN stage st ON st.id = r.stage_id WHERE 1 = 1' + countFilter.sql,
      countFilter.params
    );
    return { data: result.rows, total: parseInt(countRes.rows[0].total) };
  }

  async create(reunion) {
    const { stage_id, date, heure, salle, lien_visio, sujet } = reunion;
    const result = await pool.query(
      `INSERT INTO reunion (stage_id, date, heure, salle, lien_visio, sujet) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, stage_id, date, heure, salle, lien_visio, sujet, created_at, updated_at`,
      [stage_id, date, heure, salle || null, lien_visio || null, sujet]
    );
    return result.rows[0];
  }

  async findById(id) {
    const result = await pool.query(
      'SELECT id, stage_id, date, heure, salle, lien_visio, sujet, created_at, updated_at FROM reunion WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async delete(id) {
    await pool.query('DELETE FROM reunion WHERE id = $1', [id]);
  }
}

module.exports = new ReunionRepository();
