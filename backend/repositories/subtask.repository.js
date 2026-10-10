const pool = require('../config/db');

const SUBTASK_COLUMNS =
  'id, tache_id, titre, description, statut, created_at, updated_at';

class SubtaskRepository {
  async create(data) {
    const { tache_id, titre, description, statut } = data;
    const result = await pool.query(
      `INSERT INTO subtask (tache_id, titre, description, statut)
       VALUES ($1, $2, $3, $4)
       RETURNING ${SUBTASK_COLUMNS}`,
      [tache_id, titre, description === undefined ? null : description, statut || 'TODO']
    );
    return result.rows[0];
  }

  async findById(id) {
    const result = await pool.query(
      `SELECT ${SUBTASK_COLUMNS} FROM subtask WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByTaskId(tacheId) {
    const result = await pool.query(
      `SELECT ${SUBTASK_COLUMNS} FROM subtask
        WHERE tache_id = $1
        ORDER BY created_at ASC`,
      [tacheId]
    );
    return result.rows;
  }

  async countByStatus(tacheId) {
    const result = await pool.query(
      `SELECT statut, count(*)::int AS n FROM subtask
        WHERE tache_id = $1
        GROUP BY statut`,
      [tacheId]
    );
    return result.rows;
  }

  async update(id, data) {
    const { titre, description, statut } = data;
    const result = await pool.query(
      `UPDATE subtask SET
         titre = COALESCE($1, titre),
         description = COALESCE($2, description),
         statut = COALESCE($3, statut)
       WHERE id = $4
       RETURNING ${SUBTASK_COLUMNS}`,
      [
        titre === undefined ? null : titre,
        description === undefined ? null : description,
        statut === undefined ? null : statut,
        id
      ]
    );
    return result.rows[0] || null;
  }

  async remove(id) {
    const result = await pool.query(
      'DELETE FROM subtask WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  }
}

module.exports = new SubtaskRepository();
