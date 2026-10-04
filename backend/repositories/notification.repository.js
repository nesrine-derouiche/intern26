const pool = require('../config/db');
const { DEFAULT_LIMIT } = require('../utils/pagination.util');

class NotificationRepository {
  async findByUser(userId, options = null) {
    const isPaginated = !!(options && options.enabled);
    const limit = isPaginated ? options.limit : DEFAULT_LIMIT;
    const offset = isPaginated ? options.offset : 0;
    const types = options && Array.isArray(options.types) && options.types.length ? options.types : null;

    const params = [userId];
    let where = 'WHERE utilisateur_id = $1';
    if (types) {
      where += ` AND type = ANY($${params.length + 1}::varchar[])`;
      params.push(types);
    }

    const result = await pool.query(
      `SELECT id, utilisateur_id, titre, message, date, type, lue, lien
       FROM notification
       ${where}
       ORDER BY date DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    if (!isPaginated) return result.rows;

    const countRes = await pool.query(
      `SELECT COUNT(*) as total FROM notification ${where}`,
      params
    );
    return { data: result.rows, total: parseInt(countRes.rows[0].total) };
  }

  async countUnread(userId) {
    const res = await pool.query(
      'SELECT COUNT(*) as total FROM notification WHERE utilisateur_id = $1 AND lue = false',
      [userId]
    );
    return parseInt(res.rows[0].total);
  }

  async markAsRead(id, userId) {
    await pool.query(
      'UPDATE notification SET lue = true WHERE id = $1 AND utilisateur_id = $2',
      [id, userId]
    );
  }

  async markAllAsRead(userId) {
    await pool.query('UPDATE notification SET lue = true WHERE utilisateur_id = $1', [userId]);
  }

  async delete(id, userId) {
    await pool.query(
      'DELETE FROM notification WHERE id = $1 AND utilisateur_id = $2',
      [id, userId]
    );
  }

  async create(userId, titre, message, type, lien = null) {
    await pool.query(
      `INSERT INTO notification (utilisateur_id, titre, message, type, lien) VALUES ($1, $2, $3, $4, $5)`,
      [userId, titre, message, type, lien]
    );
  }
}

module.exports = new NotificationRepository();
