const { asyncHandler } = require('../utils/asyncHandler');
const { sendResponse } = require('../utils/response.util');
const planningService = require('../services/planning.service');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 100;

function getPagination(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || DEFAULT_PAGE);
  const limit = Math.min(500, Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIMIT));
  return { page, limit };
}

/**
 * GET /api/planning
 *
 * Consultation du planning agrégé (horaire + réunions + échéances de tâches +
 * pointages + période du stage). Lecture seule : aucune écriture.
 *
 * Permissions (appliquées dans routes/planning.routes.js) :
 *  - STAGIAIRE : uniquement ses propres stages (withScope) ;
 *  - ENCADRANT : uniquement ses stages (withScope) ;
 *  - CHEF_DEPARTEMENT : les stages de son département (withScope) ;
 *  - ADMIN / RH : tous les stages ;
 *  - CANDIDAT : 403 (requireRole, avant toute vérification de stage).
 *
 * L'autorisation sur `stage_id` est assurée exclusivement par le middleware
 * `authorizeStageQuery` de la route : `req.resource` y est renseigné.
 */
const getPlanning = asyncHandler(async (req, res) => {
  const { stage_id, date_debut, date_fin } = req.query;

  const { page, limit } = getPagination(req.query);

  const planning = await planningService.getPlanning({
    scope: req.scope,
    stageId: stage_id || null,
    dateDebut: date_debut || null,
    dateFin: date_fin || null,
    page,
    limit
  });

  sendResponse(res, 200, { planning });
});

module.exports = { getPlanning };
