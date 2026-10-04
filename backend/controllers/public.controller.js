const { asyncHandler } = require('../utils/asyncHandler');
const offreService = require('../services/offre.service');
const { sendResponse } = require('../utils/response.util');
const { getPaginationParams } = require('../utils/pagination.util');

const getOffres = asyncHandler(async (req, res) => {
  const filters = {
    search: req.query.search || undefined,
    departementId: req.query.departementId || req.query.departement || undefined,
    niveau: req.query.niveau || undefined,
    localisation: req.query.localisation || undefined,
    sort: req.query.sort || undefined
  };
  sendResponse(res, 200, await offreService.getPublicOffres(getPaginationParams(req.query), filters));
});

const getOffreById = asyncHandler(async (req, res) => {
  sendResponse(res, 200, { offre: await offreService.getPublicOffreById(req.params.id) });
});

module.exports = { getOffres, getOffreById };
