const bcrypt = require('bcrypt');
const crypto = require('crypto');
const encadrantRepository = require('../repositories/encadrant.repository');
const { buildPaginatedResult } = require('../utils/pagination.util');
const ApiError = require('../utils/error.util');

class EncadrantService {
  async getAllEncadrants(options = null, scope = null) {
    const rows = await encadrantRepository.findAll(options, scope);
    if (options && options.enabled) return buildPaginatedResult(rows.data, rows.total, options.page, options.limit);
    return rows;
  }

  async createEncadrant(encadrant) {
    try {
      const tempPassword = crypto.randomBytes(6).toString('hex');
      const hashedPwd = await bcrypt.hash(tempPassword, 12);
      const id = await encadrantRepository.create(encadrant, hashedPwd);
      return { id, tempPassword };
    } catch (err) {
      if (err.code === '23505') {
        throw new ApiError(409, 'Un compte avec cet email existe déjà.');
      }
      throw err;
    }
  }

  async updateEncadrant(id, encadrant) {
    await encadrantRepository.update(id, encadrant);
  }

  async deleteEncadrant(id) {
    await encadrantRepository.deactivate(id);
  }
}

module.exports = new EncadrantService();
