const BASE = 'http://localhost:3000/api';

require('dotenv').config();
const pool = require('../config/db');
const bcrypt = require('bcrypt');

let candidatToken = null;
let adminToken = null;
let rhToken = null;
let otherToken = null;
let otherCandidateId = null;
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

async function loginOtherCandidate() {
  if (otherToken) return otherToken;
  otherToken = await login('autre.candidat@steg.tn', 'AutreCandidat123!');
  return otherToken;
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

/** Candidature prête à la planification (postulée + RH_ACCEPTED + AI_INTERVIEW_PASSED). */
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

/** Candidature acceptée après l'entretien humain (statut HUMAN_INTERVIEW_ACCEPTED). */
async function createAcceptedCandidature(token, adminToken, rh, open) {
  const { id } = await createPassedCandidature(token, adminToken, rh, open);
  created.push(id);

  const schedule = await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
    method: 'POST',
    body: JSON.stringify({
      date: '2026-09-10',
      heure: '10:30',
      duree: 45,
      interviewer: 'Salma Bouazizi',
      interviewer_email: 'salma.bouazizi@steg.tn',
      lien_visio: 'https://teams.microsoft.com/l/meetup-join/meeting/stage-preferences-test'
    })
  });
  expect(schedule.status).toBe(200);

  const complete = await authed(`${BASE}/candidatures/${id}/entretien-humain/completion`, rh, {
    method: 'POST'
  });
  expect(complete.status).toBe(200);

  const decision = await authed(`${BASE}/candidatures/${id}/entretien-humain/decision`, rh, {
    method: 'POST',
    body: JSON.stringify({ decision: 'ACCEPTED' })
  });
  expect(decision.status).toBe(200);
  return id;
}

/** Date strictement future (YYYY-MM-DD) dans le fuseau Africa/Tunis. */
function futureDate(daysFromNow = 30) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }));
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) + daysFromNow * 86400000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Date du jour (YYYY-MM-DD) dans le fuseau Africa/Tunis (donc non future). */
function todayDate() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }));
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

async function prefRow(id) {
  const { rows } = await pool.query(
    `SELECT internship_start_date, internship_duration_months, internship_details_submitted_at
     FROM candidature WHERE id = $1`,
    [id]
  );
  return rows[0];
}

describe('Préférences de stage du candidat (intégration)', () => {
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

    // Second candidat, pour vérifier qu'un candidat ne peut jamais modifier
    // la candidature d'un autre.
    await pool.query('DELETE FROM utilisateur WHERE email = $1', ['autre.candidat@steg.tn']);
    const hash = await bcrypt.hash('AutreCandidat123!', 10);
    const inserted = await pool.query(
      `INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, role, actif, email_verifie)
       VALUES ('Test', 'Autre', $1, $2, 'CANDIDAT', true, true)
       RETURNING id`,
      ['autre.candidat@steg.tn', hash]
    );
    otherCandidateId = inserted.rows[0].id;
    await pool.query('INSERT INTO candidat (id, universite) VALUES ($1, $2)', [otherCandidateId, 'ISET Test']);
  });

  afterAll(async () => {
    for (const id of created) {
      await authed(`${BASE}/candidatures/${id}`, adminToken, { method: 'DELETE' });
    }
    for (const id of created) {
      await pool.query('DELETE FROM human_interviews WHERE candidature_id = $1', [id]);
      await pool.query('DELETE FROM ai_interview_sessions WHERE candidature_id = $1', [id]);
    }
    if (otherCandidateId) {
      await pool.query('DELETE FROM utilisateur WHERE id = $1', [otherCandidateId]);
    }
    await pool.end();
  });

  test(
    'un candidat accepté peut renseigner sa date de début de stage',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createAcceptedCandidature(token, adminToken, rh, open);
      const start = futureDate(21);

      const res = await authed(`${BASE}/candidatures/${id}/stage-preferences`, token, {
        method: 'PUT',
        body: JSON.stringify({ internship_start_date: start, internship_duration_months: 2 })
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        id,
        statut: 'HUMAN_INTERVIEW_ACCEPTED',
        internship_start_date: start,
        internship_duration_months: 2
      });
      expect(body.internship_details_submitted_at).toBeTruthy();

      const row = await prefRow(id);
      expect(row.internship_duration_months).toBe(2);
      expect(row.internship_details_submitted_at).toBeTruthy();
    },
    45000
  );

  test(
    'un candidat accepté peut renseigner la durée de son stage',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createAcceptedCandidature(token, adminToken, rh, open);

      const res = await authed(`${BASE}/candidatures/${id}/stage-preferences`, token, {
        method: 'PUT',
        body: JSON.stringify({ internship_start_date: futureDate(15), internship_duration_months: 3 })
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.internship_duration_months).toBe(3);

      const row = await prefRow(id);
      expect(Number(row.internship_duration_months)).toBe(3);
    },
    45000
  );

  test(
    'le candidat peut mettre à jour ses préférences tant que le RH n’a pas validé',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createAcceptedCandidature(token, adminToken, rh, open);

      await authed(`${BASE}/candidatures/${id}/stage-preferences`, token, {
        method: 'PUT',
        body: JSON.stringify({ internship_start_date: futureDate(20), internship_duration_months: 1 })
      });
      const second = await authed(`${BASE}/candidatures/${id}/stage-preferences`, token, {
        method: 'PUT',
        body: JSON.stringify({ internship_start_date: futureDate(45), internship_duration_months: 4 })
      });
      expect(second.status).toBe(200);
      const body = await second.json();
      expect(body.internship_duration_months).toBe(4);
      expect(body.internship_start_date).toBe(futureDate(45));
    },
    45000
  );

  test(
    'une date de début passée est refusée (400) sans effet de bord',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createAcceptedCandidature(token, adminToken, rh, open);

      const res = await authed(`${BASE}/candidatures/${id}/stage-preferences`, token, {
        method: 'PUT',
        body: JSON.stringify({ internship_start_date: '2020-01-01', internship_duration_months: 2 })
      });
      expect(res.status).toBe(400);

      const row = await prefRow(id);
      expect(row.internship_start_date).toBeNull();
      expect(row.internship_duration_months).toBeNull();
    },
    45000
  );

  test(
    'la date du jour n’est pas une date future (400)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createAcceptedCandidature(token, adminToken, rh, open);

      const res = await authed(`${BASE}/candidatures/${id}/stage-preferences`, token, {
        method: 'PUT',
        body: JSON.stringify({ internship_start_date: todayDate(), internship_duration_months: 2 })
      });
      expect(res.status).toBe(400);
    },
    45000
  );

  test(
    'une durée invalide (0, négative, texte) est refusée (400)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createAcceptedCandidature(token, adminToken, rh, open);

      for (const duration of [0, -2, 'abc', 1.5]) {
        const res = await authed(`${BASE}/candidatures/${id}/stage-preferences`, token, {
          method: 'PUT',
          body: JSON.stringify({ internship_start_date: futureDate(30), internship_duration_months: duration })
        });
        expect(res.status).toBe(400);
      }

      const row = await prefRow(id);
      expect(row.internship_start_date).toBeNull();
      expect(row.internship_duration_months).toBeNull();
    },
    45000
  );

  test(
    'un candidat ne peut pas modifier la candidature d’un autre candidat (403)',
    async () => {
      const token = await loginCandidat();
      const other = await loginOtherCandidate();
      const rh = await loginRH();
      const id = await createAcceptedCandidature(token, adminToken, rh, open);

      const res = await authed(`${BASE}/candidatures/${id}/stage-preferences`, other, {
        method: 'PUT',
        body: JSON.stringify({ internship_start_date: futureDate(30), internship_duration_months: 2 })
      });
      expect(res.status).toBe(403);

      const row = await prefRow(id);
      expect(row.internship_start_date).toBeNull();
    },
    45000
  );

  test(
    'un candidat refusé ne peut pas soumettre de préférences (400)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await createPassedCandidature(token, adminToken, rh, open);
      created.push(id);

      await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
        method: 'POST',
        body: JSON.stringify({
          date: '2026-09-10',
          heure: '11:00',
          duree: 45,
          interviewer: 'Salma Bouazizi',
          interviewer_email: 'salma.bouazizi@steg.tn',
          lien_visio: 'https://teams.microsoft.com/l/meetup-join/meeting/stage-preferences-rejected'
        })
      });
      const complete = await authed(`${BASE}/candidatures/${id}/entretien-humain/completion`, rh, {
        method: 'POST'
      });
      expect(complete.status).toBe(200);
      const decision = await authed(`${BASE}/candidatures/${id}/entretien-humain/decision`, rh, {
        method: 'POST',
        body: JSON.stringify({ decision: 'REJECTED' })
      });
      expect(decision.status).toBe(200);

      const res = await authed(`${BASE}/candidatures/${id}/stage-preferences`, token, {
        method: 'PUT',
        body: JSON.stringify({ internship_start_date: futureDate(30), internship_duration_months: 2 })
      });
      expect(res.status).toBe(400);
    },
    45000
  );

  test(
    'un candidat dont l’entretien humain n’est pas encore accepté ne peut pas soumettre (400)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await createPassedCandidature(token, adminToken, rh, open);
      created.push(id);

      await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
        method: 'POST',
        body: JSON.stringify({
          date: '2026-09-10',
          heure: '11:30',
          duree: 45,
          interviewer: 'Salma Bouazizi',
          interviewer_email: 'salma.bouazizi@steg.tn',
          lien_visio: 'https://teams.microsoft.com/l/meetup-join/meeting/stage-preferences-not-accepted'
        })
      });
      const complete = await authed(`${BASE}/candidatures/${id}/entretien-humain/completion`, rh, {
        method: 'POST'
      });
      expect(complete.status).toBe(200);

      const res = await authed(`${BASE}/candidatures/${id}/stage-preferences`, token, {
        method: 'PUT',
        body: JSON.stringify({ internship_start_date: futureDate(30), internship_duration_months: 2 })
      });
      expect(res.status).toBe(400);
    },
    45000
  );

  test(
    'une candidature encore en attente d’entretien IA ne peut pas soumettre (400)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const target = await pickFreeOffer(token, adminToken, open);
      const applyRes = await authed(`${BASE}/candidatures`, token, {
        method: 'POST',
        body: JSON.stringify({ offre_id: target.id })
      });
      expect(applyRes.status).toBe(201);
      const { candidature } = await applyRes.json();
      created.push(candidature.id);

      const res = await authed(`${BASE}/candidatures/${candidature.id}/stage-preferences`, token, {
        method: 'PUT',
        body: JSON.stringify({ internship_start_date: futureDate(30), internship_duration_months: 2 })
      });
      expect(res.status).toBe(400);
    },
    45000
  );

  test(
    'le RH ne peut pas soumettre les préférences à la place du candidat (403)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createAcceptedCandidature(token, adminToken, rh, open);

      const res = await authed(`${BASE}/candidatures/${id}/stage-preferences`, rh, {
        method: 'PUT',
        body: JSON.stringify({ internship_start_date: futureDate(30), internship_duration_months: 2 })
      });
      expect(res.status).toBe(403);
    },
    45000
  );

  test(
    'le candidat retrouve ses préférences enregistrées dans « mes candidatures »',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createAcceptedCandidature(token, adminToken, rh, open);
      const start = futureDate(25);

      await authed(`${BASE}/candidatures/${id}/stage-preferences`, token, {
        method: 'PUT',
        body: JSON.stringify({ internship_start_date: start, internship_duration_months: 3 })
      });

      const mineRes = await authed(`${BASE}/candidatures/mes-candidatures`, token);
      expect(mineRes.status).toBe(200);
      const { candidatures } = await mineRes.json();
      const mine = candidatures.find((c) => c.id === id);
      expect(mine).toBeTruthy();
      expect(mine.internship_start_date).toBe(start);
      expect(mine.internship_duration_months).toBe(3);
      expect(mine.internship_details_submitted_at).toBeTruthy();
    },
    45000
  );

  test(
    'le RH voit la date de début et la durée choisies dans les détails',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createAcceptedCandidature(token, adminToken, rh, open);
      const start = futureDate(40);

      await authed(`${BASE}/candidatures/${id}/stage-preferences`, token, {
        method: 'PUT',
        body: JSON.stringify({ internship_start_date: start, internship_duration_months: 4 })
      });

      const details = await (await authed(`${BASE}/candidatures/${id}`, rh)).json();
      expect(details.statut).toBe('HUMAN_INTERVIEW_ACCEPTED');
      expect(details.internship_start_date).toBe(start);
      expect(details.internship_duration_months).toBe(4);
      expect(details.internship_details_submitted_at).toBeTruthy();
    },
    45000
  );

  test(
    'le RH voit « non renseigné » tant que le candidat n’a pas soumis',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createAcceptedCandidature(token, adminToken, rh, open);

      const details = await (await authed(`${BASE}/candidatures/${id}`, rh)).json();
      expect(details.internship_start_date).toBeNull();
      expect(details.internship_duration_months).toBeNull();
      expect(details.internship_details_submitted_at).toBeNull();
    },
    45000
  );

  test(
    'une candidature inexistante renvoie 404',
    async () => {
      const token = await loginCandidat();
      const res = await authed(
        `${BASE}/candidatures/00000000-0000-0000-0000-000000000000/stage-preferences`,
        token,
        { method: 'PUT', body: JSON.stringify({ internship_start_date: futureDate(10), internship_duration_months: 2 }) }
      );
      expect(res.status).toBe(404);
    },
    45000
  );
});
