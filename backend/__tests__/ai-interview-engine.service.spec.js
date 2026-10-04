jest.mock('../repositories/ai-interview-engine.repository', () => ({
  findActiveByCandidature: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  markStarted: jest.fn(),
  markCompleted: jest.fn(),
  appendQuestion: jest.fn()
}));

jest.mock('../repositories/candidature.repository', () => ({
  findByIdWithOffer: jest.fn()
}));

jest.mock('../repositories/offre.repository', () => ({
  findPublicById: jest.fn()
}));

const engineService = require('../services/ai-interview-engine.service');
const engineRepository = require('../repositories/ai-interview-engine.repository');
const candidatureRepository = require('../repositories/candidature.repository');
const offreRepository = require('../repositories/offre.repository');

const RH = { id: 'rh-1', role: 'RH' };
const CANDIDAT = { id: 'cand-user-1', role: 'CANDIDAT' };
const AUTRE = { id: 'autre-candidat', role: 'CANDIDAT' };

const OFFRE_ROW = {
  id: 'offre-1',
  titre: 'Stage Developpeur Web',
  departement_nom: 'Informatique',
  duree: '6 mois',
  technologies: 'JavaScript, React',
  competences_demandees: "Travail d'equipe"
};

const CANDIDATURE_ROW = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  candidat_id: 'cand-user-1',
  stagiaire_id: null,
  offre_id: 'offre-1',
  statut: 'EN_ATTENTE'
};

const SESSION_ROW = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  candidature_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  python_session_id: 'py-1',
  statut: 'CREATED',
  questions: null,
  report: null,
  created_at: '2026-08-10T10:00:00.000Z'
};

const FIRST_QUESTION = {
  question_number: 1,
  categorie: 'MOTIVATION',
  question: 'Pourquoi postulez-vous ?'
};

const REPORT = {
  score: 72,
  recommendation: 'FAVORABLE',
  strengths: ['ok'],
  weaknesses: []
};

function pythonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  };
}

let fetchMock;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.PYTHON_AI_SERVICE_URL = 'http://python:8001';
  process.env.PYTHON_SERVICE_TOKEN = 'svc-token';
  process.env.PYTHON_AI_TIMEOUT_MS = '8000';

  fetchMock = jest.fn();
  global.fetch = fetchMock;

  engineRepository.findActiveByCandidature.mockResolvedValue(null);
  engineRepository.findById.mockResolvedValue(SESSION_ROW);
  engineRepository.create.mockResolvedValue({ ...SESSION_ROW });
  engineRepository.markStarted.mockResolvedValue({
    ...SESSION_ROW, statut: 'STARTED', questions: []
  });
  engineRepository.appendQuestion.mockImplementation(async (id, question) => ({
    ...SESSION_ROW,
    statut: 'STARTED',
    questions: question ? [question] : []
  }));
  engineRepository.markCompleted.mockResolvedValue({
    ...SESSION_ROW, statut: 'COMPLETED', report: REPORT
  });
  candidatureRepository.findByIdWithOffer.mockResolvedValue(CANDIDATURE_ROW);
  offreRepository.findPublicById.mockResolvedValue(OFFRE_ROW);
});

afterAll(() => {
  delete global.fetch;
});

describe('AiInterviewEngineService — permissions', () => {
  test('createInterview refuse un candidat (pas de requete Python)', async () => {
    await expect(engineService.createInterview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', CANDIDAT))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('getReport refuse un candidat', async () => {
    await expect(engineService.getReport('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CANDIDAT))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  test('createInterview 404 si candidature inconnue', async () => {
    candidatureRepository.findByIdWithOffer.mockResolvedValue(null);
    await expect(engineService.createInterview('00000000-0000-0000-0000-000000000000', RH))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  test('createInterview 409 si un entretien actif existe', async () => {
    engineRepository.findActiveByCandidature.mockResolvedValue(SESSION_ROW);
    await expect(engineService.createInterview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', RH))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  test('candidat non proprietaire reçoit 403', async () => {
    candidatureRepository.findByIdWithOffer.mockResolvedValue({
      ...CANDIDATURE_ROW, candidat_id: 'other-owner'
    });
    await expect(engineService.startInterview('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', AUTRE))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  test('startInterview 404 si entretien inconnu', async () => {
    engineRepository.findById.mockResolvedValue(null);
    await expect(engineService.startInterview('00000000-0000-0000-0000-000000000000', RH))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  test('getReport 409 si entretien non terminé', async () => {
    engineRepository.findById.mockResolvedValue({ ...SESSION_ROW, statut: 'STARTED' });
    await expect(engineService.getReport('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', RH))
      .rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('AiInterviewEngineService — cycle de vie complet (Python mocké)', () => {
  test('createInterview appelle Python puis persisté la session', async () => {
    fetchMock.mockResolvedValueOnce(
      pythonResponse(201, { session_id: 'py-1', statut: 'CREATED' })
    );
    const dto = await engineService.createInterview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', RH);

    expect(dto.id).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    expect(engineRepository.create).toHaveBeenCalledWith('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'py-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('http://python:8001/api/v1/interviews');
    expect(opts.headers['X-Service-Token']).toBe('svc-token');
    expect(JSON.parse(opts.body).candidature_id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  });

  test('startInterview stocke la première question de Python', async () => {
    fetchMock.mockResolvedValueOnce(
      pythonResponse(200, { session_id: 'py-1', statut: 'STARTED', question: FIRST_QUESTION })
    );
    engineRepository.findById
      .mockResolvedValueOnce(SESSION_ROW)
      .mockResolvedValue({
        ...SESSION_ROW, statut: 'STARTED', questions: [FIRST_QUESTION]
      });
    const dto = await engineService.startInterview('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CANDIDAT);

    expect(dto.statut).toBe('STARTED');
    expect(dto.questions).toHaveLength(1);
    expect(dto.questions[0]).toEqual(FIRST_QUESTION);
    expect(engineRepository.markStarted).toHaveBeenCalledWith('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    expect(engineRepository.appendQuestion).toHaveBeenCalledWith('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', FIRST_QUESTION);
  });

  test('answerInterview envoie la réponse et stocke la question suivante', async () => {
    const SECOND_QUESTION = { question_number: 2, categorie: 'MOTIVATION', question: 'Q2' };
    engineRepository.findById.mockResolvedValue({
      ...SESSION_ROW, statut: 'STARTED', questions: [FIRST_QUESTION, SECOND_QUESTION]
    });
    fetchMock.mockResolvedValueOnce(
      pythonResponse(200, { session_id: 'py-1', next_question: SECOND_QUESTION })
    );

    const dto = await engineService.answerInterview('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CANDIDAT, 1, 'Je suis motivé par le sujet.');

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('http://python:8001/api/v1/interviews/py-1/answer');
    expect(JSON.parse(opts.body)).toEqual({ question_number: 1, answer: 'Je suis motivé par le sujet.' });
    expect(engineRepository.appendQuestion).toHaveBeenCalledWith('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', SECOND_QUESTION);
    expect(dto.questions).toHaveLength(2);
  });

  test('completeInterview évalue et persiste le rapport', async () => {
    engineRepository.findById.mockResolvedValue({ ...SESSION_ROW, statut: 'STARTED' });
    fetchMock.mockResolvedValueOnce(
      pythonResponse(200, { session_id: 'py-1', statut: 'COMPLETED', report: REPORT })
    );
    const dto = await engineService.completeInterview('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CANDIDAT);

    expect(dto.statut).toBe('COMPLETED');
    expect(engineRepository.markCompleted).toHaveBeenCalledWith('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', REPORT);
  });

  test('completeInterview 409 si déjà terminé', async () => {
    engineRepository.findById.mockResolvedValue({ ...SESSION_ROW, statut: 'COMPLETED' });
    await expect(
      engineService.completeInterview('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CANDIDAT)
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test('answerInterview 400 si réponse vide', async () => {
    engineRepository.findById.mockResolvedValue({ ...SESSION_ROW, statut: 'STARTED' });
    await expect(engineService.answerInterview('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CANDIDAT, 1, '   '))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('startInterview 409 si déjà démarré', async () => {
    engineRepository.findById.mockResolvedValue({ ...SESSION_ROW, statut: 'STARTED' });
    await expect(engineService.startInterview('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', RH))
      .rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('AiInterviewEngineService — gestion des erreurs Python', () => {
  test('503 quand Python est injoignable', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(engineService.createInterview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', RH))
      .rejects.toMatchObject({ statusCode: 503 });
  });

  test('504 quand Python dépasse le timeout', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    fetchMock.mockRejectedValueOnce(abortError);
    await expect(engineService.createInterview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', RH))
      .rejects.toMatchObject({ statusCode: 504 });
  });

  test('502 quand Python rejette le jeton de service', async () => {
    fetchMock.mockResolvedValueOnce(
      pythonResponse(401, { detail: 'Jeton de service invalide.' })
    );
    await expect(engineService.createInterview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', RH))
      .rejects.toMatchObject({ statusCode: 502 });
  });

  test('le statut d erreur Python est transmis (409 entretien actif)', async () => {
    fetchMock.mockResolvedValueOnce(
      pythonResponse(409, { detail: 'Un entretien IA est déjà en cours pour cette candidature.' })
    );
    await expect(engineService.createInterview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', RH))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  test('les erreurs 4xx Python sont transmises (400 réponse invalide)', async () => {
    engineRepository.findById.mockResolvedValue({ ...SESSION_ROW, statut: 'STARTED' });
    fetchMock.mockResolvedValueOnce(
      pythonResponse(400, { detail: 'Réponse invalide.' })
    );
    await expect(
      engineService.answerInterview('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', RH, 1, 'ok')
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
