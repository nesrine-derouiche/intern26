const reunionRepository = require('../repositories/reunion.repository');
const stageRepository = require('../repositories/stage.repository');
const notificationService = require('./notification.service');
const { buildPaginatedResult } = require('../utils/pagination.util');
const logger = require('../utils/logger');
const ApiError = require('../utils/error.util');

class ReunionService {
  async getAllReunions(options = null, scope = null) {
    const rows = await reunionRepository.findAll(options, scope);
    if (options && options.enabled) return buildPaginatedResult(rows.data, rows.total, options.page, options.limit);
    return rows;
  }

  async createReunion(body, currentUser) {
    const { stage_id, date, heure, salle, lien_visio, sujet } = body;
    const reunion = await reunionRepository.create({ stage_id, date, heure, salle, lien_visio, sujet });

    try {
      const participants = await stageRepository.findParticipants(stage_id);
      if (participants) {
        const { stagiaire_id, encadrant_id } = participants;
        const notifTitre = 'Nouvelle réunion planifiée 📅';
        const notifMsg = `Une réunion pour le sujet "${sujet}" a été planifiée le ${new Date(date).toLocaleDateString()} à ${heure}.`;

        await notificationService.notifyBestEffort(stagiaire_id, notifTitre, notifMsg, 'REUNION');
        if (currentUser.id !== encadrant_id) {
          await notificationService.notifyBestEffort(encadrant_id, notifTitre, notifMsg, 'REUNION');
        }
      }
    } catch (notifErr) {
      logger.error('Erreur lors de la génération des notifications de réunion:', notifErr);
    }

    return reunion;
  }

  async deleteReunion(id) {
    await reunionRepository.delete(id);
  }
}

module.exports = new ReunionService();
