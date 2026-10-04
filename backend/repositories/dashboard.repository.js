const pool = require('../config/db');

class DashboardRepository {
  async getStagiairesStats(role, departementId = null) {
    if (role === 'CHEF_DEPARTEMENT') {
      const res = await pool.query(
        `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE s.disponibilite = true) as actifs
         FROM stagiaire s JOIN utilisateur u ON u.id = s.id
         WHERE u.actif = true
           AND s.id IN (SELECT st.stagiaire_id FROM stage st WHERE st.departement_id = $1)`,
        [departementId]
      );
      return res.rows[0];
    }
    if (role !== 'ADMIN' && role !== 'RH') return { total: 0, actifs: 0 };
    const res = await pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE s.disponibilite = true) as actifs FROM stagiaire s JOIN utilisateur u ON u.id = s.id WHERE u.actif = true');
    return res.rows[0];
  }

  async getStagesStats(whereStr, params) {
    const res = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE st.statut = 'EN_COURS') as en_cours,
        COUNT(*) FILTER (WHERE st.statut = 'TERMINE') as termines,
        COUNT(*) FILTER (WHERE st.statut = 'EN_ATTENTE') as en_attente,
        COUNT(*) FILTER (WHERE st.statut = 'SUSPENDU') as suspendus
      FROM stage st ${whereStr}
    `, params);
    return res.rows[0];
  }

  async getTachesStats(whereStr, params) {
    const res = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE t.statut = 'EN_COURS') as en_cours,
        COUNT(*) FILTER (WHERE t.statut = 'TERMINEE') as terminees,
        COUNT(*) FILTER (WHERE t.statut = 'A_FAIRE') as a_faire,
        COUNT(*) FILTER (WHERE t.statut = 'BLOQUEE') as bloquee
      FROM tache t ${whereStr}
    `, params);
    return res.rows[0];
  }

  async getTachesRetardStats(whereStr, params) {
    const res = await pool.query(`
      SELECT COUNT(*) as retard
      FROM tache t
      ${whereStr ? whereStr + " AND" : 'WHERE'} t.date_fin < NOW() AND t.statut != 'TERMINEE'
    `, params);
    return res.rows[0];
  }

  async getOffresStats(role, departementId = null) {
    if (role === 'CHEF_DEPARTEMENT') {
      const res = await pool.query(
        `SELECT
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE statut = 'OUVERTE') as ouvertes,
           COUNT(*) FILTER (WHERE statut = 'FERMEE') as fermees
         FROM offre_stage
         WHERE departement_id = $1`,
        [departementId]
      );
      return res.rows[0];
    }
    const where = role === 'STAGIAIRE' ? "WHERE statut = 'OUVERTE'" : '';
    const res = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE statut = 'OUVERTE') as ouvertes,
        COUNT(*) FILTER (WHERE statut = 'FERMEE') as fermees
      FROM offre_stage
      ${where}
    `);
    return res.rows[0];
  }

  async getCandidaturesStats(whereStr, params) {
    const res = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE c.statut = 'EN_ATTENTE') as en_attente,
        COUNT(*) FILTER (WHERE c.statut = 'ACCEPTEE') as acceptees,
        COUNT(*) FILTER (WHERE c.statut = 'REFUSEE') as refusees
      FROM candidature c ${whereStr}
    `, params);
    return res.rows[0];
  }

  async getDepartementsStats(departementId = null) {
    const where = departementId ? 'WHERE d.id = $1' : '';
    const params = departementId ? [departementId] : [];
    const res = await pool.query(`
      SELECT d.id, d.nom,
             (SELECT COUNT(*) FROM encadrant e WHERE e.departement_id = d.id) as nb_encadrants,
             (SELECT COUNT(*) FROM stage st WHERE st.departement_id = d.id AND st.statut = 'EN_COURS') as nb_stages_actifs
      FROM departement d
      ${where}
      ORDER BY nb_stages_actifs DESC, d.nom
    `, params);
    return res.rows;
  }

  async getNotificationsStats(userId) {
    const res = await pool.query('SELECT COUNT(*) as total FROM notification WHERE utilisateur_id = $1 AND lue = false', [userId]);
    return res.rows[0];
  }

  async getEncadrantsStats(role, departementId = null) {
    if (role === 'CHEF_DEPARTEMENT') {
      const res = await pool.query(
        `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE e.disponibilite = true) as actifs
         FROM encadrant e JOIN utilisateur u ON u.id = e.id
         WHERE u.actif = true AND e.departement_id = $1`,
        [departementId]
      );
      return res.rows[0];
    }
    if (role !== 'ADMIN' && role !== 'RH') return { total: 0, actifs: 0 };
    const res = await pool.query(
      `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE e.disponibilite = true) as actifs
       FROM encadrant e JOIN utilisateur u ON u.id = e.id
       WHERE u.actif = true`
    );
    return res.rows[0];
  }

  async getStagesStatutDistribution(whereStr, params) {
    const res = await pool.query(`
      SELECT st.statut, COUNT(*) as total
      FROM stage st
      WHERE 1 = 1${whereStr}
      GROUP BY st.statut
      ORDER BY total DESC
    `, params);
    return res.rows;
  }

  async getApplicationsByMonth(whereStr, params) {
    const res = await pool.query(`
      SELECT to_char(date_trunc('month', c.date_candidature), 'YYYY-MM') as mois,
             COUNT(*) as total
      FROM candidature c
      WHERE c.deleted_at IS NULL
        AND c.date_candidature >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
        ${whereStr}
      GROUP BY date_trunc('month', c.date_candidature)
      ORDER BY date_trunc('month', c.date_candidature)
    `, params);
    return res.rows;
  }

  async getStagesByDepartment(whereStr, params) {
    const res = await pool.query(`
      SELECT d.nom as departement, COUNT(*) as total,
             COUNT(*) FILTER (WHERE st.statut = 'EN_COURS') as actifs
      FROM stage st
      JOIN departement d ON d.id = st.departement_id
      WHERE 1 = 1${whereStr}
      GROUP BY d.id, d.nom
      ORDER BY total DESC
    `, params);
    return res.rows;
  }

  async getTopEncadrants(whereStr, params, limit = 5) {
    const res = await pool.query(`
      SELECT e.id as encadrant_id, u.nom, u.prenom, COUNT(st.id) as nb_stages,
             COUNT(*) FILTER (WHERE st.statut = 'EN_COURS') as nb_actifs
      FROM encadrant e
      JOIN utilisateur u ON u.id = e.id
      JOIN stage st ON st.encadrant_id = e.id
      WHERE 1 = 1${whereStr}
      GROUP BY e.id, u.nom, u.prenom
      ORDER BY nb_stages DESC
      LIMIT $${params.length + 1}
    `, [...params, limit]);
    return res.rows;
  }

  async getRecentCandidatures(whereStr, params, limit = 6) {
    const res = await pool.query(`
      SELECT c.id, c.stagiaire_id, c.offre_id, c.date_candidature, c.statut,
             su.nom as stagiaire_nom, su.prenom as stagiaire_prenom,
             o.titre as offre_titre, d.nom as departement_nom
      FROM candidature c
      JOIN utilisateur su ON su.id = c.stagiaire_id
      JOIN offre_stage o ON o.id = c.offre_id
      JOIN departement d ON d.id = o.departement_id
      WHERE c.deleted_at IS NULL${whereStr}
      ORDER BY c.date_candidature DESC
      LIMIT $${params.length + 1}
    `, [...params, limit]);
    return res.rows;
  }

  async getRecentStages(whereStr, params, limit = 6) {
    const res = await pool.query(`
      SELECT st.id, st.date_debut, st.date_fin, st.statut,
             su.nom as stagiaire_nom, su.prenom as stagiaire_prenom,
             eu.nom as encadrant_nom, eu.prenom as encadrant_prenom,
             d.nom as departement_nom, o.titre as offre_titre
      FROM stage st
      JOIN utilisateur su ON su.id = st.stagiaire_id
      JOIN utilisateur eu ON eu.id = st.encadrant_id
      JOIN departement d ON d.id = st.departement_id
      JOIN offre_stage o ON o.id = st.offre_id
      WHERE 1 = 1${whereStr}
      ORDER BY st.date_debut DESC
      LIMIT $${params.length + 1}
    `, [...params, limit]);
    return res.rows;
  }

  async getRecentDocuments(whereStr, params, limit = 6) {
    const res = await pool.query(`
      SELECT doc.id, doc.stage_id, doc.type, doc.nom, doc.date_depot,
             su.nom as stagiaire_nom, su.prenom as stagiaire_prenom,
             d.nom as departement_nom
      FROM document doc
      JOIN stage st ON st.id = doc.stage_id
      JOIN utilisateur su ON su.id = doc.stagiaire_id
      JOIN departement d ON d.id = st.departement_id
      WHERE 1 = 1${whereStr}
      ORDER BY doc.date_depot DESC
      LIMIT $${params.length + 1}
    `, [...params, limit]);
    return res.rows;
  }

  async getUpcomingReunions(whereStr, params, limit = 6, daysAhead = null) {
    const windowSql = daysAhead ? ` AND r.date <= CURRENT_DATE + ${daysAhead}` : '';
    const res = await pool.query(`
      SELECT r.id, r.stage_id, r.date, r.heure, r.salle, r.lien_visio, r.sujet,
             su.nom as stagiaire_nom, su.prenom as stagiaire_prenom,
             eu.nom as encadrant_nom, eu.prenom as encadrant_prenom,
             d.nom as departement_nom
      FROM reunion r
      JOIN stage st ON st.id = r.stage_id
      JOIN utilisateur su ON su.id = st.stagiaire_id
      JOIN utilisateur eu ON eu.id = st.encadrant_id
      JOIN departement d ON d.id = st.departement_id
      WHERE r.date >= CURRENT_DATE${windowSql}${whereStr}
      ORDER BY r.date ASC, r.heure ASC
      LIMIT $${params.length + 1}
    `, [...params, limit]);
    return res.rows;
  }

  async getRecentNotifications(role, userId, limit = 6) {
    const isGlobal = role === 'ADMIN' || role === 'RH';
    const where = isGlobal ? '' : 'WHERE n.utilisateur_id = $1';
    const params = isGlobal ? [limit] : [userId, limit];
    const res = await pool.query(`
      SELECT n.id, n.utilisateur_id, n.titre, n.message, n.date, n.type, n.lue
      FROM notification n
      ${where}
      ORDER BY n.date DESC
      LIMIT $${params.length}
    `, params);
    return res.rows;
  }

  async getEndingSoonStages(whereStr, params, limit = 10) {
    const res = await pool.query(`
      SELECT st.id, st.date_debut, st.date_fin,
             su.nom as stagiaire_nom, su.prenom as stagiaire_prenom,
             eu.nom as encadrant_nom, eu.prenom as encadrant_prenom,
             d.nom as departement_nom
      FROM stage st
      JOIN utilisateur su ON su.id = st.stagiaire_id
      JOIN utilisateur eu ON eu.id = st.encadrant_id
      JOIN departement d ON d.id = st.departement_id
      WHERE st.statut = 'EN_COURS'
        AND st.date_fin BETWEEN CURRENT_DATE AND (CURRENT_DATE + 7)${whereStr}
      ORDER BY st.date_fin ASC
      LIMIT $${params.length + 1}
    `, [...params, limit]);
    return res.rows;
  }

  async getMissingEvaluations(whereStr, params, limit = 10) {
    const res = await pool.query(`
      SELECT st.id, st.date_debut, st.date_fin,
             su.nom as stagiaire_nom, su.prenom as stagiaire_prenom,
             eu.nom as encadrant_nom, eu.prenom as encadrant_prenom,
             d.nom as departement_nom
      FROM stage st
      JOIN utilisateur su ON su.id = st.stagiaire_id
      JOIN utilisateur eu ON eu.id = st.encadrant_id
      JOIN departement d ON d.id = st.departement_id
      WHERE st.statut = 'EN_COURS'
        AND NOT EXISTS (SELECT 1 FROM evaluation ev WHERE ev.stage_id = st.id)${whereStr}
      ORDER BY st.date_fin ASC
      LIMIT $${params.length + 1}
    `, [...params, limit]);
    return res.rows;
  }

  async getReportsWaiting(whereStr, params, limit = 10) {
    const res = await pool.query(`
      SELECT r.id, r.stage_id, r.type, r.date, r.statut, r.contenu,
             su.nom as stagiaire_nom, su.prenom as stagiaire_prenom,
             d.nom as departement_nom,
             COUNT(*) OVER () as nb_total
      FROM rapport r
      JOIN stage st ON st.id = r.stage_id
      JOIN utilisateur su ON su.id = st.stagiaire_id
      JOIN departement d ON d.id = st.departement_id
      WHERE r.statut IN ('SOUMIS', 'EN_REVISION')${whereStr}
      ORDER BY r.date ASC
      LIMIT $${params.length + 1}
    `, [...params, limit]);
    return res.rows;
  }

  async getOffersExpiringSoon(whereStr, params, limit = 10) {
    const res = await pool.query(`
      SELECT o.id, o.titre, o.date_limite, o.duree, o.statut,
             d.nom as departement_nom
      FROM offre_stage o
      JOIN departement d ON d.id = o.departement_id
      WHERE o.statut = 'OUVERTE'
        AND o.date_limite <= (CURRENT_DATE + 30)
        AND o.date_limite >= CURRENT_DATE${whereStr}
      ORDER BY o.date_limite ASC
      LIMIT $${params.length + 1}
    `, [...params, limit]);
    return res.rows;
  }

  async getCandidaturesNouvellesStats(whereStr, params) {
    const res = await pool.query(`
      SELECT COUNT(*) as total
      FROM candidature c
      WHERE c.deleted_at IS NULL
        AND c.date_candidature >= CURRENT_DATE - 30${whereStr}
    `, params);
    return res.rows[0];
  }

  async getRecentAcceptedInterns(whereStr, params, limit = 6) {
    const res = await pool.query(`
      SELECT c.id, c.stagiaire_id, c.offre_id, c.date_candidature, c.statut,
             su.nom as stagiaire_nom, su.prenom as stagiaire_prenom, su.email as stagiaire_email,
             o.titre as offre_titre, d.nom as departement_nom,
             st.id as stage_id
      FROM candidature c
      JOIN utilisateur su ON su.id = c.stagiaire_id
      JOIN offre_stage o ON o.id = c.offre_id
      JOIN departement d ON d.id = o.departement_id
      LEFT JOIN stage st ON st.candidature_id = c.id
      WHERE c.deleted_at IS NULL AND c.statut = 'ACCEPTEE'${whereStr}
      ORDER BY c.date_candidature DESC
      LIMIT $${params.length + 1}
    `, [...params, limit]);
    return res.rows;
  }

  async getUpcomingStages(whereStr, params, limit = 6, daysAhead = null) {
    const windowSql = daysAhead ? ` AND st.date_debut <= CURRENT_DATE + ${daysAhead}` : '';
    const res = await pool.query(`
      SELECT st.id, st.date_debut, st.date_fin, st.statut,
             su.nom as stagiaire_nom, su.prenom as stagiaire_prenom,
             eu.nom as encadrant_nom, eu.prenom as encadrant_prenom,
             d.nom as departement_nom, o.titre as offre_titre
      FROM stage st
      JOIN utilisateur su ON su.id = st.stagiaire_id
      JOIN utilisateur eu ON eu.id = st.encadrant_id
      JOIN departement d ON d.id = st.departement_id
      JOIN offre_stage o ON o.id = st.offre_id
      WHERE st.date_debut >= CURRENT_DATE${windowSql}${whereStr}
      ORDER BY st.date_debut ASC
      LIMIT $${params.length + 1}
    `, [...params, limit]);
    return res.rows;
  }

  async getApplicationsByDepartment(whereStr, params) {
    const res = await pool.query(`
      SELECT d.nom as departement, COUNT(*) as total,
             COUNT(*) FILTER (WHERE c.statut = 'ACCEPTEE') as acceptees
      FROM candidature c
      JOIN offre_stage o ON o.id = c.offre_id
      JOIN departement d ON d.id = o.departement_id
      WHERE c.deleted_at IS NULL${whereStr}
      GROUP BY d.id, d.nom
      ORDER BY total DESC
    `, params);
    return res.rows;
  }

  async getOffresByDepartment(whereStr, params) {
    const res = await pool.query(`
      SELECT d.nom as departement, COUNT(*) as total,
             COUNT(*) FILTER (WHERE o.statut = 'OUVERTE') as ouvertes,
             COUNT(*) FILTER (WHERE o.statut = 'FERMEE') as fermees
      FROM offre_stage o
      JOIN departement d ON d.id = o.departement_id
      WHERE 1 = 1${whereStr}
      GROUP BY d.id, d.nom
      ORDER BY total DESC
    `, params);
    return res.rows;
  }

  async getRecruitmentStats(whereStr, params) {
    const res = await pool.query(`
      SELECT c.statut, COUNT(*) as total
      FROM candidature c
      WHERE c.deleted_at IS NULL${whereStr}
      GROUP BY c.statut
      ORDER BY total DESC
    `, params);
    return res.rows;
  }

  async getStagesWithoutDocuments(whereStr, params, limit = 10) {
    const res = await pool.query(`
      SELECT st.id, st.date_debut, st.date_fin,
             su.nom as stagiaire_nom, su.prenom as stagiaire_prenom,
             eu.nom as encadrant_nom, eu.prenom as encadrant_prenom,
             d.nom as departement_nom
      FROM stage st
      JOIN utilisateur su ON su.id = st.stagiaire_id
      JOIN utilisateur eu ON eu.id = st.encadrant_id
      JOIN departement d ON d.id = st.departement_id
      WHERE st.statut = 'EN_COURS'
        AND NOT EXISTS (SELECT 1 FROM document doc WHERE doc.stage_id = st.id)${whereStr}
      ORDER BY st.date_fin ASC
      LIMIT $${params.length + 1}
    `, [...params, limit]);
    return res.rows;
  }

  async getMyInternsStats(whereStr, params) {
    const res = await pool.query(`
      SELECT COUNT(DISTINCT st.stagiaire_id) as total,
             COUNT(DISTINCT st.stagiaire_id) FILTER (WHERE st.statut = 'EN_COURS') as actifs
      FROM stage st WHERE 1 = 1${whereStr}
    `, params);
    return res.rows[0];
  }

  async getMeetingsStats(whereStr, params) {
    const res = await pool.query(`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE r.date >= CURRENT_DATE) as a_venir
      FROM reunion r
      JOIN stage st ON st.id = r.stage_id
      WHERE 1 = 1${whereStr}
    `, params);
    return res.rows[0];
  }

  async getMeetingsByMonth(whereStr, params) {
    const res = await pool.query(`
      SELECT to_char(date_trunc('month', r.date), 'YYYY-MM') as mois,
             COUNT(*) as total
      FROM reunion r
      JOIN stage st ON st.id = r.stage_id
      WHERE r.date >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'${whereStr}
      GROUP BY date_trunc('month', r.date)
      ORDER BY date_trunc('month', r.date)
    `, params);
    return res.rows;
  }

  async getTasksDueTodayOrOverdue(whereStr, params) {
    const res = await pool.query(`
      (
        SELECT t.id, t.titre, t.priorite, t.statut, t.date_fin, t.progress,
               su.nom as executant_nom, su.prenom as executant_prenom,
               p.titre as projet_titre,
               TRUE as est_du_jour
        FROM tache t
        JOIN projet p ON p.id = t.projet_id
        JOIN utilisateur su ON su.id = t.executant_id
        WHERE t.date_fin = CURRENT_DATE${whereStr}
        ORDER BY t.priorite DESC, t.date_fin ASC
        LIMIT $${params.length + 1}
      )
      UNION ALL
      (
        SELECT t.id, t.titre, t.priorite, t.statut, t.date_fin, t.progress,
               su.nom as executant_nom, su.prenom as executant_prenom,
               p.titre as projet_titre,
               FALSE as est_du_jour
        FROM tache t
        JOIN projet p ON p.id = t.projet_id
        JOIN utilisateur su ON su.id = t.executant_id
        WHERE t.date_fin < CURRENT_DATE AND t.statut != 'TERMINEE'${whereStr}
        ORDER BY t.date_fin ASC
        LIMIT $${params.length + 2}
      )
    `, [...params, 6, 10]);
    return res.rows;
  }

  async getSubmittedReports(whereStr, params, limit = 10) {
    const res = await pool.query(`
      SELECT r.id, r.stage_id, r.type, r.date, r.statut,
             su.nom as stagiaire_nom, su.prenom as stagiaire_prenom,
             d.nom as departement_nom
      FROM rapport r
      JOIN stage st ON st.id = r.stage_id
      JOIN utilisateur su ON su.id = st.stagiaire_id
      JOIN departement d ON d.id = st.departement_id
      WHERE r.statut = 'SOUMIS'${whereStr}
      ORDER BY r.date DESC
      LIMIT $${params.length + 1}
    `, [...params, limit]);
    return res.rows;
  }

  async getInternshipsProgress(whereStr, params, limit = 6) {
    const res = await pool.query(`
      SELECT st.id, st.date_debut, st.date_fin,
             su.nom as stagiaire_nom, su.prenom as stagiaire_prenom,
             LEAST(100, GREATEST(0, ROUND(100.0 * (CURRENT_DATE - st.date_debut) / NULLIF((st.date_fin - st.date_debut), 0))))::int as progress
      FROM stage st
      JOIN utilisateur su ON su.id = st.stagiaire_id
      WHERE st.statut = 'EN_COURS'${whereStr}
      ORDER BY progress DESC
      LIMIT $${params.length + 1}
    `, [...params, limit]);
    return res.rows;
  }
}

module.exports = new DashboardRepository();
