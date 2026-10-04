const BASE = 'http://localhost:3000/api';

require('dotenv').config();
const pool = require('../config/db');

let candidatToken = null;
let adminToken = null;
let rhToken = null;
let rhUserId = null;
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

/**
 * Candidature prête à la planification : le candidat postule, le RH accepte
 * pour l'entretien IA, puis la candidature est passée en AI_INTERVIEW_PASSED.
 */
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

/** Candidature avec un entretien humain planifié (statut EN_ENTRETIEN_HUMAIN). */
async function createScheduledInterview(token, adminToken, rh, open) {
  const { id } = await createPassedCandidature(token, adminToken, rh, open);
  created.push(id);
  const res = await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
    method: 'POST',
    body: JSON.stringify({
      date: '2026-09-10',
      heure: '10:30',
      duree: 45,
      interviewer: 'Salma Bouazizi',
      interviewer_email: 'salma.bouazizi@steg.tn',
      lien_visio: 'https://teams.microsoft.com/l/meetup-join/meeting/completion-test'
    })
  });
  expect(res.status).toBe(200);
  return id;
}

async function humanInterview(id) {
  const { rows } = await pool.query(
    `SELECT h.id, h.statut, h.completed_at, h.completed_by, c.statut AS candidature_statut
     FROM human_interviews h
     JOIN candidature c ON c.id = h.candidature_id
     WHERE h.candidature_id = $1`,
    [id]
  );
  return rows[0];
}

describe('Achèvement de l’entretien humain (intégration)', () => {
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

    const { rows: rh } = await pool.query(
      'SELECT id FROM utilisateur WHERE email = $1',
      ['salma.bouazizi@steg.tn']
    );
    rhUserId = rh[0].id;
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
    'RH marque l’entretien comme terminé : statuts HUMAN_INTERVIEW_COMPLETED',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createScheduledInterview(token, adminToken, rh, open);

      const res = await authed(`${BASE}/candidatures/${id}/entretien-humain/completion`, rh, {
        method: 'POST'
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toContain('complété');
      expect(body).toMatchObject({
        candidature_id: id,
        statut: 'HUMAN_INTERVIEW_COMPLETED'
      });

      const row = await humanInterview(id);
      expect(row.statut).toBe('HUMAN_INTERVIEW_COMPLETED');
      expect(row.candidature_statut).toBe('HUMAN_INTERVIEW_COMPLETED');

      const details = await (await authed(`${BASE}/candidatures/${id}`, rh)).json();
      expect(details.statut).toBe('HUMAN_INTERVIEW_COMPLETED');
      expect(details.human_interview).toMatchObject({ statut: 'HUMAN_INTERVIEW_COMPLETED' });
    },
    45000
  );

  test(
    'completed_at est enregistré',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createScheduledInterview(token, adminToken, rh, open);

      const res = await authed(`${BASE}/candidatures/${id}/entretien-humain/completion`, rh, {
        method: 'POST'
      });
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.completed_at).toBeTruthy();
      expect(new Date(body.completed_at).getTime()).not.toBeNaN();

      const row = await humanInterview(id);
      expect(row.completed_at).toBeTruthy();
    },
    45000
  );

  test(
    'completed_by est enregistré (utilisateur RH)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createScheduledInterview(token, adminToken, rh, open);

      const res = await authed(`${BASE}/candidatures/${id}/entretien-humain/completion`, rh, {
        method: 'POST'
      });
      expect(res.status).toBe(200);

      const row = await humanInterview(id);
      expect(row.completed_by).toBe(rhUserId);

      const details = await (await authed(`${BASE}/candidatures/${id}`, rh)).json();
      expect(details.human_interview.completed_by).toBe(rhUserId);
    },
    45000
  );

  test(
    'un candidat ne peut pas marquer l’entretien comme terminé (403)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createScheduledInterview(token, adminToken, rh, open);

      const res = await authed(`${BASE}/candidatures/${id}/entretien-humain/completion`, token, {
        method: 'POST'
      });
      expect(res.status).toBe(403);

      const row = await humanInterview(id);
      expect(row.statut).toBe('PLANIFIE');
      expect(row.completed_at).toBeNull();
      expect(row.completed_by).toBeNull();
    },
    45000
  );

  test(
    'un entretien annulé ne peut pas être complété (400)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createScheduledInterview(token, adminToken, rh, open);

      const cancel = await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
        method: 'DELETE'
      });
      expect(cancel.status).toBe(200);

      const res = await authed(`${BASE}/candidatures/${id}/entretien-humain/completion`, rh, {
        method: 'POST'
      });
      expect(res.status).toBe(400);

      const row = await humanInterview(id);
      expect(row.statut).toBe('ANNULE');
      expect(row.completed_at).toBeNull();
    },
    45000
  );

  test(
    'un entretien déjà complété ne peut pas être complété deux fois (400)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createScheduledInterview(token, adminToken, rh, open);

      const first = await authed(`${BASE}/candidatures/${id}/entretien-humain/completion`, rh, {
        method: 'POST'
      });
      expect(first.status).toBe(200);

      const second = await authed(`${BASE}/candidatures/${id}/entretien-humain/completion`, rh, {
        method: 'POST'
      });
      expect(second.status).toBe(400);
    },
    45000
  );

  test(
    'un entretien hors workflow RH ne peut pas être complété (400)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await createPassedCandidature(token, adminToken, rh, open);
      created.push(id);

      const res = await authed(`${BASE}/candidatures/${id}/entretien-humain/completion`, rh, {
        method: 'POST'
      });
      expect(res.status).toBe(400);
    },
    45000
  );

  test(
    'une candidature inexistante renvoie 404',
    async () => {
      const rh = await loginRH();
      const res = await authed(
        `${BASE}/candidatures/00000000-0000-0000-0000-000000000000/entretien-humain/completion`,
        rh,
        { method: 'POST' }
      );
      expect(res.status).toBe(404);
    },
    45000
  );
});
