jest.mock('../repositories/candidat.repository', () => ({
  getProfile: jest.fn()
}));

jest.mock('../repositories/stagiaire.repository', () => ({
  findById: jest.fn()
}));

const {
  documentVerificationService,
  DocumentVerificationError
} = require('../services/document-verification.service');
const candidatRepository = require('../repositories/candidat.repository');
const stagiaireRepository = require('../repositories/stagiaire.repository');

const SAMPLE_BUFFER = Buffer.from('contenu du document');

function pythonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

let fetchMock;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.AI_DOCUMENT_SERVICE_URL = 'http://python:8001';
  process.env.AI_DOCUMENT_SERVICE_TOKEN = 'doc-svc-token';
  process.env.AI_DOCUMENT_TIMEOUT_MS = '2000';

  fetchMock = jest.fn();
  global.fetch = fetchMock;
});

afterEach(() => {
  delete process.env.AI_DOCUMENT_SERVICE_URL;
  delete process.env.AI_DOCUMENT_SERVICE_TOKEN;
  delete process.env.AI_DOCUMENT_TIMEOUT_MS;
});

afterAll(() => {
  delete global.fetch;
});

describe('DocumentVerificationService.verifyDocument — requête Python', () => {
  test('appelle POST /api/documents/verify avec le jeton de service dans X-Service-Token', async () => {
    fetchMock.mockResolvedValue(
      pythonResponse(200, { status: 'VALID', confidence: 90, document_type: 'CV', checks: {}, issues: [], summary: 'ok' })
    );

    await documentVerificationService.verifyDocument({
      candidatureId: 'cand-1',
      documentType: 'CV',
      filename: 'cv-salma.pdf',
      fileBuffer: SAMPLE_BUFFER,
      candidate: { nom: 'Ben Ali', prenom: 'Salma', email: 's@steg.tn' }
    });

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('http://python:8001/api/documents/verify');
    expect(opts.method).toBe('POST');
    expect(opts.headers['X-Service-Token']).toBe('doc-svc-token');
  });

  test('envoie document_type, candidature_id et le profil candidat en multipart', async () => {
    fetchMock.mockResolvedValue(
      pythonResponse(200, { status: 'VALID', confidence: 90, document_type: 'CV', checks: {}, issues: [], summary: 'ok' })
    );

    await documentVerificationService.verifyDocument({
      candidatureId: 'cand-9',
      documentType: 'CIN',
      filename: 'cin-salma.pdf',
      fileBuffer: SAMPLE_BUFFER,
      candidate: { nom: 'Ben Ali', prenom: 'Salma', email: 'salma@example.tn', cin: '01234567' }
    });

    const [, opts] = fetchMock.mock.calls[0];
    const form = opts.body;
    expect(form.get('document_type')).toBe('CIN');
    expect(form.get('candidature_id')).toBe('cand-9');
    const candidate = JSON.parse(form.get('candidate'));
    expect(candidate).toEqual({
      nom: 'Ben Ali',
      prenom: 'Salma',
      email: 'salma@example.tn',
      cin: '01234567'
    });
    expect(form.get('file').name).toBe('cin-salma.pdf');
  });

  test('sans profil candidat, envoie un objet candidate avec des valeurs nulles', async () => {
    fetchMock.mockResolvedValue(
      pythonResponse(200, { status: 'VALID', confidence: 90, document_type: 'CV', checks: {}, issues: [], summary: 'ok' })
    );

    await documentVerificationService.verifyDocument({
      candidatureId: 'cand-1',
      documentType: 'CV',
      filename: 'cv.pdf',
      fileBuffer: SAMPLE_BUFFER
    });

    const [, opts] = fetchMock.mock.calls[0];
    const candidate = JSON.parse(opts.body.get('candidate'));
    expect(candidate).toEqual({ nom: null, prenom: null, email: null, cin: null });
  });

  test('rejette les réponses HTTP non-OK avec une erreur normalisée (sans stack trace Python)', async () => {
    fetchMock.mockResolvedValue(pythonResponse(503, { detail: 'détail interne Python' }));

    await expect(
      documentVerificationService.verifyDocument({
        candidatureId: 'cand-1',
        documentType: 'CV',
        filename: 'cv.pdf',
        fileBuffer: SAMPLE_BUFFER
      })
    ).rejects.toMatchObject({ name: 'DocumentVerificationError', code: 'python_error' });
  });

  test('rejette 401/403 comme une erreur d’authentification du service', async () => {
    fetchMock.mockResolvedValue(pythonResponse(401, { detail: 'Jeton de service invalide.' }));

    await expect(
      documentVerificationService.verifyDocument({
        candidatureId: 'cand-1',
        documentType: 'CV',
        filename: 'cv.pdf',
        fileBuffer: SAMPLE_BUFFER
      })
    ).rejects.toMatchObject({ name: 'DocumentVerificationError', code: 'auth' });
  });

  test('rejette un timeout (AbortError) comme une erreur "timeout"', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    fetchMock.mockRejectedValue(abortError);

    await expect(
      documentVerificationService.verifyDocument({
        candidatureId: 'cand-1',
        documentType: 'CV',
        filename: 'cv.pdf',
        fileBuffer: SAMPLE_BUFFER
      })
    ).rejects.toMatchObject({ name: 'DocumentVerificationError', code: 'timeout' });
  });

  test('rejette une erreur réseau comme une indisponibilité', async () => {
    fetchMock.mockRejectedValue(new Error('fetch failed'));

    await expect(
      documentVerificationService.verifyDocument({
        candidatureId: 'cand-1',
        documentType: 'CV',
        filename: 'cv.pdf',
        fileBuffer: SAMPLE_BUFFER
      })
    ).rejects.toMatchObject({ name: 'DocumentVerificationError', code: 'unavailable' });
  });

  test('rejette une réponse illisible (non-JSON)', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } });

    await expect(
      documentVerificationService.verifyDocument({
        candidatureId: 'cand-1',
        documentType: 'CV',
        filename: 'cv.pdf',
        fileBuffer: SAMPLE_BUFFER
      })
    ).rejects.toMatchObject({ name: 'DocumentVerificationError', code: 'invalid_response' });
  });
});

describe('DocumentVerificationService.verifyDocument — verdicts et validation', () => {
  test.each([
    ['VALID', 'VALID'],
    ['REVIEW_REQUIRED', 'REVIEW_REQUIRED'],
    ['REJECTED', 'REJECTED']
  ])('normalise le verdict %s', async (verdict) => {
    fetchMock.mockResolvedValue(
      pythonResponse(200, {
        status: verdict,
        confidence: 77,
        document_type: 'CV',
        checks: {},
        issues: ['anomalie'],
        summary: 'résumé'
      })
    );

    const result = await documentVerificationService.verifyDocument({
      candidatureId: 'cand-1',
      documentType: 'CV',
      filename: 'cv.pdf',
      fileBuffer: SAMPLE_BUFFER
    });

    expect(result).toEqual({
      status: verdict,
      confidence: 77,
      summary: 'résumé',
      issues: ['anomalie']
    });
  });

  test('rejette un verdict inconnu (aucun statut arbitraire accepté)', async () => {
    fetchMock.mockResolvedValue(pythonResponse(200, { status: 'PEUT-ETRE', confidence: 50 }));

    await expect(
      documentVerificationService.verifyDocument({
        candidatureId: 'cand-1',
        documentType: 'CV',
        filename: 'cv.pdf',
        fileBuffer: SAMPLE_BUFFER
      })
    ).rejects.toMatchObject({ name: 'DocumentVerificationError', code: 'invalid_response' });
  });

  test('rejette une réponse sans champ status', async () => {
    fetchMock.mockResolvedValue(pythonResponse(200, { confidence: 50 }));

    await expect(
      documentVerificationService.verifyDocument({
        candidatureId: 'cand-1',
        documentType: 'CV',
        filename: 'cv.pdf',
        fileBuffer: SAMPLE_BUFFER
      })
    ).rejects.toMatchObject({ name: 'DocumentVerificationError', code: 'invalid_response' });
  });

  test('tolère une confidence manquante (null) sans invalider le verdict', async () => {
    fetchMock.mockResolvedValue(pythonResponse(200, { status: 'VALID' }));

    const result = await documentVerificationService.verifyDocument({
      candidatureId: 'cand-1',
      documentType: 'CV',
      filename: 'cv.pdf',
      fileBuffer: SAMPLE_BUFFER
    });

    expect(result.status).toBe('VALID');
    expect(result.confidence).toBeNull();
  });
});

describe('DocumentVerificationService.loadCandidateProfile — chargement serveur', () => {
  test('candidature portail : charge le profil candidat (nom/prénom/email)', async () => {
    candidatRepository.getProfile.mockResolvedValue({
      nom: 'Sassi',
      prenom: 'Marwa',
      email: 'candidat@steg.tn'
    });

    const result = await documentVerificationService.loadCandidateProfile({
      stagiaire_id: null,
      candidat_id: 'cand-user-1'
    });

    expect(candidatRepository.getProfile).toHaveBeenCalledWith('cand-user-1');
    expect(stagiaireRepository.findById).not.toHaveBeenCalled();
    expect(result).toEqual({ nom: 'Sassi', prenom: 'Marwa', email: 'candidat@steg.tn' });
  });

  test('candidature stagiaire : charge le profil stagiaire', async () => {
    stagiaireRepository.findById.mockResolvedValue({ nom: 'Trabelsi', prenom: 'Fatma', email: 'f@steg.tn' });

    const result = await documentVerificationService.loadCandidateProfile({
      stagiaire_id: 'stag-1',
      candidat_id: null
    });

    expect(stagiaireRepository.findById).toHaveBeenCalledWith('stag-1');
    expect(candidatRepository.getProfile).not.toHaveBeenCalled();
    expect(result).toEqual({ nom: 'Trabelsi', prenom: 'Fatma', email: 'f@steg.tn' });
  });

  test('sans propriétaire ni profil, renvoie null', async () => {
    expect(await documentVerificationService.loadCandidateProfile(null)).toBeNull();
    candidatRepository.getProfile.mockResolvedValue(null);
    expect(
      await documentVerificationService.loadCandidateProfile({ stagiaire_id: null, candidat_id: 'x' })
    ).toBeNull();
  });
});

describe('DocumentVerificationError', () => {
  test('est une erreur nommée avec un code', () => {
    const err = new DocumentVerificationError('unavailable', 'message');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('DocumentVerificationError');
    expect(err.code).toBe('unavailable');
  });
});
