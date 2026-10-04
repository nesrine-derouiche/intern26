const pool = require('../config/db');
const { scopeFilter } = require('../utils/scope.util');

class RapportRepository {
  async findAll(options = null, scope = null, filters = {}) {
    const isPaginated = !!(options && options.enabled);
    const limit = isPaginated ? options.limit : null;
    const offset = isPaginated ? options.offset : null;
    const filter = scopeFilter(scope, 'rapports');
    const filterSql = filter.sql;
    let baseParams = [...filter.params];

    let extraWhere = '';
    if (filters.stage_id) {
      baseParams.push(filters.stage_id);
      extraWhere += ` AND r.stage_id = $${baseParams.length}`;
    }

    const query = `
      SELECT r.id, r.stage_id, r.type, r.contenu, r.date, r.statut, r.commentaire,
             su.nom as stagiaire_nom, su.prenom as stagiaire_prenom,
             eu.nom as encadrant_nom, eu.prenom as encadrant_prenom,
             d.nom as departement_nom
      FROM rapport r
      JOIN stage st ON st.id = r.stage_id
      JOIN utilisateur su ON su.id = st.stagiaire_id
      JOIN utilisateur eu ON eu.id = st.encadrant_id
      JOIN departement d ON d.id = st.departement_id
      WHERE 1 = 1${filterSql}${extraWhere}
      ORDER BY r.date DESC
      ${isPaginated ? `LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}` : ''}
    `;

    const params = isPaginated ? [...baseParams, limit, offset] : baseParams;
    const result = await pool.query(query, params);

    if (!isPaginated) return result.rows;

    const countFilter = scopeFilter(scope, 'rapports');
    let countParams = [...countFilter.params];
    let countExtraWhere = '';
    if (filters.stage_id) {
      countParams.push(filters.stage_id);
      countExtraWhere += ` AND r.stage_id = $${countParams.length}`;
    }
    const countRes = await pool.query(
      'SELECT COUNT(*) as total FROM rapport r JOIN stage st ON st.id = r.stage_id WHERE 1 = 1' + countFilter.sql + countExtraWhere,
      countParams
    );
    return { data: result.rows, total: parseInt(countRes.rows[0].total) };
  }

  async findById(id) {
    const result = await pool.query(
      `SELECT r.id, r.stage_id, r.type, r.contenu, r.date, r.statut, r.commentaire
       FROM rapport r
       WHERE r.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findStageContext(rapportId) {
    const result = await pool.query(
      `SELECT st.stagiaire_id, st.encadrant_id, st.departement_id
       FROM rapport r
       JOIN stage st ON st.id = r.stage_id
       WHERE r.id = $1`,
      [rapportId]
    );
    return result.rows[0] || null;
  }

  async findStageContextByStageId(stageId) {
    const result = await pool.query(
      `SELECT st.stagiaire_id, st.encadrant_id, st.departement_id, st.statut as stage_statut
       FROM stage st
       WHERE st.id = $1`,
      [stageId]
    );
    return result.rows[0] || null;
  }

  async create({ stage_id, type, contenu }) {
    const result = await pool.query(
      `INSERT INTO rapport (stage_id, type, contenu, statut)
       VALUES ($1, $2, $3, 'SOUMIS')
       RETURNING id, stage_id, type, contenu, date, statut, commentaire`,
      [stage_id, type, contenu || null]
    );
    return result.rows[0];
  }

  async update(id, { contenu, type }) {
    const fields = [];
    const params = [];
    let paramIndex = 1;

    if (contenu !== undefined) { fields.push(`contenu = $${paramIndex}`); params.push(contenu); paramIndex++; }
    if (type !== undefined) { fields.push(`type = $${paramIndex}`); params.push(type); paramIndex++; }

    if (fields.length === 0) return this.findById(id);

    params.push(id);
    const result = await pool.query(
      `UPDATE rapport SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, stage_id, type, contenu, date, statut, commentaire`,
      params
    );
    return result.rows[0];
  }

  async setEnRevision(id) {
    const result = await pool.query(
      `UPDATE rapport SET statut = 'EN_REVISION' WHERE id = $1
       RETURNING id, stage_id, type, contenu, date, statut, commentaire`,
      [id]
    );
    return result.rows[0];
  }

  async validate(id) {
    const result = await pool.query(
      `UPDATE rapport SET statut = 'VALIDE' WHERE id = $1
       RETURNING id, stage_id, type, contenu, date, statut, commentaire`,
      [id]
    );
    return result.rows[0];
  }

  async reject(id, commentaire) {
    const result = await pool.query(
      `UPDATE rapport SET statut = 'REJETE', commentaire = $2 WHERE id = $1
       RETURNING id, stage_id, type, contenu, date, statut, commentaire`,
      [id, commentaire]
    );
    return result.rows[0];
  }

  async delete(id) {
    await pool.query('DELETE FROM rapport WHERE id = $1', [id]);
  }
}

module.exports = new RapportRepository();
