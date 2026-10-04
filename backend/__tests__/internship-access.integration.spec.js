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
let secondCandidatId = null;
let secondCandidatToken = null;
let open = [];
let created = [];

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

/** Candidature acceptée après l'entretien humain (statut HUMAN_INTERVIEW_ACCEPTED). */
async function createAcceptedCandidature(token, adminToken, rh, open) {
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
      lien_visio: 'https://teams.microsoft.com/l/meetup-join/meeting/internship-access-test'
    })
  });
  expect(schedule.status).toBe(200);

  const complete = await authed(`${BASE}/candidatures/${candidature.id}/entretien-humain/completion`, rh, {
    method: 'POST'
  });
  expect(complete.status).toBe(200);

  const decision = await authed(`${BASE}/candidatures/${candidature.id}/entretien-humain/decision`, rh, {
    method: 'POST',
    body: JSON.stringify({ decision: 'ACCEPTED' })
  });
  expect(decision.status).toBe(200);

  return candidature.id;
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

async function uploadDocument(candidatureId, type, token) {
  const form = new FormData();
  form.append('file', new Blob(['contenu du document'], { type: 'application/pdf' }), `${type.toLowerCase()}.pdf`);
  return fetch(`${BASE}/candidatures/${candidatureId}/documents/${type}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
}

/** Force le verdict de vérification automatique d'un document. */
async function setVerificationStatus(candidatureId, type, verificationStatus) {
  await pool.query(
    'UPDATE candidature_document SET verification_status = $1 WHERE candidature_id = $2 AND type = $3',
    [verificationStatus, candidatureId, type]
  );
}

/** Force le statut RH d'un document. */
async function setStatut(candidatureId, type, statut) {
  await pool.query(
    'UPDATE candidature_document SET statut = $1 WHERE candidature_id = $2 AND type = $3',
    [statut, candidatureId, type]
  );
}

/** Dépose les 4 documents requis du dossier. */
async function submitAllDocuments(candidatureId, token) {
  for (const type of ['CV', 'CIN', 'DEMANDE_STAGE', 'LETTRE_AFFECTATION']) {
    const res = await uploadDocument(candidatureId, type, token);
    expect(res.status).toBe(200);
  }
}

async function internshipAccess(candidatureId, token) {
  const res = await authed(`${BASE}/candidatures/${candidatureId}/internship-access`, token);
  return { res, data: await res.json() };
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

describe('Garde d\'accès au stage (internship-access, intégration)', () => {
  beforeAll(async () => {
    adminToken = await loginAdmin();
    const offresRes = await fetch(`${BASE}/public/offres`);
    expect(offresRes.status).toBe(200);
    open = await offresRes.json();
    expect(open.length).toBeGreaterThan(0);

    await resetCandidateData();
    secondCandidatId = await createSecondCandidat();
    expect(secondCandidatId).toBeTruthy();
  });

  /** Nettoie les candidatures créées pendant ce test (état vierge entre tests). */
  async function cleanupCreated() {
    for (const id of created) {
      await pool.query('DELETE FROM human_interviews WHERE candidature_id = $1', [id]);
      await pool.query('DELETE FROM ai_interview_sessions WHERE candidature_id = $1', [id]);
      await authed(`${BASE}/candidatures/${id}`, adminToken, { method: 'DELETE' });
    }
    created = [];
  }

  afterEach(async () => {
    await cleanupCreated();
  });

  afterAll(async () => {
    await cleanupCreated();
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
    'candidature hors fenêtre d\'onboarding → accès accordé',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createAcceptedCandidature(token, adminToken, rh, open);

      const { res, data } = await internshipAccess(id, token);
      expect(res.status).toBe(200);
      expect(data.access_granted).toBe(true);
      expect(data.documents).toEqual({
        cv: 'VALID',
        cin: 'VALID',
        demande_stage: 'VALID',
        lettre_affectation: 'VALID'
      });
    },
    120000
  );

  test(
    'dossier incomplet (MANQUANT) → accès refusé',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);

      const { res, data } = await internshipAccess(id, token);
      expect(res.status).toBe(200);
      expect(data.access_granted).toBe(false);
      expect(data.documents).toEqual({
        cv: 'MANQUANT',
        cin: 'MANQUANT',
        demande_stage: 'MANQUANT',
        lettre_affectation: 'MANQUANT'
      });
    },
    120000
  );

  test(
    'dossier complet envoyé (en cours de vérification AI) → accès refusé',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await submitAllDocuments(id, token);

      const { res, data } = await internshipAccess(id, token);
      expect(res.status).toBe(200);
      expect(data.access_granted).toBe(false);
      expect(data.documents).toEqual({
        cv: 'VERIFICATION',
        cin: 'VERIFICATION',
        demande_stage: 'VERIFICATION',
        lettre_affectation: 'VERIFICATION'
      });
    },
    120000
  );

  test(
    'un document en cours de vérification (PENDING) → accès refusé',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await submitAllDocuments(id, token);
      await setVerificationStatus(id, 'CV', 'PENDING');

      const { res, data } = await internshipAccess(id, token);
      expect(res.status).toBe(200);
      expect(data.access_granted).toBe(false);
      expect(data.documents.cv).toBe('VERIFICATION');
    },
    120000
  );

  test(
    'un document nécessitant une vérification (REVIEW_REQUIRED) → accès refusé',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await submitAllDocuments(id, token);
      await setVerificationStatus(id, 'CIN', 'REVIEW_REQUIRED');

      const { res, data } = await internshipAccess(id, token);
      expect(res.status).toBe(200);
      expect(data.access_granted).toBe(false);
      expect(data.documents.cin).toBe('REVIEW_REQUIRED');
    },
    120000
  );

  test(
    'un document rejeté (REJECTED) → accès refusé',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await submitAllDocuments(id, token);
      await setVerificationStatus(id, 'DEMANDE_STAGE', 'REJECTED');

      const { res, data } = await internshipAccess(id, token);
      expect(res.status).toBe(200);
      expect(data.access_granted).toBe(false);
      expect(data.documents.demande_stage).toBe('REJECTED');
    },
    120000
  );

  test(
    'les 4 documents validés → accès accordé (tous VALID)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await submitAllDocuments(id, token);
      for (const type of ['CV', 'CIN', 'DEMANDE_STAGE', 'LETTRE_AFFECTATION']) {
        await setVerificationStatus(id, type, 'VALID');
      }

      const { res, data } = await internshipAccess(id, token);
      expect(res.status).toBe(200);
      expect(data.access_granted).toBe(true);
      expect(data.documents).toEqual({
        cv: 'VALID',
        cin: 'VALID',
        demande_stage: 'VALID',
        lettre_affectation: 'VALID'
      });
    },
    120000
  );

  test(
    'accès à la candidature d\'un autre candidat → 403',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);

      const other = await loginSecondCandidat();
      const { res, data } = await internshipAccess(id, other);
      expect(res.status).toBe(403);
      expect(data.message).toContain('ne vous appartient pas');
    },
    120000
  );

  test(
    'endpoint sans jeton d\'authentification → 401',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);

      const res = await fetch(`${BASE}/candidatures/${id}/internship-access`);
      expect(res.status).toBe(401);
    },
    120000
  );

  test(
    'un candidat au dossier non vérifié est bloqué (403) sur les API du stage',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await submitAllDocuments(id, token);

      const blocked = await authed(`${BASE}/taches`, token);
      expect(blocked.status).toBe(403);
      const blockedData = await blocked.json();
      expect(blockedData.message).toContain('Accès refusé');

      const blockedStages = await authed(`${BASE}/stages`, token);
      expect(blockedStages.status).toBe(403);
    },
    120000
  );

  test(
    'le même candidat avec dossier validé accède aux API du stage (200)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await submitAllDocuments(id, token);
      for (const type of ['CV', 'CIN', 'DEMANDE_STAGE', 'LETTRE_AFFECTATION']) {
        await setVerificationStatus(id, type, 'VALID');
      }

      const tasks = await authed(`${BASE}/taches`, token);
      expect(tasks.status).toBe(200);

      const stages = await authed(`${BASE}/stages`, token);
      expect(stages.status).toBe(200);
    },
    120000
  );

  test(
    'un candidat hors fenêtre d\'onboarding n\'est jamais bloqué sur les API du stage',
    async () => {
      const token = await loginCandidat();
      const res = await authed(`${BASE}/taches`, token);
      expect(res.status).toBe(200);
    },
    120000
  );

  test(
    'les autres rôles (stagiaire) ne sont pas affectés par le garde',
    async () => {
      const res = await authed(`${BASE}/taches`, await login('fatma.trabelsi@steg.tn', 'stagiaire123'));
      expect(res.status).toBe(200);
    },
    120000
  );
});
