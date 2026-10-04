const { body, param } = require('express-validator');

const VALID_DOCUMENT_TYPES = ['CV', 'CONVENTION', 'ASSURANCE', 'RAPPORT', 'ATTESTATION'];

const uploadDocumentValidation = [
  param('stageId')
    .notEmpty().withMessage('Stage requis.')
    .isUUID().withMessage('ID stage invalide.'),
  body('type')
    .notEmpty().withMessage('Type de document requis.')
    .isIn(VALID_DOCUMENT_TYPES).withMessage(`Type invalide. Types acceptés : ${VALID_DOCUMENT_TYPES.join(', ')}.`)
];

module.exports = { uploadDocumentValidation };
