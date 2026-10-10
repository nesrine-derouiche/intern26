const express = require('express');
const router = express.Router();
const c = require('../controllers/certification.controller');
const { authenticateToken: auth } = require('../middlewares/auth.middleware');
const { requireRole: role } = require('../middlewares/role.middleware');
const { withScope, authorizeStage } = require('../middlewares/authorization.middleware');
const { enforceOnboardingAccess } = require('../middlewares/onboarding-access.middleware');
const certificationService = require('../services/certification.service');
const {
  kindParamValidation,
  docIdParamValidation,
  denyValidation,
  redoValidation
} = require('../validators/certification.validator');
const { validate } = require('../validators');

// Mounted at /api/stages (same pattern as pdf.routes.js): all paths are
// stage-scoped via authorizeStage('stage') — 404 si inexistant, 403 hors
// périmètre — puis restreints par rôle : dépôt/soumission = STAGIAIRE
// propriétaire (vérifié en service), relecture = ENCADRANT assigné
// (vérifié en service). Lecture/téléchargement = périmètre du stage.

router.use(auth, withScope, enforceOnboardingAccess);

router.get('/:stageId/certification', authorizeStage('stage'), c.getState);

router.post(
  '/:stageId/certification/documents/:kind',
  role('STAGIAIRE'),
  authorizeStage('stage'),
  kindParamValidation,
  validate,
  certificationService.uploadMiddleware,
  c.upload
);

router.post(
  '/:stageId/certification/submit',
  role('STAGIAIRE'),
  authorizeStage('stage'),
  c.submit
);

router.post(
  '/:stageId/certification/valider',
  role('ENCADRANT'),
  authorizeStage('stage'),
  c.validate
);

router.post(
  '/:stageId/certification/refuser',
  role('ENCADRANT'),
  authorizeStage('stage'),
  denyValidation,
  validate,
  c.deny
);

router.post(
  '/:stageId/certification/corriger',
  role('ENCADRANT'),
  authorizeStage('stage'),
  redoValidation,
  validate,
  c.requestRedo
);

router.get(
  '/:stageId/certification/documents/:docId/download',
  authorizeStage('stage'),
  docIdParamValidation,
  validate,
  c.download
);

router.post(
  '/:stageId/certification/attestation',
  role('ENCADRANT'),
  authorizeStage('stage'),
  c.generateAttestation
);

router.get(
  '/:stageId/certification/attestation',
  authorizeStage('stage'),
  c.downloadAttestation
);

module.exports = router;
