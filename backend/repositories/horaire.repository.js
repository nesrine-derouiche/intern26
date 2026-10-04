const pool = require('../config/db');

class HoraireRepository {
  async findByStageId(stageId) {
    const result = await pool.query(
      `SELECT id, stage_id, heure_debut, heure_fin, duree_pause_minutes,
              created_at, updated_at
       FROM horaire WHERE stage_id = $1`,
      [stageId]
    );
    return result.rows[0] || null;
  }

  async create({ stage_id, heure_debut, heure_fin, duree_pause_minutes }) {
    const result = await pool.query(
      `INSERT INTO horaire (stage_id, heure_debut, heure_fin, duree_pause_minutes)
       VALUES ($1, $2, $3, $4)
       RETURNING id, stage_id, heure_debut, heure_fin, duree_pause_minutes, created_at, updated_at`,
      [stage_id, heure_debut || '09:00', heure_fin || '17:00', duree_pause_minutes || 60]
    );
    return result.rows[0];
  }

  async upsert({ stage_id, heure_debut, heure_fin, duree_pause_minutes }) {
    const result = await pool.query(
      `INSERT INTO horaire (stage_id, heure_debut, heure_fin, duree_pause_minutes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (stage_id) DO UPDATE SET
         heure_debut = EXCLUDED.heure_debut,
         heure_fin = EXCLUDED.heure_fin,
         duree_pause_minutes = EXCLUDED.duree_pause_minutes
       RETURNING id, stage_id, heure_debut, heure_fin, duree_pause_minutes, created_at, updated_at`,
      [stage_id, heure_debut || '09:00', heure_fin || '17:00', duree_pause_minutes || 60]
    );
    return result.rows[0];
  }

  async update(stageId, { heure_debut, heure_fin, duree_pause_minutes }) {
    const fields = [];
    const params = [];
    let paramIndex = 1;

    if (heure_debut !== undefined) { fields.push(`heure_debut = $${paramIndex}`); params.push(heure_debut); paramIndex++; }
    if (heure_fin !== undefined) { fields.push(`heure_fin = $${paramIndex}`); params.push(heure_fin); paramIndex++; }
    if (duree_pause_minutes !== undefined) { fields.push(`duree_pause_minutes = $${paramIndex}`); params.push(duree_pause_minutes); paramIndex++; }

    if (fields.length === 0) return this.findByStageId(stageId);

    params.push(stageId);
    const result = await pool.query(
      `UPDATE horaire SET ${fields.join(', ')} WHERE stage_id = $${paramIndex}
       RETURNING id, stage_id, heure_debut, heure_fin, duree_pause_minutes, created_at, updated_at`,
      params
    );
    return result.rows[0] || null;
  }

  async delete(stageId) {
    await pool.query('DELETE FROM horaire WHERE stage_id = $1', [stageId]);
  }
}

module.exports = new HoraireRepository();
