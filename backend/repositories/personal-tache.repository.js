const pool = require('../config/db');

class PersonalTacheRepository {
  async findByStagiaire(stagiaireId) {
    const res = await pool.query(
      `SELECT * FROM tache_personnelle
       WHERE stagiaire_id = $1
       ORDER BY statut, position, created_at`,
      [stagiaireId]
    );
    return res.rows;
  }

  async findById(id) {
    const res = await pool.query(
      'SELECT * FROM tache_personnelle WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }

  async create({ stagiaire_id, titre, description, priorite, date_echeance }) {
    const maxPos = await pool.query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next_pos
       FROM tache_personnelle
       WHERE stagiaire_id = $1 AND statut = 'A_FAIRE'`,
      [stagiaire_id]
    );
    const position = maxPos.rows[0].next_pos;

    const res = await pool.query(
      `INSERT INTO tache_personnelle (stagiaire_id, titre, description, priorite, date_echeance, position)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [stagiaire_id, titre, description || null, priorite || null, date_echeance || null, position]
    );
    return res.rows[0];
  }

  async update(id, { titre, description, priorite, date_echeance }) {
    const res = await pool.query(
      `UPDATE tache_personnelle
       SET titre = COALESCE($2, titre),
           description = $3,
           priorite = $4,
           date_echeance = $5
       WHERE id = $1
       RETURNING *`,
      [id, titre, description, priorite || null, date_echeance || null]
    );
    return res.rows[0] || null;
  }

  async delete(id) {
    const task = await this.findById(id);
    if (!task) return null;

    await pool.query('DELETE FROM tache_personnelle WHERE id = $1', [id]);

    await pool.query(
      `UPDATE tache_personnelle
       SET position = position - 1
       WHERE stagiaire_id = $1 AND statut = $2 AND position > $3`,
      [task.stagiaire_id, task.statut, task.position]
    );

    return task;
  }

  async move(id, { statut, position }) {
    const { withTransaction } = require('../config/db');

    return withTransaction(async (client) => {
      const lockRes = await client.query(
        'SELECT * FROM tache_personnelle WHERE id = $1 FOR UPDATE',
        [id]
      );
      const task = lockRes.rows[0];
      if (!task) return null;

      const oldStatut = task.statut;
      const oldPosition = task.position;
      const newStatut = statut || oldStatut;
      const newPosition = position != null ? position : oldPosition;

      if (newStatut === oldStatut && newPosition === oldPosition) {
        return task;
      }

      if (newStatut !== oldStatut) {
        await client.query(
          `UPDATE tache_personnelle
           SET position = position - 1
           WHERE stagiaire_id = $1 AND statut = $2 AND position > $3`,
          [task.stagiaire_id, oldStatut, oldPosition]
        );

        await client.query(
          `UPDATE tache_personnelle
           SET position = position + 1
           WHERE stagiaire_id = $1 AND statut = $2 AND position >= $3 AND id != $4`,
          [task.stagiaire_id, newStatut, newPosition, id]
        );
      } else {
        if (newPosition < oldPosition) {
          await client.query(
            `UPDATE tache_personnelle
             SET position = position + 1
             WHERE stagiaire_id = $1 AND statut = $2 AND position >= $3 AND position < $4 AND id != $5`,
            [task.stagiaire_id, newStatut, newPosition, oldPosition, id]
          );
        } else if (newPosition > oldPosition) {
          await client.query(
            `UPDATE tache_personnelle
             SET position = position - 1
             WHERE stagiaire_id = $1 AND statut = $2 AND position > $3 AND position <= $4 AND id != $5`,
            [task.stagiaire_id, newStatut, oldPosition, newPosition, id]
          );
        }
      }

      const updateRes = await client.query(
        `UPDATE tache_personnelle
         SET statut = $2, position = $3
         WHERE id = $1
         RETURNING *`,
        [id, newStatut, newPosition]
      );

      return updateRes.rows[0];
    });
  }

  async countByStatut(stagiaireId) {
    const res = await pool.query(
      `SELECT statut, COUNT(*)::int AS total
       FROM tache_personnelle
       WHERE stagiaire_id = $1
       GROUP BY statut`,
      [stagiaireId]
    );
    const counts = { A_FAIRE: 0, EN_COURS: 0, TERMINEE: 0 };
    for (const row of res.rows) {
      counts[row.statut] = row.total;
    }
    return counts;
  }
}

module.exports = new PersonalTacheRepository();
