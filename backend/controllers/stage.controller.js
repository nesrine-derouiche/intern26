const { asyncHandler } = require('../utils/asyncHandler');
const stageService = require('../services/stage.service');
const { sendResponse } = require('../utils/response.util');
const { getPaginationParams } = require('../utils/pagination.util');

const getAll = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await stageService.getAllStages(getPaginationParams(req.query), req.scope));
});

const update = asyncHandler(async (req, res) => {
  await stageService.updateStage(req.params.id, req.body);
  sendResponse(res, 200, null, 'Stage mis à jour.');
});

const complete = asyncHandler(async (req, res) => {
  const result = await stageService.completeStage(req.params.id, req.user);
  sendResponse(res, 200, result, 'Stage terminé avec succès.');
});

const delete_ = asyncHandler(async (req, res) => {
  await stageService.deleteStage(req.params.id);
  sendResponse(res, 200, null, 'Stage supprimé.');
});

module.exports = { getAll, update, complete, delete: delete_ };
