const { asyncHandler } = require('../utils/asyncHandler');
const personalTacheService = require('../services/personal-tache.service');
const { sendResponse } = require('../utils/response.util');

const getAll = asyncHandler(async (req, res) => {
  const taches = await personalTacheService.getMyTaches(req.user);
  sendResponse(res, 200, taches);
});

const getById = asyncHandler(async (req, res) => {
  const tache = await personalTacheService.getTacheById(req.params.id, req.user);
  sendResponse(res, 200, tache);
});

const create = asyncHandler(async (req, res) => {
  const tache = await personalTacheService.create(req.body, req.user);
  sendResponse(res, 201, tache, 'Tâche personnelle créée.');
});

const update = asyncHandler(async (req, res) => {
  const tache = await personalTacheService.update(req.params.id, req.body, req.user);
  sendResponse(res, 200, tache, 'Tâche personnelle mise à jour.');
});

const remove = asyncHandler(async (req, res) => {
  await personalTacheService.delete(req.params.id, req.user);
  sendResponse(res, 200, null, 'Tâche personnelle supprimée.');
});

const move = asyncHandler(async (req, res) => {
  const tache = await personalTacheService.move(req.params.id, req.body, req.user);
  sendResponse(res, 200, tache, 'Tâche déplacée.');
});

const getCounts = asyncHandler(async (req, res) => {
  const counts = await personalTacheService.getCounts(req.user);
  sendResponse(res, 200, counts);
});

module.exports = { getAll, getById, create, update, remove, move, getCounts };
