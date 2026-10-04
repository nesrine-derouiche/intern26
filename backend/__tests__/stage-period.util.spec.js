const {
  addCalendarMonths,
  isoFromDate,
  dateFromIso,
  weeksToMonths
} = require('../utils/stage-period.util');

describe('stage-period.util : arithmétique calendaire (mois, pas de semaines)', () => {
  test('1 mois : 2026-01-15 + 1 mois → 2026-02-15', () => {
    expect(addCalendarMonths('2026-01-15', 1)).toBe('2026-02-15');
  });

  test('2 mois : 2026-01-15 + 2 mois → 2026-03-15', () => {
    expect(addCalendarMonths('2026-01-15', 2)).toBe('2026-03-15');
  });

  test('3 mois : 2026-01-15 + 3 mois → 2026-04-15', () => {
    expect(addCalendarMonths('2026-01-15', 3)).toBe('2026-04-15');
  });

  test('31 janvier + 1 mois (année non bissextile) → clamp au 28 février', () => {
    expect(addCalendarMonths('2026-01-31', 1)).toBe('2026-02-28');
  });

  test('31 janvier + 1 mois (année bissextile) → clamp au 29 février', () => {
    expect(addCalendarMonths('2028-01-31', 1)).toBe('2028-02-29');
  });

  test('31 vers un mois à 30 jours → clamp au dernier jour (30 avril)', () => {
    expect(addCalendarMonths('2026-03-31', 1)).toBe('2026-04-30');
  });

  test('30 janvier + 1 mois (février non bissextile) → 28 février', () => {
    expect(addCalendarMonths('2026-01-30', 1)).toBe('2026-02-28');
  });

  test('30 janvier + 1 mois (février bissextile) → 29 février', () => {
    expect(addCalendarMonths('2028-01-30', 1)).toBe('2028-02-29');
  });

  test('février non bissextile (2027) : 2027-02-15 + 1 mois → 2027-03-15', () => {
    expect(addCalendarMonths('2027-02-15', 1)).toBe('2027-03-15');
  });

  test('février bissextile (2028) : 2028-02-29 + 1 mois → 2028-03-29', () => {
    expect(addCalendarMonths('2028-02-29', 1)).toBe('2028-03-29');
  });

  test('28 février + 1 mois → 28 mars (sans slip sur les 31 jours)', () => {
    expect(addCalendarMonths('2026-02-28', 1)).toBe('2026-03-28');
  });

  test('31 décembre + 1 mois → 31 janvier de l’année suivante', () => {
    expect(addCalendarMonths('2026-12-31', 1)).toBe('2027-01-31');
  });

  test('passage d’année (5 mois sur décembre) : 2026-12-01 + 5 → 2027-05-01', () => {
    expect(addCalendarMonths('2026-12-01', 5)).toBe('2027-05-01');
  });

  test('12 mois : 2026-06-10 + 12 → 2027-06-10 (même jour, année suivante)', () => {
    expect(addCalendarMonths('2026-06-10', 12)).toBe('2027-06-10');
  });

  test('plusieurs années (18 mois) : 2026-06-10 + 18 → 2027-12-10', () => {
    expect(addCalendarMonths('2026-06-10', 18)).toBe('2027-12-10');
  });

  test('aucun décalage de fuseau : l’entrée et la sortie restent des dates nues YYYY-MM-DD', () => {
    expect(addCalendarMonths('2026-01-15', 1)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('entrée invalide → null (pas de crash, pas de date absurde)', () => {
    expect(addCalendarMonths(null, 1)).toBeNull();
    expect(addCalendarMonths('31/01/2026', 1)).toBeNull();
    expect(addCalendarMonths('', 1)).toBeNull();
  });
});

describe('stage-period.util : conversions et période depuis aujourd’hui', () => {
  test('semaines → mois (arrondi, min 1)', () => {
    expect(weeksToMonths(4.33)).toBe(1);
    expect(weeksToMonths(9)).toBe(2);
    expect(weeksToMonths(24)).toBe(6);
    expect(weeksToMonths(1)).toBe(1);
    expect(weeksToMonths(0)).toBeNull();
    expect(weeksToMonths(-3)).toBeNull();
    expect(weeksToMonths(null)).toBeNull();
  });

  test('isoFromDate : string YYYY-MM-DD inchangée, Date JS normalisée', () => {
    expect(isoFromDate('2026-01-31')).toBe('2026-01-31');
    expect(isoFromDate(new Date(2026, 0, 31))).toBe('2026-01-31');
    expect(isoFromDate(null)).toBeNull();
    expect(isoFromDate('pas-une-date')).toBeNull();
  });

  test('dateFromIso : Date locale minuit sans ambiguïté de fuseau', () => {
    const d = dateFromIso('2026-01-31');
    expect(d).toBeInstanceOf(Date);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(31);
    expect(dateFromIso(null)).toBeNull();
    expect(dateFromIso('2026/01/31')).toBeNull();
  });

  test('computeStagePeriodFromToday : fin = début + N mois, date_debut = aujourd’hui (Tunisie)', () => {
    const { todayTunisIso, computeStagePeriodFromToday } = require('../utils/stage-period.util');
    const period = computeStagePeriodFromToday(3);
    expect(period).not.toBeNull();
    expect(period.date_debut).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(period.date_fin).toBe(addCalendarMonths(period.date_debut, 3));
    expect(period.date_debut).toBe(todayTunisIso());
    expect(computeStagePeriodFromToday(0)).toBeNull();
    expect(computeStagePeriodFromToday(null)).toBeNull();
  });
});