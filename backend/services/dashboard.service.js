const dashboardRepository = require('../repositories/dashboard.repository');
const { scopeFilter } = require('../utils/scope.util');

class DashboardService {
  async getStats(user, scope) {
    const departementId = scope ? scope.departementId : null;
    const filters = this._buildRoleFilters(user.role, user.id, departementId);

    const scopeF = (type) => scopeFilter(scope, type);
    const stagesF = scopeF('stages');
    const candF = scopeF('candidatures');
    const reunF = scopeF('reunions');
    const docF = scopeF('documents');
    const offF = scopeF('offres');
    const rappF = scopeF('rapports');
    const tachesF = scopeF('taches');

    const [
      stag, stages, taches, tachesRetard, offres, candidatures, depts, notifs,
      encadrants, statutDist, appsMois, deptStages, topEnc,
      recentCands, recentSts, recentDocs, upcomingR, recentNotifs,
      endingSoon, missingEval, reportsWait, offersExpiring,
      candNouvelles, recentAccepted, upcomingStages, appsByDept, offresByDept,
      recruitStats, stagesNoDocs, reunionsSoon, stagesThisWeek
    ] = await Promise.all([
      dashboardRepository.getStagiairesStats(user.role, departementId),
      dashboardRepository.getStagesStats(filters.stagesWhere, filters.stagesParams),
      dashboardRepository.getTachesStats(filters.tachesWhere, filters.tachesParams),
      dashboardRepository.getTachesRetardStats(filters.tachesWhere, filters.tachesParams),
      dashboardRepository.getOffresStats(user.role, departementId),
      dashboardRepository.getCandidaturesStats(filters.candWhere, filters.candParams),
      dashboardRepository.getDepartementsStats(departementId),
      dashboardRepository.getNotificationsStats(user.id),
      dashboardRepository.getEncadrantsStats(user.role, departementId),
      dashboardRepository.getStagesStatutDistribution(stagesF.sql, stagesF.params),
      dashboardRepository.getApplicationsByMonth(candF.sql, candF.params),
      dashboardRepository.getStagesByDepartment(stagesF.sql, stagesF.params),
      dashboardRepository.getTopEncadrants(stagesF.sql, stagesF.params),
      dashboardRepository.getRecentCandidatures(candF.sql, candF.params),
      dashboardRepository.getRecentStages(stagesF.sql, stagesF.params),
      dashboardRepository.getRecentDocuments(docF.sql, docF.params),
      dashboardRepository.getUpcomingReunions(reunF.sql, reunF.params),
      dashboardRepository.getRecentNotifications(user.role, user.id),
      dashboardRepository.getEndingSoonStages(stagesF.sql, stagesF.params),
      dashboardRepository.getMissingEvaluations(stagesF.sql, stagesF.params),
      dashboardRepository.getReportsWaiting(rappF.sql, rappF.params),
      dashboardRepository.getOffersExpiringSoon(offF.sql, offF.params),
      dashboardRepository.getCandidaturesNouvellesStats(candF.sql, candF.params),
      dashboardRepository.getRecentAcceptedInterns(candF.sql, candF.params),
      dashboardRepository.getUpcomingStages(stagesF.sql, stagesF.params),
      dashboardRepository.getApplicationsByDepartment(candF.sql, candF.params),
      dashboardRepository.getOffresByDepartment(offF.sql, offF.params),
      dashboardRepository.getRecruitmentStats(candF.sql, candF.params),
      dashboardRepository.getStagesWithoutDocuments(docF.sql, docF.params),
      dashboardRepository.getUpcomingReunions(reunF.sql, reunF.params, 6, 7),
      dashboardRepository.getUpcomingStages(stagesF.sql, stagesF.params, 10, 7)
    ]);

    const encadrant = user.role === 'ENCADRANT'
      ? await this._getEncadrantStats(stagesF, tachesF, reunF, rappF, reportsWait)
      : null;

    return this._buildStatsResponse({
      stag, stages, taches, tachesRetard, offres, candidatures, depts, notifs,
      encadrants, statutDist, appsMois, deptStages, topEnc,
      recentCands, recentSts, recentDocs, upcomingR, recentNotifs,
      endingSoon, missingEval, reportsWait, offersExpiring,
      candNouvelles, recentAccepted, upcomingStages, appsByDept, offresByDept,
      recruitStats, stagesNoDocs, reunionsSoon, stagesThisWeek,
      encadrant
    }, user.role);
  }

  _buildStatsResponse({
    stag, stages, taches, tachesRetard, offres, candidatures, depts, notifs,
    encadrants, statutDist, appsMois, deptStages, topEnc,
    recentCands, recentSts, recentDocs, upcomingR, recentNotifs,
    endingSoon, missingEval, reportsWait, offersExpiring,
    candNouvelles, recentAccepted, upcomingStages, appsByDept, offresByDept,
    recruitStats, stagesNoDocs, reunionsSoon, stagesThisWeek,
    encadrant
  }, role) {
    return {
      stagiairesTotal: parseInt(stag.total),
      stagiairesActifs: parseInt(stag.actifs),
      encadrantsTotal: parseInt(encadrants.total),
      encadrantsActifs: parseInt(encadrants.actifs),
      stagesTotal: parseInt(stages.total),
      stagesEnCours: parseInt(stages.en_cours),
      stagesTermines: parseInt(stages.termines),
      stagesEnAttente: parseInt(stages.en_attente),
      stagesSuspendus: parseInt(stages.suspendus),
      tachesTotal: parseInt(taches.total),
      tachesEnCours: parseInt(taches.en_cours),
      tachesTerminees: parseInt(taches.terminees),
      tachesAFaire: parseInt(taches.a_faire),
      tachesBloquees: parseInt(taches.bloquee),
      tachesEnRetard: parseInt(tachesRetard.retard),
      offresTotal: parseInt(offres.total),
      offresOuvertes: parseInt(offres.ouvertes),
      offresFermees: parseInt(offres.fermees),
      candidaturesTotal: parseInt(candidatures.total),
      candidaturesNouvelles: parseInt(candNouvelles.total),
      candidaturesEnAttente: parseInt(candidatures.en_attente),
      candidaturesAcceptees: parseInt(candidatures.acceptees),
      candidaturesRefusees: parseInt(candidatures.refusees),
      departementsTotal: depts.length,
      departements: depts,
      notificationsNonLues: parseInt(notifs.total),
      repartitionStatutsStages: statutDist.map((r) => ({ statut: r.statut, total: parseInt(r.total) })),
      applicationsParMois: this._buildMonthsSeries(appsMois),
      stagesParDepartement: deptStages.map((r) => ({
        departement: r.departement,
        total: parseInt(r.total),
        actifs: parseInt(r.actifs)
      })),
      topEncadrants: topEnc.map((r) => ({
        encadrant_id: r.encadrant_id,
        nom: r.nom,
        prenom: r.prenom,
        nb_stages: parseInt(r.nb_stages),
        nb_actifs: parseInt(r.nb_actifs)
      })),
      recentCandidatures: recentCands,
      recentStages: recentSts,
      recentDocuments: recentDocs,
      prochainesReunions: upcomingR,
      recentNotifications: recentNotifs,
      recentInternsAcceptes: recentAccepted,
      prochainsStages: upcomingStages,
      applicationsParDepartement: appsByDept.map((r) => ({
        departement: r.departement,
        total: parseInt(r.total),
        acceptees: parseInt(r.acceptees)
      })),
      offresParDepartement: offresByDept.map((r) => ({
        departement: r.departement,
        total: parseInt(r.total),
        ouvertes: parseInt(r.ouvertes),
        fermees: parseInt(r.fermees)
      })),
      recrutementStatistiques: recruitStats.map((r) => ({
        statut: r.statut,
        total: parseInt(r.total)
      })),
      alerts: {
        stagesSeTerminantSous7Jours: endingSoon,
        evaluationsManquantes: missingEval,
        rapportsEnAttente: reportsWait.map(({ nb_total, ...rest }) => rest),
        offresExpirantBientot: offersExpiring,
        documentsManquants: stagesNoDocs,
        entretiensAPrevoir: reunionsSoon,
        stagesDemarrantCetteSemaine: stagesThisWeek
      },
      encadrant,
      userRole: role
    };
  }

  _buildMonthsSeries(rows) {
    const byMonth = new Map(rows.map((r) => [r.mois, parseInt(r.total)]));
    const monthsFr = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const result = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      result.push({
        mois: key,
        libelle: `${monthsFr[d.getMonth()]} ${d.getFullYear()}`,
        total: byMonth.get(key) || 0
      });
    }
    return result;
  }

  async _getEncadrantStats(stagesF, tachesF, reunF, rappF, reportsWait) {
    const [interns, meetings, meetingsMois, tasksRows, submittedReports, internshipsProgress] = await Promise.all([
      dashboardRepository.getMyInternsStats(stagesF.sql, stagesF.params),
      dashboardRepository.getMeetingsStats(reunF.sql, reunF.params),
      dashboardRepository.getMeetingsByMonth(reunF.sql, reunF.params),
      dashboardRepository.getTasksDueTodayOrOverdue(tachesF.sql, tachesF.params),
      dashboardRepository.getSubmittedReports(rappF.sql, rappF.params),
      dashboardRepository.getInternshipsProgress(stagesF.sql, stagesF.params)
    ]);
    const tachesDuJour = tasksRows.filter((t) => t.est_du_jour).map(({ est_du_jour, ...rest }) => rest);
    const tachesEnRetard = tasksRows.filter((t) => !t.est_du_jour).map(({ est_du_jour, ...rest }) => rest);
    return {
      stagiairesTotal: parseInt(interns.total),
      stagiairesActifs: parseInt(interns.actifs),
      reunionsTotal: parseInt(meetings.total),
      reunionsAVenir: parseInt(meetings.a_venir),
      reunionsParMois: this._buildMonthsSeries(meetingsMois),
      tachesDuJour,
      tachesEnRetard,
      rapportsAValider: parseInt(reportsWait[0]?.nb_total ?? 0),
      rapportsSoumis: submittedReports,
      progressStages: internshipsProgress
    };
  }

  _buildRoleFilters(role, userId, departementId) {
    const filters = {
      stagesWhere: '',
      stagesParams: [],
      tachesWhere: '',
      tachesParams: [],
      candWhere: '',
      candParams: []
    };

    if (role === 'STAGIAIRE') {
      filters.stagesWhere = 'WHERE st.stagiaire_id = $1';
      filters.stagesParams = [userId];
      filters.tachesWhere = 'WHERE t.executant_id = $1';
      filters.tachesParams = [userId];
      filters.candWhere = 'WHERE c.stagiaire_id = $1';
      filters.candParams = [userId];
    } else if (role === 'ENCADRANT') {
      filters.stagesWhere = 'WHERE st.encadrant_id = $1';
      filters.stagesParams = [userId];
      filters.tachesWhere = 'WHERE t.createur_id = $1';
      filters.tachesParams = [userId];
    } else if (role === 'CHEF_DEPARTEMENT') {
      filters.stagesWhere = 'WHERE st.departement_id = $1';
      filters.stagesParams = [departementId];
      filters.tachesWhere = `WHERE t.projet_id IN (SELECT p.id FROM projet p JOIN stage st ON st.id = p.stage_id WHERE st.departement_id = $1)`;
      filters.tachesParams = [departementId];
      filters.candWhere = `WHERE c.offre_id IN (SELECT id FROM offre_stage WHERE departement_id = $1)`;
      filters.candParams = [departementId];
    }

    return filters;
  }
}

module.exports = new DashboardService();
