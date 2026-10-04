const express = require('express');
const router = express.Router();
const encadrantController = require('../controllers/encadrant.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');
const { withScope } = require('../middlewares/authorization.middleware');
const { createSupervisorValidation } = require('../validators/supervisor.validator');
const { validate } = require('../validators');

router.use(authenticateToken, withScope);

router.get('/', encadrantController.getAllEncadrants);
router.post('/', requireRole('ADMIN', 'RH'), createSupervisorValidation, validate, encadrantController.createEncadrant);
router.put('/:id', requireRole('ADMIN', 'RH'), encadrantController.updateEncadrant);
router.delete('/:id', requireRole('ADMIN', 'RH'), encadrantController.deleteEncadrant);

module.exports = router;
