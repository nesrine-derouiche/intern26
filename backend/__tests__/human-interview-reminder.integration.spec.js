const BASE = 'http://localhost:3000/api';

require('dotenv').config();
const pool = require('../config/db');

jest.mock('../services/email.service', () => ({
  sendHumanInterviewReminderEmail: jest.fn()
}));

const emailService = require('../services/email.service');
const job = require('../services/human-interview-reminder.job');

let candidatToken = null;
let adminToken = null;
let rhToken = null;
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

/** Candidature prête (AI_INTERVIEW_PASSED) pour une planification RH. */
async function createPassedCandidature(token, adminToken, rh, open) {
  const target = await pickFreeOffer(token, adminToken, open);
  const applyRes = await authed(`${BASE}/candidatures`, token, {
    method: 'POST',
    body: JSON.stringify({ offre_id: target.id })
  });
  expect(applyRes.status).toBe(201);
  const { candidature } = await applyRes.json();

  const putRes = await authed(`${BASE}/candidatures/${candidature.id}`, rh, {
    method: 'PUT',
    body: JSON.stringify({ statut: 'RH_ACCEPTED' })
  });
  expect(putRes.status).toBe(200);

  await pool.query("UPDATE candidature SET statut = 'AI_INTERVIEW_PASSED' WHERE id = $1", [candidature.id]);
  return { id: candidature.id, offre: { id: target.id, nombre_places: target.nombre_places } };
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

/** Insère directement un entretien humain (la planification via API exige un futur strict). */
async function insertInterview(candidatureId, overrides = {}) {
  const {
    date = tunisToday(),
    heure = '10:00',
    duree = 45,
    interviewer = 'Salma Bouazizi',
    interviewerEmail = 'salma.bouazizi@steg.tn',
    lienVisio = 'https://teams.microsoft.com/l/meetup-join/reminder-test',
    statut = 'PLANIFIE',
    reminderSent = false
  } = overrides;
  const { rows } = await pool.query(
    `INSERT INTO human_interviews (candidature_id, date, heure, duree, interviewer, interviewer_email, lien_visio, statut, human_interview_reminder_sent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [candidatureId, date, heure, duree, interviewer, interviewerEmail, lienVisio, statut, reminderSent]
  );
  return rows[0].id;
}

/** Email + prénom réels du candidat stockés en base. */
async function candidateEmail(candidatureId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(cu.email, su.email) AS email, COALESCE(cu.prenom, su.prenom) AS prenom
     FROM candidature c
     LEFT JOIN utilisateur su ON su.id = c.stagiaire_id
     LEFT JOIN utilisateur cu ON cu.id = c.candidat_id
     WHERE c.id = $1`,
    [candidatureId]
  );
  return rows[0];
}

async function reminderSent(interviewId) {
  const { rows } = await pool.query(
    'SELECT human_interview_reminder_sent FROM human_interviews WHERE id = $1',
    [interviewId]
  );
  return rows[0].human_interview_reminder_sent;
}

/** Supprime les candidatures et entretiens du candidat de test (état vierge). */
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

describe('Rappel automatique de l’entretien humain (jour J)', () => {
  beforeAll(async () => {
    adminToken = await loginAdmin();
    const offresRes = await fetch(`${BASE}/public/offres`);
    expect(offresRes.status).toBe(200);
    open = await offresRes.json();
    await resetCandidateData();
  });

  beforeEach(() => {
    emailService.sendHumanInterviewReminderEmail.mockReset();
    emailService.sendHumanInterviewReminderEmail.mockResolvedValue(true);
  });

  afterAll(async () => {
    for (const id of created) {
      await authed(`${BASE}/candidatures/${id}`, adminToken, { method: 'DELETE' });
    }
    for (const id of created) {
      await pool.query('DELETE FROM human_interviews WHERE candidature_id = $1', [id]);
      await pool.query('DELETE FROM ai_interview_sessions WHERE candidature_id = $1', [id]);
    }
    await pool.end();
  });

  test(
    'entretien aujourd’hui → le rappel est envoyé et marqué',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await createPassedCandidature(token, adminToken, rh, open);
      created.push(id);
      const interviewId = await insertInterview(id);

      const summary = await job.run();

      expect(summary).toEqual({ date: tunisToday(), total: 1, sent: 1 });
      expect(emailService.sendHumanInterviewReminderEmail).toHaveBeenCalledTimes(1);

      const { email, prenom } = await candidateEmail(id);
      expect(email).toBeTruthy();
      const [to, payload] = emailService.sendHumanInterviewReminderEmail.mock.calls[0];
      expect(to).toBe(email);
      expect(payload.nom).toBe(prenom);
      expect(payload.titreOffre).toBeTruthy();
      expect(payload.date).toBe(tunisToday().split('-').reverse().join('/'));
      expect(payload.heure).toBe('10:00');
      expect(payload.duree).toBe('45 minutes');
      expect(payload.interviewer).toBe('Salma Bouazizi');
      expect(payload.lienVisio).toContain('reminder-test');
      expect(await reminderSent(interviewId)).toBe(true);
    },
    45000
  );

  test(
    'entretien demain → aucun rappel',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await createPassedCandidature(token, adminToken, rh, open);
      created.push(id);
      const interviewId = await insertInterview(id, { date: addDays(tunisToday(), 1) });

      const summary = await job.run();

      expect(summary.sent).toBe(0);
      expect(emailService.sendHumanInterviewReminderEmail).not.toHaveBeenCalled();
      expect(await reminderSent(interviewId)).toBe(false);
    },
    45000
  );

  test(
    'entretien hier → aucun rappel',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await createPassedCandidature(token, adminToken, rh, open);
      created.push(id);
      const interviewId = await insertInterview(id, { date: addDays(tunisToday(), -1) });

      const summary = await job.run();

      expect(summary.sent).toBe(0);
      expect(emailService.sendHumanInterviewReminderEmail).not.toHaveBeenCalled();
      expect(await reminderSent(interviewId)).toBe(false);
    },
    45000
  );

  test(
    'rappel déjà envoyé → aucun email en double',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await createPassedCandidature(token, adminToken, rh, open);
      created.push(id);
      const interviewId = await insertInterview(id, { reminderSent: true });

      const summary = await job.run();

      expect(summary.sent).toBe(0);
      expect(emailService.sendHumanInterviewReminderEmail).not.toHaveBeenCalled();
      expect(await reminderSent(interviewId)).toBe(true);
    },
    45000
  );

  test(
    'plusieurs entretiens aujourd’hui → tous les candidats concernés reçoivent leur email',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      await resetCandidateData();
      const a = await createPassedCandidature(token, adminToken, rh, open);
      const b = await createPassedCandidature(token, adminToken, rh, open);
      const c = await createPassedCandidature(token, adminToken, rh, open);
      created.push(a.id, b.id, c.id);

      const ia = await insertInterview(a.id, { interviewer: 'Salma Bouazizi' });
      const ib = await insertInterview(b.id, { interviewer: 'Yosra Karray', lienVisio: 'https://meet.steg.tn/b' });
      const ic = await insertInterview(c.id, { date: addDays(tunisToday(), 1), interviewer: 'Sami Trabelsi' });

      const summary = await job.run();

      expect(summary.sent).toBe(2);
      expect(emailService.sendHumanInterviewReminderEmail).toHaveBeenCalledTimes(2);

      const calls = emailService.sendHumanInterviewReminderEmail.mock.calls;
      expect(calls).toHaveLength(2);

      const { email: emailA } = await candidateEmail(a.id);
      for (const [to] of calls) expect(to).toBe(emailA);

      const interviewers = calls.map((call) => call[1].interviewer);
      expect(interviewers).toEqual(expect.arrayContaining(['Salma Bouazizi', 'Yosra Karray']));
      expect(interviewers).not.toContain('Sami Trabelsi');

      expect(await reminderSent(ia)).toBe(true);
      expect(await reminderSent(ib)).toBe(true);
      expect(await reminderSent(ic)).toBe(false);
    },
    120000
  );

  test(
    'échec d’envoi → le rappel reste non marqué et est retenté ensuite',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await createPassedCandidature(token, adminToken, rh, open);
      created.push(id);
      const interviewId = await insertInterview(id);

      emailService.sendHumanInterviewReminderEmail.mockResolvedValue(false);
      let summary = await job.run();
      expect(summary.sent).toBe(0);
      expect(await reminderSent(interviewId)).toBe(false);

      emailService.sendHumanInterviewReminderEmail.mockRejectedValue(new Error('SMTP down'));
      summary = await job.run();
      expect(summary.sent).toBe(0);
      expect(await reminderSent(interviewId)).toBe(false);

      emailService.sendHumanInterviewReminderEmail.mockResolvedValue(true);
      summary = await job.run();
      expect(summary.sent).toBe(1);
      expect(emailService.sendHumanInterviewReminderEmail).toHaveBeenCalledTimes(3);
      expect(await reminderSent(interviewId)).toBe(true);
    },
    45000
  );

  test(
    'entretien annulé → aucun rappel',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await createPassedCandidature(token, adminToken, rh, open);
      created.push(id);
      const interviewId = await insertInterview(id, { statut: 'ANNULE' });

      const summary = await job.run();

      expect(summary.sent).toBe(0);
      expect(emailService.sendHumanInterviewReminderEmail).not.toHaveBeenCalled();
      expect(await reminderSent(interviewId)).toBe(false);
    },
    45000
  );

  test(
    'entretien replanifié → le rappel utilise le nouveau créneau',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await createPassedCandidature(token, adminToken, rh, open);
      created.push(id);
      const interviewId = await insertInterview(id, {
        date: addDays(tunisToday(), 1),
        heure: '09:00',
        interviewer: 'Salma Bouazizi'
      });

      // Le RH replanifie l'entretien à aujourd'hui (nouveau créneau).
      await pool.query(
        `UPDATE human_interviews
         SET date = $1, heure = '14:30', duree = 60, interviewer = 'Yosra Karray',
             lien_visio = $2, statut = 'PLANIFIE', updated_at = now()
         WHERE id = $3`,
        [tunisToday(), 'https://teams.microsoft.com/l/meetup-join/rescheduled', interviewId]
      );

      const summary = await job.run();

      expect(summary.sent).toBe(1);
      expect(emailService.sendHumanInterviewReminderEmail).toHaveBeenCalledTimes(1);
      const [, payload] = emailService.sendHumanInterviewReminderEmail.mock.calls[0];
      expect(payload.date).toBe(tunisToday().split('-').reverse().join('/'));
      expect(payload.heure).toBe('14:30');
      expect(payload.duree).toBe('60 minutes');
      expect(payload.interviewer).toBe('Yosra Karray');
      expect(payload.lienVisio).toContain('rescheduled');
      expect(await reminderSent(interviewId)).toBe(true);
    },
    45000
  );
});
