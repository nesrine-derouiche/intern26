const bcrypt = require('bcrypt');
const crypto = require('crypto');
const stagiaireRepository = require('../repositories/stagiaire.repository');
const { buildPaginatedResult } = require('../utils/pagination.util');
const ApiError = require('../utils/error.util');

class StagiaireService {
  async getAllStagiaires(options = null, scope = null) {
    const rows = await stagiaireRepository.findAll(options, scope);
    if (options && options.enabled) return buildPaginatedResult(rows.data, rows.total, options.page, options.limit);
    return rows;
  }

  async getStagiaireById(id) {
    const stagiaire = await stagiaireRepository.findById(id);
    if (!stagiaire) throw new ApiError(404, 'Stagiaire introuvable.');
    return stagiaire;
  }

  async createStagiaire(stagiaire) {
    try {
      const tempPassword = crypto.randomBytes(6).toString('hex');
      const hashedPwd = await bcrypt.hash(tempPassword, 12);
      const id = await stagiaireRepository.create(stagiaire, hashedPwd);
      return { id, tempPassword };
    } catch (err) {
      if (err.code === '23505') throw new ApiError(409, 'Un compte avec cet email existe déjà.');
      throw err;
    }
  }

  async updateStagiaire(id, stagiaire) {
    await stagiaireRepository.update(id, stagiaire);
  }

  async deleteStagiaire(id) {
    await stagiaireRepository.deactivate(id);
  }
}

module.exports = new StagiaireService();
