const BASE = 'http://localhost:3000/api';

require('dotenv').config();
const pool = require('../config/db');
const bcrypt = require('bcrypt');

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
  const mineRes = await authed(`${BASE}/candidatures/mes-offres`, token);
  expect(mineRes.status).toBe(200);
  const mine = await mineRes.json();
  const applied = new Set((mine.offre_ids || []));

  let target = open.find((o) => !applied.has(o.id) && o.nombre_places > 0);
  if (!target) {
    const list = await (await authed(`${BASE}/candidatures/mes-candidatures`, token)).json();
    const toFree = (list.candidatures || [])[0];
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

async function applyToOffer(token) {
  const target = await pickFreeOffer(token, adminToken, open);
  const applyRes = await authed(`${BASE}/candidatures`, token, {
    method: 'POST',
    body: JSON.stringify({ offre_id: target.id })
  });
  expect(applyRes.status).toBe(201);
  const { candidature } = await applyRes.json();
  return { id: candidature.id, offre_id: target.id, offre_titre: target.titre };
}

/** Crée un second compte CANDIDAT en base (pour tester l'isolation). */
async function createOtherCandidate() {
  const email = `autre-candidat-${Date.now()}@steg.tn`;
  const pwd = await bcrypt.hash('Candidat123!', 10);
  const { rows } = await pool.query(
    `INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone, adresse, role, email_verifie)
     VALUES ('Autre', 'Candidat', $1, $2, '+216 00 000 000', 'Tunis', 'CANDIDAT', true)
     RETURNING id`,
    [email, pwd]
  );
  await pool.query(
    `INSERT INTO candidat (id, universite, specialite, niveau, competences, langues)
     VALUES ($1, 'FST', 'Informatique', 'Licence', 'Python', 'Français')`,
    [rows[0].id]
  );
  return email;
}

const VALID = {
  date: '2026-09-10',
  heure: '10:30',
  duree: 45,
  interviewer: 'Salma Bouazizi',
  interviewer_email: 'salma.bouazizi@steg.tn',
  lien_visio: 'https://teams.microsoft.com/l/meetup-join/meeting/read-test'
};

describe('Lecture côté candidat — Mes candidatures (intégration)', () => {
  beforeAll(async () => {
    adminToken = await loginAdmin();
    const offresRes = await fetch(`${BASE}/public/offres`);
    expect(offresRes.status).toBe(200);
    open = await offresRes.json();
    expect(open.length).toBeGreaterThan(0);

    const { rows: users } = await pool.query(
      'SELECT id FROM utilisateur WHERE email = $1',
      ['candidat@steg.tn']
    );
    if (users[0]) {
      await pool.query('DELETE FROM human_interviews WHERE candidature_id IN (SELECT id FROM candidature WHERE candidat_id = $1)', [users[0].id]);
      await pool.query('DELETE FROM ai_interview_sessions WHERE candidature_id IN (SELECT id FROM candidature WHERE candidat_id = $1)', [users[0].id]);
      await pool.query('DELETE FROM candidature WHERE candidat_id = $1', [users[0].id]);
    }
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
    'le candidat liste ses candidatures (id, offre, statut, date)',
    async () => {
      const token = await loginCandidat();
      const { id, offre_titre } = await applyToOffer(token);
      created.push(id);

      const res = await authed(`${BASE}/candidatures/mes-candidatures`, token);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.candidatures)).toBe(true);

      const mine = body.candidatures.find((c) => c.id === id);
      expect(mine).toBeTruthy();
      expect(mine.offre_id).toBeTruthy();
      expect(mine.offre_titre).toBe(offre_titre);
      expect(mine.statut).toBe('EN_ATTENTE');
      expect(mine.date_candidature).toBeTruthy();
      expect(mine.departement_nom).toBeTruthy();
    },
    90000
  );

  test(
    'un autre candidat ne voit pas la candidature du premier (isolation)',
    async () => {
      const token = await loginCandidat();
      const { id } = await applyToOffer(token);
      created.push(id);

      const otherEmail = await createOtherCandidate();
      const otherToken = await login(otherEmail, 'Candidat123!');

      const otherRes = await authed(`${BASE}/candidatures/mes-candidatures`, otherToken);
      expect(otherRes.status).toBe(200);
      const otherBody = await otherRes.json();
      const found = (otherBody.candidatures || []).find((c) => c.id === id);
      expect(found).toBeUndefined();
    },
    90000
  );

  test(
    'un candidat non connecté est rejeté (401)',
    async () => {
      const res = await fetch(`${BASE}/candidatures/mes-candidatures`);
      expect(res.status).toBe(401);
    },
    45000
  );

  test(
    'la candidature liste puis l’entretien humain associé (lecture seule, portail candidat)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await applyToOffer(token);
      created.push(id);

      const putRes = await authed(`${BASE}/candidatures/${id}`, rh, {
        method: 'PUT',
        body: JSON.stringify({ statut: 'RH_ACCEPTED' })
      });
      expect(putRes.status).toBe(200);
      await pool.query("UPDATE candidature SET statut = 'AI_INTERVIEW_PASSED' WHERE id = $1", [id]);

      const schedule = await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
        method: 'POST',
        body: JSON.stringify(VALID)
      });
      expect(schedule.status).toBe(200);

      const listRes = await authed(`${BASE}/candidatures/mes-candidatures`, token);
      const listBody = await listRes.json();
      const mine = listBody.candidatures.find((c) => c.id === id);
      expect(mine).toBeTruthy();
      expect(mine.statut).toBe('EN_ENTRETIEN_HUMAIN');

      const interviewRes = await authed(`${BASE}/candidatures/${id}/entretien-humain`, token);
      expect(interviewRes.status).toBe(200);
      const interviewBody = await interviewRes.json();
      expect(interviewBody.interview).toMatchObject({
        date: '2026-09-10',
        heure: '10:30',
        duree: 45,
        lien_visio: VALID.lien_visio,
        statut: 'PLANIFIE'
      });
    },
    120000
  );
});
