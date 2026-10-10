const { body, param } = require('express-validator');

/**
 * Validation de structure HTTP uniquement.
 *
 * Les règles métier (statuts TODO / IN_PROGRESS / DONE, propriété de la
 * tâche parente, calcul de progression) restent l'apanage exclusif de
 * `services/subtask.service.js` et des middlewares de
 * `routes/subtask.routes.js`, sources de vérité métier.
 */

const taskIdParamValidation = [
  param('taskId')
    .isUUID().withMessage('Identifiant de tâche invalide.')
];

const subtaskIdParamValidation = [
  param('id')
    .isUUID().withMessage('Identifiant de sous-tâche invalide.')
];

const createSubtaskValidation = [
  body('titre')
    .notEmpty().withMessage('Le titre est requis.')
    .isString().withMessage('Le titre doit être une chaîne.')
    .isLength({ max: 200 }).withMessage('Le titre ne doit pas dépasser 200 caractères.'),

  body('description')
    .optional({ values: 'falsy' })
    .isString().withMessage('La description doit être une chaîne.'),

  body('statut')
    .optional()
    .isIn(['TODO', 'IN_PROGRESS', 'DONE']).withMessage('Statut de sous-tâche invalide.')
];

const updateSubtaskValidation = [
  body('titre')
    .optional()
    .isString().withMessage('Le titre doit être une chaîne.')
    .notEmpty().withMessage('Le titre ne peut pas être vide.')
    .isLength({ max: 200 }).withMessage('Le titre ne doit pas dépasser 200 caractères.'),

  body('description')
    .optional({ values: 'falsy' })
    .isString().withMessage('La description doit être une chaîne.'),

  body('statut')
    .optional()
    .isIn(['TODO', 'IN_PROGRESS', 'DONE']).withMessage('Statut de sous-tâche invalide.')
];

const updateStatusValidation = [
  body('statut')
    .notEmpty().withMessage('Le statut est requis.')
    .isString().withMessage('Le statut doit être une chaîne.')
    .isIn(['TODO', 'IN_PROGRESS', 'DONE']).withMessage('Statut de sous-tâche invalide.')
];

module.exports = {
  taskIdParamValidation,
  subtaskIdParamValidation,
  createSubtaskValidation,
  updateSubtaskValidation,
  updateStatusValidation
};
