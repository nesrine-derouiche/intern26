const { asyncHandler } = require('../utils/asyncHandler');
const pdfService = require('../services/pdf.service');
const documentGenerationService = require('../services/document-generation.service');

const conventionFilename = (variables) =>
  `convention_stage_${variables.stagiaire_nom}_${variables.stagiaire_prenom}.pdf`;

const attestationFilename = (variables) =>
  `attestation_stage_${variables.stagiaire_nom}_${variables.stagiaire_prenom}.pdf`;

const downloadConvention = asyncHandler(async (req, res) => {
  const stageId = req.params.stageId;
  const prepared = await documentGenerationService.generate({ stageId, type: 'CONVENTION' });
  if (prepared.generated) {
    pdfService.generateRendered(res, conventionFilename(prepared.variables), prepared.rendered);
    return;
  }
  await pdfService.generateConvention(stageId, res);
});

const downloadAttestation = asyncHandler(async (req, res) => {
  const stageId = req.params.stageId;
  const prepared = await documentGenerationService.generate({ stageId, type: 'ATTESTATION' });
  if (prepared.generated) {
    pdfService.generateRendered(res, attestationFilename(prepared.variables), prepared.rendered);
    return;
  }
  await pdfService.generateAttestation(stageId, res);
});

/**
 * P1-3A-6 — « EVALUATION » n'existe pas dans l'enum type_document
 * (database/schema.sql) : aucun template ne peut être associé à ce type sans
 * modifier le schéma (hors périmètre à cette étape). documentGenerationService
 * retournerait { generated:false, reason:'NO_TEMPLATE_TYPE' } : la route
 * historique reste donc inchangée.
 */
const downloadEvaluation = asyncHandler(async (req, res) => {
  await pdfService.generateEvaluation(req.params.stageId, res);
});

module.exports = { downloadConvention, downloadAttestation, downloadEvaluation };
