const express = require('express');
const router = express.Router();
const c = require('../controllers/rapport.controller');
const { authenticateToken: auth } = require('../middlewares/auth.middleware');
const { requireRole: role } = require('../middlewares/role.middleware');
const { withScope, authorizeResource } = require('../middlewares/authorization.middleware');
const { enforceOnboardingAccess } = require('../middlewares/onboarding-access.middleware');
const { createRapportValidation, updateRapportValidation, rejectRapportValidation } = require('../validators/rapport.validator');
const { validate } = require('../validators');

router.use(auth, withScope, enforceOnboardingAccess);

router.get('/', c.getAll);
router.get('/:id', authorizeResource('rapport'), c.getById);
router.post('/', role('STAGIAIRE'), createRapportValidation, validate, c.create);
router.put('/:id', role('STAGIAIRE'), authorizeResource('rapport'), updateRapportValidation, validate, c.update);
router.post('/:id/en-revision', role('ENCADRANT'), authorizeResource('rapport'), c.setEnRevision);
router.post('/:id/valider', role('ENCADRANT'), authorizeResource('rapport'), c.validate);
router.post('/:id/rejeter', role('ENCADRANT'), authorizeResource('rapport'), rejectRapportValidation, validate, c.reject);
router.delete('/:id', authorizeResource('rapport'), role('STAGIAIRE'), c.delete);

module.exports = router;
