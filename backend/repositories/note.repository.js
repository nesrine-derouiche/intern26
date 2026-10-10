const pool = require('../config/db');

const NOTE_COLUMNS =
  'id, stagiaire_id, titre, contenu, pinned, client_key, created_at, updated_at';

class NoteRepository {
  async create(data) {
    const { stagiaire_id, titre, contenu, pinned, client_key } = data;
    const result = await pool.query(
      `INSERT INTO note (stagiaire_id, titre, contenu, pinned, client_key)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${NOTE_COLUMNS}`,
      [
        stagiaire_id,
        titre === undefined || titre === null ? '' : titre,
        contenu === undefined || contenu === null ? '' : contenu,
        pinned === undefined ? false : !!pinned,
        client_key === undefined ? null : client_key
      ]
    );
    return result.rows[0];
  }

  async findById(id) {
    const result = await pool.query(
      `SELECT ${NOTE_COLUMNS} FROM note WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByOwnerAndClientKey(stagiaireId, clientKey) {
    const result = await pool.query(
      `SELECT ${NOTE_COLUMNS} FROM note
        WHERE stagiaire_id = $1 AND client_key = $2`,
      [stagiaireId, clientKey]
    );
    return result.rows[0] || null;
  }

  async findByStagiaire(stagiaireId) {
    const result = await pool.query(
      `SELECT ${NOTE_COLUMNS} FROM note
        WHERE stagiaire_id = $1
        ORDER BY pinned DESC, updated_at DESC`,
      [stagiaireId]
    );
    return result.rows;
  }

  async update(id, data) {
    const { titre, contenu, pinned } = data;
    const result = await pool.query(
      `UPDATE note SET
         titre = COALESCE($1, titre),
         contenu = COALESCE($2, contenu),
         pinned = COALESCE($3, pinned)
       WHERE id = $4
       RETURNING ${NOTE_COLUMNS}`,
      [
        titre === undefined ? null : titre,
        contenu === undefined ? null : contenu,
        pinned === undefined ? null : !!pinned,
        id
      ]
    );
    return result.rows[0] || null;
  }

  async remove(id) {
    const result = await pool.query(
      'DELETE FROM note WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  }
}

module.exports = new NoteRepository();
