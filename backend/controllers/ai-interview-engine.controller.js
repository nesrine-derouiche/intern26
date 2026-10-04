const { asyncHandler } = require('../utils/asyncHandler');
const engineService = require('../services/ai-interview-engine.service');
const { sendResponse } = require('../utils/response.util');

const createInterview = asyncHandler(async (req, res) => {
  const interview = await engineService.createInterview(req.params.candidatureId, req.user);
  sendResponse(res, 201, interview, 'Entretien IA vocal créé.');
});

const getInterview = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await engineService.getInterview(req.params.id, req.user));
});

const startInterview = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await engineService.startInterview(req.params.id, req.user), 'Entretien IA démarré.');
});

const completeInterview = asyncHandler(async (req, res) => {
  const interview = await engineService.completeInterview(req.params.id, req.user);
  sendResponse(res, 200, interview, 'Entretien IA terminé.');
});

const answerInterview = asyncHandler(async (req, res) => {
  const { question_number, answer } = req.body || {};
  const interview = await engineService.answerInterview(req.params.id, req.user, question_number, answer);
  sendResponse(res, 200, interview, 'Réponse enregistrée.');
});

const getReport = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await engineService.getReport(req.params.id, req.user));
});

module.exports = { createInterview, getInterview, startInterview, answerInterview, completeInterview, getReport };
