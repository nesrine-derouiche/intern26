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

const REQUIRED_TYPES = ['CV', 'CIN', 'DEMANDE_STAGE', 'LETTRE_AFFECTATION'];

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
      lien_visio: 'https://teams.microsoft.com/l/meetup-join/meeting/readiness-test'
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

/** Force le verdict de vérification automatique d'un document. */
async function setVerificationStatus(candidatureId, type, verificationStatus) {
  await pool.query(
    'UPDATE candidature_document SET verification_status = $1 WHERE candidature_id = $2 AND type = $3',
    [verificationStatus, candidatureId, type]
  );
}

/** Dépose les 4 documents requis et force un verdict VALID pour chacun. */
async function uploadAllValidDocuments(candidatureId, token) {
  for (const type of REQUIRED_TYPES) {
    const res = await uploadDocument(candidatureId, type, token);
    expect(res.status).toBe(200);
  }
  for (const type of REQUIRED_TYPES) {
    await setVerificationStatus(candidatureId, type, 'VALID');
  }
}

/** Dépose uniquement les types fournis, avec un verdict VALID. */
async function uploadValidTypes(candidatureId, token, types) {
  for (const type of types) {
    const res = await uploadDocument(candidatureId, type, token);
    expect(res.status).toBe(200);
    await setVerificationStatus(candidatureId, type, 'VALID');
  }
}

function readiness(candidatureId, token) {
  return authed(`${BASE}/candidatures/${candidatureId}/internship-readiness`, token);
}

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

describe('Éligibilité du dossier à la création du stagiaire (intégration)', () => {
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
    'dossier complet : entretien accepté, période validée et 4 documents VALID → prêt',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadAllValidDocuments(id, token);

      const res = await readiness(id, rh);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ready).toBe(true);
      expect(data.reasons).toEqual([]);
      expect(data.missingDocuments).toEqual([]);
      expect(data.invalidDocuments).toEqual([]);
      expect(data.documents).toHaveLength(4);
      for (const doc of data.documents) {
        expect(doc.status).toBe('VALID');
        expect(doc.id).toBeTruthy();
      }
    },
    120000
  );

  test(
    'CV manquant → non prêt, raison DOCUMENTS_INCOMPLETE',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadValidTypes(id, token, ['CIN', 'DEMANDE_STAGE', 'LETTRE_AFFECTATION']);

      const data = await (await readiness(id, rh)).json();
      expect(data.ready).toBe(false);
      expect(data.reasons).toContain('DOCUMENTS_INCOMPLETE');
      expect(data.missingDocuments).toEqual(['CV']);
      expect(data.documents.find((d) => d.type === 'CV').status).toBe('MANQUANT');
    },
    120000
  );

  test(
    'CIN manquant → non prêt',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadValidTypes(id, token, ['CV', 'DEMANDE_STAGE', 'LETTRE_AFFECTATION']);

      const data = await (await readiness(id, rh)).json();
      expect(data.ready).toBe(false);
      expect(data.missingDocuments).toEqual(['CIN']);
    },
    120000
  );

  test(
    'lettre d\'affectation manquante → non prêt',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadValidTypes(id, token, ['CV', 'CIN', 'DEMANDE_STAGE']);

      const data = await (await readiness(id, rh)).json();
      expect(data.ready).toBe(false);
      expect(data.missingDocuments).toEqual(['LETTRE_AFFECTATION']);
    },
    120000
  );

  test(
    'demande de stage manquante → non prêt',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadValidTypes(id, token, ['CV', 'CIN', 'LETTRE_AFFECTATION']);

      const data = await (await readiness(id, rh)).json();
      expect(data.ready).toBe(false);
      expect(data.missingDocuments).toEqual(['DEMANDE_STAGE']);
    },
    120000
  );

  test(
    'document rejeté → non prêt, raison DOCUMENTS_INVALID',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadAllValidDocuments(id, token);
      await setVerificationStatus(id, 'CIN', 'REJECTED');

      const data = await (await readiness(id, rh)).json();
      expect(data.ready).toBe(false);
      expect(data.reasons).toContain('DOCUMENTS_INVALID');
      expect(data.invalidDocuments).toEqual(['CIN']);
      expect(data.documents.find((d) => d.type === 'CIN').status).toBe('REJECTED');
    },
    120000
  );

  test(
    'document REVIEW_REQUIRED → non prêt',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadAllValidDocuments(id, token);
      await setVerificationStatus(id, 'DEMANDE_STAGE', 'REVIEW_REQUIRED');

      const data = await (await readiness(id, rh)).json();
      expect(data.ready).toBe(false);
      expect(data.reasons).toContain('DOCUMENTS_INVALID');
      expect(data.invalidDocuments).toEqual(['DEMANDE_STAGE']);
      expect(data.documents.find((d) => d.type === 'DEMANDE_STAGE').status).toBe('REVIEW_REQUIRED');
    },
    120000
  );

  test(
    'période de stage non validée par le RH → non prêt',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createAcceptedCandidature(token, adminToken, rh, open);
      await pool.query("UPDATE candidature SET internship_period_validated_at = now() WHERE id = $1", [id]);
      await uploadAllValidDocuments(id, token);
      await pool.query("UPDATE candidature SET internship_period_validated_at = NULL WHERE id = $1", [id]);

      const data = await (await readiness(id, rh)).json();
      expect(data.ready).toBe(false);
      expect(data.reasons).toContain('INTERNSHIP_PERIOD_NOT_VALIDATED');
      expect(data.reasons).not.toContain('HUMAN_INTERVIEW_NOT_ACCEPTED');
    },
    120000
  );

  test(
    'entretien humain non accepté → non prêt',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadAllValidDocuments(id, token);
      await pool.query("UPDATE candidature SET statut = 'AI_INTERVIEW_PASSED' WHERE id = $1", [id]);

      const data = await (await readiness(id, rh)).json();
      expect(data.ready).toBe(false);
      expect(data.reasons).toContain('HUMAN_INTERVIEW_NOT_ACCEPTED');
      expect(data.reasons).not.toContain('INTERNSHIP_PERIOD_NOT_VALIDATED');
    },
    120000
  );

  test(
    'le candidat propriétaire peut consulter son propre état de dossier',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);

      const res = await readiness(id, token);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.candidature_id).toBe(id);
    },
    120000
  );

  test(
    'un autre candidat ne peut pas consulter l\'état de dossier d\'une candidature qui ne lui appartient pas (403)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const other = await loginSecondCandidat();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);

      const res = await readiness(id, other);
      expect(res.status).toBe(403);
    },
    120000
  );

  test(
    'candidature inconnue → 404',
    async () => {
      const rh = await loginRH();
      const res = await readiness('00000000-0000-4000-8000-000000000000', rh);
      expect(res.status).toBe(404);
    },
    120000
  );

  test(
    'le candidat ne peut pas modifier l\'éligibilité via des données envoyées dans la requête',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadValidTypes(id, token, ['CV', 'CIN', 'LETTRE_AFFECTATION']);

      const res = await authed(
        `${BASE}/candidatures/${id}/internship-readiness?cv=VALID&cin=VALID&demande_stage=VALID&lettre_affectation=VALID`,
        token
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ready).toBe(false);
      expect(data.missingDocuments).toEqual(['DEMANDE_STAGE']);

      const postRes = await authed(`${BASE}/candidatures/${id}/internship-readiness`, rh, {
        method: 'POST',
        body: JSON.stringify({ documents: { demande_stage: 'VALID' } })
      });
      expect(postRes.status).toBe(404);

      const rhData = await (await readiness(id, rh)).json();
      expect(rhData.missingDocuments).toEqual(['DEMANDE_STAGE']);
    },
    120000
  );

  test(
    'l\'éligibilité est en lecture seule : aucune méthode d\'écriture sur le chemin',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);

      const putRes = await authed(`${BASE}/candidatures/${id}/internship-readiness`, rh, {
        method: 'PUT',
        body: JSON.stringify({ ready: true })
      });
      expect(putRes.status).toBe(404);
    },
    120000
  );
});
