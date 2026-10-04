/**
 * MOTEUR D'ENTRETIEN IA — SIMULATION DE DÉVELOPPEMENT (MOCK).
 *
 * Ce module est la SEULE partie « intelligence artificielle » du système et
 * est volontairement isolé dans `services/ai/` : le workflow de candidature
 * (`services/candidature.service.js`) ne connaît rien de l'implémentation de
 * l'IA et n'utilise que le contrat de résultat ci-dessous.
 *
 *   { score: number, status: 'PASSED' | 'FAILED' }
 *
 * Le futur moteur réel (service Python) analysera les réponses du candidat et
 * produira ce même objet. Aucun appel réseau n'est fait ici : en attendant,
 * le score est simulé de façon déterministe à partir de l'identifiant de la
 * candidature (le même candidat obtient toujours le même résultat pour la
 * même candidature), sauf si l'environnement force un sens :
 *
 *   AI_MOCK_SCORE=42        → score fixe (0..100)
 *   AI_MOCK_STATUS=PASSED   → statut forcé (PASSED | FAILED)
 */
class MockAiInterviewService {
  static get THRESHOLD() {
    return 60;
  }

  /**
   * Produit le résultat d'un entretien IA simulé.
   * @param {{ candidatureId?: string, candidatId?: string, answers?: unknown[] }} ctx
   * @returns {Promise<{ score: number, status: 'PASSED'|'FAILED' }>}
   */
  async runInterview(ctx = {}) {
    const forcedStatus = process.env.AI_MOCK_STATUS;
    const forcedScore = Number(process.env.AI_MOCK_SCORE);

    let score;
    if (Number.isFinite(forcedScore) && forcedScore >= 0 && forcedScore <= 100) {
      score = Math.round(forcedScore);
    } else {
      const seed = ctx.candidatureId || ctx.candidatId || 'candidature';
      score = this._deterministicScore(seed);
    }

    let status;
    if (forcedStatus === 'PASSED' || forcedStatus === 'FAILED') {
      status = forcedStatus;
    } else {
      status = score >= MockAiInterviewService.THRESHOLD ? 'PASSED' : 'FAILED';
    }

    return { score, status };
  }

  /** Score stable dans [0, 100] dérivé d'une chaîne (FNV-1a modulo 101). */
  _deterministicScore(seed) {
    let hash = 2166136261;
    for (let i = 0; i < String(seed).length; i += 1) {
      hash ^= String(seed).charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % 101;
  }
}

module.exports = new MockAiInterviewService();
