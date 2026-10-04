jest.mock('../repositories/ai-interview.repository', () => ({
  findByToken: jest.fn(),
  findByCandidatureId: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  setStatus: jest.fn(),
  setPythonSession: jest.fn(),
  createQuestions: jest.fn(),
  getQuestions: jest.fn(),
  getAnswers: jest.fn(),
  upsertAnswer: jest.fn(),
  saveEvaluation: jest.fn(),
  countAnswers: jest.fn(),
  appendIntegrityEvents: jest.fn(),
  saveIntegrityDevices: jest.fn(),
  setDeviceFingerprint: jest.fn(),
  recordDeviceCheck: jest.fn(),
  updateIntegrityRisk: jest.fn()
}));

jest.mock('../repositories/candidature.repository', () => ({
  findByIdWithOffer: jest.fn()
}));

jest.mock('../repositories/offre.repository', () => ({
  findPublicById: jest.fn()
}));

jest.mock('../repositories/candidat.repository', () => ({
  getProfile: jest.fn()
}));

jest.mock('../services/notification.service', () => ({
  notifyRoleBestEffort: jest.fn()
}));

jest.mock('../services/candidature.service', () => ({
  applyAiInterviewResult: jest.fn(),
  applicantName: jest.fn()
}));

jest.mock('../services/ai/question-generator.service', () => ({
  generateQuestions: jest.fn()
}));

jest.mock('../services/ai/ai-interview.provider.service', () => ({
  evaluateInterview: jest.fn()
}));

jest.mock('../services/ai-voice.service', () => ({
  transcribe: jest.fn(),
  synthesize: jest.fn()
}));

const aiInterviewService = require('../services/ai-interview.service');
const aiInterviewRepository = require('../repositories/ai-interview.repository');
const candidatureRepository = require('../repositories/candidature.repository');
const offreRepository = require('../repositories/offre.repository');
const notificationService = require('../services/notification.service');
const candidatureService = require('../services/candidature.service');
const questionGenerator = require('../services/ai/question-generator.service');
const aiProvider = require('../services/ai/ai-interview.provider.service');
const voiceService = require('../services/ai-voice.service');

const CANDIDAT = { id: 'candidat-1', role: 'CANDIDAT' };
const AUTRE = { id: 'autre-candidat', role: 'CANDIDAT' };

const SESSION = {
  id: 'session-1',
  candidature_id: 'cand-1',
  token: 'tok-1',
  statut: 'EN_ATTENTE',
  evaluation_status: 'EN_ATTENTE'
};

const CANDIDATURE = {
  id: 'cand-1',
  candidat_id: 'candidat-1',
  stagiaire_id: null,
  offre_id: 'offre-1',
  statut: 'RH_ACCEPTED',
  date_candidature: '2026-08-05T10:00:00.000Z'
};

const OFFRE = {
  id: 'offre-1',
  titre: 'Développeur Node.js',
  departement_nom: 'Informatique',
  duree: 16,
  competences_demandees: 'Node.js, JavaScript',
  technologies: 'Node.js, Express'
};

function mockOwnedSession(session = SESSION, candidature = CANDIDATURE) {
  aiInterviewRepository.findByToken.mockResolvedValue(session);
  candidatureRepository.findByIdWithOffer.mockResolvedValue(candidature);
  offreRepository.findPublicById.mockResolvedValue(OFFRE);
}

beforeEach(() => {
  jest.clearAllMocks();
  aiInterviewRepository.getAnswers.mockResolvedValue([]);
});

describe('AiInterviewService — accès par token', () => {
  test('GET renvoie le contexte au propriétaire', async () => {
    mockOwnedSession();
    const result = await aiInterviewService.getInterviewByToken('tok-1', CANDIDAT);

    expect(result.id).toBe('session-1');
    expect(result.token).toBe('tok-1');
    expect(result.statut).toBe('EN_ATTENTE');
    expect(result.candidature.id).toBe('cand-1');
    expect(result.offre.competences).toEqual(['Node.js', 'JavaScript']);
    expect(result.offre.technologies).toEqual(['Node.js', 'Express']);
    expect(result.candidat).toBeDefined();
  });

  test('lève 404 si le token est inconnu', async () => {
    aiInterviewRepository.findByToken.mockResolvedValue(null);
    await expect(aiInterviewService.getInterviewByToken('ghost', CANDIDAT)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('lève 403 si le candidat connecté n’est pas le propriétaire', async () => {
    mockOwnedSession();
    await expect(aiInterviewService.getInterviewByToken('tok-1', AUTRE)).rejects.toMatchObject({ statusCode: 403 });
  });

  test('lève 404 si la candidature n’est pas en RH_ACCEPTED', async () => {
    mockOwnedSession(SESSION, { ...CANDIDATURE, statut: 'EN_ATTENTE' });
    await expect(aiInterviewService.getInterviewByToken('tok-1', CANDIDAT)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('reprend les questions et réponses quand la session est EN_COURS', async () => {
    const questions = [{ id: 'q1', question_number: 1, question: 'Présentez-vous' }];
    const answers = [{ id: 'a1', question_number: 1, answer: 'Je suis Marwa' }];
    aiInterviewRepository.getQuestions.mockResolvedValue(questions);
    aiInterviewRepository.getAnswers.mockResolvedValue(answers);
    mockOwnedSession({ ...SESSION, statut: 'EN_COURS' });

    const result = await aiInterviewService.getInterviewByToken('tok-1', CANDIDAT);
    expect(result.questions).toEqual(questions);
    expect(result.answers).toEqual(answers);
  });

  test('lève 404 si la session est TERMINE (lien bloqué après « terminer »)', async () => {
    mockOwnedSession({ ...SESSION, statut: 'TERMINE', evaluation_status: 'EVALUEE' });
    await expect(aiInterviewService.getInterviewByToken('tok-1', CANDIDAT)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Entretien IA introuvable.'
    });
  });

  test('lève 404 si la session est ABANDONNE (lien bloqué après « quitter »)', async () => {
    mockOwnedSession({ ...SESSION, statut: 'ABANDONNE' });
    await expect(aiInterviewService.getInterviewByToken('tok-1', CANDIDAT)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Entretien IA introuvable.'
    });
    expect(aiInterviewRepository.getQuestions).not.toHaveBeenCalled();
  });
});

describe('AiInterviewService — quitInterview', () => {
  test('met la session en ABANDONNE (lien bloqué)', async () => {
    mockOwnedSession({ ...SESSION, statut: 'EN_COURS' });
    aiInterviewRepository.setStatus.mockResolvedValue({ ...SESSION, statut: 'ABANDONNE' });

    const result = await aiInterviewService.quitInterview('tok-1', CANDIDAT);

    expect(result).toEqual({ statut: 'ABANDONNE' });
    expect(aiInterviewRepository.setStatus).toHaveBeenCalledWith('session-1', 'ABANDONNE');
  });

  test('lève 400 si l’entretien est déjà terminé', async () => {
    mockOwnedSession({ ...SESSION, statut: 'TERMINE', evaluation_status: 'EVALUEE' });
    await expect(aiInterviewService.quitInterview('tok-1', CANDIDAT)).rejects.toMatchObject({ statusCode: 400 });
    expect(aiInterviewRepository.setStatus).not.toHaveBeenCalled();
  });

  test('est idempotent si la session est déjà ABANDONNE', async () => {
    mockOwnedSession({ ...SESSION, statut: 'ABANDONNE' });
    const result = await aiInterviewService.quitInterview('tok-1', CANDIDAT);
    expect(result).toEqual({ statut: 'ABANDONNE' });
    expect(aiInterviewRepository.setStatus).not.toHaveBeenCalled();
  });
});

describe('AiInterviewService — startInterview (vocal)', () => {
  const FIRST_QUESTION = { question_number: 1, categorie: 'PRESENTATION', question: 'Bonjour, présentez-vous.' };

  test('crée la session Python, génère la 1ère question et son audio', async () => {
    jest.spyOn(aiInterviewService, '_pythonCreate').mockResolvedValue({ session_id: 'py-1' });
    jest.spyOn(aiInterviewService, '_pythonStart').mockResolvedValue({ question: FIRST_QUESTION, total_questions: 8 });
    voiceService.synthesize.mockResolvedValue({ audio: Buffer.from('WAV'), format: 'wav', provider: 'edge' });
    mockOwnedSession();

    const result = await aiInterviewService.startInterview('tok-1', CANDIDAT);

    expect(result.question).toEqual(FIRST_QUESTION);
    expect(result.total_questions).toBe(8);
    expect(result.audio).toEqual(Buffer.from('WAV'));
    expect(result.audio_format).toBe('wav');
    expect(result.audio_provider).toBe('edge');
    expect(aiInterviewRepository.setPythonSession).toHaveBeenCalledWith('session-1', 'py-1');
    expect(aiInterviewRepository.createQuestions).toHaveBeenCalledWith('session-1', [FIRST_QUESTION]);
    expect(aiInterviewRepository.setStatus).toHaveBeenCalledWith('session-1', 'EN_COURS');
    expect(voiceService.synthesize).toHaveBeenCalledWith(FIRST_QUESTION.question);
  });

  test('réutilise la session Python déjà créée (reprise)', async () => {
    jest.spyOn(aiInterviewService, '_pythonStart').mockResolvedValue({ question: FIRST_QUESTION, total_questions: 8 });
    voiceService.synthesize.mockResolvedValue({ audio: Buffer.from('WAV'), format: 'wav' });
    mockOwnedSession({ ...SESSION, python_session_id: 'py-existant' });

    const result = await aiInterviewService.startInterview('tok-1', CANDIDAT);

    expect(aiInterviewService._pythonCreate).not.toHaveBeenCalled();
    expect(aiInterviewRepository.setPythonSession).not.toHaveBeenCalled();
    expect(result.question.question_number).toBe(1);
  });

  test('lève 400 si la session a déjà commencé', async () => {
    mockOwnedSession({ ...SESSION, statut: 'EN_COURS' });
    await expect(aiInterviewService.startInterview('tok-1', CANDIDAT)).rejects.toMatchObject({ statusCode: 400 });
    expect(aiInterviewService._pythonCreate).not.toHaveBeenCalled();
  });
});

describe('AiInterviewService — réponse vocale (audio)', () => {
  const SESSION_VOCAL = { ...SESSION, statut: 'EN_COURS', python_session_id: 'py-1' };

  beforeEach(() => {
    aiInterviewRepository.getQuestions.mockResolvedValue([
      { id: 'q1', question_number: 1, question: 'Bonjour, présentez-vous.' }
    ]);
    aiInterviewRepository.upsertAnswer.mockResolvedValue({ question_number: 1, answer: 'texte' });
  });

  test('STT → moteur → question suivante + audio TTS', async () => {
    const next = { question_number: 2, categorie: 'MOTIVATION', question: 'Pourquoi ce stage ?' };
    voiceService.transcribe.mockResolvedValue('Je suis motivé');
    jest.spyOn(aiInterviewService, '_pythonAnswer').mockResolvedValue({ next_question: next, done: false });
    voiceService.synthesize.mockResolvedValue({ audio: Buffer.from('WAV2'), format: 'wav', provider: 'edge' });
    mockOwnedSession(SESSION_VOCAL);

    const result = await aiInterviewService.answerInterviewAudio('tok-1', 1, Buffer.from('audio'), 'reponse.webm', 'audio/webm', CANDIDAT);

    expect(result.answer_text).toBe('Je suis motivé');
    expect(result.next_question).toEqual(next);
    expect(result.done).toBe(false);
    expect(result.audio).toEqual(Buffer.from('WAV2'));
    expect(result.audio_format).toBe('wav');
    expect(result.audio_provider).toBe('edge');
    expect(aiInterviewRepository.upsertAnswer).toHaveBeenCalledWith('session-1', 1, 'Bonjour, présentez-vous.', 'Je suis motivé', null);
    expect(aiInterviewRepository.createQuestions).toHaveBeenCalledWith('session-1', [next]);
  });

  test('dernière réponse : done sans question suivante ni audio', async () => {
    voiceService.transcribe.mockResolvedValue('Ma dernière réponse');
    jest.spyOn(aiInterviewService, '_pythonAnswer').mockResolvedValue({ next_question: null, done: true });
    mockOwnedSession(SESSION_VOCAL);

    const result = await aiInterviewService.answerInterviewAudio('tok-1', 8, Buffer.from('audio'), 'r.webm', 'audio/webm', CANDIDAT);

    expect(result.done).toBe(true);
    expect(result.next_question).toBeNull();
    expect(result.audio).toBeNull();
    expect(voiceService.synthesize).not.toHaveBeenCalled();
  });

  test('lève 400 si l’entretien n’est pas vocal', async () => {
    mockOwnedSession({ ...SESSION, statut: 'EN_COURS' });
    await expect(aiInterviewService.answerInterviewAudio('tok-1', 1, Buffer.from('a'), 'r.webm', 'audio/webm', CANDIDAT))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('transmet l’erreur STT (ex. audio vide)', async () => {
    voiceService.transcribe.mockRejectedValue(Object.assign(new Error('Audio vide'), { statusCode: 400 }));
    mockOwnedSession(SESSION_VOCAL);
    await expect(aiInterviewService.answerInterviewAudio('tok-1', 1, null, 'r.webm', 'audio/webm', CANDIDAT))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('AiInterviewService — synthèse vocale', () => {
  test('proxy TTS : renvoie l’audio du texte', async () => {
    voiceService.synthesize.mockResolvedValue({ audio: Buffer.from('MP3'), format: 'mp3', provider: 'system' });
    mockOwnedSession();
    const result = await aiInterviewService.synthesize('tok-1', 'Reposez la question', CANDIDAT);
    expect(result).toEqual({ audio: Buffer.from('MP3'), audio_format: 'mp3', audio_provider: 'system' });
  });

  test('vérifie l’appartenance avant synthèse', async () => {
    mockOwnedSession();
    await expect(aiInterviewService.synthesize('tok-1', 'x', AUTRE)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('AiInterviewService — intégrité et anti-triche', () => {
  beforeEach(() => {
    aiInterviewRepository.getAnswers.mockResolvedValue([
      { question_number: 1, answer: 'Bonjour', duration_seconds: 25 }
    ]);
    aiInterviewRepository.updateIntegrityRisk.mockResolvedValue(undefined);
    aiInterviewRepository.findById.mockResolvedValue({
      id: 'session-1',
      started_at: '2026-08-06T10:00:00.000Z',
      integrity_events: [
        { event: 'TAB_SWITCH', timestamp: '2026-08-06T10:01:00.000Z' },
        { event: 'PASTE_ATTEMPT', timestamp: '2026-08-06T10:01:05.000Z' }
      ],
      device_fingerprint_changed: false
    });
  });

  test('reportIntegrity enregistre le lot, puis recalcule et persiste le risque', async () => {
    aiInterviewRepository.appendIntegrityEvents.mockResolvedValue([]);
    aiInterviewRepository.saveIntegrityDevices.mockResolvedValue({ camera: 'Webcam' });
    mockOwnedSession({
      ...SESSION,
      statut: 'EN_COURS',
      started_at: '2026-08-06T10:00:00.000Z',
      integrity_events: []
    });

    const result = await aiInterviewService.reportIntegrity('tok-1', {
      events: [
        { event: 'TAB_SWITCH', timestamp: '2026-08-06T10:01:00.000Z' },
        { event: 'PASTE_ATTEMPT', timestamp: '2026-08-06T10:01:05.000Z' }
      ],
      devices: { camera: 'Webcam' }
    }, CANDIDAT);

    expect(result.stored).toBe(2);
    expect(aiInterviewRepository.appendIntegrityEvents).toHaveBeenCalledWith('session-1', expect.any(Array));
    expect(aiInterviewRepository.saveIntegrityDevices).toHaveBeenCalledWith('session-1', { camera: 'Webcam' });
    expect(aiInterviewRepository.findById).toHaveBeenCalledWith('session-1');
    expect(aiInterviewRepository.updateIntegrityRisk).toHaveBeenCalledWith('session-1', expect.objectContaining({ level: 'LOW' }));
    expect(result.risk).toMatchObject({ score: expect.any(Number), level: expect.any(String) });
  });

  test('reportIntegrity refuse un événement inconnu', async () => {
    mockOwnedSession({ ...SESSION, statut: 'EN_COURS' });
    await expect(
      aiInterviewService.reportIntegrity('tok-1', { events: [{ event: 'HACK', timestamp: '2026-08-06T10:01:00.000Z' }] }, CANDIDAT)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('reportFingerprint : première vérification enregistre l’empreinte de référence', async () => {
    mockOwnedSession({ ...SESSION, statut: 'EN_COURS', device_fingerprint: null });
    aiInterviewRepository.setDeviceFingerprint.mockResolvedValue({ device_checks: 1, device_fingerprint_changed: false });

    const result = await aiInterviewService.reportFingerprint('tok-1', 'a1b2c3d4e5f60718', CANDIDAT);

    expect(result).toMatchObject({ matched: true, first_time: true });
    expect(aiInterviewRepository.setDeviceFingerprint).toHaveBeenCalledWith('session-1', 'a1b2c3d4e5f60718');
    expect(aiInterviewRepository.recordDeviceCheck).not.toHaveBeenCalled();
  });

  test('reportFingerprint : une différence d’empreinte signale un changement d’appareil', async () => {
    mockOwnedSession({
      ...SESSION,
      statut: 'EN_COURS',
      device_fingerprint: 'a1b2c3d4e5f60718',
      device_fingerprint_changed: false
    });
    aiInterviewRepository.recordDeviceCheck.mockResolvedValue({ device_checks: 2, device_fingerprint_changed: true });
    aiInterviewRepository.appendIntegrityEvents.mockResolvedValue([]);
    aiInterviewRepository.findById.mockResolvedValue({
      id: 'session-1',
      started_at: '2026-08-06T10:00:00.000Z',
      integrity_events: [{ event: 'DEVICE_CHANGE', timestamp: '2026-08-06T10:02:00.000Z' }],
      device_fingerprint_changed: true
    });

    const result = await aiInterviewService.reportFingerprint('tok-1', 'd4e5f60718a9b0c1', CANDIDAT);

    expect(result).toMatchObject({ matched: false, first_time: false });
    expect(aiInterviewRepository.recordDeviceCheck).toHaveBeenCalledWith('session-1', false);
    expect(aiInterviewRepository.appendIntegrityEvents).toHaveBeenCalledWith(
      'session-1',
      expect.arrayContaining([expect.objectContaining({ event: 'DEVICE_CHANGE' })])
    );
    expect(aiInterviewRepository.updateIntegrityRisk).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({ level: 'MODERATE' })
    );
  });

  test('reportFingerprint : même empreinte = appareil cohérent, aucun flag', async () => {
    mockOwnedSession({
      ...SESSION,
      statut: 'EN_COURS',
      device_fingerprint: 'a1b2c3d4e5f60718',
      device_fingerprint_changed: false
    });
    aiInterviewRepository.recordDeviceCheck.mockResolvedValue({ device_checks: 2, device_fingerprint_changed: false });
    aiInterviewRepository.findById.mockResolvedValue({
      id: 'session-1',
      started_at: '2026-08-06T10:00:00.000Z',
      integrity_events: [],
      device_fingerprint_changed: false
    });

    const result = await aiInterviewService.reportFingerprint('tok-1', 'A1B2C3D4E5F60718', CANDIDAT);

    expect(result).toMatchObject({ matched: true, first_time: false });
    expect(aiInterviewRepository.recordDeviceCheck).toHaveBeenCalledWith('session-1', true);
    expect(aiInterviewRepository.appendIntegrityEvents).not.toHaveBeenCalled();
  });

  test('reportFingerprint refuse une empreinte invalide', async () => {
    mockOwnedSession({ ...SESSION, statut: 'EN_COURS' });
    await expect(aiInterviewService.reportFingerprint('tok-1', '!!not-a-hash!!', CANDIDAT))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('AiInterviewService — saveAnswer', () => {
  beforeEach(() => {
    aiInterviewRepository.getQuestions.mockResolvedValue([
      { id: 'q1', question_number: 1, question: 'Présentez-vous' }
    ]);
    aiInterviewRepository.upsertAnswer.mockResolvedValue({ question_number: 1, answer: 'Bonjour' });
  });

  test('enregistre une réponse valide en conservant le texte', async () => {
    mockOwnedSession({ ...SESSION, statut: 'EN_COURS' });
    const result = await aiInterviewService.saveAnswer('tok-1', 1, 'Bonjour', CANDIDAT);
    expect(result).toEqual({ saved: true, question_number: 1, answer: 'Bonjour' });
    expect(aiInterviewRepository.upsertAnswer).toHaveBeenCalledWith('session-1', 1, 'Présentez-vous', 'Bonjour', null);
  });

  test('enregistre une durée de réponse quand elle est fournie', async () => {
    mockOwnedSession({ ...SESSION, statut: 'EN_COURS' });
    await aiInterviewService.saveAnswer('tok-1', 1, 'Bonjour', CANDIDAT, 12.5);
    expect(aiInterviewRepository.upsertAnswer).toHaveBeenCalledWith('session-1', 1, 'Présentez-vous', 'Bonjour', 12.5);
  });

  test('lève 400 si la session n’est pas en cours', async () => {
    mockOwnedSession();
    await expect(aiInterviewService.saveAnswer('tok-1', 1, 'x', CANDIDAT)).rejects.toMatchObject({ statusCode: 400 });
  });

  test('lève 400 pour une question inexistante', async () => {
    mockOwnedSession({ ...SESSION, statut: 'EN_COURS' });
    await expect(aiInterviewService.saveAnswer('tok-1', 99, 'x', CANDIDAT)).rejects.toMatchObject({ statusCode: 400 });
  });

  test('lève 400 pour une réponse vide ou trop longue', async () => {
    mockOwnedSession({ ...SESSION, statut: 'EN_COURS' });
    await expect(aiInterviewService.saveAnswer('tok-1', 1, '   ', CANDIDAT)).rejects.toMatchObject({ statusCode: 400 });
    await expect(aiInterviewService.saveAnswer('tok-1', 1, 'x'.repeat(5001), CANDIDAT)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('AiInterviewService — completeInterview', () => {
  beforeEach(() => {
    aiInterviewRepository.getAnswers.mockResolvedValue([
      { question_number: 1, answer: 'Bonjour' },
      { question_number: 2, answer: 'Motivé' }
    ]);
  });

  test('évalue avec le fournisseur, sauvegarde l’analyse et laisse la décision au RH', async () => {
    aiProvider.evaluateInterview.mockResolvedValue({
      score: 82,
      recommendation: 'FAVORABLE',
      axes: { technical: 80 }
    });
    candidatureService.applicantName.mockResolvedValue('Marwa Sassi');
    mockOwnedSession({ ...SESSION, statut: 'EN_COURS' });

    const result = await aiInterviewService.completeInterview('tok-1', CANDIDAT);

    expect(result).toEqual({ statut: 'TERMINE', evaluation_status: 'EVALUEE', score: 82 });
    expect(aiInterviewRepository.setStatus).toHaveBeenCalledWith('session-1', 'TERMINE');
    expect(aiInterviewRepository.saveEvaluation).toHaveBeenCalledWith('session-1', expect.objectContaining({ score: 82 }), 'EVALUEE');
    expect(candidatureService.applyAiInterviewResult).not.toHaveBeenCalled();
    expect(notificationService.notifyRoleBestEffort).toHaveBeenCalledWith(
      'RH',
      'Analyse d\'entretien IA disponible',
      expect.stringContaining('Marwa Sassi'),
      'CANDIDATURE',
      '/candidatures/cand-1'
    );
  });

  test('lève 400 si aucune réponse n’est enregistrée', async () => {
    aiInterviewRepository.getAnswers.mockResolvedValue([]);
    mockOwnedSession({ ...SESSION, statut: 'EN_COURS' });
    await expect(aiInterviewService.completeInterview('tok-1', CANDIDAT)).rejects.toMatchObject({ statusCode: 400 });
    expect(candidatureService.applyAiInterviewResult).not.toHaveBeenCalled();
  });

  test('fournisseur indisponible : session TERMINE + status INDISPONIBLE + RH prévenu, aucun score', async () => {
    const err = Object.assign(new Error('Fournisseur indisponible'), { statusCode: 503 });
    aiProvider.evaluateInterview.mockRejectedValue(err);
    candidatureService.applicantName.mockResolvedValue('Marwa Sassi');
    mockOwnedSession({ ...SESSION, statut: 'EN_COURS' });

    const result = await aiInterviewService.completeInterview('tok-1', CANDIDAT);

    expect(result).toEqual({ statut: 'TERMINE', evaluation_status: 'INDISPONIBLE' });
    expect(aiInterviewRepository.saveEvaluation).toHaveBeenCalledWith('session-1', {}, 'INDISPONIBLE');
    expect(candidatureService.applyAiInterviewResult).not.toHaveBeenCalled();
    expect(notificationService.notifyRoleBestEffort).toHaveBeenCalledWith(
      'RH',
      'Évaluation IA indisponible',
      expect.stringContaining('Marwa Sassi'),
      'CANDIDATURE',
      '/candidatures/cand-1'
    );
  });

  test('vocal : analyse par le moteur Python sauvegardée, décision laissée au RH', async () => {
    jest.spyOn(aiInterviewService, '_pythonComplete').mockResolvedValue({
      report: {
        score_global: 88,
        compatibilite_offre: 84,
        competences_techniques: 90,
        motivation: 85,
        communication: 80,
        points_forts: ['Profil solide'],
        points_faibles: [],
        resume: 'Bilan global positif.',
        recommendation: 'FAVORABLE'
      }
    });
    candidatureService.applicantName.mockResolvedValue('Marwa Sassi');
    mockOwnedSession({ ...SESSION, statut: 'EN_COURS', python_session_id: 'py-1' });

    const result = await aiInterviewService.completeInterview('tok-1', CANDIDAT);

    expect(result).toEqual({ statut: 'TERMINE', evaluation_status: 'EVALUEE', score: 88 });
    expect(aiInterviewRepository.saveEvaluation).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({ score_global: 88, recommendation: 'FAVORABLE' }),
      'EVALUEE'
    );
    expect(candidatureService.applyAiInterviewResult).not.toHaveBeenCalled();
    expect(notificationService.notifyRoleBestEffort).toHaveBeenCalledWith(
      'RH',
      'Analyse d\'entretien IA disponible',
      expect.stringContaining('Marwa Sassi'),
      'CANDIDATURE',
      '/candidatures/cand-1'
    );
  });

  test('vocal : moteur indisponible → INDISPONIBLE + RH prévenu, aucun score', async () => {
    jest.spyOn(aiInterviewService, '_pythonComplete').mockRejectedValue(
      Object.assign(new Error('Python down'), { statusCode: 503 })
    );
    candidatureService.applicantName.mockResolvedValue('Marwa Sassi');
    mockOwnedSession({ ...SESSION, statut: 'EN_COURS', python_session_id: 'py-1' });

    const result = await aiInterviewService.completeInterview('tok-1', CANDIDAT);

    expect(result).toEqual({ statut: 'TERMINE', evaluation_status: 'INDISPONIBLE' });
    expect(candidatureService.applyAiInterviewResult).not.toHaveBeenCalled();
    expect(notificationService.notifyRoleBestEffort).toHaveBeenCalled();
  });
});
