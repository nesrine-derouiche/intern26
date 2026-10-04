const { asyncHandler } = require('../utils/asyncHandler');
const reunionService = require('../services/reunion.service');
const { sendResponse } = require('../utils/response.util');
const { getPaginationParams } = require('../utils/pagination.util');

const getAll = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await reunionService.getAllReunions(getPaginationParams(req.query), req.scope));
});

const create = asyncHandler(async (req, res) => {
  const reunion = await reunionService.createReunion(req.body, req.user);
  sendResponse(res, 201, { reunion }, 'Réunion créée.');
});

const delete_ = asyncHandler(async (req, res) => {
  await reunionService.deleteReunion(req.params.id);
  sendResponse(res, 200, null, 'Réunion supprimée.');
});

module.exports = { getAll, create, delete: delete_ };
