/**
 * MOTEUR DE RISQUE ANTI-TRICHE DE L'ENTRETIEN IA.
 *
 * Agrège UNIQUEMENT des faits techniques — jamais d'analyse biométrique, jamais
 * de reconnaissance faciale — en un score pondéré (0-100) et un niveau
 * (LOW / MODERATE / HIGH / CRITICAL) que le RH peut rejouer avant de décider.
 *
 * Le moteur ne prend JAMAIS de décision métier (pas de refus automatique) :
 * il documente les signaux pour un contrôle humain. Chaque signal est
 * borné (cap) pour éviter qu'un comportement répété ne fasse exploser le score.
 */

/** Poids de chaque événement d'intégrité (base par occurrence). */
const EVENT_WEIGHTS = {
  TAB_SWITCH: 4,
  WINDOW_BLUR: 3,
  FULLSCREEN_EXIT: 6,
  CAMERA_DISABLED: 3,
  CAMERA_LOST: 4,
  MIC_DISABLED: 2,
  MIC_LOST: 3,
  NETWORK_DOWN: 5,
  DEVTOOLS_DETECTED: 18,
  COPY_ATTEMPT: 8,
  PASTE_ATTEMPT: 12,
};

/**
 * Poids d'un changement d'appareil en cours d'entretien. Il n'est PAS compté
 * dans la boucle des événements : seul le flag serveur `device_fingerprint_changed`
 * (posé lors d'une différence d'empreinte) l'active — une fois, pas plus.
 */
const DEVICE_CHANGE_WEIGHT = 25;

/** Plafond du nombre d'occurrences comptées pour chaque type d'événement. */
const EVENT_CAPS = {
  TAB_SWITCH: 12,
  WINDOW_BLUR: 12,
  FULLSCREEN_EXIT: 6,
  CAMERA_DISABLED: 4,
  CAMERA_LOST: 4,
  MIC_DISABLED: 4,
  MIC_LOST: 4,
  NETWORK_DOWN: 4,
  DEVTOOLS_DETECTED: 3,
  COPY_ATTEMPT: 3,
  PASTE_ATTEMPT: 3,
};

/** Part maximale du score attribuée aux événements (le reste = anomalies). */
const MAX_EVENT_SCORE = 60;

/** Plafonds des anomalies temporelles (secondes). */
const MIN_AVERAGE_ANSWER_SECONDS = 8; // en dessous → réponse trop courte
const SCRIPTED_TIMING_STD_SECONDS = 2.5; // écart-type des durées de réponse
const MIN_SESSION_SECONDS_PER_ANSWER = 20; // temps total minimum par réponse

const RISK_LEVELS = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function countBy(events, names) {
  return (events || []).filter((e) => names.includes(e.event)).length;
}

function stddev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calcule le score de risque d'une session.
 * @param {object} params
 * @param {Array<{event: string}>} params.events - événements d'intégrité.
 * @param {number|null} params.durationSeconds - durée totale de la session.
 * @param {Array<{duration_seconds: number|null}>} [params.answers] - réponses (avec durée).
 * @param {boolean} [params.deviceChanged] - une empreinte d'appareil différente a été détectée.
 * @returns {{ score: number, level: string, flags: string[] }}
 */
function computeIntegrityRisk({ events = [], durationSeconds = null, answers = [], deviceChanged = false }) {
  const flags = [];

  // 1. Score des événements techniques (borné).
  let eventScore = 0;
  for (const [name, weight] of Object.entries(EVENT_WEIGHTS)) {
    const count = Math.min(countBy(events, [name]), EVENT_CAPS[name] || 100);
    if (count > 0) eventScore += count * weight;
  }
  if (deviceChanged) {
    eventScore += DEVICE_CHANGE_WEIGHT;
  }
  eventScore = clamp(eventScore, 0, MAX_EVENT_SCORE);

  // 2. Anomalies comportementales.
  let anomalyScore = 0;

  const durations = (answers || [])
    .map((a) => Number(a && a.duration_seconds))
    .filter((d) => Number.isFinite(d) && d > 0);

  if (durations.length >= 4) {
    const average = durations.reduce((a, b) => a + b, 0) / durations.length;
    if (average < MIN_AVERAGE_ANSWER_SECONDS) {
      anomalyScore += 12;
      flags.push('REPONSES_TROP_RAPIDES');
    }
    if (stddev(durations) < SCRIPTED_TIMING_STD_SECONDS) {
      anomalyScore += 10;
      flags.push('TIMING_SCRIPTE');
    }
  }

  const answeredCount = (answers || []).filter((a) => a && String(a.answer || '').trim()).length;
  if (
    answeredCount >= 4 &&
    Number.isFinite(durationSeconds) &&
    durationSeconds > 0 &&
    durationSeconds < answeredCount * MIN_SESSION_SECONDS_PER_ANSWER
  ) {
    anomalyScore += 10;
    flags.push('SESSION_TROP_COURTE');
  }

  if (deviceChanged) {
    anomalyScore += 10;
    flags.push('APPAREIL_CHANGE');
  }

  if (countBy(events, ['DEVTOOLS_DETECTED']) > 0) {
    flags.push('DEVTOOLS_OUVERTS');
  }
  if (countBy(events, ['PASTE_ATTEMPT']) > 0) {
    flags.push('COLLAGE_ESSAYE');
  }
  if (countBy(events, ['COPY_ATTEMPT']) > 0) {
    flags.push('COPIE_ESSAYEE');
  }

  const total = clamp(eventScore + anomalyScore, 0, 100);

  let level;
  if (total >= 70) level = 'CRITICAL';
  else if (total >= 40) level = 'HIGH';
  else if (total >= 20) level = 'MODERATE';
  else level = 'LOW';

  return { score: total, level, flags };
}

/** Niveau de risque trié (pour les badges RH). */
function riskLevelRank(level) {
  return RISK_LEVELS.indexOf(level);
}

module.exports = {
  computeIntegrityRisk,
  riskLevelRank,
  RISK_LEVELS,
};
