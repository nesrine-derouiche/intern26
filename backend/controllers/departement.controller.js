const { asyncHandler } = require('../utils/asyncHandler');
const departementService = require('../services/departement.service');
const { sendResponse } = require('../utils/response.util');
const { getPaginationParams } = require('../utils/pagination.util');

const getAllDepartements = asyncHandler(async (req, res) => {
  const result = await departementService.getAllDepartements(getPaginationParams(req.query), req.scope);
  sendResponse(res, 200, result);
});

const createDepartement = asyncHandler(async (req, res) => {
  const departement = await departementService.createDepartement(req.body);
  sendResponse(res, 201, { departement }, 'Département créé.');
});

const updateDepartement = asyncHandler(async (req, res) => {
  await departementService.updateDepartement(req.params.id, req.body);
  sendResponse(res, 200, null, 'Département mis à jour.');
});

const deleteDepartement = asyncHandler(async (req, res) => {
  await departementService.deleteDepartement(req.params.id);
  sendResponse(res, 200, null, 'Département supprimé.');
});

module.exports = { getAllDepartements, createDepartement, updateDepartement, deleteDepartement };
