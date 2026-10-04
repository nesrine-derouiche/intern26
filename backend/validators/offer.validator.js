const { body } = require('express-validator');

const createOfferValidation = [
  body('departement_id')
    .notEmpty().withMessage('Département requis.')
    .isUUID().withMessage('ID département invalide.'),
  body('titre')
    .notEmpty().withMessage('Titre requis.')
    .isString().withMessage('Le titre doit être une chaîne.'),
  body('duree')
    .notEmpty().withMessage('Durée requise.')
    .isInt({ min: 1 }).withMessage('La durée doit être un entier positif.'),
  body('nombre_places')
    .notEmpty().withMessage('Nombre de places requis.')
    .isInt({ min: 1 }).withMessage('Le nombre de places doit être un entier positif.'),
  body('date_limite')
    .notEmpty().withMessage('Date limite requise.')
    .isDate().withMessage('Date limite invalide.')
];

module.exports = { createOfferValidation };
