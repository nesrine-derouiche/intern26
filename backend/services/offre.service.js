const offreRepository = require('../repositories/offre.repository');
const candidatRepository = require('../repositories/candidat.repository');
const cvAnalysisService = require('./cv-analysis.service');
const { buildPaginatedResult } = require('../utils/pagination.util');
const ApiError = require('../utils/error.util');

class OffreService {
  async getAllOffres(options = null, scope = null) {
    const rows = await offreRepository.findAll(options, scope);
    if (options && options.enabled) return buildPaginatedResult(rows.data, rows.total, options.page, options.limit);
    return rows;
  }

  async createOffre(offre) {
    return await offreRepository.create(offre);
  }

  async updateOffre(id, offre) {
    await offreRepository.update(id, offre);
  }

  async deleteOffre(id) {
    await offreRepository.delete(id);
  }

  async getPublicOffres(options, filters) {
    const rows = await offreRepository.findPublic(options, filters);
    if (options && options.enabled) return buildPaginatedResult(rows.data, rows.total, options.page, options.limit);
    return rows;
  }

  async getPublicOffreById(id) {
    const offre = await offreRepository.findPublicById(id);
    if (!offre) throw new ApiError(404, 'Offre de stage introuvable.');
    return offre;
  }

  /** Analyse IA (moteur local) du CV du candidat contre une offre. */
  async analyseCv(offreId, candidatId) {
    const offre = await offreRepository.findPublicById(offreId);
    if (!offre) throw new ApiError(404, 'Offre de stage introuvable.');
    const candidat = await candidatRepository.getProfile(candidatId);
    if (!candidat) throw new ApiError(404, 'Profil candidat introuvable.');
    if (!candidat.cv_path) {
      throw new ApiError(400, 'Votre CV doit être déposé avant de lancer l\'analyse IA.');
    }
    return cvAnalysisService.runAnalysis(candidatId, offre, candidat);
  }
}

module.exports = new OffreService();
