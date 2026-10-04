const pool = require('../config/db');

class StagiaireOverviewRepository {
  async findCalendarEvents(stagiaireId) {
    const stageResult = await pool.query(
      `SELECT st.id, st.date_debut, st.date_fin, st.statut
       FROM stage st
       WHERE st.stagiaire_id = $1
       ORDER BY st.date_debut DESC LIMIT 1`,
      [stagiaireId]
    );
    const stage = stageResult.rows[0];
    if (!stage) return [];

    const [meetingsResult, tasksResult] = await Promise.all([
      pool.query(
        `SELECT r.id, r.date, r.heure, r.sujet, r.salle, r.lien_visio
         FROM reunion r
         WHERE r.stage_id = $1
         ORDER BY r.date ASC, r.heure ASC`,
        [stage.id]
      ),
      pool.query(
        `SELECT t.id, t.titre, t.statut, t.date_debut, t.date_fin, t.progress
         FROM tache t
         JOIN projet p ON p.id = t.projet_id
         WHERE p.stage_id = $1
         ORDER BY t.date_fin ASC NULLS LAST`,
        [stage.id]
      )
    ]);

    const events = [];

    events.push({
      id: `stage-debut-${stage.id}`,
      type: 'INTERNSHIP',
      title: 'Début du stage',
      date: stage.date_debut,
      time: null,
      status: stage.statut,
      resource_id: stage.id
    });

    events.push({
      id: `stage-fin-${stage.id}`,
      type: 'INTERNSHIP',
      title: 'Fin du stage',
      date: stage.date_fin,
      time: null,
      status: stage.statut,
      resource_id: stage.id
    });

    for (const m of meetingsResult.rows) {
      events.push({
        id: `reunion-${m.id}`,
        type: 'MEETING',
        title: m.sujet || 'Réunion',
        date: m.date,
        time: m.heure,
        status: null,
        resource_id: m.id
      });
    }

    for (const t of tasksResult.rows) {
      if (t.date_fin) {
        events.push({
          id: `tache-${t.id}`,
          type: 'TASK',
          title: t.titre,
          date: t.date_fin,
          time: null,
          status: t.statut,
          resource_id: t.id
        });
      }
      if (t.date_debut && t.date_debut !== t.date_fin) {
        events.push({
          id: `tache-debut-${t.id}`,
          type: 'TASK',
          title: `Début : ${t.titre}`,
          date: t.date_debut,
          time: null,
          status: t.statut,
          resource_id: t.id
        });
      }
    }

    events.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return da - db;
    });

    return events;
  }

  async findProject(stagiaireId) {
    const stageResult = await pool.query(
      `SELECT st.id, st.date_debut, st.date_fin, st.statut
       FROM stage st
       WHERE st.stagiaire_id = $1
       ORDER BY st.date_debut DESC LIMIT 1`,
      [stagiaireId]
    );
    const stage = stageResult.rows[0];
    if (!stage) return null;

    const projectResult = await pool.query(
      `SELECT p.id, p.stage_id, p.titre, p.description, p.technologies, p.etat, p.avancement,
              eu.id as encadrant_id, eu.nom as encadrant_nom, eu.prenom as encadrant_prenom,
              st.date_debut as stage_debut, st.date_fin as stage_fin, st.statut as stage_statut,
              d.nom as departement_nom
       FROM projet p
       JOIN stage st ON st.id = p.stage_id
       JOIN utilisateur eu ON eu.id = st.encadrant_id
       JOIN departement d ON d.id = st.departement_id
       WHERE p.stage_id = $1 LIMIT 1`,
      [stage.id]
    );

    const project = projectResult.rows[0] || null;
    if (!project) return null;

    const taskStats = await pool.query(
      `SELECT COUNT(*)::int as total,
              COUNT(*) FILTER (WHERE t.statut = 'A_FAIRE')::int as todo,
              COUNT(*) FILTER (WHERE t.statut = 'EN_COURS')::int as in_progress,
              COUNT(*) FILTER (WHERE t.statut = 'TERMINEE')::int as completed,
              COUNT(*) FILTER (WHERE t.statut = 'BLOQUEE')::int as blocked,
              COUNT(*) FILTER (WHERE t.date_fin < CURRENT_DATE AND t.statut != 'TERMINEE')::int as overdue
       FROM tache t
       WHERE t.projet_id = $1`,
      [project.id]
    );

    const stats = taskStats.rows[0];

    return {
      project: {
        id: project.id,
        titre: project.titre,
        description: project.description,
        technologies: project.technologies,
        etat: project.etat,
        avancement: project.avancement,
        supervisor: {
          id: project.encadrant_id,
          full_name: `${project.encadrant_prenom} ${project.encadrant_nom}`,
        },
        departement: project.departement_nom,
      },
      stage: {
        id: stage.id,
        date_debut: stage.date_debut,
        date_fin: stage.date_fin,
        statut: stage.statut,
      },
      tasks: stats,
    };
  }

  async findOverview(stagiaireId) {
    const [traineeResult, stageResult] = await Promise.all([
      pool.query(
        "SELECT id, nom, prenom, email FROM utilisateur WHERE id = $1 AND role = 'STAGIAIRE'",
        [stagiaireId]
      ),
      pool.query(
        `SELECT st.id, st.date_debut, st.date_fin, st.statut,
                eu.id as encadrant_id, eu.nom as encadrant_nom, eu.prenom as encadrant_prenom,
                o.titre as offre_titre
         FROM stage st
         JOIN utilisateur eu ON eu.id = st.encadrant_id
         JOIN offre_stage o ON o.id = st.offre_id
         WHERE st.stagiaire_id = $1
         ORDER BY st.date_debut DESC
         LIMIT 1`,
        [stagiaireId]
      )
    ]);

    const trainee = traineeResult.rows[0] || null;
    const stage = stageResult.rows[0] || null;

    if (!trainee) return null;
    if (!stage) {
      return {
        trainee,
        internship: null,
        project: null,
        tasks: { total: 0, todo: 0, in_progress: 0, completed: 0, overdue: 0, next: [] },
        upcoming_meetings: [],
        journal: null,
        evaluation: null
      };
    }

    const [projectResult, taskStatsResult, nextTasksResult, meetingsResult, journalResult, evalResult] = await Promise.all([
      pool.query(
        'SELECT id, titre, description, avancement FROM projet WHERE stage_id = $1 LIMIT 1',
        [stage.id]
      ),
      pool.query(
        `SELECT COUNT(*)::int as total,
                COUNT(*) FILTER (WHERE t.statut = 'A_FAIRE')::int as todo,
                COUNT(*) FILTER (WHERE t.statut = 'EN_COURS')::int as in_progress,
                COUNT(*) FILTER (WHERE t.statut = 'TERMINEE')::int as completed,
                COUNT(*) FILTER (WHERE t.date_fin < CURRENT_DATE AND t.statut != 'TERMINEE')::int as overdue
         FROM tache t
         JOIN projet p ON p.id = t.projet_id
         WHERE p.stage_id = $1`,
        [stage.id]
      ),
      pool.query(
        `SELECT t.id, t.titre, t.priorite, t.date_fin, t.statut
         FROM tache t
         JOIN projet p ON p.id = t.projet_id
         WHERE p.stage_id = $1 AND t.statut != 'TERMINEE'
         ORDER BY t.date_fin ASC NULLS LAST
         LIMIT 3`,
        [stage.id]
      ),
      pool.query(
        `SELECT r.id, r.date, r.heure, r.sujet, r.salle, r.lien_visio
         FROM reunion r
         WHERE r.stage_id = $1 AND r.date >= CURRENT_DATE
         ORDER BY r.date ASC, r.heure ASC
         LIMIT 3`,
        [stage.id]
      ),
      pool.query(
        `SELECT
           COUNT(*)::int as total,
           COUNT(*) FILTER (WHERE statut IN ('SOUMIS', 'VALIDE'))::int as submitted,
           COUNT(*) FILTER (WHERE statut IN ('BROUILLON', 'REJETE'))::int as pending
         FROM journal
         WHERE stage_id = $1`,
        [stage.id]
      ),
      pool.query(
        'SELECT id, note_finale, validee FROM evaluation WHERE stage_id = $1',
        [stage.id]
      )
    ]);

    const stats = taskStatsResult.rows[0];
    const journalStats = journalResult.rows[0];

    return {
      trainee,
      internship: {
        id: stage.id,
        title: stage.offre_titre,
        start_date: stage.date_debut,
        end_date: stage.date_fin,
        status: stage.statut,
        supervisor: {
          id: stage.encadrant_id,
          full_name: `${stage.encadrant_prenom} ${stage.encadrant_nom}`
        }
      },
      project: projectResult.rows[0] || null,
      tasks: {
        total: stats.total,
        todo: stats.todo,
        in_progress: stats.in_progress,
        completed: stats.completed,
        overdue: stats.overdue,
        next: nextTasksResult.rows
      },
      upcoming_meetings: meetingsResult.rows,
      journal: {
        total: journalStats.total,
        submitted: journalStats.submitted,
        pending: journalStats.pending
      },
      evaluation: evalResult.rows[0] || null
    };
  }
}

module.exports = new StagiaireOverviewRepository();
