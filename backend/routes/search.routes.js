const express = require('express');
const router = express.Router();
const c = require('../controllers/search.controller');
const { authenticateToken: auth } = require('../middlewares/auth.middleware');
const { withScope } = require('../middlewares/authorization.middleware');
const { enforceOnboardingAccess } = require('../middlewares/onboarding-access.middleware');

router.use(auth, withScope, enforceOnboardingAccess);
router.get('/', c.search.bind(c));

module.exports = router;
