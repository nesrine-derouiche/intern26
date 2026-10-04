const fs = require('fs');
const path = require('path');
const BASE = 'http://localhost:3000/api';
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

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
let rhId = null;
let secondCandidatId = null;
let secondCandidatToken = null;
let open = [];
let created = [];
let uploadedFiles = [];

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

/** Second candidat créé dans beforeAll : permet de tester l'accès refusé (403). */
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

/** Candidature dont l'entretien humain est complété (statut HUMAN_INTERVIEW_COMPLETED). */
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
      lien_visio: 'https://teams.microsoft.com/l/meetup-join/meeting/onboarding-documents-test'
    })
  });
  expect(schedule.status).toBe(200);

  const complete = await authed(`${BASE}/candidatures/${candidature.id}/entretien-humain/completion`, rh, {
    method: 'POST'
  });
  expect(complete.status).toBe(200);

  return candidature.id;
}

/** Candidature acceptée après l'entretien humain (statut HUMAN_INTERVIEW_ACCEPTED). */
async function createAcceptedCandidature(token, adminToken, rh, open) {
  const id = await createCompletedCandidature(token, adminToken, rh, open);
  const decision = await authed(`${BASE}/candidatures/${id}/entretien-humain/decision`, rh, {
    method: 'POST',
    body: JSON.stringify({ decision: 'ACCEPTED' })
  });
  expect(decision.status).toBe(200);
  return id;
}

/** Candidature dont la période de stage a été validée par le RH (fenêtre d'onboarding). */
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

function futureDate(daysFromNow = 30) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }));
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) + daysFromNow * 86400000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
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

async function candidateCvPath() {
  const { rows } = await pool.query(
    'SELECT cv_path, cv_original_name FROM candidat WHERE id = (SELECT id FROM utilisateur WHERE email = $1)',
    ['candidat@steg.tn']
  );
  return rows[0];
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

describe('Dossier de candidature (onboarding documents, intégration)', () => {
  beforeAll(async () => {
    adminToken = await loginAdmin();
    const offresRes = await fetch(`${BASE}/public/offres`);
    expect(offresRes.status).toBe(200);
    open = await offresRes.json();
    expect(open.length).toBeGreaterThan(0);

    const { rows: rhUsers } = await pool.query(
      "SELECT id FROM utilisateur WHERE email = 'salma.bouazizi@steg.tn'"
    );
    rhId = rhUsers[0].id;
    expect(rhId).toBeTruthy();

    await resetCandidateData();
    secondCandidatId = await createSecondCandidat();
    expect(secondCandidatId).toBeTruthy();
  });

  afterAll(async () => {
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
    'état du dossier avant acceptation → pas de fenêtre d\'onboarding (documents_onboarding null)',
    async () => {
      const token = await loginCandidat();
      const target = await pickFreeOffer(token, adminToken, open);
      const applyRes = await authed(`${BASE}/candidatures`, token, {
        method: 'POST',
        body: JSON.stringify({ offre_id: target.id })
      });
      expect(applyRes.status).toBe(201);
      const { candidature } = await applyRes.json();
      created.push(candidature.id);

      const state = await documentsState(candidature.id, token);
      expect(state).toBeNull();
    },
    120000
  );

  test(
    'candidature acceptée sans période validée → pas encore de fenêtre d\'onboarding',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createAcceptedCandidature(token, adminToken, rh, open);
      const state = await documentsState(id, token);
      expect(state).toBeNull();
    },
    120000
  );

  test(
    'candidature en onboarding → 4 documents requis, soumissions reflétées (CV issu de la candidature si déposé)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);

      const state = await documentsState(id, token);
      expect(state).toBeDefined();
      expect(state.candidature_id).toBe(id);
      expect(state.required_types).toEqual(['CV', 'CIN', 'DEMANDE_STAGE', 'LETTRE_AFFECTATION']);
      expect(state.documents).toHaveLength(4);
      expect(state.total).toBe(4);

      const cv = state.documents.find((d) => d.type === 'CV');
      const candidatCv = await candidateCvPath();
      if (candidatCv && candidatCv.cv_path) {
        expect(cv.statut).toBe('EN_ATTENTE');
        expect(cv.from_application).toBe(true);
      } else {
        expect(cv.statut).toBe('MANQUANT');
      }
      for (const type of ['CIN', 'DEMANDE_STAGE', 'LETTRE_AFFECTATION']) {
        const doc = state.documents.find((d) => d.type === type);
        expect(doc.statut).toBe('MANQUANT');
        expect(doc.from_application).toBe(false);
      }
      expect(state.submitted).toBe(cv.statut === 'MANQUANT' ? 0 : 1);
    },
    120000
  );

  test(
    'le candidat dépose chaque document → EN_ATTENTE, compteur progressif, dossier complet à 4/4',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);

      for (const type of ['CIN', 'DEMANDE_STAGE', 'LETTRE_AFFECTATION', 'CV']) {
        const res = await uploadDocument(id, type, token, { filename: `${type.toLowerCase()}.pdf` });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.document.statut).toBe('EN_ATTENTE');
        expect(data.documents_onboarding.submitted).toBeGreaterThan(0);
        const submitted = data.documents_onboarding.documents.filter((d) => d.statut !== 'MANQUANT').length;
        expect(data.documents_onboarding.submitted).toBe(submitted);
      }

      const state = await documentsState(id, token);
      expect(state.submitted).toBe(4);
      for (const doc of state.documents) {
        expect(doc.statut).toBe('EN_ATTENTE');
        expect(doc.from_application).toBe(false);
      }
    },
    120000
  );

  test(
    'un nouveau dépôt remplace le précédent (upsert) et repasse EN_ATTENTE',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);

      const first = await uploadDocument(id, 'CIN', token, { filename: 'cin-v1.pdf' });
      expect(first.status).toBe(200);
      const firstData = await first.json();
      const firstNom = firstData.document.nom;

      const second = await uploadDocument(id, 'CIN', token, { filename: 'cin-v2.pdf' });
      expect(second.status).toBe(200);
      const secondData = await second.json();

      expect(secondData.document.nom).toBe('cin-v2.pdf');
      expect(secondData.document.nom).not.toBe(firstNom);

      const { rows } = await pool.query(
        'SELECT COUNT(*)::int AS count FROM candidature_document WHERE candidature_id = $1 AND type = $2',
        [id, 'CIN']
      );
      expect(rows[0].count).toBe(1);
    },
    120000
  );

  test(
    'dépôt refusé pour un type hors dossier (400)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);

      const form = new FormData();
      form.append('file', new Blob(['x'], { type: 'application/pdf' }), 'attestation.pdf');
      const res = await fetch(`${BASE}/candidatures/${id}/documents/ATTESTATION`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });
      expect(res.status).toBe(400);
    },
    120000
  );

  test(
    'dépôt refusé sans fichier (400)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);

      const form = new FormData();
      const res = await fetch(`${BASE}/candidatures/${id}/documents/CIN`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toContain('Aucun fichier fourni');
    },
    120000
  );

  test(
    'dépôt refusé avant validation de la période de stage (400)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createAcceptedCandidature(token, adminToken, rh, open);

      const res = await uploadDocument(id, 'CIN', token, { filename: 'cin.pdf' });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toContain('après validation de la période de stage');
    },
    120000
  );

  test(
    'dépôt refusé pour une candidature inexistante (404) et pour un rôle non candidat (403)',
    async () => {
      const token = await loginCandidat();
      const admin = await loginAdmin();

      const missing = await uploadDocument('00000000-0000-0000-0000-000000000000', 'CIN', token, { filename: 'cin.pdf' });
      expect(missing.status).toBe(404);

      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      const denied = await uploadDocument(id, 'CIN', admin, { filename: 'cin.pdf' });
      expect(denied.status).toBe(403);
    },
    120000
  );

  test(
    'dépôt refusé sans jeton d\'authentification (401)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);

      const form = buildForm('cin.pdf');
      const res = await fetch(`${BASE}/candidatures/${id}/documents/CIN`, {
        method: 'POST',
        body: form
      });
      expect(res.status).toBe(401);
    },
    120000
  );

  test(
    'dépôt refusé pour une extension non autorisée (400)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);

      const form = new FormData();
      form.append('file', new Blob(['x'], { type: 'application/octet-stream' }), 'malveillant.exe');
      const res = await fetch(`${BASE}/candidatures/${id}/documents/CIN`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toContain('Extension non autorisée');
    },
    120000
  );

  test(
    'dépôt refusé pour un fichier de plus de 10 Mo (400)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);

      const bigFile = new Blob([Buffer.alloc(10 * 1024 * 1024 + 1)], { type: 'application/pdf' });
      const form = new FormData();
      form.append('file', bigFile, 'tres-gros.pdf');
      const res = await fetch(`${BASE}/candidatures/${id}/documents/CIN`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toContain('trop volumineux');
    },
    120000
  );

  test(
    'dépôt refusé sur la candidature d\'un autre candidat (403)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);

      const other = await loginSecondCandidat();
      const res = await uploadDocument(id, 'CIN', other, { filename: 'cin.pdf' });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.message).toContain('ne vous appartient pas');

      const state = await documentsState(id, token);
      expect(state.documents.find((d) => d.type === 'CIN').statut).toBe('MANQUANT');
    },
    120000
  );

  test(
    'l\'examen RH expose le dossier de documents de la candidature acceptée',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadDocument(id, 'CIN', token, { filename: 'cin.pdf' });

      const res = await authed(`${BASE}/candidatures/${id}`, rh);
      expect(res.status).toBe(200);
      const details = await res.json();
      expect(details.documents_onboarding).toBeDefined();
      expect(details.documents_onboarding.candidature_id).toBe(id);
      const cin = details.documents_onboarding.documents.find((d) => d.type === 'CIN');
      expect(cin.statut).toBe('EN_ATTENTE');
      expect(cin.nom).toBe('cin.pdf');
    },
    120000
  );
});
