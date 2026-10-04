const pool = require('../config/db');
const { scopeFilter } = require('../utils/scope.util');

class OffreRepository {
  /** Tris autorisés sur le portail public (valeurs en liste blanche). */
  static PUBLIC_SORTS = {
    deadline: 'o.date_limite ASC',
    recent: 'o.date_limite DESC',
    duration: 'o.duree DESC',
    places: 'o.nombre_places DESC'
  };

  async findAll(options = null, scope = null) {
    const isPaginated = !!(options && options.enabled);
    const limit = isPaginated ? options.limit : null;
    const offset = isPaginated ? options.offset : null;
    const filter = scopeFilter(scope, 'offres');
    const filterSql = filter.sql;
    const baseParams = filter.params;

    const query = `
      SELECT o.id, o.departement_id, o.titre, o.description, o.duree,
             o.competences_demandees, o.nombre_places, o.date_limite, o.statut,
             d.nom as departement_nom,
             (SELECT COUNT(*) FROM candidature c WHERE c.offre_id = o.id) as nb_candidatures
      FROM offre_stage o
      JOIN departement d ON d.id = o.departement_id
      WHERE 1 = 1${filterSql}
      ORDER BY o.date_limite DESC
      ${isPaginated ? `LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}` : ''}
    `;

    const params = isPaginated ? [...baseParams, limit, offset] : baseParams;
    const result = await pool.query(query, params);

    if (!isPaginated) return result.rows;

    const countFilter = scopeFilter(scope, 'offres');
    const countRes = await pool.query(
      'SELECT COUNT(*) as total FROM offre_stage o WHERE 1 = 1' + countFilter.sql,
      countFilter.params
    );
    return { data: result.rows, total: parseInt(countRes.rows[0].total) };
  }

  async findById(id) {
    const result = await pool.query('SELECT statut, nombre_places FROM offre_stage WHERE id = $1', [id]);
    return result.rows[0];
  }

  async decrementPlaces(offreId, client) {
    const q = client || pool;
    await q.query(
      `UPDATE offre_stage
         SET nombre_places = GREATEST(nombre_places - 1, 1),
             statut = CASE WHEN nombre_places <= 1 THEN 'FERMEE'::statut_offre ELSE statut END
       WHERE id = $1`,
      [offreId]
    );
  }

  async create(offre) {
    const { departement_id, titre, description, duree, competences_demandees, nombre_places, date_limite } = offre;
    const result = await pool.query(
      `INSERT INTO offre_stage (departement_id, titre, description, duree, competences_demandees, nombre_places, date_limite)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, departement_id, titre, description, duree, competences_demandees, nombre_places, date_limite, statut`,
      [departement_id, titre, description || '', duree, competences_demandees || '', nombre_places, date_limite]
    );
    return result.rows[0];
  }

  async update(id, offre) {
    const { titre, description, duree, competences_demandees, nombre_places, date_limite, statut } = offre;
    await pool.query(
      `UPDATE offre_stage SET
        titre = COALESCE($1, titre), description = COALESCE($2, description),
        duree = COALESCE($3, duree), competences_demandees = COALESCE($4, competences_demandees),
        nombre_places = COALESCE($5, nombre_places), date_limite = COALESCE($6, date_limite),
        statut = COALESCE($7, statut)
       WHERE id = $8`,
      [titre, description, duree, competences_demandees, nombre_places, date_limite, statut, id]
    );
  }

  async delete(id) {
    await pool.query('DELETE FROM offre_stage WHERE id = $1', [id]);
  }

  /** Offres publiées sur le portail public (sans authentification). */
  async findPublic(options, filters = {}) {
    const isPaginated = !!(options && options.enabled);
    const limit = isPaginated ? options.limit : null;
    const offset = isPaginated ? options.offset : null;

    const conditions = ["o.statut = 'OUVERTE'"];
    const params = [];
    const where = (col) => `${col} = $${params.length + 1}`;

    if (filters.search) {
      params.push(`%${filters.search}%`);
      conditions.push(
        `(unaccent(o.titre) ILIKE unaccent($${params.length}) OR unaccent(o.description) ILIKE unaccent($${params.length}) OR unaccent(d.nom) ILIKE unaccent($${params.length}) OR unaccent(o.localisation) ILIKE unaccent($${params.length}) OR unaccent(o.technologies) ILIKE unaccent($${params.length}))`,
      );
    }
    if (filters.departementId) {
      conditions.push(where('o.departement_id'));
      params.push(filters.departementId);
    }
    if (filters.niveau) {
      conditions.push(where('o.niveau'));
      params.push(filters.niveau);
    }
    if (filters.localisation) {
      conditions.push(where('o.localisation'));
      params.push(filters.localisation);
    }

    const whereSql = conditions.map((c) => `(${c})`).join(' AND ');

    const orderBy = OffreRepository.PUBLIC_SORTS[filters.sort] || OffreRepository.PUBLIC_SORTS.deadline;

    const query = `
      SELECT o.id, o.titre, o.description, o.duree, o.competences_demandees, o.nombre_places,
             o.date_limite, o.missions, o.technologies, o.documents_demandes,
             o.localisation, o.niveau, o.departement_id,
             d.nom AS departement_nom,
             e.id AS encadrant_id,
             u.nom AS encadrant_nom, u.prenom AS encadrant_prenom,
             e.service AS encadrant_service
      FROM offre_stage o
      JOIN departement d ON d.id = o.departement_id
      LEFT JOIN encadrant e ON e.id = o.encadrant_id
      LEFT JOIN utilisateur u ON u.id = e.id
      WHERE ${whereSql}
      ORDER BY ${orderBy}
      ${isPaginated ? `LIMIT $${params.length + 1} OFFSET $${params.length + 2}` : ''}
    `;

    const finalParams = isPaginated ? [...params, limit, offset] : params;
    const result = await pool.query(query, finalParams);

    if (!isPaginated) return result.rows;

    const countRes = await pool.query(
      `SELECT COUNT(*) AS total
       FROM offre_stage o
       JOIN departement d ON d.id = o.departement_id
       WHERE ${whereSql}`,
      params
    );
    return { data: result.rows, total: parseInt(countRes.rows[0].total) };
  }

  async findPublicById(id) {
    const result = await pool.query(
      `SELECT o.id, o.titre, o.description, o.duree, o.competences_demandees, o.nombre_places,
              o.date_limite, o.missions, o.technologies, o.documents_demandes,
              o.localisation, o.niveau, o.departement_id,
              d.nom AS departement_nom,
              e.id AS encadrant_id,
              u.nom AS encadrant_nom, u.prenom AS encadrant_prenom,
              e.service AS encadrant_service
       FROM offre_stage o
       JOIN departement d ON d.id = o.departement_id
       LEFT JOIN encadrant e ON e.id = o.encadrant_id
       LEFT JOIN utilisateur u ON u.id = e.id
       WHERE o.id = $1`,
      [id]
    );
    return result.rows[0];
  }
}

module.exports = new OffreRepository();
