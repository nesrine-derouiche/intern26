const pool = require('../config/db');
const { scopeFilter } = require('../utils/scope.util');

/**
 * Lecture agrégée du planning (P1-2).
 *
 * Aucune écriture : la table `horaire` et la table `pointage` ne sont jamais
 * modifiées. Chaque appel effectue au plus 5 requêtes (stages + horaires +
 * réunions + tâches + pointages), toutes par lot `= ANY($1)` : pas de N+1.
 */
class PlanningRepository {
  /**
   * Stages accessibles pour l'utilisateur (scope) et, éventuellement, un stage
   * précis. Le filtre de scope est deny-safe (voir scope.util).
   */
  async findStages(scope, stageId = null) {
    const filter = scopeFilter(scope, 'stages');
    const params = [...filter.params];

    let sql = `
      SELECT st.id, st.stagiaire_id, st.encadrant_id, st.departement_id,
             st.date_debut, st.date_fin, st.statut
      FROM stage st
      WHERE 1 = 1${filter.sql}`;

    if (stageId) {
      params.push(stageId);
      sql += ` AND st.id = $${params.length}`;
    }

    sql += ' ORDER BY st.date_debut ASC, st.id ASC';

    const result = await pool.query(sql, params);
    return result.rows;
  }

  async findHoraires(stageIds) {
    if (!stageIds.length) return [];
    const result = await pool.query(
      `SELECT id, stage_id, heure_debut, heure_fin, duree_pause_minutes
       FROM horaire
       WHERE stage_id = ANY($1)
       ORDER BY stage_id`,
      [stageIds]
    );
    return result.rows;
  }

  async findReunions(stageIds, dateDebut = null, dateFin = null) {
    if (!stageIds.length) return [];
    const params = [stageIds];
    let dateFilter = '';

    if (dateDebut) {
      params.push(dateDebut);
      dateFilter += ` AND r.date >= $${params.length}`;
    }
    if (dateFin) {
      params.push(dateFin);
      dateFilter += ` AND r.date <= $${params.length}`;
    }

    const result = await pool.query(
      `SELECT r.id, r.stage_id, r.date, r.heure, r.salle, r.lien_visio, r.sujet
       FROM reunion r
       WHERE r.stage_id = ANY($1)${dateFilter}
       ORDER BY r.date ASC, r.heure ASC`,
      params
    );
    return result.rows;
  }

  async findTaches(stageIds, dateDebut = null, dateFin = null) {
    if (!stageIds.length) return [];
    const params = [stageIds];
    let dateFilter = '';

    if (dateDebut) {
      params.push(dateDebut);
      dateFilter += ` AND t.date_fin >= $${params.length}`;
    }
    if (dateFin) {
      params.push(dateFin);
      dateFilter += ` AND t.date_fin <= $${params.length}`;
    }

    const result = await pool.query(
      `SELECT t.id, t.projet_id, p.stage_id, t.titre, t.statut, t.progress,
              t.priorite, t.date_debut, t.date_fin
       FROM tache t
       JOIN projet p ON p.id = t.projet_id
       WHERE p.stage_id = ANY($1)
         AND t.date_fin IS NOT NULL${dateFilter}
       ORDER BY t.date_fin ASC, t.id ASC`,
      params
    );
    return result.rows;
  }

  async findPointages(stageIds, dateDebut = null, dateFin = null) {
    if (!stageIds.length) return [];
    const params = [stageIds];
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
      `SELECT p.id, p.stage_id, p.date_pointage, p.heure_entree, p.heure_sortie,
              p.retard_minutes, p.statut
       FROM pointage p
       WHERE p.stage_id = ANY($1)${dateFilter}
       ORDER BY p.date_pointage DESC, p.id ASC`,
      params
    );
    return result.rows;
  }
}

module.exports = new PlanningRepository();
