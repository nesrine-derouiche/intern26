const express = require('express');
const router = express.Router();
const c = require('../controllers/document-template.controller');
const { authenticateToken: auth } = require('../middlewares/auth.middleware');
const { requireRole: role } = require('../middlewares/role.middleware');
const {
  listTemplatesValidation,
  createTemplateValidation,
  updateTemplateValidation,
  previewTemplateValidation
} = require('../validators/document-template.validator');
const { validate } = require('../validators');

// P1-3A-4 — Templates de documents : ADMIN et RH uniquement.
// `auth` (401 sans jeton) puis `requireRole` (403 pour tout autre rôle)
// tournent AVANT la validation, comme dans routes/offre.routes.js.
router.use(auth);

router.get('/', role('ADMIN', 'RH'), listTemplatesValidation, validate, c.list);
router.get('/:id', role('ADMIN', 'RH'), c.getById);
router.post('/', role('ADMIN', 'RH'), createTemplateValidation, validate, c.create);
router.put('/:id', role('ADMIN', 'RH'), updateTemplateValidation, validate, c.update);
router.patch('/:id/deactivate', role('ADMIN', 'RH'), c.deactivate);
router.post('/:id/preview', role('ADMIN', 'RH'), previewTemplateValidation, validate, c.preview);

module.exports = router;
