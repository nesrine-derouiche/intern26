const express = require('express');
const router = express.Router();
const c = require('../controllers/subtask.controller');
const { authenticateToken: auth } = require('../middlewares/auth.middleware');
const { requireRole: role } = require('../middlewares/role.middleware');
const { withScope } = require('../middlewares/authorization.middleware');
const { enforceOnboardingAccess } = require('../middlewares/onboarding-access.middleware');
const authorizationService = require('../services/authorization.service');
const subtaskService = require('../services/subtask.service');
const { validate } = require('../validators');
const v = require('../validators/subtask.validator');

// This router is mounted at /api and uses absolute paths (same pattern as
// document.routes.js): nested reads under /taches/:taskId, direct access
// under /subtasks/:id. No collision with tache.routes.js (mounted at
// /taches with /, /mes-taches and /:id shapes only).

router.use(auth, withScope, enforceOnboardingAccess);

/**
 * Charge la tâche parente avec le périmètre d'autorisation existant
 * (authorizationService.loadAndAssert('tache', ...) : ADMIN/RH plein accès,
 * STAGIAIRE si exécutant, ENCADRANT si créateur, CHEF si même département).
 * 404 si inexistante, 403 hors périmètre.
 */
const authorizeParentTask = async (req, res, next) => {
  try {
    req.task = await authorizationService.loadAndAssert(
      'tache',
      req.params.taskId,
      req.user,
      req.scope
    );
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Charge la sous-tâche puis sa tâche parente avec le même périmètre :
 * un utilisateur hors périmètre du parent reçoit 403 sans jamais voir
 * la sous-tâche.
 */
const authorizeSubtask = async (req, res, next) => {
  try {
    const subtask = await subtaskService.getSubtask(req.params.id);
    req.subtask = subtask;
    req.task = await authorizationService.loadAndAssert(
      'tache',
      subtask.tache_id,
      req.user,
      req.scope
    );
    next();
  } catch (error) {
    next(error);
  }
};

router.get(
  '/taches/:taskId/subtasks',
  v.taskIdParamValidation,
  validate,
  authorizeParentTask,
  c.listByTask
);

router.post(
  '/taches/:taskId/subtasks',
  role('ENCADRANT'),
  v.taskIdParamValidation,
  validate,
  authorizeParentTask,
  v.createSubtaskValidation,
  validate,
  c.create
);

router.get(
  '/taches/:taskId/progress',
  v.taskIdParamValidation,
  validate,
  authorizeParentTask,
  c.progress
);

router.put(
  '/subtasks/:id',
  role('ENCADRANT'),
  v.subtaskIdParamValidation,
  validate,
  authorizeSubtask,
  v.updateSubtaskValidation,
  validate,
  c.update
);

router.patch(
  '/subtasks/:id/status',
  role('STAGIAIRE', 'ENCADRANT'),
  v.subtaskIdParamValidation,
  validate,
  authorizeSubtask,
  v.updateStatusValidation,
  validate,
  c.updateStatus
);

router.delete(
  '/subtasks/:id',
  role('ENCADRANT'),
  v.subtaskIdParamValidation,
  validate,
  authorizeSubtask,
  c.remove
);

module.exports = router;
