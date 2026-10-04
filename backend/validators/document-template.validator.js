const { body, query } = require('express-validator');

/**
 * Validation de structure HTTP uniquement.
 *
 * Les règles métier (enum type_document, identifiants de variables,
 * placeholders, versioning, échappement) restent l'apanage exclusif de
 * `services/document-template.service.js`, source de vérité métier.
 */

const listTemplatesValidation = [
  query('type')
    .optional({ values: 'falsy' })
    .isString().withMessage('Le type doit être une chaîne.'),

  query('actif')
    .optional({ values: 'falsy' })
    .isBoolean().withMessage('Le filtre actif doit être true ou false.'),

  query('page')
    .optional({ values: 'falsy' })
    .isInt({ min: 1 }).withMessage('La page doit être un entier supérieur ou égal à 1.'),

  query('limit')
    .optional({ values: 'falsy' })
    .isInt({ min: 1 }).withMessage('La limite doit être un entier supérieur ou égal à 1.')
];

const createTemplateValidation = [
  body('nom')
    .notEmpty().withMessage('Le nom est requis.')
    .isString().withMessage('Le nom doit être une chaîne.'),

  body('type')
    .notEmpty().withMessage('Le type est requis.')
    .isString().withMessage('Le type doit être une chaîne.'),

  body('contenu')
    .notEmpty().withMessage('Le contenu est requis.')
    .isString().withMessage('Le contenu doit être une chaîne.'),

  body('variables')
    .optional()
    .isArray().withMessage('Les variables doivent être un tableau.')
];

const updateTemplateValidation = [
  body('nom')
    .optional()
    .isString().withMessage('Le nom doit être une chaîne.')
    .notEmpty().withMessage('Le nom ne peut pas être vide.'),

  body('contenu')
    .optional()
    .isString().withMessage('Le contenu doit être une chaîne.')
    .notEmpty().withMessage('Le contenu ne peut pas être vide.'),

  body('variables')
    .optional()
    .isArray().withMessage('Les variables doivent être un tableau.')
];

const previewTemplateValidation = [
  body().custom((value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('Le corps de la requête doit être un objet JSON.');
    }
    return true;
  })
];

module.exports = {
  listTemplatesValidation,
  createTemplateValidation,
  updateTemplateValidation,
  previewTemplateValidation
};
