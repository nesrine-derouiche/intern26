const { asyncHandler } = require('../utils/asyncHandler');
const rapportService = require('../services/rapport.service');
const { sendResponse } = require('../utils/response.util');
const { getPaginationParams } = require('../utils/pagination.util');

const getAll = asyncHandler(async (req, res) => {
  const filters = {};
  if (req.query.stage_id) filters.stage_id = req.query.stage_id;
  sendResponse(res, 200, await rapportService.getAllRapports(getPaginationParams(req.query), req.scope, filters));
});

const getById = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await rapportService.getRapportById(req.params.id));
});

const create = asyncHandler(async (req, res) => {
  const rapport = await rapportService.createRapport(req.body, req.user);
  sendResponse(res, 201, { rapport }, 'Rapport créé.');
});

const update = asyncHandler(async (req, res) => {
  const rapport = await rapportService.updateRapport(req.params.id, req.body, req.user);
  sendResponse(res, 200, { rapport }, 'Rapport mis à jour.');
});

const setEnRevision = asyncHandler(async (req, res) => {
  const rapport = await rapportService.setEnRevision(req.params.id, req.user);
  sendResponse(res, 200, { rapport }, 'Rapport mis en révision.');
});

const validate_ = asyncHandler(async (req, res) => {
  const rapport = await rapportService.validateRapport(req.params.id, req.user);
  sendResponse(res, 200, { rapport }, 'Rapport validé.');
});

const reject_ = asyncHandler(async (req, res) => {
  const rapport = await rapportService.rejectRapport(req.params.id, req.body.commentaire, req.user);
  sendResponse(res, 200, { rapport }, 'Rapport rejeté.');
});

const delete_ = asyncHandler(async (req, res) => {
  await rapportService.deleteRapport(req.params.id, req.user);
  sendResponse(res, 200, null, 'Rapport supprimé.');
});

module.exports = { getAll, getById, create, update, setEnRevision, validate: validate_, reject: reject_, delete: delete_ };
