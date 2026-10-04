const express = require('express');
const router = express.Router();
const c = require('../controllers/pointage.controller');
const { authenticateToken: auth } = require('../middlewares/auth.middleware');
const { requireRole: role } = require('../middlewares/role.middleware');
const { withScope, authorizeResource } = require('../middlewares/authorization.middleware');
const { enforceOnboardingAccess } = require('../middlewares/onboarding-access.middleware');
const { createPointageValidation, corrigerPointageValidation, upsertHoraireValidation } = require('../validators/pointage.validator');
const { validate } = require('../validators');

router.use(auth, withScope, enforceOnboardingAccess);

router.post('/entree', role('STAGIAIRE'), createPointageValidation, validate, c.pointerEntree);
router.post('/sortie', role('STAGIAIRE'), createPointageValidation, validate, c.pointerSortie);
router.get('/mes-presences', role('STAGIAIRE'), c.getMesPresences);
router.get('/retards', role('ENCADRANT', 'ADMIN', 'RH'), c.getRetards);
router.get('/', role('ADMIN', 'RH', 'ENCADRANT'), c.getAll);

router.get('/stage/:id', authorizeResource('stage'), c.getByStage);
router.get('/stats/:id', authorizeResource('stage'), c.getStats);
router.get('/horaires/:id', authorizeResource('stage'), c.getHoraire);
router.put('/horaires/:id', authorizeResource('stage'), role('ENCADRANT', 'ADMIN', 'RH'), upsertHoraireValidation, validate, c.upsertHoraire);

router.put('/:id/corriger', authorizeResource('pointage'), role('ADMIN', 'RH'), corrigerPointageValidation, validate, c.corriger);

module.exports = router;
