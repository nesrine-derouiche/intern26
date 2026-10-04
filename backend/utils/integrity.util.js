const ApiError = require('./error.util');

/**
 * INTÉGRITÉ DE L'ENTRETIEN IA — uniquement des événements techniques.
 *
 * Garanties de confidentialité :
 *  - AUCUNE reconnaissance faciale, AUCUNE analyse biométrique, AUCUNE
 *    détection de « triche » avec certitude ;
 *  - le système enregistre seulement des faits techniques (onglet quitté,
 *    caméra/micro coupés, plein écran quitté, réseau interrompu) ;
 *  - les noms de périphériques (caméra/micro) sont de simples libellés
 *    techniques, sans lien avec l'identité de la personne.
 */

/** Noms d'événements d'intégrité acceptés par l'API. */
const INTEGRITY_EVENTS = [
  'SESSION_START',
  'SESSION_END',
  'TAB_SWITCH',
  'WINDOW_BLUR',
  'FULLSCREEN_EXIT',
  'CAMERA_DISABLED',
  'MIC_DISABLED',
  'CAMERA_LOST',
  'MIC_LOST',
  'NETWORK_DOWN',
  'NETWORK_RECOVERED',
  'DEVTOOLS_DETECTED',
  'COPY_ATTEMPT',
  'PASTE_ATTEMPT',
  'DEVICE_CHANGE',
];

const MAX_EVENTS_PER_CALL = 200;
const MAX_DETAIL_LENGTH = 500;

function isIsoTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/** Valide un événement d'intégrité et renvoie sa forme normalisée. */
function normalizeIntegrityEvent(raw) {
  const event = raw && typeof raw === 'object' ? raw : {};
  if (!INTEGRITY_EVENTS.includes(event.event)) {
    throw new ApiError(400, `Événement d'intégrité inconnu : ${String(event.event)}.`);
  }
  if (!isIsoTimestamp(event.timestamp)) {
    throw new ApiError(400, "Chaque événement d'intégrité doit avoir un horodatage ISO valide.");
  }
  if (event.duration != null && (typeof event.duration !== 'number' || event.duration < 0)) {
    throw new ApiError(400, "La durée d'un événement d'intégrité doit être un nombre >= 0.");
  }
  if (event.detail != null && (typeof event.detail !== 'string' || event.detail.length > MAX_DETAIL_LENGTH)) {
    throw new ApiError(400, 'Le détail d\'un événement d\'intégrité est trop long.');
  }
  return {
    event: event.event,
    timestamp: event.timestamp,
    ...(event.duration != null ? { duration: event.duration } : {}),
    ...(event.detail ? { detail: event.detail } : {}),
  };
}

/** Valide un lot d'événements envoyé par le navigateur. */
function validateIntegrityEvents(events) {
  if (!Array.isArray(events) || events.length === 0) {
    throw new ApiError(400, 'Aucun événement d\'intégrité à enregistrer.');
  }
  if (events.length > MAX_EVENTS_PER_CALL) {
    throw new ApiError(400, `Trop d'événements d'intégrité d'un coup (${MAX_EVENTS_PER_CALL} max).`);
  }
  return events.map(normalizeIntegrityEvent);
}

const countBy = (events, names) =>
  (events || []).filter((e) => names.includes(e.event)).length;

/**
 * Synthèse d'intégrité visible par les RH — sans jugement d'intention.
 * @param {object} session - ligne ai_interview_sessions (avec integrity_events/devices).
 */
function buildIntegritySummary(session) {
  if (!session) return null;
  const events = Array.isArray(session.integrity_events) ? session.integrity_events : [];
  const devices = session.integrity_devices && typeof session.integrity_devices === 'object'
    ? session.integrity_devices
    : {};

  let durationSeconds = null;
  if (session.started_at) {
    const end = session.completed_at || new Date();
    const ms = new Date(end).getTime() - new Date(session.started_at).getTime();
    durationSeconds = ms > 0 ? Math.round(ms / 1000) : 0;
  }

  const status = session.statut === 'TERMINE' ? 'TERMINE' : session.statut === 'EN_COURS' ? 'EN_COURS' : 'EN_ATTENTE';

  return {
    status,
    duration_seconds: durationSeconds,
    events_count: events.length,
    tab_switches: countBy(events, ['TAB_SWITCH', 'WINDOW_BLUR']),
    fullscreen_exits: countBy(events, ['FULLSCREEN_EXIT']),
    camera_disabled: countBy(events, ['CAMERA_DISABLED', 'CAMERA_LOST']),
    mic_disabled: countBy(events, ['MIC_DISABLED', 'MIC_LOST']),
    network_interruptions: countBy(events, ['NETWORK_DOWN']),
    devtools_detected: countBy(events, ['DEVTOOLS_DETECTED']),
    copy_attempts: countBy(events, ['COPY_ATTEMPT']),
    paste_attempts: countBy(events, ['PASTE_ATTEMPT']),
    device_checks: session.device_checks != null ? Number(session.device_checks) : 0,
    device_fingerprint_changed: !!session.device_fingerprint_changed,
    device_fingerprint: session.device_fingerprint || null,
    risk: {
      score: session.integrity_risk_score != null ? Number(session.integrity_risk_score) : 0,
      level: session.integrity_risk_level || 'LOW',
      flags: Array.isArray(session.integrity_flags) ? session.integrity_flags : [],
      computed_at: session.integrity_computed_at || null,
    },
    camera_used: devices.camera || null,
    microphone_used: devices.microphone || null,
    events,
  };
}

module.exports = {
  INTEGRITY_EVENTS,
  normalizeIntegrityEvent,
  validateIntegrityEvents,
  buildIntegritySummary,
};
