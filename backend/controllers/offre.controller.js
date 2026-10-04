const { asyncHandler } = require('../utils/asyncHandler');
const offreService = require('../services/offre.service');
const { sendResponse } = require('../utils/response.util');
const { getPaginationParams } = require('../utils/pagination.util');

const getAll = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await offreService.getAllOffres(getPaginationParams(req.query), req.scope));
});

const create = asyncHandler(async (req, res) => {
  const offre = await offreService.createOffre(req.body);
  sendResponse(res, 201, { offre }, 'Offre créée.');
});

const update = asyncHandler(async (req, res) => {
  await offreService.updateOffre(req.params.id, req.body);
  sendResponse(res, 200, null, 'Offre mise à jour.');
});

const delete_ = asyncHandler(async (req, res) => {
  await offreService.deleteOffre(req.params.id);
  sendResponse(res, 200, null, 'Offre supprimée.');
});

const analyseCv = asyncHandler(async (req, res) => {
  const result = await offreService.analyseCv(req.params.id, req.user.id);
  sendResponse(res, 200, result);
});

module.exports = { getAll, create, update, delete: delete_, analyseCv };
