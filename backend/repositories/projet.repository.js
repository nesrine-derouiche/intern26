const pool = require('../config/db');

class ProjetRepository {
  async findStageIdById(projetId) {
    const result = await pool.query('SELECT stage_id FROM projet WHERE id = $1', [projetId]);
    return result.rows[0];
  }

  async findByStageId(stageId) {
    const result = await pool.query(
      'SELECT id, stage_id, titre, description, technologies, etat, avancement FROM projet WHERE stage_id = $1 LIMIT 1',
      [stageId]
    );
    return result.rows[0] || null;
  }

  async findByStageIdWithDetails(stageId) {
    const result = await pool.query(
      `SELECT p.id, p.stage_id, p.titre, p.description, p.technologies, p.etat, p.avancement,
              eu.id as encadrant_id, eu.nom as encadrant_nom, eu.prenom as encadrant_prenom,
              st.date_debut as stage_debut, st.date_fin as stage_fin, st.statut as stage_statut,
              d.nom as departement_nom
       FROM projet p
       JOIN stage st ON st.id = p.stage_id
       JOIN utilisateur eu ON eu.id = st.encadrant_id
       JOIN departement d ON d.id = st.departement_id
       WHERE p.stage_id = $1 LIMIT 1`,
      [stageId]
    );
    return result.rows[0] || null;
  }

  async findStageIdByStagiaireId(stagiaireId) {
    const result = await pool.query(
      `SELECT st.id as stage_id FROM stage st
       WHERE st.stagiaire_id = $1
       ORDER BY st.date_debut DESC LIMIT 1`,
      [stagiaireId]
    );
    return result.rows[0] || null;
  }

  async updateAvancement(projetId, avancement) {
    await pool.query('UPDATE projet SET avancement = $1 WHERE id = $2', [avancement, projetId]);
  }

  async findAll(options = null, scope = null, filters = {}) {
    let where = [];
    let params = [];
    let paramIndex = 1;

    if (scope && scope.type === 'user' && scope.role === 'ENCADRANT') {
      where.push(`p.stage_id IN (SELECT st.id FROM stage st WHERE st.encadrant_id = $${paramIndex})`);
      params.push(scope.userId);
      paramIndex++;
    }

    if (filters.stage_id) {
      where.push(`p.stage_id = $${paramIndex}`);
      params.push(filters.stage_id);
      paramIndex++;
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM projet p ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    let query = `
      SELECT p.id, p.stage_id, p.titre, p.description, p.technologies, p.etat, p.avancement
      FROM projet p
      ${whereClause}
      ORDER BY p.id
    `;

    if (options && options.enabled) {
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(options.limit, options.offset);
    }

    const result = await pool.query(query, params);
    return { data: result.rows, total };
  }

  async findById(id) {
    const result = await pool.query(
      `SELECT p.id, p.stage_id, p.titre, p.description, p.technologies, p.etat, p.avancement,
              st.encadrant_id, st.stagiaire_id, st.departement_id
       FROM projet p
       JOIN stage st ON st.id = p.stage_id
       WHERE p.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findAuthContext(projetId) {
    const result = await pool.query(
      `SELECT st.encadrant_id, st.stagiaire_id, st.departement_id
       FROM projet p
       JOIN stage st ON st.id = p.stage_id
       WHERE p.id = $1`,
      [projetId]
    );
    return result.rows[0] || null;
  }

  async existsByStageId(stageId) {
    const result = await pool.query('SELECT 1 FROM projet WHERE stage_id = $1', [stageId]);
    return result.rows.length > 0;
  }

  async create({ stage_id, titre, description, technologies, etat, avancement }) {
    const result = await pool.query(
      `INSERT INTO projet (stage_id, titre, description, technologies, etat, avancement)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, stage_id, titre, description, technologies, etat, avancement`,
      [stage_id, titre, description || null, technologies || null, etat || 'EN_COURS', avancement || 0]
    );
    return result.rows[0];
  }

  async update(id, { titre, description, technologies, etat, avancement }) {
    const fields = [];
    const params = [];
    let paramIndex = 1;

    if (titre !== undefined) { fields.push(`titre = $${paramIndex}`); params.push(titre); paramIndex++; }
    if (description !== undefined) { fields.push(`description = $${paramIndex}`); params.push(description); paramIndex++; }
    if (technologies !== undefined) { fields.push(`technologies = $${paramIndex}`); params.push(technologies); paramIndex++; }
    if (etat !== undefined) { fields.push(`etat = $${paramIndex}`); params.push(etat); paramIndex++; }
    if (avancement !== undefined) { fields.push(`avancement = $${paramIndex}`); params.push(avancement); paramIndex++; }

    if (fields.length === 0) return;

    params.push(id);
    await pool.query(
      `UPDATE projet SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      params
    );
  }

  async delete(id) {
    await pool.query('DELETE FROM projet WHERE id = $1', [id]);
  }
}

module.exports = new ProjetRepository();
