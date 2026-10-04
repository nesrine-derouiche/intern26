const rapportRepository = require('../repositories/rapport.repository');
const stageRepository = require('../repositories/stage.repository');
const notificationService = require('./notification.service');
const { buildPaginatedResult } = require('../utils/pagination.util');
const ApiError = require('../utils/error.util');

const VALID_TRANSITIONS = {
  SOUMIS: ['EN_REVISION'],
  EN_REVISION: ['VALIDE', 'REJETE'],
  REJETE: ['SOUMIS'],
  VALIDE: []
};

class RapportService {
  async getAllRapports(options = null, scope = null, filters = {}) {
    const rows = await rapportRepository.findAll(options, scope, filters);
    if (options && options.enabled) return buildPaginatedResult(rows.data, rows.total, options.page, options.limit);
    return rows;
  }

  async getRapportById(id) {
    const rapport = await rapportRepository.findById(id);
    if (!rapport) throw new ApiError(404, 'Rapport introuvable.');
    return rapport;
  }

  async createRapport(body, currentUser) {
    const { stage_id, type, contenu } = body;

    const stageCtx = await rapportRepository.findStageContextByStageId(stage_id);
    if (!stageCtx) throw new ApiError(400, 'Le stage spécifié n\'existe pas.');
    if (stageCtx.stagiaire_id !== currentUser.id) {
      throw new ApiError(403, 'Vous ne pouvez créer un rapport que pour votre propre stage.');
    }
    if (stageCtx.stage_statut !== 'EN_COURS') {
      throw new ApiError(400, 'Le rapport ne peut être créé que pendant un stage en cours.');
    }

    const rapport = await rapportRepository.create({ stage_id, type, contenu });

    const encadrantId = stageCtx.encadrant_id;
    if (encadrantId) {
      await notificationService.notifyBestEffort(
        encadrantId,
        'Nouveau rapport soumis',
        `Un rapport ${type.toLowerCase()} a été soumis pour validation.`,
        'RAPPORT'
      );
    }

    return rapport;
  }

  async updateRapport(id, body, currentUser) {
    const rapport = await rapportRepository.findById(id);
    if (!rapport) throw new ApiError(404, 'Rapport introuvable.');

    const editableStatuses = ['SOUMIS', 'REJETE'];
    if (!editableStatuses.includes(rapport.statut)) {
      throw new ApiError(400, 'Un rapport en révision ou validé ne peut plus être modifié.');
    }

    const stageCtx = await rapportRepository.findStageContext(id);
    if (!stageCtx || stageCtx.stagiaire_id !== currentUser.id) {
      throw new ApiError(403, 'Vous ne pouvez modifier que votre propre rapport.');
    }

    return await rapportRepository.update(id, { contenu: body.contenu, type: body.type });
  }

  async setEnRevision(id, currentUser) {
    const rapport = await rapportRepository.findById(id);
    if (!rapport) throw new ApiError(404, 'Rapport introuvable.');

    this._assertValidTransition(rapport.statut, 'EN_REVISION');

    const stageCtx = await rapportRepository.findStageContext(id);
    if (!stageCtx || stageCtx.encadrant_id !== currentUser.id) {
      throw new ApiError(403, 'Seul l\'encadrant assigné à ce stage peut reprendre un rapport en révision.');
    }

    const updated = await rapportRepository.setEnRevision(id);

    await notificationService.notifyBestEffort(
      stageCtx.stagiaire_id,
      'Rapport en révision',
      `Votre rapport ${rapport.type.toLowerCase()} est maintenant en cours de révision.`,
      'RAPPORT'
    );

    return updated;
  }

  async validateRapport(id, currentUser) {
    const rapport = await rapportRepository.findById(id);
    if (!rapport) throw new ApiError(404, 'Rapport introuvable.');

    this._assertValidTransition(rapport.statut, 'VALIDE');

    const stageCtx = await rapportRepository.findStageContext(id);
    if (!stageCtx || stageCtx.encadrant_id !== currentUser.id) {
      throw new ApiError(403, 'Seul l\'encadrant assigné à ce stage peut valider le rapport.');
    }

    const updated = await rapportRepository.validate(id);

    await notificationService.notifyBestEffort(
      stageCtx.stagiaire_id,
      'Rapport validé',
      `Votre rapport ${rapport.type.toLowerCase()} a été validé par votre encadrant.`,
      'RAPPORT'
    );

    return updated;
  }

  async rejectRapport(id, commentaire, currentUser) {
    const rapport = await rapportRepository.findById(id);
    if (!rapport) throw new ApiError(404, 'Rapport introuvable.');

    this._assertValidTransition(rapport.statut, 'REJETE');

    const stageCtx = await rapportRepository.findStageContext(id);
    if (!stageCtx || stageCtx.encadrant_id !== currentUser.id) {
      throw new ApiError(403, 'Seul l\'encadrant assigné à ce stage peut rejeter le rapport.');
    }

    const updated = await rapportRepository.reject(id, commentaire);

    await notificationService.notifyBestEffort(
      stageCtx.stagiaire_id,
      'Rapport à corriger',
      `Votre rapport ${rapport.type.toLowerCase()} a été rejeté : ${commentaire}`,
      'RAPPORT'
    );

    return updated;
  }

  async deleteRapport(id, currentUser) {
    const rapport = await rapportRepository.findById(id);
    if (!rapport) throw new ApiError(404, 'Rapport introuvable.');

    const stageCtx = await rapportRepository.findStageContext(id);
    if (!stageCtx) throw new ApiError(404, 'Stage associé introuvable.');

    if (currentUser.role === 'STAGIAIRE') {
      if (stageCtx.stagiaire_id !== currentUser.id) {
        throw new ApiError(403, 'Vous ne pouvez supprimer que votre propre rapport.');
      }
      if (rapport.statut !== 'SOUMIS') {
        throw new ApiError(400, 'Seul un rapport soumis peut être supprimé.');
      }
    }

    await rapportRepository.delete(id);
  }

  _assertValidTransition(from, to) {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      throw new ApiError(400, `Transition invalide : ${from} → ${to}.`);
    }
  }
}

module.exports = new RapportService();
