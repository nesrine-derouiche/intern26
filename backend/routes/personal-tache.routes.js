const express = require('express');
const router = express.Router();
const c = require('../controllers/personal-tache.controller');
const { authenticateToken: auth } = require('../middlewares/auth.middleware');
const { enforceOnboardingAccess } = require('../middlewares/onboarding-access.middleware');
const {
  createPersonalTaskValidation,
  updatePersonalTaskValidation,
  movePersonalTaskValidation,
} = require('../validators/personal-task.validator');
const { validate } = require('../validators');

router.use(auth, enforceOnboardingAccess);
router.get('/counts', c.getCounts);
router.get('/', c.getAll);
router.post('/', createPersonalTaskValidation, validate, c.create);
router.get('/:id', c.getById);
router.put('/:id', updatePersonalTaskValidation, validate, c.update);
router.delete('/:id', c.remove);
router.patch('/:id/move', movePersonalTaskValidation, validate, c.move);

module.exports = router;
