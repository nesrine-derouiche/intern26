const express = require('express');
const router = express.Router();
const c = require('../controllers/certification.controller');
const { authenticateToken: auth } = require('../middlewares/auth.middleware');
const { withScope } = require('../middlewares/authorization.middleware');
const { enforceOnboardingAccess } = require('../middlewares/onboarding-access.middleware');

// Table de suivi des certifications : périmètre appliqué en service
// (ENCADRANT = stages assignés, STAGIAIRE = stage propre,
// CHEF_DEPARTEMENT = département, ADMIN/RH = tout, CANDIDAT = 403).
router.use(auth, withScope, enforceOnboardingAccess);

router.get('/', c.list);

module.exports = router;
