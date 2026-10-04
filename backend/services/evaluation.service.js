const evaluationRepository = require('../repositories/evaluation.repository');
const stageRepository = require('../repositories/stage.repository');
const notificationService = require('./notification.service');
const { buildPaginatedResult } = require('../utils/pagination.util');
const ApiError = require('../utils/error.util');

class EvaluationService {
  async getAllEvaluations(options = null, scope = null) {
    const rows = await evaluationRepository.findAll(options, scope);
    if (options && options.enabled) return buildPaginatedResult(rows.data, rows.total, options.page, options.limit);
    return rows;
  }

  async createEvaluation(body, currentUser) {
    const { stage_id, technique, communication, autonomie, ponctualite, qualite, commentaire } = body;

    const stage = await stageRepository.findEvaluationContext(stage_id);
    if (!stage) throw new ApiError(404, 'Stage introuvable.');
    if (stage.statut !== 'EN_COURS' && stage.statut !== 'TERMINE') throw new ApiError(400, 'L\'évaluation ne peut être créée que pour un stage en cours ou terminé.');
    if (stage.encadrant_id !== currentUser.id) throw new ApiError(403, 'Seul l\'encadrant assigné à ce stage peut évaluer le stagiaire.');

    const existingEval = await evaluationRepository.findByStageId(stage_id);
    if (existingEval) throw new ApiError(400, 'Ce stage a déjà une évaluation finale.');

    const note = this._computeNote({ technique, communication, autonomie, ponctualite, qualite });

    const evaluation = await evaluationRepository.create({
      stage_id,
      encadrant_id: currentUser.id,
      technique: note.technique,
      communication: note.communication,
      autonomie: note.autonomie,
      ponctualite: note.ponctualite,
      qualite: note.qualite,
      note_finale: note.noteFinale.toFixed(2),
      commentaire
    });

    await notificationService.notifyBestEffort(
      stage.stagiaire_id,
      'Évaluation finale disponible 🎓',
      `Votre évaluation finale a été enregistrée avec une note globale de ${note.noteFinale.toFixed(2)}/20.`,
      'EVALUATION'
    );

    return evaluation;
  }

  _computeNote({ technique, communication, autonomie, ponctualite, qualite }) {
    const techniqueNum = parseFloat(technique) || 0;
    const communicationNum = parseFloat(communication) || 0;
    const autonomieNum = parseFloat(autonomie) || 0;
    const ponctualiteNum = parseFloat(ponctualite) || 0;
    const qualiteNum = parseFloat(qualite) || 0;

    return {
      technique: techniqueNum,
      communication: communicationNum,
      autonomie: autonomieNum,
      ponctualite: ponctualiteNum,
      qualite: qualiteNum,
      noteFinale: (techniqueNum + communicationNum + autonomieNum + ponctualiteNum + qualiteNum) / 5
    };
  }

  async updateEvaluation() {
    throw new ApiError(400, 'Une évaluation validée ne peut pas être modifiée.');
  }

  async deleteEvaluation(id) {
    await evaluationRepository.delete(id);
  }
}

module.exports = new EvaluationService();
