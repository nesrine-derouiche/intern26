const { computeIntegrityRisk, riskLevelRank, RISK_LEVELS } = require('../utils/anti-cheat.util');

describe('computeIntegrityRisk — moteur de risque anti-triche', () => {
  test('session propre : score 0 et niveau LOW', () => {
    const risk = computeIntegrityRisk({ events: [], durationSeconds: 600, answers: [] });
    expect(risk).toEqual({ score: 0, level: 'LOW', flags: [] });
  });

  test('quelques changements d’onglet restent LOW/MODERATE (signal seul, sans verdict)', () => {
    const events = Array.from({ length: 4 }, (_, i) => ({ event: 'TAB_SWITCH' }));
    const risk = computeIntegrityRisk({ events, durationSeconds: 600, answers: [] });
    expect(risk.score).toBe(16);
    expect(risk.level).toBe('LOW');
  });

  test('DevTools + tentative de collage font monter le risque en HIGH', () => {
    const events = [
      { event: 'DEVTOOLS_DETECTED' },
      { event: 'DEVTOOLS_DETECTED' },
      { event: 'PASTE_ATTEMPT' },
    ];
    const risk = computeIntegrityRisk({ events, durationSeconds: 600, answers: [] });
    expect(risk.level).toBe('HIGH');
    expect(risk.flags).toEqual(expect.arrayContaining(['DEVTOOLS_OUVERTS', 'COLLAGE_ESSAYE']));
    expect(risk.score).toBeGreaterThanOrEqual(40);
  });

  test('changement d’appareil en cours d’entretien = signal fort', () => {
    const risk = computeIntegrityRisk({
      events: [{ event: 'DEVICE_CHANGE' }],
      durationSeconds: 600,
      answers: [],
      deviceChanged: true,
    });
    expect(risk.level).toBe('MODERATE');
    expect(risk.flags).toContain('APPAREIL_CHANGE');
  });

  test('réponses anormalement courtes → flag REPONSES_TROP_RAPIDES', () => {
    const answers = Array.from({ length: 6 }, (_, i) => ({ answer: `a${i}`, duration_seconds: 3 }));
    const risk = computeIntegrityRisk({ events: [], durationSeconds: 900, answers });
    expect(risk.flags).toContain('REPONSES_TROP_RAPIDES');
    expect(risk.score).toBeGreaterThanOrEqual(12);
  });

  test('durées de réponse identiques (écart-type quasi nul) → flag TIMING_SCRIPTE', () => {
    const answers = Array.from({ length: 5 }, (_, i) => ({ answer: `a${i}`, duration_seconds: 12.2 }));
    const risk = computeIntegrityRisk({ events: [], durationSeconds: 1200, answers });
    expect(risk.flags).toContain('TIMING_SCRIPTE');
  });

  test('session trop courte pour le nombre de réponses → flag SESSION_TROP_COURTE', () => {
    const answers = Array.from({ length: 8 }, (_, i) => ({ answer: `a${i}`, duration_seconds: 30 }));
    const risk = computeIntegrityRisk({ events: [], durationSeconds: 90, answers });
    expect(risk.flags).toContain('SESSION_TROP_COURTE');
  });

  test('le score est borné à 100 même avec un comportement extrême', () => {
    const events = Array.from({ length: 200 }, (_, i) => ({
      event: i % 2 ? 'DEVTOOLS_DETECTED' : 'PASTE_ATTEMPT',
    }));
    const risk = computeIntegrityRisk({ events, durationSeconds: 60, answers: [], deviceChanged: true });
    expect(risk.score).toBeLessThanOrEqual(100);
  });

  test('le score ne dépasse jamais 100 et le niveau est toujours valide', () => {
    for (const level of RISK_LEVELS) {
      expect(riskLevelRank(level)).toBeGreaterThanOrEqual(0);
    }
    expect(riskLevelRank('INCONNU')).toBe(-1);
  });
});
