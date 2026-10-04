const pool = require('../config/db');

class DeviceTokenRepository {
  async upsert(userId, token, platform = 'android') {
    await pool.query(
      `INSERT INTO device_token (utilisateur_id, token, platform, last_seen_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (token) DO UPDATE
         SET utilisateur_id = EXCLUDED.utilisateur_id,
             platform       = EXCLUDED.platform,
             last_seen_at   = now()`,
      [userId, token, platform]
    );
  }

  async deleteByUserAndToken(userId, token) {
    await pool.query(
      'DELETE FROM device_token WHERE token = $1 AND utilisateur_id = $2',
      [token, userId]
    );
  }

  async deleteToken(token) {
    await pool.query('DELETE FROM device_token WHERE token = $1', [token]);
  }

  async findTokensByUser(userId) {
    const result = await pool.query(
      'SELECT token FROM device_token WHERE utilisateur_id = $1',
      [userId]
    );
    return result.rows.map((row) => row.token);
  }
}

module.exports = new DeviceTokenRepository();
