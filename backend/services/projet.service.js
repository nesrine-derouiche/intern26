const projetRepository = require('../repositories/projet.repository');
const stageRepository = require('../repositories/stage.repository');
const { buildPaginatedResult } = require('../utils/pagination.util');
const ApiError = require('../utils/error.util');

class ProjetService {
  async getAllProjets(options = null, scope = null, filters = {}) {
    const rows = await projetRepository.findAll(options, scope, filters);
    if (options && options.enabled) return buildPaginatedResult(rows.data, rows.total, options.page, options.limit);
    return rows.data;
  }

  async getProjetById(id) {
    const projet = await projetRepository.findById(id);
    if (!projet) throw new ApiError(404, 'Projet introuvable.');
    return projet;
  }

  async createProjet(body, currentUser) {
    const { stage_id, titre, description, technologies, etat, avancement } = body;

    const stage = await stageRepository.findById(stage_id);
    if (!stage) throw new ApiError(400, 'Le stage spécifié n\'existe pas.');

    const alreadyExists = await projetRepository.existsByStageId(stage_id);
    if (alreadyExists) throw new ApiError(409, 'Un projet existe déjà pour ce stage.');

    if (currentUser.role === 'ENCADRANT' && stage.encadrant_id !== currentUser.id) {
      throw new ApiError(403, 'Vous ne pouvez créer un projet que pour un de vos stages.');
    }

    return await projetRepository.create({ stage_id, titre, description, technologies, etat, avancement });
  }

  async updateProjet(id, body) {
    const existing = await projetRepository.findById(id);
    if (!existing) throw new ApiError(404, 'Projet introuvable.');

    await projetRepository.update(id, body);
  }

  async deleteProjet(id) {
    const existing = await projetRepository.findById(id);
    if (!existing) throw new ApiError(404, 'Projet introuvable.');

    await projetRepository.delete(id);
  }
}

module.exports = new ProjetService();
