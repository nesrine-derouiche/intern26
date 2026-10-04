const planningRepository = require('../repositories/planning.repository');

/**
 * Service de consultation du planning (P1-2 — Option 1 : lecture seule).
 *
 * Agrège, pour un ou plusieurs stages : l'horaire de travail, les réunions,
 * les échéances de tâches, les pointages et la période du stage, puis les
 * restitue sous forme d'événements homogènes au calendrier existant.
 *
 * Aucune écriture en base : `horaire`, `pointage`, `reunion` et `tache` ne
 * sont que lues. Le calcul de retard (P1-1) n'est pas touché.
 */

const TUNIS_TZ = 'Africa/Tunis';

const EVENT_TYPES = Object.freeze({
  STAGE_START: 'STAGE_START',
  STAGE_END: 'STAGE_END',
  REUNION: 'REUNION',
  TASK_DEADLINE: 'TASK_DEADLINE',
  POINTAGE_ENTREE: 'POINTAGE_ENTREE',
  POINTAGE_SORTIE: 'POINTAGE_SORTIE'
});

const EVENT_TYPE_VALUES = Object.freeze(Object.values(EVENT_TYPES));

/** '09:00:00' (TIME pg) → '09:00'. */
function normalizeTime(value) {
  if (!value) return null;
  const time = String(value);
  return time.length >= 5 ? time.slice(0, 5) : time;
}

/**
 * Colonnes DATE pg → 'YYYY-MM-DD'.
 *
 * node-postgres convertit les DATE en objet Date (minuit local) : on repart
 * des composants locaux pour ne perdre ni le jour ni le fuseau.
 */
function toDateOnly(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

/** Instant ISO → heure locale Tunisie 'HH:MM'. */
function tunisTime(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TUNIS_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  const get = (type) => (parts.find((p) => p.type === type) || {}).value;
  return `${get('hour')}:${get('minute')}`;
}

function normalizeHoraire(horaire) {
  if (!horaire) return null;
  return {
    id: horaire.id,
    stage_id: horaire.stage_id,
    heure_debut: normalizeTime(horaire.heure_debut),
    heure_fin: normalizeTime(horaire.heure_fin),
    duree_pause_minutes: Number(horaire.duree_pause_minutes) || 0
  };
}

function normalizeReunion(reunion) {
  return {
    ...reunion,
    date: toDateOnly(reunion.date),
    heure: normalizeTime(reunion.heure)
  };
}

function normalizePointage(pointage) {
  return {
    ...pointage,
    date_pointage: toDateOnly(pointage.date_pointage),
    heure_entree: pointage.heure_entree || null,
    heure_sortie: pointage.heure_sortie || null
  };
}

/** La date est-elle dans [dateDebut, dateFin] (bornes optionnelles) ? */
function inRange(date, dateDebut, dateFin) {
  const value = toDateOnly(date);
  if (!value) return false;
  if (dateDebut && value < toDateOnly(dateDebut)) return false;
  if (dateFin && value > toDateOnly(dateFin)) return false;
  return true;
}

function buildEvent({ id, type, title, date, time = null, status = null, resourceId, metadata = {} }) {
  return {
    id,
    type,
    title,
    date: toDateOnly(date),
    time,
    status,
    resource_id: resourceId,
    metadata
  };
}

/**
 * Construit la liste complète des événements (non paginée) à partir des
 * enregistrements agrégés, bornée par les filtres de période.
 */
function buildEvents({ stages, reunions, taches, pointages, dateDebut, dateFin }) {
  const events = [];

  for (const stage of stages) {
    if (inRange(stage.date_debut, dateDebut, dateFin)) {
      events.push(buildEvent({
        id: `stage-start-${stage.id}`,
        type: EVENT_TYPES.STAGE_START,
        title: 'Début du stage',
        date: stage.date_debut,
        status: stage.statut,
        resourceId: stage.id,
        metadata: { stage_id: stage.id, statut: stage.statut }
      }));
    }
    if (inRange(stage.date_fin, dateDebut, dateFin)) {
      events.push(buildEvent({
        id: `stage-end-${stage.id}`,
        type: EVENT_TYPES.STAGE_END,
        title: 'Fin du stage',
        date: stage.date_fin,
        status: stage.statut,
        resourceId: stage.id,
        metadata: { stage_id: stage.id, statut: stage.statut }
      }));
    }
  }

  for (const reunion of reunions) {
    if (!inRange(reunion.date, dateDebut, dateFin)) continue;
    events.push(buildEvent({
      id: `reunion-${reunion.id}`,
      type: EVENT_TYPES.REUNION,
      title: reunion.sujet || 'Réunion',
      date: reunion.date,
      time: normalizeTime(reunion.heure),
      status: null,
      resourceId: reunion.id,
      metadata: {
        stage_id: reunion.stage_id,
        salle: reunion.salle || null,
        lien_visio: reunion.lien_visio || null
      }
    }));
  }

  for (const tache of taches) {
    if (!inRange(tache.date_fin, dateDebut, dateFin)) continue;
    events.push(buildEvent({
      id: `tache-${tache.id}`,
      type: EVENT_TYPES.TASK_DEADLINE,
      title: tache.titre,
      date: tache.date_fin,
      status: tache.statut,
      resourceId: tache.id,
      metadata: {
        stage_id: tache.stage_id,
        date_debut: toDateOnly(tache.date_debut),
        progress: Number(tache.progress) || 0,
        priorite: tache.priorite || null
      }
    }));
  }

  for (const pointage of pointages) {
    if (!inRange(pointage.date_pointage, dateDebut, dateFin)) continue;

    if (pointage.heure_entree) {
      events.push(buildEvent({
        id: `pointage-entree-${pointage.id}`,
        type: EVENT_TYPES.POINTAGE_ENTREE,
        title: 'Pointage — entrée',
        date: pointage.date_pointage,
        time: tunisTime(pointage.heure_entree),
        status: pointage.statut,
        resourceId: pointage.id,
        metadata: {
          stage_id: pointage.stage_id,
          retard_minutes: Number(pointage.retard_minutes) || 0
        }
      }));
    }

    if (pointage.heure_sortie) {
      events.push(buildEvent({
        id: `pointage-sortie-${pointage.id}`,
        type: EVENT_TYPES.POINTAGE_SORTIE,
        title: 'Pointage — sortie',
        date: pointage.date_pointage,
        time: tunisTime(pointage.heure_sortie),
        status: pointage.statut,
        resourceId: pointage.id,
        metadata: { stage_id: pointage.stage_id }
      }));
    }
  }

  return events.sort((a, b) => {
    if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
    const timeA = a.time || '';
    const timeB = b.time || '';
    if (timeA !== timeB) return timeA.localeCompare(timeB);
    return a.type.localeCompare(b.type) || a.id.localeCompare(b.id);
  });
}

class PlanningService {
  /**
   * Planning agrégé pour un stage donné ou pour tous les stages accessibles.
   *
   * @param {object}  options
   * @param {object}  options.scope     Portée de l'utilisateur (avecScope)
   * @param {string}  [options.stageId] Stage ciblé (déjà autorisé par la route)
   * @param {string}  [options.dateDebut] Filtre période (AAAA-MM-DD)
   * @param {string}  [options.dateFin]   Filtre période (AAAA-MM-DD)
   * @param {number}  [options.page]    Page des événements (défaut 1)
   * @param {number}  [options.limit]   Taille de page des événements (défaut 100)
   */
  async getPlanning({ scope, stageId = null, dateDebut = null, dateFin = null, page = 1, limit = 100 }) {
    const stages = await planningRepository.findStages(scope, stageId);
    const stageIds = stages.map((stage) => stage.id);

    const [horaires, reunions, taches, pointages] = stageIds.length
      ? await Promise.all([
          planningRepository.findHoraires(stageIds),
          planningRepository.findReunions(stageIds, dateDebut, dateFin),
          planningRepository.findTaches(stageIds, dateDebut, dateFin),
          planningRepository.findPointages(stageIds, dateDebut, dateFin)
        ])
      : [[], [], [], []];

    const horaireByStage = new Map(horaires.map((h) => [h.stage_id, normalizeHoraire(h)]));

    const events = buildEvents({ stages, reunions, taches, pointages, dateDebut, dateFin });

    const total = events.length;
    const safeLimit = Math.max(1, limit);
    const safePage = Math.max(1, page);
    const start = (safePage - 1) * safeLimit;

    const stageRows = stages.map((stage) => ({
      id: stage.id,
      stagiaire_id: stage.stagiaire_id,
      encadrant_id: stage.encadrant_id,
      date_debut: toDateOnly(stage.date_debut),
      date_fin: toDateOnly(stage.date_fin),
      statut: stage.statut,
      horaire: horaireByStage.get(stage.id) || null
    }));

    const periode = stages.length
      ? {
          date_debut: dateDebut || stageRows.map((s) => s.date_debut).sort()[0],
          date_fin: dateFin || stageRows.map((s) => s.date_fin).sort().slice(-1)[0]
        }
      : null;

    return {
      stage_id: stageId || null,
      periode,
      stages: stageRows,
      horaire: stageRows.length === 1 ? stageRows[0].horaire : null,
      evenements: events.slice(start, start + safeLimit),
      reunions: reunions.map(normalizeReunion),
      taches: taches.map((t) => ({ ...t, date_debut: toDateOnly(t.date_debut), date_fin: toDateOnly(t.date_fin) })),
      pointages: pointages.map(normalizePointage),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: safeLimit > 0 ? Math.ceil(total / safeLimit) : 0
      }
    };
  }
}

module.exports = new PlanningService();
module.exports.EVENT_TYPES = EVENT_TYPES;
module.exports.EVENT_TYPE_VALUES = EVENT_TYPE_VALUES;
