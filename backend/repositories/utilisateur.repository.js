const pool = require('../config/db');

class UtilisateurRepository {
  /** Retourne les id des utilisateurs ayant le rôle donné (actifs). */
  async findIdsByRole(role) {
    const result = await pool.query(
      'SELECT id FROM utilisateur WHERE role = $1 AND actif = true',
      [role]
    );
    return result.rows.map((row) => row.id);
  }
}

module.exports = new UtilisateurRepository();
