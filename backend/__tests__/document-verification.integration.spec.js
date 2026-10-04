const fs = require('fs');
const path = require('path');
const http = require('http');
const BASE = 'http://localhost:3000/api';
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// Le serveur Node (sous test) doit être lancé avec :
//   AI_DOCUMENT_SERVICE_URL=http://localhost:8471
//   AI_DOCUMENT_SERVICE_TOKEN=doc-svc-int-token
//   AI_DOCUMENT_TIMEOUT_MS=2000
// pour que les uploads déclenchent la vérification documentaire vers le faux
// service Python démarré par cette suite (et non vers le vrai ai-service).
const FAKE_PORT = 8471;
const FAKE_TOKEN = 'doc-svc-int-token';

require('dotenv').config();
const pool = require('../config/db');
const bcrypt = require('bcrypt');

jest.mock('../services/email.service', () => ({
  sendMobileAccessEmail: jest.fn(),
  sendInternshipAcceptedEmail: jest.fn(),
  sendHumanInterviewInvitationEmail: jest.fn(),
  sendCandidatureReceivedEmail: jest.fn(),
  sendDocumentsRequestEmail: jest.fn()
}));

let candidatToken = null;
let adminToken = null;
let rhToken = null;
let secondCandidatToken = null;
let secondCandidatId = null;
let open = [];
let created = [];
let uploadedFiles = [];
let candidateProfile = null;

// ─────────────────────── Faux service Python (mock) ─────────────────────────
let fakeServer = null;
const fakeRequests = [];
let fakeResponses = [];

function startFakePython() {
  return new Promise((resolve) => {
    fakeServer = http.createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks);

      let fields = {};
      try {
        const parsed = await new Request('http://fake/api/documents/verify', {
          method: 'POST',
          headers: { ...req.headers },
          body: raw,
          duplex: 'half'
        }).formData();
        fields = parsed;
      } catch (e) {
        fields = {};
      }

      fakeRequests.push({
        url: req.url,
        headers: req.headers,
        document_type: fields.get ? fields.get('document_type') : null,
        candidature_id: fields.get ? fields.get('candidature_id') : null,
        candidate: fields.get ? fields.get('candidate') : null,
        filename: fields.get ? (fields.get('file') && fields.get('file').name) : null
      });

      const next = fakeResponses.length
        ? fakeResponses.shift()
        : { status: 200, body: { status: 'VALID', confidence: 90, document_type: 'CV', checks: {}, issues: [], summary: 'ok' } };

      if (next.delayMs) {
        await new Promise((r) => setTimeout(r, next.delayMs));
      }
      res.writeHead(next.status || 200, { 'Content-Type': 'application/json', Connection: 'close' });
      res.end(JSON.stringify(next.body));
    });
    fakeServer.listen(FAKE_PORT, '127.0.0.1', resolve);
  });
}

function stopFakePython() {
  return new Promise((resolve) => {
    if (!fakeServer) return resolve();
    fakeServer.close(() => resolve());
    fakeServer = null;
  });
}

function fakeVerdict(verdict, confidence = 80) {
  fakeResponses.push({
    status: 200,
    body: { status: verdict, confidence, document_type: 'CV', checks: {}, issues: [], summary: `résumé ${verdict}` }
  });
}

// ─────────────────────────── Helpers génériques ─────────────────────────────
async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error(`Login échoué (${res.status}) : ${await res.text()}`);
  const data = await res.json();
  return data.token;
}

async function loginCandidat() {
  if (candidatToken) return candidatToken;
  candidatToken = await login('candidat@steg.tn', 'Candidat123!');
  return candidatToken;
}

async function loginAdmin() {
  if (adminToken) return adminToken;
  adminToken = await login('admin@steg.tn', 'admin123');
  return adminToken;
}

async function loginRH() {
  if (rhToken) return rhToken;
  rhToken = await login('salma.bouazizi@steg.tn', 'rh1234');
  return rhToken;
}

async function createSecondCandidat() {
  const { rows: existing } = await pool.query(
    'SELECT id FROM utilisateur WHERE email = $1',
    ['candidat2@steg.tn']
  );
  if (existing[0]) return existing[0].id;
  const password = await bcrypt.hash('Candidat123!', 12);
  const { rows } = await pool.query(
    `INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone, adresse, role, email_verifie)
     VALUES ('Test', 'Deuxième', $1, $2, '+216 22 000 001', 'Tunis', 'CANDIDAT', true)
     RETURNING id`,
    ['candidat2@steg.tn', password]
  );
  await pool.query(
    `INSERT INTO candidat (id, universite, specialite, niveau, competences, langues)
     VALUES ($1, 'INSAT', 'Génie Logiciel', 'Master 2', 'Dart, Flutter', 'Français')`,
    [rows[0].id]
  );
  return rows[0].id;
}

async function loginSecondCandidat() {
  if (secondCandidatToken) return secondCandidatToken;
  secondCandidatToken = await login('candidat2@steg.tn', 'Candidat123!');
  return secondCandidatToken;
}

async function authed(url, token, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
}

async function pickFreeOffer(token, adminToken, open) {
  const mineRes = await authed(`${BASE}/candidatures`, token);
  expect(mineRes.status).toBe(200);
  const mine = await mineRes.json();
  const applied = new Set((Array.isArray(mine) ? mine : []).map((c) => c.offre_id));

  let target = open.find((o) => !applied.has(o.id) && o.nombre_places > 0);
  if (!target) {
    const toFree = (Array.isArray(mine) ? mine : []).find((c) => c.id);
    expect(toFree).toBeTruthy();
    const freeRes = await authed(`${BASE}/candidatures/${toFree.id}`, adminToken, {
      method: 'DELETE'
    });
    expect(freeRes.status).toBe(200);
    target =
      open.find((o) => o.id === toFree.offre_id) ||
      open.find((o) => o.nombre_places > 0) ||
      open[0];
  }
  return target;
}

function futureDate(daysFromNow = 30) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }));
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) + daysFromNow * 86400000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

async function createCompletedCandidature(token, adminToken, rh, open) {
  const target = await pickFreeOffer(token, adminToken, open);
  const applyRes = await authed(`${BASE}/candidatures`, token, {
    method: 'POST',
    body: JSON.stringify({ offre_id: target.id })
  });
  expect(applyRes.status).toBe(201);
  const { candidature } = await applyRes.json();
  created.push(candidature.id);

  const putRes = await authed(`${BASE}/candidatures/${candidature.id}`, rh, {
    method: 'PUT',
    body: JSON.stringify({ statut: 'RH_ACCEPTED' })
  });
  expect(putRes.status).toBe(200);

  await pool.query("UPDATE candidature SET statut = 'AI_INTERVIEW_PASSED' WHERE id = $1", [candidature.id]);

  const schedule = await authed(`${BASE}/candidatures/${candidature.id}/entretien-humain`, rh, {
    method: 'POST',
    body: JSON.stringify({
      date: futureDate(30),
      heure: '10:30',
      duree: 45,
      interviewer: 'Salma Bouazizi',
      interviewer_email: 'salma.bouazizi@steg.tn',
      lien_visio: 'https://teams.microsoft.com/l/meetup-join/meeting/document-verification-test'
    })
  });
  expect(schedule.status).toBe(200);

  const complete = await authed(`${BASE}/candidatures/${candidature.id}/entretien-humain/completion`, rh, {
    method: 'POST'
  });
  expect(complete.status).toBe(200);

  return candidature.id;
}

async function createAcceptedCandidature(token, adminToken, rh, open) {
  const id = await createCompletedCandidature(token, adminToken, rh, open);
  const decision = await authed(`${BASE}/candidatures/${id}/entretien-humain/decision`, rh, {
    method: 'POST',
    body: JSON.stringify({ decision: 'ACCEPTED' })
  });
  expect(decision.status).toBe(200);
  return id;
}

async function createOnboardingCandidature(token, adminToken, rh, open) {
  const id = await createAcceptedCandidature(token, adminToken, rh, open);
  const prefs = await authed(`${BASE}/candidatures/${id}/stage-preferences`, token, {
    method: 'PUT',
    body: JSON.stringify({ internship_start_date: futureDate(30), internship_duration_months: 4 })
  });
  expect(prefs.status).toBe(200);
  const validated = await authed(`${BASE}/candidatures/${id}/stage-preferences/validate`, rh, {
    method: 'POST'
  });
  expect(validated.status).toBe(200);
  return id;
}

function buildForm(filename = 'cin.pdf') {
  const form = new FormData();
  form.append('file', new Blob(['contenu du document'], { type: 'application/pdf' }), filename);
  return form;
}

async function uploadDocument(candidatureId, type, token, { filename } = {}) {
  const body = buildForm(filename);
  const res = await fetch(`${BASE}/candidatures/${candidatureId}/documents/${type}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body
  });
  if (res.ok) {
    const { rows } = await pool.query(
      'SELECT chemin FROM candidature_document WHERE candidature_id = $1',
      [candidatureId]
    );
    for (const r of rows) {
      if (!uploadedFiles.includes(r.chemin)) uploadedFiles.push(r.chemin);
    }
  }
  return res;
}

async function documentsState(candidatureId, token) {
  const res = await authed(`${BASE}/candidatures/mes-candidatures`, token);
  expect(res.status).toBe(200);
  const { candidatures } = await res.json();
  const candidature = candidatures.find((c) => c.id === candidatureId);
  return candidature ? candidature.documents_onboarding : null;
}

async function dbVerificationStatus(candidatureId, type) {
  const { rows } = await pool.query(
    'SELECT verification_status FROM candidature_document WHERE candidature_id = $1 AND type = $2',
    [candidatureId, type]
  );
  return rows[0] ? rows[0].verification_status : null;
}

async function latestRHVerificationNotification(candidatureId) {
  const { rows } = await pool.query(
    `SELECT n.titre, n.message, n.lien, u.role
     FROM notification n
     JOIN utilisateur u ON u.id = n.utilisateur_id
     WHERE n.titre = 'Document à vérifier' AND n.lien = $1
     ORDER BY n.date DESC LIMIT 1`,
    [`/candidatures/${candidatureId}`]
  );
  return rows[0] || null;
}

/** Supprime les candidatures du candidat de test (état vierge). */
async function resetCandidateData() {
  const { rows: users } = await pool.query(
    'SELECT id FROM utilisateur WHERE email = $1',
    ['candidat@steg.tn']
  );
  if (!users[0]) return;
  const id = users[0].id;
  await pool.query(
    'DELETE FROM human_interviews WHERE candidature_id IN (SELECT id FROM candidature WHERE candidat_id = $1)',
    [id]
  );
  await pool.query(
    'DELETE FROM ai_interview_sessions WHERE candidature_id IN (SELECT id FROM candidature WHERE candidat_id = $1)',
    [id]
  );
  await pool.query('DELETE FROM candidature WHERE candidat_id = $1', [id]);
}

describe('Vérification documentaire IA — upload → Python → verdict persisté (intégration)', () => {
  beforeAll(async () => {
    await startFakePython();
    adminToken = await loginAdmin();
    const offresRes = await fetch(`${BASE}/public/offres`);
    expect(offresRes.status).toBe(200);
    open = await offresRes.json();
    expect(open.length).toBeGreaterThan(0);

    const { rows } = await pool.query(
      `SELECT u.nom, u.prenom, u.email FROM utilisateur u JOIN candidat c ON c.id = u.id
       WHERE u.email = 'candidat@steg.tn'`
    );
    candidateProfile = rows[0] || null;

    await resetCandidateData();
    secondCandidatId = await createSecondCandidat();
    expect(secondCandidatId).toBeTruthy();
  }, 120000);

  afterAll(async () => {
    await stopFakePython();
    for (const id of created) {
      await authed(`${BASE}/candidatures/${id}`, adminToken, { method: 'DELETE' });
    }
    for (const id of created) {
      await pool.query('DELETE FROM human_interviews WHERE candidature_id = $1', [id]);
      await pool.query('DELETE FROM ai_interview_sessions WHERE candidature_id = $1', [id]);
    }
    for (const filename of uploadedFiles) {
      try {
        const filePath = path.join(UPLOAD_DIR, path.basename(filename));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) {}
    }
    if (secondCandidatId) {
      try {
        await pool.query('DELETE FROM candidature WHERE candidat_id = $1', [secondCandidatId]);
        await pool.query('DELETE FROM candidat WHERE id = $1', [secondCandidatId]);
        await pool.query('DELETE FROM utilisateur WHERE id = $1', [secondCandidatId]);
      } catch (e) {}
    }
    const original = await bcrypt.hash('Candidat123!', 12);
    await pool.query('UPDATE utilisateur SET mot_de_passe = $1 WHERE email = $2', [
      original,
      'candidat@steg.tn'
    ]);
    await pool.end();
  });

  test(
    'l’upload déclenche la vérification Python : URL, jeton de service, type, candidature et profil candidat',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      fakeVerdict('VALID', 91);

      const res = await uploadDocument(id, 'CIN', token, { filename: 'cin-salma.pdf' });
      expect(res.status).toBe(200);

      const req = fakeRequests[fakeRequests.length - 1];
      expect(req.url).toBe('/api/documents/verify');
      expect(req.headers['x-service-token']).toBe(FAKE_TOKEN);
      expect(req.document_type).toBe('CIN');
      expect(req.candidature_id).toBe(id);
      expect(req.filename).toBe('cin-salma.pdf');
      const candidate = JSON.parse(req.candidate);
      expect(candidate).toEqual({
        nom: candidateProfile ? candidateProfile.nom : null,
        prenom: candidateProfile ? candidateProfile.prenom : null,
        email: candidateProfile ? candidateProfile.email : null,
        cin: null
      });
    },
    120000
  );

  test(
    'Python VALID → verification_status = VALID exposé dans le dossier d’onboarding',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      fakeVerdict('VALID', 92);

      const res = await uploadDocument(id, 'DEMANDE_STAGE', token, { filename: 'demande-stage.pdf' });
      expect(res.status).toBe(200);

      expect(await dbVerificationStatus(id, 'DEMANDE_STAGE')).toBe('VALID');

      const state = await documentsState(id, token);
      const doc = state.documents.find((d) => d.type === 'DEMANDE_STAGE');
      expect(doc.verification_status).toBe('VALID');
      expect(doc.statut).toBe('EN_ATTENTE');
    },
    120000
  );

  test(
    'Python REVIEW_REQUIRED → verification_status = REVIEW_REQUIRED + notification RH créée',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      fakeVerdict('REVIEW_REQUIRED', 60);

      const res = await uploadDocument(id, 'CIN', token, { filename: 'cin-a-verifier.pdf' });
      expect(res.status).toBe(200);

      expect(await dbVerificationStatus(id, 'CIN')).toBe('REVIEW_REQUIRED');

      const notif = await latestRHVerificationNotification(id);
      expect(notif).toBeTruthy();
      expect(notif.role).toBe('RH');
      expect(notif.titre).toBe('Document à vérifier');
      expect(notif.message).toContain('CIN');
      expect(notif.message).not.toContain('cin-a-verifier');
      expect(notif.lien).toBe(`/candidatures/${id}`);
    },
    120000
  );

  test(
    'Python REJECTED → verification_status = REJECTED sans rejeter la candidature ni supprimer le document',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      fakeVerdict('REJECTED', 20);

      const res = await uploadDocument(id, 'CV', token, { filename: 'cv-rejete.pdf' });
      expect(res.status).toBe(200);

      expect(await dbVerificationStatus(id, 'CV')).toBe('REJECTED');

      const { rows } = await pool.query(
        'SELECT chemin, statut FROM candidature_document WHERE candidature_id = $1 AND type = $2',
        [id, 'CV']
      );
      expect(rows[0].chemin).toBeTruthy();
      expect(rows[0].statut).toBe('EN_ATTENTE');

      const candidature = await pool.query('SELECT statut FROM candidature WHERE id = $1', [id]);
      expect(candidature.rows[0].statut).toBe('HUMAN_INTERVIEW_ACCEPTED');
    },
    120000
  );

  test(
    'Python indisponible → upload réussi, verification_status = PENDING, document conservé',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await stopFakePython();

      try {
        const res = await uploadDocument(id, 'LETTRE_AFFECTATION', token, { filename: 'lettre.pdf' });
        expect(res.status).toBe(200);
        expect(await dbVerificationStatus(id, 'LETTRE_AFFECTATION')).toBe('PENDING');
        const { rows } = await pool.query(
          'SELECT chemin FROM candidature_document WHERE candidature_id = $1 AND type = $2',
          [id, 'LETTRE_AFFECTATION']
        );
        expect(rows[0].chemin).toBeTruthy();
      } finally {
        await startFakePython();
      }
    },
    120000
  );

  test(
    'Python trop lent → upload réussi, verification_status = PENDING (aucun blocage)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      fakeResponses.push({ status: 200, delayMs: 3000, body: { status: 'VALID', confidence: 90 } });

      const res = await uploadDocument(id, 'DEMANDE_STAGE', token, { filename: 'demande-lente.pdf' });
      expect(res.status).toBe(200);
      expect(await dbVerificationStatus(id, 'DEMANDE_STAGE')).toBe('PENDING');
    },
    120000
  );

  test(
    'réponse Python invalide (verdict inconnu) → upload réussi, verification_status = PENDING',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      fakeResponses.push({ status: 200, body: { status: 'PEUT-ETRE', confidence: 50 } });

      const res = await uploadDocument(id, 'CV', token, { filename: 'cv-bizarre.pdf' });
      expect(res.status).toBe(200);
      expect(await dbVerificationStatus(id, 'CV')).toBe('PENDING');
    },
    120000
  );

  test(
    'réponse Python illisible (non-JSON) → upload réussi, verification_status = PENDING',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      fakeResponses.push({ status: 200, body: null });

      const res = await uploadDocument(id, 'LETTRE_AFFECTATION', token, { filename: 'lettre-bizarre.pdf' });
      expect(res.status).toBe(200);
      expect(await dbVerificationStatus(id, 'LETTRE_AFFECTATION')).toBe('PENDING');
    },
    120000
  );

  test(
    'le jeton de service n’apparaît JAMAIS dans la réponse d’upload',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      fakeVerdict('VALID', 90);

      const res = await uploadDocument(id, 'CIN', token, { filename: 'cin-securite.pdf' });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).not.toContain(FAKE_TOKEN);
    },
    120000
  );

  test(
    'le candidat ne peut pas déposer un document sur la candidature d’un autre candidat (aucune vérification)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);

      const before = fakeRequests.length;
      const other = await loginSecondCandidat();
      const res = await uploadDocument(id, 'CIN', other, { filename: 'cin-autre.pdf' });
      expect(res.status).toBe(403);
      expect(fakeRequests.length).toBe(before);
      expect(await dbVerificationStatus(id, 'CIN')).toBeNull();
    },
    120000
  );

  test(
    'un re-dépôt démarre un nouveau cycle de vérification (PENDING → nouveau verdict)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);

      fakeVerdict('REVIEW_REQUIRED', 55);
      const first = await uploadDocument(id, 'CIN', token, { filename: 'cin-v1.pdf' });
      expect(first.status).toBe(200);
      expect(await dbVerificationStatus(id, 'CIN')).toBe('REVIEW_REQUIRED');

      fakeVerdict('VALID', 95);
      const second = await uploadDocument(id, 'CIN', token, { filename: 'cin-v2.pdf' });
      expect(second.status).toBe(200);
      expect(await dbVerificationStatus(id, 'CIN')).toBe('VALID');

      const { rows } = await pool.query(
        'SELECT nom, chemin FROM candidature_document WHERE candidature_id = $1 AND type = $2',
        [id, 'CIN']
      );
      expect(rows[0].nom).toBe('cin-v2.pdf');
    },
    120000
  );
});
