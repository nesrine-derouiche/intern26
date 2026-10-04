const { asyncHandler } = require('../utils/asyncHandler');
const aiInterviewService = require('../services/ai-interview.service');
const { sendResponse } = require('../utils/response.util');
const ApiError = require('../utils/error.util');
const logger = require('../utils/logger');

function logAudioSent(bytes, format, provider) {
  logger.info(
    '[TTS] audio sent (%d bytes, format=%s, provider=%s)',
    bytes,
    format || 'wav',
    provider || 'unknown',
  );
}

const getInterview = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await aiInterviewService.getInterviewByToken(req.params.token, req.user));
});

const startInterview = asyncHandler(async (req, res) => {
  const started = await aiInterviewService.startInterview(req.params.token, req.user);
  logAudioSent(started.audio.length, started.audio_format, started.audio_provider);
  sendResponse(res, 200, {
    question: started.question,
    total_questions: started.total_questions,
    audio: started.audio.toString('base64'),
    audio_format: started.audio_format,
  }, 'Entretien commencé.');
});

const saveAnswer = asyncHandler(async (req, res) => {
  const saved = await aiInterviewService.saveAnswer(
    req.params.token,
    req.params.numero,
    req.body.answer,
    req.user,
    req.body.duration_seconds
  );
  sendResponse(res, 200, saved, 'Réponse enregistrée.');
});

const answerInterviewAudio = asyncHandler(async (req, res) => {
  const { question_number, filename, mime, duration_seconds } = req.body || {};
  const answered = await aiInterviewService.answerInterviewAudio(
    req.params.token,
    question_number,
    req.file ? req.file.buffer : null,
    req.file ? req.file.originalname : (filename || 'reponse.webm'),
    req.file ? req.file.mimetype : (mime || 'audio/webm'),
    req.user,
    duration_seconds
  );
  if (answered.audio) {
    logAudioSent(answered.audio.length, answered.audio_format, answered.audio_provider);
  }
  sendResponse(res, 200, {
    answer_text: answered.answer_text,
    question_number: answered.question_number,
    next_question: answered.next_question,
    done: answered.done,
    audio: answered.audio ? answered.audio.toString('base64') : null,
    audio_format: answered.audio_format,
  }, 'Réponse vocale analysée.');
});

const synthesize = asyncHandler(async (req, res) => {
  const { text } = req.body || {};
  const synth = await aiInterviewService.synthesize(req.params.token, text, req.user);
  logAudioSent(synth.audio.length, synth.audio_format, synth.audio_provider);
  sendResponse(res, 200, {
    audio: synth.audio.toString('base64'),
    audio_format: synth.audio_format,
  }, 'Audio généré.');
});

const completeInterview = asyncHandler(async (req, res) => {
  const outcome = await aiInterviewService.completeInterview(req.params.token, req.user);
  sendResponse(res, 200, outcome, 'Entretien terminé.');
});

/** « Quitter » : bloque le lien du mail (l'entretien devient inaccessible). */
const quitInterview = asyncHandler(async (req, res) => {
  const outcome = await aiInterviewService.quitInterview(req.params.token, req.user);
  sendResponse(res, 200, outcome, 'Entretien quitté.');
});

const reportIntegrity = asyncHandler(async (req, res) => {
  const stored = await aiInterviewService.reportIntegrity(req.params.token, req.body, req.user);
  sendResponse(res, 200, stored, 'Événements d\'intégrité enregistrés.');
});

const reportFingerprint = asyncHandler(async (req, res) => {
  const outcome = await aiInterviewService.reportFingerprint(req.params.token, req.body && req.body.fingerprint, req.user);
  sendResponse(res, 200, outcome, 'Empreinte d\'appareil enregistrée.');
});

/**
 * État du microservice Python d'entretien IA. 503 si le service est injoignable :
 * le candidat ne doit pas être invité à rejoindre un entretien indisponible.
 */
const pythonHealth = asyncHandler(async (req, res) => {
  const ok = await aiInterviewService.healthCheck();
  if (!ok) {
    throw new ApiError(503, 'Le service d\'entretien IA (Python) est indisponible. Réessayez dans quelques instants.');
  }
  sendResponse(res, 200, { ok: true }, 'Service IA disponible.');
});

module.exports = { getInterview, startInterview, saveAnswer, answerInterviewAudio, synthesize, completeInterview, quitInterview, reportIntegrity, reportFingerprint, pythonHealth };
