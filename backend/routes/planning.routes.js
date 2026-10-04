const express = require('express');
const router = express.Router();
const c = require('../controllers/planning.controller');
const { authenticateToken: auth } = require('../middlewares/auth.middleware');
const { withScope, authorizeResource } = require('../middlewares/authorization.middleware');
const { enforceOnboardingAccess } = require('../middlewares/onboarding-access.middleware');
const { requireRole } = require('../middlewares/role.middleware');
const { getPlanningValidation } = require('../validators/planning.validator');
const { validate } = require('../validators');

/**
 * P1-2 — Consultation du planning (lecture seule).
 *
 * `stage_id` est un query param : on le transcrit en paramètre de route pour
 * réutiliser le middleware `authorizeResource('stage')` inchangé (404 si le
 * stage n'existe pas, 403 s'il n'appartient pas à l'utilisateur).
 * Sans `stage_id`, la portée est appliquée par `withScope` (scopeFilter).
 */
const authorizeStageQuery = (req, res, next) => {
  if (!req.query.stage_id) return next();
  req.params.id = req.query.stage_id;
  return authorizeResource('stage')(req, res, next);
};

// Rôles habilités à consulter le planning (deny-by-default : tout autre rôle → 403).
const PLANNING_ROLES = ['STAGIAIRE', 'ENCADRANT', 'CHEF_DEPARTEMENT', 'RH', 'ADMIN'];

router.use(auth, withScope, enforceOnboardingAccess);

// La garde de rôle tourne AVANT authorizeStageQuery : un candidat reçoit
// systématiquement 403 et ne peut jamais distinguer un stage existant (404)
// d'un stage inexistant.
router.get(
  '/',
  getPlanningValidation,
  validate,
  requireRole(...PLANNING_ROLES),
  authorizeStageQuery,
  c.getPlanning
);

module.exports = router;
