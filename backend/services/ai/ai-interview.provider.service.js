const ApiError = require('../../utils/error.util');
const localEvaluator = require('./evaluators/local-ai-interview-evaluator.service');

/**
 * ABSTRACTION DU FOURNISSEUR D'ÉVALUATION IA DE L'ENTRETIEN.
 *
 * Rôle :
 *  - exposer UNE interface unique `evaluateInterview(ctx)` ;
 *  - distinguer clairement une VRAIE évaluation IA d'un fournisseur
 *    indisponible (aucun score « factice » n'est jamais produit).
 *
 * Fournisseurs :
 *  - AI_INTERVIEW_PROVIDER=local  (défaut) → moteur déterministe local qui
 *    analyse les réponses réelles du candidat (voir evaluators/) ;
 *  - AI_INTERVIEW_PROVIDER=none   → fournisseur indisponible : l'entretien se
 *    termine mais AUCUNE évaluation n'est produite (évaluation_status =
 *    'INDISPONIBLE'), le RH est prévenu. Aucun score n'est inventé.
 *  - tout autre nom (ex : 'openai', 'python') → non configuré : considéré
 *    indisponible tant que l'implémentation n'existe pas.
 *
 * Le reste du système ne connaît que ce module : brancher un vrai moteur
 * d'IA (OpenAI, service Python…) revient à ajouter une branche ici, sans
 * modifier le workflow de candidature.
 */
class AiInterviewProviderService {
  /** Nom du fournisseur configuré. */
  getProvider() {
    return process.env.AI_INTERVIEW_PROVIDER || 'local';
  }

  /** Un fournisseur réel est-il configuré et opérationnel ? */
  isAvailable() {
    return this.getProvider() !== 'none';
  }

  /**
   * Évalue un entretien à partir des réponses réelles.
   *
   * @param {{ sessionId: string, offre: object, questions: Array, answers: Array }} ctx
   * @returns {Promise<{ score:number, technical:number, motivation:number, communication:number,
   *           problemSolving:number, relevance:number, strengths:string[], weaknesses:string[],
   *           recommendation:'FAVORABLE'|'DEFAVORABLE', provider:string }>}
   * @throws {ApiError(503)} si aucun fournisseur d'IA n'est opérationnel.
   */
  async evaluateInterview(ctx) {
    const provider = this.getProvider();
    if (!this.isAvailable()) {
      throw new ApiError(503, 'Évaluation IA indisponible : aucun fournisseur d\'IA configuré.');
    }

    if (provider === 'local') {
      const evaluation = await localEvaluator.evaluate(ctx);
      return { ...evaluation, provider };
    }

    throw new ApiError(503, `Fournisseur d'IA "${provider}" non configuré.`);
  }
}

module.exports = new AiInterviewProviderService();
