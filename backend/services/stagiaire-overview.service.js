const stagiaireOverviewRepository = require('../repositories/stagiaire-overview.repository');

class StagiaireOverviewService {
  async getOverview(stagiaireId) {
    return stagiaireOverviewRepository.findOverview(stagiaireId);
  }

  async getProject(stagiaireId) {
    return stagiaireOverviewRepository.findProject(stagiaireId);
  }

  async getCalendarEvents(stagiaireId) {
    return stagiaireOverviewRepository.findCalendarEvents(stagiaireId);
  }
}

module.exports = new StagiaireOverviewService();
