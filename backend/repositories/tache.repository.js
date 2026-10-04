const pool = require('../config/db');
const { scopeFilter } = require('../utils/scope.util');

class TacheRepository {
  async findAll(options = null, scope = null) {
    const isPaginated = !!(options && options.enabled);
    const limit = isPaginated ? options.limit : null;
    const offset = isPaginated ? options.offset : null;
    const filter = scopeFilter(scope, 'taches');
    const filterSql = filter.sql;
    const baseParams = filter.params;

    const query = `
      SELECT t.id, t.projet_id, t.createur_id, t.executant_id, t.titre, t.description,
             t.priorite, t.date_debut, t.date_fin, t.statut, t.progress, t.created_at,
             t.completion_date, t.estimated_hours, t.spent_hours,
             p.titre as projet_titre,
             eu.nom as createur_nom, eu.prenom as createur_prenom,
             su.nom as executant_nom, su.prenom as executant_prenom
      FROM tache t
      JOIN projet p ON p.id = t.projet_id
      JOIN utilisateur eu ON eu.id = t.createur_id
      JOIN utilisateur su ON su.id = t.executant_id
      WHERE 1 = 1${filterSql}
      ORDER BY t.date_debut DESC NULLS LAST
      ${isPaginated ? `LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}` : ''}
    `;

    const params = isPaginated ? [...baseParams, limit, offset] : baseParams;
    const result = await pool.query(query, params);

    if (!isPaginated) return result.rows;

    const countFilter = scopeFilter(scope, 'taches');
    const countRes = await pool.query(
      'SELECT COUNT(*) as total FROM tache t WHERE 1 = 1' + countFilter.sql,
      countFilter.params
    );
    return { data: result.rows, total: parseInt(countRes.rows[0].total) };
  }

  async findByExecutant(userId, options = null) {
    return this._findByUserColumn('executant_id', userId, options);
  }

  async findByCreateur(userId, options = null) {
    return this._findByUserColumn('createur_id', userId, options);
  }

  async _findByUserColumn(column, userId, options = null) {
    const columns = { executant_id: 'executant_id', createur_id: 'createur_id' };
    const col = columns[column];
    if (!col) throw new Error('Colonne de filtre invalide.');

    const isPaginated = !!(options && options.enabled);
    const limit = isPaginated ? options.limit : null;
    const offset = isPaginated ? options.offset : null;

    const query = `
      SELECT t.id, t.projet_id, t.createur_id, t.executant_id, t.titre, t.description,
             t.priorite, t.date_debut, t.date_fin, t.statut, t.progress, t.created_at,
             t.completion_date, t.estimated_hours, t.spent_hours,
             p.titre as projet_titre,
             eu.nom as createur_nom, eu.prenom as createur_prenom
      FROM tache t
      JOIN projet p ON p.id = t.projet_id
      JOIN utilisateur eu ON eu.id = t.createur_id
      WHERE t.${col} = $1
      ORDER BY t.date_debut DESC NULLS LAST
      ${isPaginated ? 'LIMIT $2 OFFSET $3' : ''}
    `;

    const params = isPaginated ? [userId, limit, offset] : [userId];
    const result = await pool.query(query, params);

    if (!isPaginated) return result.rows;

    const countRes = await pool.query(
      `SELECT COUNT(*) as total FROM tache WHERE ${col} = $1`,
      [userId]
    );
    return { data: result.rows, total: parseInt(countRes.rows[0].total) };
  }

  async findById(id) {
    const result = await pool.query(
      'SELECT id, projet_id, createur_id, executant_id, titre, description, priorite, date_debut, date_fin, statut, progress, created_at, completion_date, estimated_hours, spent_hours FROM tache WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  async create(tache) {
    const { projet_id, createur_id, executant_id, titre, description, priorite, date_debut, date_fin, progress, estimated_hours, spent_hours, created_at, completion_date, statut } = tache;
    const result = await pool.query(
      `INSERT INTO tache (projet_id, createur_id, executant_id, titre, description, priorite, date_debut, date_fin, progress, estimated_hours, spent_hours, created_at, completion_date, statut)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id, projet_id, createur_id, executant_id, titre, description, priorite, date_debut, date_fin, statut, progress, created_at, completion_date, estimated_hours, spent_hours`,
      [projet_id, createur_id, executant_id, titre, description || '', priorite || 'MOYENNE', date_debut, date_fin, progress, estimated_hours, spent_hours, created_at, completion_date, statut]
    );
    return result.rows[0];
  }

  async update(id, tache) {
    const { titre, description, priorite, statut, date_debut, date_fin, progress, estimated_hours, spent_hours, completion_date } = tache;
    await pool.query(
      `UPDATE tache SET
        titre = $1, description = $2, priorite = $3, statut = $4,
        date_debut = $5, date_fin = $6, progress = $7,
        estimated_hours = $8, spent_hours = $9, completion_date = $10
       WHERE id = $11`,
      [titre, description, priorite, statut, date_debut, date_fin, progress, estimated_hours, spent_hours, completion_date, id]
    );
  }

  async delete(id) {
    const taskRes = await pool.query('SELECT projet_id FROM tache WHERE id = $1', [id]);
    const projetId = taskRes.rows.length > 0 ? taskRes.rows[0].projet_id : null;
    await pool.query('DELETE FROM tache WHERE id = $1', [id]);
    return projetId;
  }

  async getProjectSummary(projectId) {
    const result = await pool.query(
      `SELECT p.stage_id,
              COALESCE(AVG(t.progress), 0) as avg_progress,
              COUNT(t.id) as total_tasks,
              COUNT(t.id) FILTER (WHERE t.statut = 'TERMINEE') as completed_tasks
       FROM projet p
       LEFT JOIN tache t ON t.projet_id = p.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [projectId]
    );
    return result.rows[0];
  }
}

module.exports = new TacheRepository();
