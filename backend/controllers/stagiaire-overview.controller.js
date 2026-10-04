const { asyncHandler } = require('../utils/asyncHandler');
const stagiaireOverviewService = require('../services/stagiaire-overview.service');
const stageService = require('../services/stage.service');
const { sendResponse } = require('../utils/response.util');
const ApiError = require('../utils/error.util');

const getOverview = asyncHandler(async (req, res) => {
  if (req.user.role !== 'STAGIAIRE') {
    throw new ApiError(403, 'Réservé aux stagiaires.');
  }
  const data = await stagiaireOverviewService.getOverview(req.user.id);
  if (!data) throw new ApiError(404, 'Aucune donnée de stage trouvée.');
  sendResponse(res, 200, data);
});

const getMonProjet = asyncHandler(async (req, res) => {
  if (req.user.role !== 'STAGIAIRE') {
    throw new ApiError(403, 'Réservé aux stagiaires.');
  }
  const data = await stagiaireOverviewService.getProject(req.user.id);
  if (!data) throw new ApiError(404, 'Aucun projet trouvé pour votre stage.');
  sendResponse(res, 200, data);
});

const getCalendar = asyncHandler(async (req, res) => {
  if (req.user.role !== 'STAGIAIRE') {
    throw new ApiError(403, 'Réservé aux stagiaires.');
  }
  const data = await stagiaireOverviewService.getCalendarEvents(req.user.id);
  sendResponse(res, 200, data);
});

const getCompletion = asyncHandler(async (req, res) => {
  if (req.user.role !== 'STAGIAIRE') {
    throw new ApiError(403, 'Réservé aux stagiaires.');
  }
  const data = await stageService.getCompletionData(req.user.id);
  if (!data) throw new ApiError(404, 'Aucun stage trouvé.');
  sendResponse(res, 200, data);
});

module.exports = { getOverview, getMonProjet, getCalendar, getCompletion };
