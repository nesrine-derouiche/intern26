const { asyncHandler } = require('../utils/asyncHandler');
const tacheService = require('../services/tache.service');
const { sendResponse } = require('../utils/response.util');
const { getPaginationParams } = require('../utils/pagination.util');

const getAll = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await tacheService.getAllTaches(getPaginationParams(req.query), req.scope));
});

const getMesTaches = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await tacheService.getMesTaches(req.user, getPaginationParams(req.query)));
});

const create = asyncHandler(async (req, res) => {
  const tache = await tacheService.createTache(req.body, req.user);
  sendResponse(res, 201, { tache }, 'Tâche créée.');
});

const update = asyncHandler(async (req, res) => {
  await tacheService.updateTache(req.params.id, req.body);
  sendResponse(res, 200, null, 'Tâche mise à jour.');
});

const delete_ = asyncHandler(async (req, res) => {
  await tacheService.deleteTache(req.params.id);
  sendResponse(res, 200, null, 'Tâche supprimée.');
});

module.exports = { getAll, getMesTaches, create, update, delete: delete_ };
