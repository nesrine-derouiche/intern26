const { asyncHandler } = require('../utils/asyncHandler');
const stagiaireService = require('../services/stagiaire.service');
const { sendResponse } = require('../utils/response.util');
const { getPaginationParams } = require('../utils/pagination.util');

const getAll = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await stagiaireService.getAllStagiaires(getPaginationParams(req.query), req.scope));
});

const getById = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await stagiaireService.getStagiaireById(req.params.id));
});

const create = asyncHandler(async (req, res) => {
  const { id, tempPassword } = await stagiaireService.createStagiaire(req.body);
  sendResponse(res, 201, { id, motDePasseTemporaire: tempPassword }, 'Stagiaire créé.');
});

const update = asyncHandler(async (req, res) => {
  await stagiaireService.updateStagiaire(req.params.id, req.body);
  sendResponse(res, 200, null, 'Stagiaire mis à jour.');
});

const delete_ = asyncHandler(async (req, res) => {
  await stagiaireService.deleteStagiaire(req.params.id);
  sendResponse(res, 200, null, 'Stagiaire désactivé.');
});

module.exports = { getAll, getById, create, update, delete: delete_ };
