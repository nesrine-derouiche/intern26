const { asyncHandler } = require('../utils/asyncHandler');
const candidatureService = require('../services/candidature.service');
const { onboardingAccessService } = require('../services/onboarding-access.service');
const { internshipReadinessService } = require('../services/internship-readiness.service');
const { internshipConversionService } = require('../services/internship-conversion.service');
const mockAiInterview = require('../services/ai/mock-ai.service');
const { sendResponse } = require('../utils/response.util');
const { getPaginationParams } = require('../utils/pagination.util');

const getAll = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await candidatureService.getAllCandidatures(getPaginationParams(req.query), req.scope));
});

const getMyOffers = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await candidatureService.getMyAppliedOffers(req.user));
});

const getMyCandidatures = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await candidatureService.getMyCandidatures(req.user));
});

const getById = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await candidatureService.getCandidatureDetails(req.params.id, req.user));
});

const getAiInterview = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await candidatureService.getAiInterview(req.params.id, req.user));
});

const getCandidateHumanInterview = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await candidatureService.getCandidateHumanInterview(req.params.id, req.user));
});

/** État d'accès au stage (garde d'onboarding) de la candidature du candidat connecté. */
const getInternshipAccess = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await onboardingAccessService.getInternshipAccess(req.params.id, req.user));
});

/** Éligibilité du dossier à la création du stagiaire (lecture seule). */
const getInternshipReadiness = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await internshipReadinessService.checkInternshipReadiness(req.params.id, req.user));
});

/** Conversion du dossier prêt (READY_FOR_TRAINEE) en stagiaire (transaction atomique). */
const convertToTrainee = asyncHandler(async (req, res) => {
  const result = await internshipConversionService.convertCandidatureToStagiaire(req.params.id, req.user);
  sendResponse(res, 200, result, result.already_converted
    ? 'Le stagiaire a déjà été créé pour cette candidature.'
    : 'Le stagiaire a été créé et le stage enregistré.');
});

const submitStagePreferences = asyncHandler(async (req, res) => {
  const result = await candidatureService.submitStagePreferences(req.params.id, req.body, req.user);
  sendResponse(res, 200, result, 'Votre période de stage a été enregistrée.');
});

const validateStagePreferences = asyncHandler(async (req, res) => {
  const result = await candidatureService.validateStagePreferences(req.params.id, req.user);
  sendResponse(res, 200, result, 'La période de stage a été validée.');
});

const requestStagePreferencesModification = asyncHandler(async (req, res) => {
  const result = await candidatureService.requestStagePreferencesModification(req.params.id, req.user);
  sendResponse(res, 200, result, 'Une modification de la période de stage a été demandée au candidat.');
});

/**
 * Déclencheur DEV du résultat d'entretien IA.
 *
 * Remplace pour le développement le retour du futur moteur IA. Deux modes :
 *  - corps avec `{ score, status }` → le résultat est appliqué tel quel ;
 *  - corps vide → le moteur MOCK (services/ai/mock-ai.service.js) produit
 *    un résultat simulé, exactement comme le fera le service IA réel.
 * Le workflow métier (statut, notifications, emails) est appliqué par
 * candidatureService.submitAiInterviewResult, qui ne connaît que le contrat
 * { score, status } et ignore totalement l'implémentation de l'IA.
 */
const submitAiInterviewResult = asyncHandler(async (req, res) => {
  let result = null;
  if (req.body && (req.body.status === 'PASSED' || req.body.status === 'FAILED')) {
    result = { score: Number(req.body.score), status: req.body.status };
  }
  if (!result) {
    result = await mockAiInterview.runInterview({ candidatureId: req.params.id });
  }
  const outcome = await candidatureService.submitAiInterviewResult(req.params.id, result, req.user);
  const message = outcome.statut === 'AI_INTERVIEW_PASSED'
    ? 'Entretien IA réussi : le candidat est éligible pour un entretien humain.'
    : 'Entretien IA non réussi : le candidat est écarté.';
  sendResponse(res, 200, outcome, message);
});

const downloadCv = asyncHandler(async (req, res) => {
  const { filePath, filename } = await candidatureService.getCandidatureCvFile(req.params.id, req.user);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
  res.sendFile(filePath);
});

const updateStatut = asyncHandler(async (req, res) => {
  const result = await candidatureService.updateCandidatureStatut(req.params.id, req.body.statut, req.user.role);
  sendResponse(res, 200, null, result.message);
});

const create = asyncHandler(async (req, res) => {
  const candidature = await candidatureService.createCandidature(req.body, req.user);
  sendResponse(res, 201, { candidature }, 'Candidature créée.');
});

const delete_ = asyncHandler(async (req, res) => {
  await candidatureService.deleteCandidature(req.params.id);
  sendResponse(res, 200, null, 'Candidature supprimée.');
});

const scheduleHumanInterview = asyncHandler(async (req, res) => {
  const result = await candidatureService.scheduleHumanInterview(req.params.id, req.body, req.user.role);
  sendResponse(res, 200, result.interview, result.message);
});

const scheduleExpressHumanInterview = asyncHandler(async (req, res) => {
  const result = await candidatureService.scheduleExpressHumanInterview(req.params.id, req.user);
  sendResponse(res, 200, result.interview, result.message);
});

const updateHumanInterview = asyncHandler(async (req, res) => {
  const result = await candidatureService.updateHumanInterview(req.params.id, req.body, req.user.role);
  sendResponse(res, 200, result.interview, result.message);
});

const cancelHumanInterview = asyncHandler(async (req, res) => {
  const result = await candidatureService.cancelHumanInterview(req.params.id, req.user.role);
  sendResponse(res, 200, null, result.message);
});

const completeHumanInterview = asyncHandler(async (req, res) => {
  const result = await candidatureService.completeHumanInterview(req.params.id, req.user);
  sendResponse(res, 200, result.interview, result.message);
});

const decideHumanInterview = asyncHandler(async (req, res) => {
  const result = await candidatureService.decideHumanInterview(req.params.id, req.body, req.user);
  sendResponse(res, 200, result, result.message);
});

const recordHumanInterviewDecision = asyncHandler(async (req, res) => {
  const result = await candidatureService.recordHumanInterviewDecision(req.params.id, req.body, req.user);
  sendResponse(res, 200, result, result.statut === 'ACCEPTEE'
    ? 'Candidature acceptée : le stage a été créé et la collecte des documents est lancée.'
    : 'Candidature refusée.');
});

/** Acceptation directe après entretien IA réussi (raccourci de démo, sans entretien humain). */
const acceptAfterAiInterview = asyncHandler(async (req, res) => {
  const result = await candidatureService.acceptAfterAiInterview(req.params.id, req.user);
  sendResponse(res, 200, result, 'Candidature acceptée directement (stage créé).');
});

const uploadOnboardingDocument = asyncHandler(async (req, res) => {
  const result = await candidatureService.uploadOnboardingDocument(req.params.id, req.params.type, req.file, req.user);
  sendResponse(res, 200, result, 'Document déposé. Il sera vérifié par le service RH.');
});

/** Décision RH de vérification manuelle d'un document du dossier (VALIDER / REJETER). */
const decideDocumentVerification = asyncHandler(async (req, res) => {
  const result = await candidatureService.decideDocumentVerification(req.params.id, req.params.documentId, req.body, req.user);
  sendResponse(res, 200, result, result.message);
});

/** Téléchargement (visionnage) d'un document du dossier par le RH. */
const downloadOnboardingDocument = asyncHandler(async (req, res) => {
  const { filePath, nom, contentType } = await candidatureService.getOnboardingDocumentFile(req.params.id, req.params.documentId);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(nom)}"`);
  res.sendFile(filePath);
});

module.exports = { getAll, getMyOffers, getMyCandidatures, getById, getAiInterview, getCandidateHumanInterview, getInternshipAccess, getInternshipReadiness, convertToTrainee, submitStagePreferences, validateStagePreferences, requestStagePreferencesModification, submitAiInterviewResult, downloadCv, updateStatut, create, delete: delete_, scheduleHumanInterview, scheduleExpressHumanInterview, updateHumanInterview, cancelHumanInterview, completeHumanInterview, decideHumanInterview, recordHumanInterviewDecision, acceptAfterAiInterview, uploadOnboardingDocument, decideDocumentVerification, downloadOnboardingDocument };
