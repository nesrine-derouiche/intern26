const { body } = require('express-validator');

const createMeetingValidation = [
  body('stage_id')
    .notEmpty().withMessage('Stage requis.')
    .isUUID().withMessage('ID stage invalide.'),
  body('date')
    .notEmpty().withMessage('Date requise.')
    .isDate().withMessage('Date invalide.'),
  body('heure')
    .notEmpty().withMessage('Heure requise.')
    .matches(/^([0-1]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/).withMessage('Format heure invalide (HH:MM).'),
  body('salle')
    .optional()
    .isString().withMessage('La salle doit être une chaîne.'),
  body('lien_visio')
    .optional({ values: 'falsy' })
    .isURL().withMessage('Lien visio invalide.'),
  body('sujet')
    .notEmpty().withMessage('Sujet requis.')
    .isString().withMessage('Le sujet doit être une chaîne.')
];

module.exports = { createMeetingValidation };
