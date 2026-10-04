const express = require('express');
const router = express.Router();
const c = require('../controllers/pdf.controller');
const { authenticateToken: auth } = require('../middlewares/auth.middleware');
const { withScope, authorizeStage } = require('../middlewares/authorization.middleware');
const { enforceOnboardingAccess } = require('../middlewares/onboarding-access.middleware');

router.use(auth, withScope, enforceOnboardingAccess);
// This router will be mounted at /api/stages
router.get('/:stageId/pdf/convention', authorizeStage('stage'), c.downloadConvention.bind(c));
router.get('/:stageId/pdf/attestation', authorizeStage('stage'), c.downloadAttestation.bind(c));
router.get('/:stageId/pdf/evaluation', authorizeStage('stage'), c.downloadEvaluation.bind(c));

module.exports = router;
