const pool = require('../config/db');
const { scopeFilter } = require('../utils/scope.util');

class PointageRepository {
  async findById(id) {
    const result = await pool.query(
      `SELECT p.id, p.stage_id, p.date_pointage, p.heure_entree, p.heure_sortie,
              p.duree_minutes, p.retard_minutes, p.statut, p.commentaire,
              p.created_at, p.updated_at,
              st.stagiaire_id, st.encadrant_id, st.departement_id,
              su.nom as stagiaire_nom, su.prenom as stagiaire_prenom,
              eu.nom as encadrant_nom, eu.prenom as encadrant_prenom,
              d.nom as departement_nom
       FROM pointage p
       JOIN stage st ON st.id = p.stage_id
       JOIN utilisateur su ON su.id = st.stagiaire_id
       JOIN utilisateur eu ON eu.id = st.encadrant_id
       JOIN departement d ON d.id = st.departement_id
       WHERE p.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findStageContext(pointageId) {
    const result = await pool.query(
      `SELECT st.stagiaire_id, st.encadrant_id, st.departement_id
       FROM pointage p
       JOIN stage st ON st.id = p.stage_id
       WHERE p.id = $1`,
      [pointageId]
    );
    return result.rows[0] || null;
  }

  async findByStageAndDate(stageId, date) {
    const result = await pool.query(
      `SELECT p.id, p.stage_id, p.date_pointage, p.heure_entree, p.heure_sortie,
              p.duree_minutes, p.retard_minutes, p.statut, p.commentaire,
              p.created_at, p.updated_at
       FROM pointage p
       WHERE p.stage_id = $1 AND p.date_pointage = $2`,
      [stageId, date]
    );
    return result.rows[0] || null;
  }

  async findAll(options = null, scope = null, filters = {}) {
    const isPaginated = !!(options && options.enabled);
    const limit = isPaginated ? options.limit : null;
    const offset = isPaginated ? options.offset : null;
    const filter = scopeFilter(scope, 'presences');
    const filterSql = filter.sql;
    let baseParams = [...filter.params];

    let extraWhere = '';
    if (filters.stage_id) {
      baseParams.push(filters.stage_id);
      extraWhere += ` AND p.stage_id = $${baseParams.length}`;
    }
    if (filters.statut) {
      baseParams.push(filters.statut);
      extraWhere += ` AND p.statut = $${baseParams.length}`;
    }
    if (filters.date_debut) {
      baseParams.push(filters.date_debut);
      extraWhere += ` AND p.date_pointage >= $${baseParams.length}`;
    }
    if (filters.date_fin) {
      baseParams.push(filters.date_fin);
      extraWhere += ` AND p.date_pointage <= $${baseParams.length}`;
    }

    const query = `
      SELECT p.id, p.stage_id, p.date_pointage, p.heure_entree, p.heure_sortie,
             p.duree_minutes, p.retard_minutes, p.statut, p.commentaire,
             p.created_at, p.updated_at,
             su.nom as stagiaire_nom, su.prenom as stagiaire_prenom,
             eu.nom as encadrant_nom, eu.prenom as encadrant_prenom,
             d.nom as departement_nom
      FROM pointage p
      JOIN stage st ON st.id = p.stage_id
      JOIN utilisateur su ON su.id = st.stagiaire_id
      JOIN utilisateur eu ON eu.id = st.encadrant_id
      JOIN departement d ON d.id = st.departement_id
      WHERE 1 = 1${filterSql}${extraWhere}
      ORDER BY p.date_pointage DESC, p.heure_entree DESC
      ${isPaginated ? `LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}` : ''}
    `;

    const params = isPaginated ? [...baseParams, limit, offset] : baseParams;
    const result = await pool.query(query, params);

    if (!isPaginated) return result.rows;

    const countFilter = scopeFilter(scope, 'presences');
    let countParams = [...countFilter.params];
    let countExtraWhere = '';
    if (filters.stage_id) {
      countParams.push(filters.stage_id);
      countExtraWhere += ` AND p.stage_id = $${countParams.length}`;
    }
    if (filters.statut) {
      countParams.push(filters.statut);
      countExtraWhere += ` AND p.statut = $${countParams.length}`;
    }
    if (filters.date_debut) {
      countParams.push(filters.date_debut);
      countExtraWhere += ` AND p.date_pointage >= $${countParams.length}`;
    }
    if (filters.date_fin) {
      countParams.push(filters.date_fin);
      countExtraWhere += ` AND p.date_pointage <= $${countParams.length}`;
    }
    const countRes = await pool.query(
      `SELECT COUNT(*) as total FROM pointage p
       JOIN stage st ON st.id = p.stage_id
       WHERE 1 = 1${countFilter.sql}${countExtraWhere}`,
      countParams
    );
    return { data: result.rows, total: parseInt(countRes.rows[0].total) };
  }

  async findByStagiaire(stagiaireId, options = null, filters = {}) {
    const isPaginated = !!(options && options.enabled);
    const limit = isPaginated ? options.limit : null;
    const offset = isPaginated ? options.offset : null;
    let params = [stagiaireId];
    let extraWhere = '';

    if (filters.date_debut) {
      params.push(filters.date_debut);
      extraWhere += ` AND p.date_pointage >= $${params.length}`;
    }
    if (filters.date_fin) {
      params.push(filters.date_fin);
      extraWhere += ` AND p.date_pointage <= $${params.length}`;
    }

    const query = `
      SELECT p.id, p.stage_id, p.date_pointage, p.heure_entree, p.heure_sortie,
             p.duree_minutes, p.retard_minutes, p.statut, p.commentaire,
             p.created_at, p.updated_at
      FROM pointage p
      JOIN stage st ON st.id = p.stage_id
      WHERE st.stagiaire_id = $1${extraWhere}
      ORDER BY p.date_pointage DESC, p.heure_entree DESC
      ${isPaginated ? `LIMIT $${params.length + 1} OFFSET $${params.length + 2}` : ''}
    `;

    if (isPaginated) params.push(limit, offset);
    const result = await pool.query(query, params);

    if (!isPaginated) return result.rows;

    let countParams = [stagiaireId];
    let countExtraWhere = '';
    if (filters.date_debut) {
      countParams.push(filters.date_debut);
      countExtraWhere += ` AND p.date_pointage >= $${countParams.length}`;
    }
    if (filters.date_fin) {
      countParams.push(filters.date_fin);
      countExtraWhere += ` AND p.date_pointage <= $${countParams.length}`;
    }
    const countRes = await pool.query(
      `SELECT COUNT(*) as total FROM pointage p
       JOIN stage st ON st.id = p.stage_id
       WHERE st.stagiaire_id = $1${countExtraWhere}`,
      countParams
    );
    return { data: result.rows, total: parseInt(countRes.rows[0].total) };
  }

  async create({ stage_id, date_pointage, heure_entree, retard_minutes, statut, commentaire }) {
    const result = await pool.query(
      `INSERT INTO pointage (stage_id, date_pointage, heure_entree, retard_minutes, statut, commentaire)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, stage_id, date_pointage, heure_entree, heure_sortie,
                 duree_minutes, retard_minutes, statut, commentaire, created_at, updated_at`,
      [stage_id, date_pointage, heure_entree, retard_minutes || 0, statut || 'PRESENT', commentaire || null]
    );
    return result.rows[0];
  }

  async setSortie(id, heure_sortie) {
    const result = await pool.query(
      `UPDATE pointage SET heure_sortie = $2 WHERE id = $1
       RETURNING id, stage_id, date_pointage, heure_entree, heure_sortie,
                 duree_minutes, retard_minutes, statut, commentaire, created_at, updated_at`,
      [id, heure_sortie]
    );
    return result.rows[0] || null;
  }

  async update(id, { heure_entree, heure_sortie, retard_minutes, statut, commentaire }) {
    const fields = [];
    const params = [];
    let paramIndex = 1;

    if (heure_entree !== undefined) { fields.push(`heure_entree = $${paramIndex}`); params.push(heure_entree); paramIndex++; }
    if (heure_sortie !== undefined) { fields.push(`heure_sortie = $${paramIndex}`); params.push(heure_sortie); paramIndex++; }
    if (retard_minutes !== undefined) { fields.push(`retard_minutes = $${paramIndex}`); params.push(retard_minutes); paramIndex++; }
    if (statut !== undefined) { fields.push(`statut = $${paramIndex}`); params.push(statut); paramIndex++; }
    if (commentaire !== undefined) { fields.push(`commentaire = $${paramIndex}`); params.push(commentaire); paramIndex++; }

    if (fields.length === 0) return this.findById(id);

    params.push(id);
    const result = await pool.query(
      `UPDATE pointage SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, stage_id, date_pointage, heure_entree, heure_sortie,
                 duree_minutes, retard_minutes, statut, commentaire, created_at, updated_at`,
      params
    );
    return result.rows[0] || null;
  }

  async delete(id) {
    await pool.query('DELETE FROM pointage WHERE id = $1', [id]);
  }

  async getStatsByStage(stageId, dateDebut, dateFin) {
    let params = [stageId];
    let dateFilter = '';
    if (dateDebut) {
      params.push(dateDebut);
      dateFilter += ` AND p.date_pointage >= $${params.length}`;
    }
    if (dateFin) {
      params.push(dateFin);
      dateFilter += ` AND p.date_pointage <= $${params.length}`;
    }

    const result = await pool.query(
      `SELECT
         COUNT(*) as total_jours,
         COUNT(*) FILTER (WHERE p.statut = 'PRESENT') as presents,
         COUNT(*) FILTER (WHERE p.statut = 'RETARD') as retards,
         COUNT(*) FILTER (WHERE p.statut = 'ABSENT') as absents,
         COALESCE(SUM(p.duree_minutes), 0) as total_minutes,
         COALESCE(AVG(p.duree_minutes), 0) as moyenne_minutes,
         COALESCE(SUM(p.retard_minutes), 0) as total_retard_minutes
       FROM pointage p
       WHERE p.stage_id = $1${dateFilter}`,
      params
    );
    return result.rows[0];
  }
}

module.exports = new PointageRepository();
