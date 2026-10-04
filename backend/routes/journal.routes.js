const express = require('express');
const router = express.Router();
const c = require('../controllers/journal.controller');
const { authenticateToken: auth } = require('../middlewares/auth.middleware');
const { requireRole: role } = require('../middlewares/role.middleware');
const { withScope, authorizeResource } = require('../middlewares/authorization.middleware');
const { enforceOnboardingAccess } = require('../middlewares/onboarding-access.middleware');
const {
  createJournalValidation,
  updateJournalValidation,
  validateJournalValidation
} = require('../validators/journal.validator');
const { validate } = require('../validators');
router.use(auth, withScope, enforceOnboardingAccess);
router.get('/', c.getAll);
router.post('/', role('STAGIAIRE'), createJournalValidation, validate, c.create);
router.put('/:id', role('STAGIAIRE'), authorizeResource('journal'), updateJournalValidation, validate, c.update);
router.post('/:id/soumettre', role('STAGIAIRE'), authorizeResource('journal'), c.submit);
router.post('/:id/valider', role('ENCADRANT'), authorizeResource('journal'), validateJournalValidation, validate, c.validate);
router.post('/:id/rejeter', role('ENCADRANT'), authorizeResource('journal'), validateJournalValidation, validate, c.reject);
router.delete('/:id', role('STAGIAIRE'), authorizeResource('journal'), c.delete);
module.exports = router;
