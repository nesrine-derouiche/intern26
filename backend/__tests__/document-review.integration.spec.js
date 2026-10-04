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
let candidatId = null;
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

/** Second candidat créé dans beforeAll : permet de tester les documents d'une autre candidature. */
async function createSecondCandidat() {
  const { rows: existing } = await pool.query(
    'SELECT id FROM utilisateur WHERE email = $1',
    ['candidat.docreview@steg.tn']
  );
  if (existing[0]) return existing[0].id;
  const password = await bcrypt.hash('Candidat123!', 12);
  const { rows } = await pool.query(
    `INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone, adresse, role, email_verifie)
     VALUES ('Test', 'Deuxième', $1, $2, '+216 22 000 001', 'Tunis', 'CANDIDAT', true)
     RETURNING id`,
    ['candidat.docreview@steg.tn', password]
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
  secondCandidatToken = await login('candidat.docreview@steg.tn', 'Candidat123!');
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
      lien_visio: 'https://teams.microsoft.com/l/meetup-join/meeting/document-review-test'
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

async function uploadDocument(candidatureId, type, token, { filename } = {}) {
  const form = new FormData();
  form.append('file', new Blob(['contenu du document'], { type: 'application/pdf' }), filename || `${type.toLowerCase()}.pdf`);
  const res = await fetch(`${BASE}/candidatures/${candidatureId}/documents/${type}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
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

async function documentRow(candidatureId, type) {
  const { rows } = await pool.query(
    'SELECT id, type, verification_status, statut, rejected_reason FROM candidature_document WHERE candidature_id = $1 AND type = $2',
    [candidatureId, type]
  );
  return rows[0];
}

/** Force le verdict de vérification automatique d'un document. */
async function setVerificationStatus(candidatureId, type, verificationStatus) {
  await pool.query(
    'UPDATE candidature_document SET verification_status = $1 WHERE candidature_id = $2 AND type = $3',
    [verificationStatus, candidatureId, type]
  );
}

/** Décide manuellement (PATCH) le sort d'un document en tant que RH/ADMIN. */
function decide(candidatureId, documentId, token, payload) {
  return authed(`${BASE}/candidatures/${candidatureId}/documents/${documentId}/verification`, token, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

async function internshipAccessState(candidatureId, token) {
  const res = await authed(`${BASE}/candidatures/${candidatureId}/internship-access`, token);
  expect(res.status).toBe(200);
  return res.json();
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

describe('Vérification manuelle RH des documents du dossier (intégration)', () => {
  beforeAll(async () => {
    adminToken = await loginAdmin();
    const offresRes = await fetch(`${BASE}/public/offres`);
    expect(offresRes.status).toBe(200);
    open = await offresRes.json();
    expect(open.length).toBeGreaterThan(0);

    const { rows: candidatUsers } = await pool.query(
      'SELECT id FROM utilisateur WHERE email = $1',
      ['candidat@steg.tn']
    );
    candidatId = candidatUsers[0].id;
    expect(candidatId).toBeTruthy();

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
    if (candidatId) {
      await pool.query('DELETE FROM notification WHERE utilisateur_id = $1', [candidatId]);
    }
    if (secondCandidatId) {
      try {
        await pool.query('DELETE FROM candidature WHERE candidat_id = $1', [secondCandidatId]);
        await pool.query('DELETE FROM candidat WHERE id = $1', [secondCandidatId]);
        await pool.query('DELETE FROM utilisateur WHERE id = $1', [secondCandidatId]);
      } catch (e) {}
    }
    await pool.end();
  });

  test(
    'l\'examen RH expose les documents du dossier avec leur id et leur verdict de vérification',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadDocument(id, 'CIN', token, { filename: 'cin.pdf' });

      const res = await authed(`${BASE}/candidatures/${id}`, rh);
      expect(res.status).toBe(200);
      const details = await res.json();
      expect(details.documents_onboarding).toBeDefined();
      const cin = details.documents_onboarding.documents.find((d) => d.type === 'CIN');
      expect(cin.id).toBeTruthy();
      expect(cin.verification_status).toBe('PENDING');
      expect(cin.nom).toBe('cin.pdf');
    },
    120000
  );

  test(
    'le RH valide un document REVIEW_REQUIRED → VALID, statut VALIDE, motif effacé',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadDocument(id, 'CIN', token, { filename: 'cin.pdf' });
      await setVerificationStatus(id, 'CIN', 'REVIEW_REQUIRED');
      const doc = await documentRow(id, 'CIN');

      const res = await decide(id, doc.id, rh, { status: 'VALID' });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.document.verification_status).toBe('VALID');
      expect(data.document.statut).toBe('VALIDE');

      const after = await documentRow(id, 'CIN');
      expect(after.verification_status).toBe('VALID');
      expect(after.statut).toBe('VALIDE');
      expect(after.rejected_reason).toBeNull();
    },
    120000
  );

  test(
    'le RH rejette un document REVIEW_REQUIRED → REJECTED, statut REJETE, motif conservé',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadDocument(id, 'DEMANDE_STAGE', token, { filename: 'demande.pdf' });
      await setVerificationStatus(id, 'DEMANDE_STAGE', 'REVIEW_REQUIRED');
      const doc = await documentRow(id, 'DEMANDE_STAGE');

      const res = await decide(id, doc.id, rh, { status: 'REJECTED', rejected_reason: 'Demande de stage incomplète.' });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.document.verification_status).toBe('REJECTED');
      expect(data.document.statut).toBe('REJETE');
      expect(data.document.rejected_reason).toBe('Demande de stage incomplète.');

      const after = await documentRow(id, 'DEMANDE_STAGE');
      expect(after.verification_status).toBe('REJECTED');
      expect(after.rejected_reason).toBe('Demande de stage incomplète.');
    },
    120000
  );

  test(
    'un candidat ne peut pas valider un document (403)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadDocument(id, 'CIN', token, { filename: 'cin.pdf' });
      await setVerificationStatus(id, 'CIN', 'REVIEW_REQUIRED');
      const doc = await documentRow(id, 'CIN');

      const res = await decide(id, doc.id, token, { status: 'VALID' });
      expect(res.status).toBe(403);

      const after = await documentRow(id, 'CIN');
      expect(after.verification_status).toBe('REVIEW_REQUIRED');
    },
    120000
  );

  test(
    'un candidat ne peut pas rejeter un document (403)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadDocument(id, 'CIN', token, { filename: 'cin.pdf' });
      await setVerificationStatus(id, 'CIN', 'REVIEW_REQUIRED');
      const doc = await documentRow(id, 'CIN');

      const res = await decide(id, doc.id, token, { status: 'REJECTED', rejected_reason: 'non' });
      expect(res.status).toBe(403);

      const after = await documentRow(id, 'CIN');
      expect(after.verification_status).toBe('REVIEW_REQUIRED');
    },
    120000
  );

  test(
    'un candidat ne peut pas modifier un verdict déjà rendu (PENDING → 409)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadDocument(id, 'CIN', token, { filename: 'cin.pdf' });
      const doc = await documentRow(id, 'CIN');

      const res = await decide(id, doc.id, token, { status: 'VALID' });
      expect(res.status).toBe(403);
      expect((await documentRow(id, 'CIN')).verification_status).toBe('PENDING');
    },
    120000
  );

  test(
    'le RH ne peut pas valider un document appartenant à une autre candidature (404)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const second = await loginSecondCandidat();
      const candidatureA = await createOnboardingCandidature(token, adminToken, rh, open);
      const candidatureB = await createOnboardingCandidature(second, adminToken, rh, open);
      await uploadDocument(candidatureA, 'CIN', token, { filename: 'cin.pdf' });
      await uploadDocument(candidatureB, 'CIN', second, { filename: 'cin.pdf' });
      await setVerificationStatus(candidatureA, 'CIN', 'REVIEW_REQUIRED');
      const docA = await documentRow(candidatureA, 'CIN');

      const res = await decide(candidatureB, docA.id, rh, { status: 'VALID' });
      expect(res.status).toBe(404);

      const after = await documentRow(candidatureA, 'CIN');
      expect(after.verification_status).toBe('REVIEW_REQUIRED');
    },
    120000
  );

  test(
    'le RH ne peut pas rejeter un document appartenant à une autre candidature (404)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const second = await loginSecondCandidat();
      const candidatureA = await createOnboardingCandidature(token, adminToken, rh, open);
      const candidatureB = await createOnboardingCandidature(second, adminToken, rh, open);
      await uploadDocument(candidatureA, 'LETTRE_AFFECTATION', token, { filename: 'lettre.pdf' });
      await uploadDocument(candidatureB, 'LETTRE_AFFECTATION', second, { filename: 'lettre.pdf' });
      await setVerificationStatus(candidatureA, 'LETTRE_AFFECTATION', 'REVIEW_REQUIRED');
      const docA = await documentRow(candidatureA, 'LETTRE_AFFECTATION');

      const res = await decide(candidatureB, docA.id, rh, { status: 'REJECTED', rejected_reason: 'non' });
      expect(res.status).toBe(404);
    },
    120000
  );

  test(
    'un document déjà VALID ne peut pas être modifié (409)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadDocument(id, 'CIN', token, { filename: 'cin.pdf' });
      await setVerificationStatus(id, 'CIN', 'REVIEW_REQUIRED');
      const doc = await documentRow(id, 'CIN');

      const first = await decide(id, doc.id, rh, { status: 'VALID' });
      expect(first.status).toBe(200);

      const second = await decide(id, doc.id, rh, { status: 'REJECTED', rejected_reason: 'changement de décision' });
      expect(second.status).toBe(409);

      const after = await documentRow(id, 'CIN');
      expect(after.verification_status).toBe('VALID');
      expect(after.statut).toBe('VALIDE');
    },
    120000
  );

  test(
    'un document PENDING (vérification automatique en cours) ne peut pas être tranché manuellement (409)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadDocument(id, 'CIN', token, { filename: 'cin.pdf' });
      const doc = await documentRow(id, 'CIN');
      expect(doc.verification_status).toBe('PENDING');

      const res = await decide(id, doc.id, rh, { status: 'VALID' });
      expect(res.status).toBe(409);
      expect((await documentRow(id, 'CIN')).verification_status).toBe('PENDING');
    },
    120000
  );

  test(
    'une décision avec un statut invalide ou sans documentId UUID est refusée (400)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadDocument(id, 'CIN', token, { filename: 'cin.pdf' });
      await setVerificationStatus(id, 'CIN', 'REVIEW_REQUIRED');
      const doc = await documentRow(id, 'CIN');

      const badStatus = await decide(id, doc.id, rh, { status: 'EN_ATTENTE' });
      expect(badStatus.status).toBe(400);

      const badId = await decide(id, 'pas-un-uuid', rh, { status: 'VALID' });
      expect(badId.status).toBe(400);
    },
    120000
  );

  test(
    'la validation RH d\'un document envoie une notification au candidat',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadDocument(id, 'CIN', token, { filename: 'cin.pdf' });
      await setVerificationStatus(id, 'CIN', 'REVIEW_REQUIRED');
      const doc = await documentRow(id, 'CIN');

      const res = await decide(id, doc.id, rh, { status: 'VALID' });
      expect(res.status).toBe(200);

      const { rows } = await pool.query(
        `SELECT titre, message, type, lien FROM notification
         WHERE utilisateur_id = $1 AND type = 'CANDIDATURE'
         ORDER BY date DESC LIMIT 1`,
        [candidatId]
      );
      expect(rows[0]).toBeDefined();
      expect(rows[0].titre).toBe('Document validé');
      expect(rows[0].message).toBe('Votre document CIN a été validé.');
      expect(rows[0].lien).toBeNull();
    },
    120000
  );

  test(
    'le rejet d\'un document envoie une notification de nouvelle action au candidat',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadDocument(id, 'CIN', token, { filename: 'cin.pdf' });
      await setVerificationStatus(id, 'CIN', 'REVIEW_REQUIRED');
      const doc = await documentRow(id, 'CIN');

      const res = await decide(id, doc.id, rh, { status: 'REJECTED', rejected_reason: 'Illisible.' });
      expect(res.status).toBe(200);

      const { rows } = await pool.query(
        `SELECT titre, message FROM notification
         WHERE utilisateur_id = $1 AND type = 'CANDIDATURE'
         ORDER BY date DESC LIMIT 1`,
        [candidatId]
      );
      expect(rows[0]).toBeDefined();
      expect(rows[0].titre).toBe('Document rejeté');
      expect(rows[0].message).toBe('Votre document CIN nécessite une nouvelle action.');
    },
    120000
  );

  test(
    'chaque décision RH est tracée dans l\'historique d\'audit avec le document concerné',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadDocument(id, 'CIN', token, { filename: 'cin.pdf' });
      await setVerificationStatus(id, 'CIN', 'REVIEW_REQUIRED');
      const doc = await documentRow(id, 'CIN');

      const res = await decide(id, doc.id, rh, { status: 'REJECTED', rejected_reason: 'Document illisible.' });
      expect(res.status).toBe(200);

      const { rows } = await pool.query(
        `SELECT decision, action, document_id, previous_status, new_status
         FROM candidature_decisions
         WHERE candidature_id = $1 AND document_id = $2
         ORDER BY decided_at DESC LIMIT 1`,
        [id, doc.id]
      );
      expect(rows[0]).toBeDefined();
      expect(rows[0].decision).toBe('REJECTED');
      expect(rows[0].action).toBe('DOCUMENT_REVIEW');
      expect(rows[0].document_id).toBe(doc.id);
      expect(rows[0].previous_status).toBe('REVIEW_REQUIRED');
      expect(rows[0].new_status).toBe('REJECTED');

      const detailsRes = await authed(`${BASE}/candidatures/${id}`, rh);
      expect(detailsRes.status).toBe(200);
      const details = await detailsRes.json();
      const audit = details.decision_history.find((e) => e.document_id === doc.id);
      expect(audit).toBeDefined();
      expect(audit.decision).toBe('REJECTED');
    },
    120000
  );

  test(
    'après validation RH des 4 documents, l\'accès au stage reflète le dossier complet (VALID)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);

      for (const type of ['CV', 'CIN', 'DEMANDE_STAGE', 'LETTRE_AFFECTATION']) {
        const upload = await uploadDocument(id, type, token, { filename: `${type.toLowerCase()}.pdf` });
        expect(upload.status).toBe(200);
        await setVerificationStatus(id, type, 'REVIEW_REQUIRED');
        const doc = await documentRow(id, type);
        const res = await decide(id, doc.id, rh, { status: 'VALID' });
        expect(res.status).toBe(200);
      }

      const access = await internshipAccessState(id, token);
      expect(access.documents).toBeDefined();
      const statuses = Object.values(access.documents);
      expect(statuses).toEqual(['VALID', 'VALID', 'VALID', 'VALID']);
      expect(access.access_granted).toBe(true);
    },
    120000
  );

  test(
    'le RH peut télécharger un document du dossier (download, 200)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadDocument(id, 'CIN', token, { filename: 'cin.pdf' });
      const doc = await documentRow(id, 'CIN');

      const res = await authed(`${BASE}/candidatures/${id}/documents/${doc.id}/download`, rh);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/pdf');
      const buffer = Buffer.from(await res.arrayBuffer());
      expect(buffer.length).toBeGreaterThan(0);
    },
    120000
  );

  test(
    'le téléchargement d\'un document d\'une autre candidature est refusé (404)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const second = await loginSecondCandidat();
      const candidatureA = await createOnboardingCandidature(token, adminToken, rh, open);
      const candidatureB = await createOnboardingCandidature(second, adminToken, rh, open);
      await uploadDocument(candidatureA, 'CIN', token, { filename: 'cin.pdf' });
      const docA = await documentRow(candidatureA, 'CIN');

      const res = await authed(`${BASE}/candidatures/${candidatureB}/documents/${docA.id}/download`, rh);
      expect(res.status).toBe(404);
    },
    120000
  );
});
