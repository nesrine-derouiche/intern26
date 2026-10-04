const { asyncHandler } = require('../utils/asyncHandler');
const encadrantService = require('../services/encadrant.service');
const { sendResponse } = require('../utils/response.util');
const { getPaginationParams } = require('../utils/pagination.util');

const getAllEncadrants = asyncHandler(async (req, res) => {
  const result = await encadrantService.getAllEncadrants(getPaginationParams(req.query), req.scope);
  sendResponse(res, 200, result);
});

const createEncadrant = asyncHandler(async (req, res) => {
  const { id, tempPassword } = await encadrantService.createEncadrant(req.body);
  sendResponse(res, 201, { id, motDePasseTemporaire: tempPassword }, 'Encadrant créé.');
});

const updateEncadrant = asyncHandler(async (req, res) => {
  await encadrantService.updateEncadrant(req.params.id, req.body);
  sendResponse(res, 200, null, 'Encadrant mis à jour.');
});

const deleteEncadrant = asyncHandler(async (req, res) => {
  await encadrantService.deleteEncadrant(req.params.id);
  sendResponse(res, 200, null, 'Encadrant désactivé.');
});

module.exports = { getAllEncadrants, createEncadrant, updateEncadrant, deleteEncadrant };
