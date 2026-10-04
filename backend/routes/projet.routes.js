const express = require('express');
const router = express.Router();
const c = require('../controllers/projet.controller');
const { authenticateToken: auth } = require('../middlewares/auth.middleware');
const { requireRole: role } = require('../middlewares/role.middleware');
const { withScope, authorizeResource } = require('../middlewares/authorization.middleware');
const { createProjetValidation, updateProjetValidation } = require('../validators/projet.validator');
const { validate } = require('../validators');

router.use(auth, withScope);

router.get('/', c.getAll);
router.get('/:id', c.getById);
router.post('/', role('ADMIN', 'RH', 'ENCADRANT'), createProjetValidation, validate, c.create);
router.put('/:id', role('ADMIN', 'RH', 'ENCADRANT'), authorizeResource('projet'), updateProjetValidation, validate, c.update);
router.delete('/:id', role('ADMIN', 'RH'), authorizeResource('projet'), c.delete);

module.exports = router;
