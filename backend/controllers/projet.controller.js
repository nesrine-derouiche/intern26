const { asyncHandler } = require('../utils/asyncHandler');
const projetService = require('../services/projet.service');
const { sendResponse } = require('../utils/response.util');
const { getPaginationParams } = require('../utils/pagination.util');

const getAll = asyncHandler(async (req, res) => {
  const filters = {};
  if (req.query.stage_id) filters.stage_id = req.query.stage_id;
  const result = await projetService.getAllProjets(getPaginationParams(req.query), req.scope, filters);
  sendResponse(res, 200, result);
});

const getById = asyncHandler(async (req, res) => {
  const projet = await projetService.getProjetById(req.params.id);
  sendResponse(res, 200, projet);
});

const create = asyncHandler(async (req, res) => {
  const projet = await projetService.createProjet(req.body, req.user);
  sendResponse(res, 201, { projet }, 'Projet créé.');
});

const update = asyncHandler(async (req, res) => {
  await projetService.updateProjet(req.params.id, req.body);
  sendResponse(res, 200, null, 'Projet mis à jour.');
});

const delete_ = asyncHandler(async (req, res) => {
  await projetService.deleteProjet(req.params.id);
  sendResponse(res, 200, null, 'Projet supprimé.');
});

module.exports = { getAll, getById, create, update, delete: delete_ };
