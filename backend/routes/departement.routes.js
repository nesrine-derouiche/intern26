const express = require('express');
const router = express.Router();
const departementController = require('../controllers/departement.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');
const { withScope } = require('../middlewares/authorization.middleware');
const { createDepartmentValidation, updateDepartmentValidation } = require('../validators/department.validator');
const { validate } = require('../validators');

router.use(authenticateToken, withScope);

router.get('/', departementController.getAllDepartements);
router.post('/', requireRole('ADMIN', 'RH'), createDepartmentValidation, validate, departementController.createDepartement);
router.put('/:id', requireRole('ADMIN', 'RH'), updateDepartmentValidation, validate, departementController.updateDepartement);
router.delete('/:id', requireRole('ADMIN'), departementController.deleteDepartement);

module.exports = router;
