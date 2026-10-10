const express = require('express');
const router = express.Router();
const c = require('../controllers/note.controller');
const { authenticateToken: auth } = require('../middlewares/auth.middleware');
const { requireRole: role } = require('../middlewares/role.middleware');
const { enforceOnboardingAccess } = require('../middlewares/onboarding-access.middleware');
const {
  noteIdParamValidation,
  createNoteValidation,
  updateNoteValidation
} = require('../validators/note.validator');
const { validate } = require('../validators');

// Carnet privé des stagiaires : STAGIAIRE uniquement (le service dérive
// le propriétaire de la session et répond 404 hors périmètre, sans
// révéler l'existence). Aucune lecture croisée (encadrants, autres
// stagiaires, ADMIN/RH) : refusée ici (403) et en service.
router.use(auth, enforceOnboardingAccess, role('STAGIAIRE'));

router.get('/', c.list);
router.post('/', createNoteValidation, validate, c.create);
router.put('/:id', noteIdParamValidation, validate, updateNoteValidation, validate, c.update);
router.delete('/:id', noteIdParamValidation, validate, c.remove);

module.exports = router;
