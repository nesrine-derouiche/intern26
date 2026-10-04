const departementRepository = require('../repositories/departement.repository');
const { buildPaginatedResult } = require('../utils/pagination.util');
const ApiError = require('../utils/error.util');

class DepartementService {
  async getAllDepartements(options = null, scope = null) {
    const rows = await departementRepository.findAll(options, scope);
    if (options && options.enabled) return buildPaginatedResult(rows.data, rows.total, options.page, options.limit);
    return rows;
  }

  async createDepartement(departement) {
    return await departementRepository.create(departement);
  }

  async updateDepartement(id, departement) {
    await departementRepository.update(id, departement);
  }

  async deleteDepartement(id) {
    try {
      await departementRepository.delete(id);
    } catch (err) {
      if (err.code === '23503') {
        throw new ApiError(409, 'Impossible de supprimer : des données y sont liées.');
      }
      throw err;
    }
  }
}

module.exports = new DepartementService();
