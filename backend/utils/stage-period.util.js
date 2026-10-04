/**
 * Utilitaires canoniques de calcul de période de stage.
 *
 * RÈGLE MÉTIER : la durée d'un stage est exprimée en MOIS CALENDAIRES.
 * `date_fin = date_debut + N mois calendaires` (clampée au dernier jour du
 * mois cible : 31/01 + 1 mois → fin février).
 *
 * Toutes les manipulations sont réalisées en PURE MANIPULATION DE CHAINES
 * (YYYY-MM-DD) : aucun objet `Date` JS n'est créé pour l'arithmétique, ce qui
 * garantit que le résultat ne dépend NI du fuseau horaire du serveur NI du
 * décalage de jour que node-postgres introduirait sur les colonnes DATE.
 */

const pad = (n) => String(n).padStart(2, '0');

/** Dernier jour du mois (1-12) d'une année donnée (gère les années bissextiles). */
function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Date de fin = date de début + N mois calendaires.
 *
 * @param {string|null} startIso Date de début au format YYYY-MM-DD.
 * @param {number} months Nombre de mois calendaires (signé, entier).
 * @returns {string|null} Date de fin YYYY-MM-DD (null si entrée invalide).
 */
function addCalendarMonths(startIso, months) {
  if (!startIso || !/^\d{4}-\d{2}-\d{2}$/.test(String(startIso))) return null;
  const [y, m, d] = String(startIso).split('-').map(Number);
  const total = (m - 1) + Number(months || 0);
  const y2 = y + Math.floor(total / 12);
  const m2 = ((total % 12) + 12) % 12 + 1;
  const d2 = Math.min(d, daysInMonth(y2, m2));
  return `${y2}-${pad(m2)}-${pad(d2)}`;
}

/** Date du jour (YYYY-MM-DD) dans le fuseau Africa/Tunis, jamais celui du serveur. */
function todayTunisIso() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Tunis',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

/**
 * Normalise une valeur (string YYYY-MM-DD ou Date JS, ex. colonne DATE lue
 * par node-postgres = minuit local) en YYYY-MM-DD via les accesseurs LOCAUX.
 */
function isoFromDate(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Convertit une chaine YYYY-MM-DD en Date JS locale (minuit), sans ambiguïté de fuseau. */
function dateFromIso(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Durée de stage exprimée en semaines → mois calendaires arrondis (min 1 mois). */
function weeksToMonths(weeks) {
  const n = Number(weeks);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(1, Math.round(n / 4.33));
}

/**
 * Période de stage « débutant aujourd'hui » en Tunisie : date de début = jour
 * courant, date de fin = début + N mois calendaires.
 *
 * @param {number} months Durée en mois calendaires.
 * @returns {{date_debut: string, date_fin: string}|null} Dates YYYY-MM-DD.
 */
function computeStagePeriodFromToday(months) {
  const n = Number(months);
  if (!Number.isFinite(n) || n <= 0) return null;
  const date_debut = todayTunisIso();
  const date_fin = addCalendarMonths(date_debut, n);
  return { date_debut, date_fin };
}

module.exports = {
  addCalendarMonths,
  todayTunisIso,
  isoFromDate,
  dateFromIso,
  weeksToMonths,
  computeStagePeriodFromToday
};