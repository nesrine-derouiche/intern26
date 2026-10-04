const { asyncHandler } = require('../utils/asyncHandler');
const evaluationService = require('../services/evaluation.service');
const { sendResponse } = require('../utils/response.util');
const { getPaginationParams } = require('../utils/pagination.util');

const getAll = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await evaluationService.getAllEvaluations(getPaginationParams(req.query), req.scope));
});

const create = asyncHandler(async (req, res) => {
  const evaluation = await evaluationService.createEvaluation(req.body, req.user);
  sendResponse(res, 201, { evaluation }, 'Évaluation créée et validée.');
});

const update = asyncHandler(async (req, res) => {
  await evaluationService.updateEvaluation();
  sendResponse(res, 200, null, 'Évaluation mise à jour.');
});

const delete_ = asyncHandler(async (req, res) => {
  await evaluationService.deleteEvaluation(req.params.id);
  sendResponse(res, 200, null, 'Évaluation supprimée.');
});

module.exports = { getAll, create, update, delete: delete_ };
