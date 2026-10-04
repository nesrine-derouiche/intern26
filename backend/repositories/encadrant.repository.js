const pool = require('../config/db');
const { scopeFilter } = require('../utils/scope.util');

class EncadrantRepository {
  async findAll(options = null, scope = null) {
    const isPaginated = !!(options && options.enabled);
    const limit = isPaginated ? options.limit : null;
    const offset = isPaginated ? options.offset : null;
    const filter = scopeFilter(scope, 'encadrants');
    const filterSql = filter.sql;
    const baseParams = filter.params;

    const query = `
      SELECT u.id, u.nom, u.prenom, u.email, u.telephone, u.actif,
             e.service, e.competences, e.nombre_max_stagiaires, e.disponibilite, e.departement_id,
             d.nom as departement_nom,
             (SELECT COUNT(*) FROM stage st WHERE st.encadrant_id = u.id AND st.statut = 'EN_COURS') as nb_stagiaires_actifs
      FROM utilisateur u
      JOIN encadrant e ON e.id = u.id
      LEFT JOIN departement d ON d.id = e.departement_id
      WHERE u.actif = true${filterSql}
      ORDER BY u.nom
      ${isPaginated ? `LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}` : ''}
    `;

    const params = isPaginated ? [...baseParams, limit, offset] : baseParams;
    const result = await pool.query(query, params);

    if (!isPaginated) return result.rows;

    const countFilter = scopeFilter(scope, 'encadrants');
    const countRes = await pool.query(
      `SELECT COUNT(*) as total
       FROM utilisateur u
       JOIN encadrant e ON e.id = u.id
       WHERE u.actif = true` + countFilter.sql,
      countFilter.params
    );
    return { data: result.rows, total: parseInt(countRes.rows[0].total) };
  }

  async findAvailableByDepartment(departementId) {
    const result = await pool.query(
      'SELECT id FROM encadrant WHERE departement_id = $1 AND disponibilite = true LIMIT 1',
      [departementId]
    );
    return result.rows[0];
  }

  async findAnyAvailable() {
    const result = await pool.query('SELECT id FROM encadrant WHERE disponibilite = true LIMIT 1');
    return result.rows[0];
  }

  async existsById(id) {
    const result = await pool.query('SELECT id FROM encadrant WHERE id = $1', [id]);
    return result.rows[0];
  }

  async create(encadrant, hashedPwd) {
    const { nom, prenom, email, telephone, service, nombre_max_stagiaires, competences, departement_id } = encadrant;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const uRes = await client.query(
        `INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone, role)
         VALUES ($1, $2, $3, $4, $5, 'ENCADRANT') RETURNING id`,
        [nom.trim(), prenom.trim(), email.toLowerCase().trim(), hashedPwd, telephone || null]
      );
      await client.query(
        `INSERT INTO encadrant (id, service, nombre_max_stagiaires, competences, departement_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [uRes.rows[0].id, service || null, nombre_max_stagiaires || 3, competences || null, departement_id || null]
      );
      await client.query('COMMIT');
      return uRes.rows[0].id;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async update(id, encadrant) {
    const { nom, prenom, email, telephone, service, nombre_max_stagiaires, competences, disponibilite, departement_id } = encadrant;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE utilisateur SET nom = COALESCE($1, nom), prenom = COALESCE($2, prenom), email = COALESCE($3, email), telephone = COALESCE($4, telephone) WHERE id = $5`,
        [nom, prenom, email, telephone, id]
      );
      await client.query(
        `UPDATE encadrant SET service = COALESCE($1, service), nombre_max_stagiaires = COALESCE($2, nombre_max_stagiaires), competences = COALESCE($3, competences), disponibilite = COALESCE($4, disponibilite), departement_id = $5 WHERE id = $6`,
        [service, nombre_max_stagiaires, competences, disponibilite, departement_id || null, id]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async deactivate(id) {
    await pool.query('UPDATE utilisateur SET actif = false WHERE id = $1', [id]);
  }
}

module.exports = new EncadrantRepository();
