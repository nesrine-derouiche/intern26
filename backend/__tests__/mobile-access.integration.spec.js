const BASE = 'http://localhost:3000/api';

require('dotenv').config();
const pool = require('../config/db');
const bcrypt = require('bcrypt');

jest.mock('../services/email.service', () => ({
  sendMobileAccessEmail: jest.fn()
}));

const emailService = require('../services/email.service');
const job = require('../services/mobile-access-email.job');
const mobileCredentials = require('../services/mobile-credentials.service');

let candidatToken = null;
let adminToken = null;
let rhToken = null;
let rhId = null;
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
      date: '2026-09-10',
      heure: '10:30',
      duree: 45,
      interviewer: 'Salma Bouazizi',
      interviewer_email: 'salma.bouazizi@steg.tn',
      lien_visio: 'https://teams.microsoft.com/l/meetup-join/meeting/mobile-access-test'
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

/** Candidature acceptée dont la période de stage est renseignée par le candidat. */
async function createSubmittedCandidature(token, adminToken, rh, open) {
  const id = await createAcceptedCandidature(token, adminToken, rh, open);
  const res = await authed(`${BASE}/candidatures/${id}/stage-preferences`, token, {
    method: 'PUT',
    body: JSON.stringify({ internship_start_date: futureDate(30), internship_duration_months: 4 })
  });
  expect(res.status).toBe(200);
  return id;
}

/** Candidature dont la période de stage a été validée par le RH (prépare l'accès mobile). */
async function createValidatedCandidature(token, adminToken, rh, open) {
  const id = await createSubmittedCandidature(token, adminToken, rh, open);
  const res = await authed(`${BASE}/candidatures/${id}/stage-preferences/validate`, rh, {
    method: 'POST'
  });
  expect(res.status).toBe(200);
  return id;
}

/** Candidature convertie en stagiaire (statut STAGIAIRE_CREATED), période validée. */
async function createConvertedTrainee(token, adminToken, rh, open) {
  const id = await createValidatedCandidature(token, adminToken, rh, open);
  await pool.query("UPDATE candidature SET statut = 'STAGIAIRE_CREATED' WHERE id = $1", [id]);
  return id;
}

/** Date strictement future (YYYY-MM-DD) dans le fuseau Africa/Tunis. */
function futureDate(daysFromNow = 30) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }));
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) + daysFromNow * 86400000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Date du jour (YYYY-MM-DD) dans le fuseau Africa/Tunis. */
function tunisToday() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }));
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Décalage en jours d'une date YYYY-MM-DD. */
function addDays(iso, delta) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Définit la date de début de stage d'une candidature (bypass des gardes API). */
async function setStartDate(id, iso) {
  await pool.query('UPDATE candidature SET internship_start_date = $1 WHERE id = $2', [iso, id]);
}

/** Ligne d'accès mobile d'une candidature. */
async function mobileRow(id) {
  const { rows } = await pool.query(
    `SELECT mobile_access_prepared_at, mobile_access_email_state, mobile_access_email_sent_at,
            mobile_access_email_error, mobile_access_credentials_encrypted
     FROM candidature WHERE id = $1`,
    [id]
  );
  return rows[0];
}

/** Email + prénom + nom réels du candidat stockés en base. */
async function candidateEmail(candidatureId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(cu.email, su.email) AS email, COALESCE(cu.prenom, su.prenom) AS prenom,
            COALESCE(cu.nom, su.nom) AS nom
     FROM candidature c
     LEFT JOIN utilisateur su ON su.id = c.stagiaire_id
     LEFT JOIN utilisateur cu ON cu.id = c.candidat_id
     WHERE c.id = $1`,
    [candidatureId]
  );
  return rows[0];
}

async function utilisateurRow(email) {
  const { rows } = await pool.query(
    'SELECT id, role, mot_de_passe, email FROM utilisateur WHERE email = $1',
    [email]
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

describe('Accès application mobile + email D-1 (intégration)', () => {
  beforeAll(async () => {
    await pool.query("UPDATE utilisateur SET mot_de_passe = $1, token_version = 0 WHERE email = $2", [
      await bcrypt.hash('Candidat123!', 12),
      'candidat@steg.tn'
    ]);

    candidatToken = null;
    adminToken = null;
    rhToken = null;

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
  });

  beforeEach(async () => {
    const hash = await bcrypt.hash('Candidat123!', 12);
    await pool.query("UPDATE utilisateur SET mot_de_passe = $1, role = 'CANDIDAT', token_version = 0 WHERE email = 'candidat@steg.tn'", [hash]);
    candidatToken = null;
    emailService.sendMobileAccessEmail.mockReset();
    emailService.sendMobileAccessEmail.mockResolvedValue(true);
  });

  afterAll(async () => {
    for (const id of created) {
      await authed(`${BASE}/candidatures/${id}`, adminToken, { method: 'DELETE' });
    }
    for (const id of created) {
      await pool.query('DELETE FROM human_interviews WHERE candidature_id = $1', [id]);
      await pool.query('DELETE FROM ai_interview_sessions WHERE candidature_id = $1', [id]);
    }
    // Restaure le mot de passe du candidat de test partagé (utilisé par d'autres suites).
    const original = await bcrypt.hash('Candidat123!', 12);
    await pool.query('UPDATE utilisateur SET mot_de_passe = $1 WHERE email = $2', [
      original,
      'candidat@steg.tn'
    ]);
    delete process.env.MOBILE_APP_DOWNLOAD_URL;
    await pool.end();
  });

  test(
    'la validation RH prépare l\'accès mobile (pas d\'email tant que J-1 n\'est pas atteint)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createValidatedCandidature(token, adminToken, rh, open);

      const row = await mobileRow(id);
      expect(row.mobile_access_prepared_at).toBeTruthy();
      expect(row.mobile_access_email_state).toBe('PENDING');
      expect(row.mobile_access_email_sent_at).toBeNull();
      expect(row.mobile_access_credentials_encrypted).toBeNull();

      const summary = await job.run(tunisToday());
      expect(summary.sent).toBe(0);
      expect(emailService.sendMobileAccessEmail).not.toHaveBeenCalled();
    },
    120000
  );

  test(
    'candidature validée sans période validée → aucun accès préparé ni email',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createSubmittedCandidature(token, adminToken, rh, open);
      await setStartDate(id, addDays(tunisToday(), 1));

      const summary = await job.run(tunisToday());
      expect(summary.sent).toBe(0);
      expect(emailService.sendMobileAccessEmail).not.toHaveBeenCalled();

      const row = await mobileRow(id);
      expect(row.mobile_access_prepared_at).toBeNull();
    },
    120000
  );

  test(
    'candidature refusée après entretien humain → aucun email d\'accès',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createCompletedCandidature(token, adminToken, rh, open);
      await setStartDate(id, addDays(tunisToday(), 1));

      const decision = await authed(`${BASE}/candidatures/${id}/entretien-humain/decision`, rh, {
        method: 'POST',
        body: JSON.stringify({ decision: 'REJECTED' })
      });
      expect(decision.status).toBe(200);

      const summary = await job.run(tunisToday());
      expect(summary.sent).toBe(0);
      expect(emailService.sendMobileAccessEmail).not.toHaveBeenCalled();
    },
    120000
  );

  test(
    'candidature à J-2 → aucun email d\'accès',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createValidatedCandidature(token, adminToken, rh, open);
      await setStartDate(id, addDays(tunisToday(), 2));

      const summary = await job.run(tunisToday());
      expect(summary.sent).toBe(0);
      expect(emailService.sendMobileAccessEmail).not.toHaveBeenCalled();
      expect((await mobileRow(id)).mobile_access_email_state).toBe('PENDING');
    },
    120000
  );

  test(
    'candidature à J-1 → email envoyé (identifiant, mot de passe, date, instructions, sécurité)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createValidatedCandidature(token, adminToken, rh, open);
      await setStartDate(id, addDays(tunisToday(), 1));

      const summary = await job.run(tunisToday());

      expect(summary).toEqual({ date: tunisToday(), total: 1, sent: 1 });
      expect(emailService.sendMobileAccessEmail).toHaveBeenCalledTimes(1);

      const { email, prenom, nom } = await candidateEmail(id);
      const [to, payload] = emailService.sendMobileAccessEmail.mock.calls[0];
      expect(to).toBe(email);
      expect(payload.nom).toBe([prenom, nom].filter(Boolean).join(' '));
      expect(payload.dateDebut).toBe(addDays(tunisToday(), 1).split('-').reverse().join('/'));
      expect(payload.username).toBe(email);
      expect(payload.password).toBeTruthy();
      expect(payload.password.length).toBeGreaterThanOrEqual(8);
      expect(payload.password).toMatch(/[A-Z]/);
      expect(payload.password).toMatch(/[a-z]/);
      expect(payload.password).toMatch(/[0-9]/);
      expect(payload.password).toMatch(/[^A-Za-z0-9]/);

      const row = await mobileRow(id);
      expect(row.mobile_access_email_state).toBe('SENT');
      expect(row.mobile_access_email_sent_at).toBeTruthy();
      expect(row.mobile_access_credentials_encrypted).toBeNull();
    },
    120000
  );

  test(
    'candidature dont la date de début est atteinte (J) → email envoyé quand même',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createValidatedCandidature(token, adminToken, rh, open);
      await setStartDate(id, tunisToday());

      const summary = await job.run(tunisToday());

      expect(summary.sent).toBe(1);
      expect(emailService.sendMobileAccessEmail).toHaveBeenCalledTimes(1);
      expect((await mobileRow(id)).mobile_access_email_state).toBe('SENT');
    },
    120000
  );

  test(
    'le compte existant est réutilisé (aucun doublon, rôle inchangé)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const before = await utilisateurRow('candidat@steg.tn');
      expect(before).toBeTruthy();
      expect(before.role).toBe('CANDIDAT');

      const id = await createValidatedCandidature(token, adminToken, rh, open);
      await setStartDate(id, addDays(tunisToday(), 1));
      await job.run(tunisToday());

      const after = await utilisateurRow('candidat@steg.tn');
      expect(after.id).toBe(before.id);
      expect(after.role).toBe('CANDIDAT');
      const { rows } = await pool.query(
        'SELECT COUNT(*) AS n FROM utilisateur WHERE email = $1',
        ['candidat@steg.tn']
      );
      expect(Number(rows[0].n)).toBe(1);
    },
    120000
  );

  test(
    'seul le hash bcrypt est stocké (jamais le mot de passe en clair), et il permet la connexion',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createValidatedCandidature(token, adminToken, rh, open);
      await setStartDate(id, addDays(tunisToday(), 1));
      await job.run(tunisToday());

      const [to, payload] = emailService.sendMobileAccessEmail.mock.calls[0];
      const user = await utilisateurRow('candidat@steg.tn');
      expect(user.mot_de_passe).toMatch(/^\$2/);
      expect(user.mot_de_passe).not.toContain(payload.password);
      expect(await bcrypt.compare(payload.password, user.mot_de_passe)).toBe(true);

      const newLogin = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: to, password: payload.password })
      });
      expect(newLogin.status).toBe(200);

      const oldLogin = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: to, password: 'Candidat123!' })
      });
      expect(oldLogin.status).toBe(401);
    },
    120000
  );

  test(
    'le mot de passe en clair n\'est jamais exposé par l\'API (RH ni candidat)',
    async () => {
      const rh = await loginRH();
      const id = await createValidatedCandidature(await loginCandidat(), adminToken, rh, open);
      await setStartDate(id, addDays(tunisToday(), 1));
      await job.run(tunisToday());

      const [to, payload] = emailService.sendMobileAccessEmail.mock.calls[0];

      const rhRes = await authed(`${BASE}/candidatures/${id}`, rh);
      expect(rhRes.status).toBe(200);
      const rhBody = await rhRes.json();
      expect(rhBody.mobile_access).toBeTruthy();
      expect(rhBody.mobile_access.email_state).toBe('SENT');
      expect(rhBody.mobile_access.email_sent_at).toBeTruthy();
      expect(rhBody.mobile_access.email_planned_for).toBe(tunisToday());
      expect(JSON.stringify(rhBody)).not.toContain(payload.password);
      expect(JSON.stringify(rhBody)).not.toContain('mobile_access_credentials_encrypted');

      candidatToken = null;
      const hash = await bcrypt.hash('Candidat123!', 12);
      await pool.query("UPDATE utilisateur SET mot_de_passe = $1, token_version = 0 WHERE email = 'candidat@steg.tn'", [hash]);
      const freshToken = await loginCandidat();
      const mineRes = await authed(`${BASE}/candidatures/mes-candidatures`, freshToken);
      expect(mineRes.status).toBe(200);
      const mineBody = await mineRes.json();
      const mine = mineBody.candidatures.find((c) => c.id === id);
      expect(mine).toBeTruthy();
      expect(mine.mobile_access.email_sent_at).toBeTruthy();
      expect(mine.mobile_access.email_planned_for).toBe(tunisToday());
      expect(JSON.stringify(mineBody)).not.toContain(payload.password);
      expect(JSON.stringify(mineBody)).not.toContain('mobile_access_credentials_encrypted');
    },
    120000
  );

  test(
    'l\'email d\'accès n\'est envoyé qu\'une seule fois (idempotence du job)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createValidatedCandidature(token, adminToken, rh, open);
      await setStartDate(id, addDays(tunisToday(), 1));

      await job.run(tunisToday());
      const summary = await job.run(tunisToday());

      expect(summary.sent).toBe(0);
      expect(emailService.sendMobileAccessEmail).toHaveBeenCalledTimes(1);
      expect((await mobileRow(id)).mobile_access_email_state).toBe('SENT');
    },
    120000
  );

  test(
    'échec d\'envoi → état ERROR puis nouvelle tentative avec le MÊME mot de passe',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createValidatedCandidature(token, adminToken, rh, open);
      await setStartDate(id, addDays(tunisToday(), 1));

      emailService.sendMobileAccessEmail.mockResolvedValue(false);
      let summary = await job.run(tunisToday());
      expect(summary.sent).toBe(0);
      let row = await mobileRow(id);
      expect(row.mobile_access_email_state).toBe('ERROR');
      expect(row.mobile_access_email_sent_at).toBeNull();
      expect(row.mobile_access_email_error).toBeTruthy();
      expect(row.mobile_access_credentials_encrypted).toBeTruthy();

      emailService.sendMobileAccessEmail.mockRejectedValue(new Error('SMTP down'));
      summary = await job.run(tunisToday());
      expect(summary.sent).toBe(0);
      expect((await mobileRow(id)).mobile_access_email_state).toBe('ERROR');

      const p1 = emailService.sendMobileAccessEmail.mock.calls[0][1].password;
      const p2 = emailService.sendMobileAccessEmail.mock.calls[1][1].password;
      expect(p2).toBe(p1);

      emailService.sendMobileAccessEmail.mockResolvedValue(true);
      summary = await job.run(tunisToday());
      expect(summary.sent).toBe(1);
      expect(emailService.sendMobileAccessEmail).toHaveBeenCalledTimes(3);

      row = await mobileRow(id);
      expect(row.mobile_access_email_state).toBe('SENT');
      expect(row.mobile_access_email_sent_at).toBeTruthy();
      expect(row.mobile_access_credentials_encrypted).toBeNull();
    },
    120000
  );

  test(
    'lien de téléchargement : présent quand MOBILE_APP_DOWNLOAD_URL est configurée',
    async () => {
      process.env.MOBILE_APP_DOWNLOAD_URL = 'https://play.google.com/store/apps/details?id=steg.tn.app';
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createValidatedCandidature(token, adminToken, rh, open);
      await setStartDate(id, addDays(tunisToday(), 1));

      await job.run(tunisToday());

      const payload = emailService.sendMobileAccessEmail.mock.calls[0][1];
      expect(payload.downloadUrl).toBe('https://play.google.com/store/apps/details?id=steg.tn.app');
    },
    120000
  );

  test(
    'lien de téléchargement : absent quand MOBILE_APP_DOWNLOAD_URL n\'est pas configurée',
    async () => {
      delete process.env.MOBILE_APP_DOWNLOAD_URL;
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createValidatedCandidature(token, adminToken, rh, open);
      await setStartDate(id, addDays(tunisToday(), 1));

      await job.run(tunisToday());

      const payload = emailService.sendMobileAccessEmail.mock.calls[0][1];
      expect(payload.downloadUrl).toBe('');
    },
    120000
  );

  test(
    'plusieurs candidatures arrivées à échéance → toutes sont servies',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      await resetCandidateData();
      const a = await createValidatedCandidature(token, adminToken, rh, open);
      const b = await createValidatedCandidature(token, adminToken, rh, open);
      const c = await createValidatedCandidature(token, adminToken, rh, open);
      await setStartDate(a, addDays(tunisToday(), 1));
      await setStartDate(b, tunisToday());
      await setStartDate(c, addDays(tunisToday(), 3));

      const summary = await job.run(tunisToday());

      expect(summary.sent).toBe(2);
      expect(emailService.sendMobileAccessEmail).toHaveBeenCalledTimes(2);
      expect((await mobileRow(a)).mobile_access_email_state).toBe('SENT');
      expect((await mobileRow(b)).mobile_access_email_state).toBe('SENT');
      expect((await mobileRow(c)).mobile_access_email_state).toBe('PENDING');
    },
    120000
  );

  test(
    'aucun endpoint de génération : accès anonyme refusé (401)',
    async () => {
      const res = await fetch(`${BASE}/candidatures/x/mobile-access/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      expect(res.status).toBe(401);
    }
  );

  test(
    'aucun endpoint de génération : route inexistante (404) et accès croisé verrouillé (403)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createValidatedCandidature(token, adminToken, rh, open);

      const rhPrep = await authed(`${BASE}/candidatures/${id}/mobile-access/prepare`, rh, {
        method: 'POST',
        body: JSON.stringify({})
      });
      expect(rhPrep.status).toBe(404);

      const candPrep = await authed(`${BASE}/candidatures/${id}/mobile-access/prepare`, token, {
        method: 'POST',
        body: JSON.stringify({})
      });
      expect(candPrep.status).toBe(404);

      const candDetails = await authed(`${BASE}/candidatures/${id}`, token);
      expect(candDetails.status).toBe(200);

      const rhAsCandidate = await authed(`${BASE}/candidatures/${id}/stage-preferences`, rh, {
        method: 'PUT',
        body: JSON.stringify({ internship_start_date: futureDate(40), internship_duration_months: 3 })
      });
      expect(rhAsCandidate.status).toBe(403);
    },
    120000
  );

  test(
    'stagiaire créé (STAGIAIRE_CREATED) à J-1 → email envoyé',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createConvertedTrainee(token, adminToken, rh, open);
      await setStartDate(id, addDays(tunisToday(), 1));

      const summary = await job.run(tunisToday());

      expect(summary).toEqual({ date: tunisToday(), total: 1, sent: 1 });
      expect(emailService.sendMobileAccessEmail).toHaveBeenCalledTimes(1);

      const { email, prenom, nom } = await candidateEmail(id);
      const [to, payload] = emailService.sendMobileAccessEmail.mock.calls[0];
      expect(to).toBe(email);
      expect(payload.nom).toBe([prenom, nom].filter(Boolean).join(' '));
      expect(payload.username).toBe(email);
      expect(payload.password).toBeTruthy();

      const row = await mobileRow(id);
      expect(row.mobile_access_email_state).toBe('SENT');
      expect(row.mobile_access_email_sent_at).toBeTruthy();
      expect(row.mobile_access_credentials_encrypted).toBeNull();
    },
    120000
  );

  test(
    'stagiaire créé à J-2 → aucun email d\'accès',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createConvertedTrainee(token, adminToken, rh, open);
      await setStartDate(id, addDays(tunisToday(), 2));

      const summary = await job.run(tunisToday());
      expect(summary.sent).toBe(0);
      expect(emailService.sendMobileAccessEmail).not.toHaveBeenCalled();
      expect((await mobileRow(id)).mobile_access_email_state).toBe('PENDING');
    },
    120000
  );

  test(
    'stagiaire créé dont l\'email a déjà été envoyé → pas de doublon',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createConvertedTrainee(token, adminToken, rh, open);
      await setStartDate(id, addDays(tunisToday(), 1));

      await job.run(tunisToday());
      const summary = await job.run(tunisToday());

      expect(summary.sent).toBe(0);
      expect(emailService.sendMobileAccessEmail).toHaveBeenCalledTimes(1);
      expect((await mobileRow(id)).mobile_access_email_state).toBe('SENT');
    },
    120000
  );

  test(
    'lot mixte HUMAN_INTERVIEW_ACCEPTED + STAGIAIRE_CREATED → les deux sont servis',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      await resetCandidateData();
      const accepted = await createValidatedCandidature(token, adminToken, rh, open);
      const converted = await createConvertedTrainee(token, adminToken, rh, open);
      await setStartDate(accepted, addDays(tunisToday(), 1));
      await setStartDate(converted, tunisToday());

      const summary = await job.run(tunisToday());

      expect(summary.sent).toBe(2);
      expect(emailService.sendMobileAccessEmail).toHaveBeenCalledTimes(2);
      expect((await mobileRow(accepted)).mobile_access_email_state).toBe('SENT');
      expect((await mobileRow(converted)).mobile_access_email_state).toBe('SENT');
    },
    120000
  );

  test(
    'le mot de passe en clair n\'est jamais exposé par l\'API pour un stagiaire créé',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createConvertedTrainee(token, adminToken, rh, open);
      await setStartDate(id, addDays(tunisToday(), 1));
      await job.run(tunisToday());

      const [, payload] = emailService.sendMobileAccessEmail.mock.calls[0];

      const rhRes = await authed(`${BASE}/candidatures/${id}`, rh);
      expect(rhRes.status).toBe(200);
      const rhBody = await rhRes.json();
      expect(JSON.stringify(rhBody)).not.toContain(payload.password);
      expect(JSON.stringify(rhBody)).not.toContain('mobile_access_credentials_encrypted');
    },
    120000
  );
});
