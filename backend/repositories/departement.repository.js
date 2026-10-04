const pool = require('../config/db');
const { scopeFilter } = require('../utils/scope.util');

class DepartementRepository {
  async findAll(options = null, scope = null) {
    const isPaginated = !!(options && options.enabled);
    const limit = isPaginated ? options.limit : null;
    const offset = isPaginated ? options.offset : null;
    const filter = scopeFilter(scope, 'departements');
    const filterSql = filter.sql;
    const baseParams = filter.params;

    const query = `
      SELECT d.id, d.nom, d.description, d.chef_departement_id,
             cd.nom as chef_nom, cd.prenom as chef_prenom,
             (SELECT COUNT(*) FROM encadrant e WHERE e.departement_id = d.id) as nb_encadrants,
             (SELECT COUNT(*) FROM stage st WHERE st.departement_id = d.id AND st.statut = 'EN_COURS') as nb_stages_actifs
      FROM departement d
      LEFT JOIN utilisateur cd ON cd.id = d.chef_departement_id
      WHERE 1 = 1${filterSql}
      ORDER BY d.nom
      ${isPaginated ? `LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}` : ''}
    `;

    const params = isPaginated ? [...baseParams, limit, offset] : baseParams;
    const result = await pool.query(query, params);

    if (!isPaginated) return result.rows;

    const countFilter = scopeFilter(scope, 'departements');
    const countRes = await pool.query(
      'SELECT COUNT(*) as total FROM departement WHERE 1 = 1' + countFilter.sql,
      countFilter.params
    );
    return { data: result.rows, total: parseInt(countRes.rows[0].total) };
  }

  async findByChef(chefId) {
    const result = await pool.query(
      'SELECT id, nom, chef_departement_id FROM departement WHERE chef_departement_id = $1',
      [chefId]
    );
    return result.rows[0] || null;
  }

  async create(departement) {
    const { nom, description, chef_departement_id } = departement;
    const result = await pool.query(
      'INSERT INTO departement (nom, description, chef_departement_id) VALUES ($1, $2, $3) RETURNING id, nom, description, chef_departement_id',
      [nom, description || '', chef_departement_id || null]
    );
    return result.rows[0];
  }

  async update(id, departement) {
    const { nom, description, chef_departement_id } = departement;
    await pool.query(
      'UPDATE departement SET nom = COALESCE($1, nom), description = COALESCE($2, description), chef_departement_id = COALESCE($3, chef_departement_id) WHERE id = $4',
      [nom, description, chef_departement_id, id]
    );
  }

  async delete(id) {
    await pool.query('DELETE FROM departement WHERE id = $1', [id]);
  }
}

module.exports = new DepartementRepository();
