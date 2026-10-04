const stageRepository = require('../repositories/stage.repository');
const evaluationRepository = require('../repositories/evaluation.repository');
const notificationService = require('./notification.service');
const { buildPaginatedResult } = require('../utils/pagination.util');
const ApiError = require('../utils/error.util');

const VALID_STATUTS = ['EN_ATTENTE', 'EN_COURS', 'TERMINE', 'SUSPENDU', 'ANNULE'];

class StageService {
  async getAllStages(options = null, scope = null) {
    const rows = await stageRepository.findAll(options, scope);
    if (options && options.enabled) return buildPaginatedResult(rows.data, rows.total, options.page, options.limit);
    return rows;
  }

  async updateStage(id, { statut }) {
    const stage = await stageRepository.findById(id);
    if (!stage) throw new ApiError(404, 'Stage introuvable.');

    let newDateDebut = stage.date_debut;
    let newDateFin = stage.date_fin;

    if (statut === 'EN_COURS' && stage.statut !== 'EN_COURS') newDateDebut = new Date();
    else if (statut === 'TERMINE' && stage.statut !== 'TERMINE') newDateFin = new Date();

    await stageRepository.update(id, statut, newDateDebut, newDateFin);
  }

  async completeStage(stageId, currentUser) {
    const stage = await stageRepository.findEvaluationContext(stageId);
    if (!stage) throw new ApiError(404, 'Stage introuvable.');
    if (stage.statut === 'TERMINE') throw new ApiError(400, 'Ce stage est déjà terminé.');
    if (stage.statut !== 'EN_COURS') throw new ApiError(400, 'Seul un stage en cours peut être terminé.');

    const evaluation = await evaluationRepository.findByStageId(stageId);
    if (!evaluation) throw new ApiError(400, 'Une évaluation finale est requise avant de terminer le stage.');

    await stageRepository.complete(stageId);

    await notificationService.notifyBestEffort(
      stage.stagiaire_id,
      'Stage terminé 🎓',
      'Votre stage a été officiellement terminé. Vous pouvez consulter votre évaluation et télécharger vos documents.',
      'STAGE'
    );

    const fullStage = await stageRepository.findById(stageId);
    const fullEval = await evaluationRepository.findPdfData(stageId);

    return {
      stage: fullStage,
      evaluation: fullEval,
      available_documents: ['convention', 'attestation', 'evaluation']
    };
  }

  async getCompletionData(stagiaireId) {
    const stage = await stageRepository.findLatestByStagiaire(stagiaireId);
    if (!stage) return null;

    const evaluation = await evaluationRepository.findPdfData(stage.id);

    return {
      stage: {
        id: stage.id,
        date_debut: stage.date_debut,
        date_fin: stage.date_fin,
        statut: stage.statut,
        stagiaire_nom: stage.stagiaire_nom,
        stagiaire_prenom: stage.stagiaire_prenom,
        encadrant_nom: stage.encadrant_nom,
        encadrant_prenom: stage.encadrant_prenom,
        departement_nom: stage.departement_nom,
        offre_titre: stage.offre_titre,
      },
      evaluation: evaluation ? {
        id: evaluation.id,
        technique: evaluation.technique,
        communication: evaluation.communication,
        autonomie: evaluation.autonomie,
        ponctualite: evaluation.ponctualite,
        qualite: evaluation.qualite,
        note_finale: evaluation.note_finale,
        commentaire: evaluation.commentaire,
        date_evaluation: evaluation.date_evaluation,
        validee: evaluation.validee,
        encadrant_nom: evaluation.encadrant_nom,
        encadrant_prenom: evaluation.encadrant_prenom,
      } : null,
      is_completed: stage.statut === 'TERMINE',
      completion_date: stage.statut === 'TERMINE' ? stage.date_fin : null,
      available_documents: stage.statut === 'TERMINE'
        ? ['convention', 'attestation', ...(evaluation ? ['evaluation'] : [])]
        : ['convention']
    };
  }

  async deleteStage(id) {
    const stage = await stageRepository.findById(id);
    if (!stage) throw new ApiError(404, 'Stage introuvable.');
    if (stage.statut === 'TERMINE') throw new ApiError(400, 'Impossible de supprimer un stage terminé.');
    try {
      await stageRepository.delete(id);
    } catch (err) {
      if (err.code === '23503') throw new ApiError(409, 'Impossible de supprimer le stage : des données associées y sont liées.');
      throw err;
    }
  }
}

module.exports = new StageService();
