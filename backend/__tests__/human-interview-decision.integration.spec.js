jest.setTimeout(30000);

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

/** Candidature avec entretien humain complété (statut HUMAN_INTERVIEW_COMPLETED). */
async function createCompletedInterview(token, adminToken, rh, open) {
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
      lien_visio: 'https://teams.microsoft.com/l/meetup-join/meeting/decision-test'
    })
  });
  expect(schedule.status).toBe(200);

  const complete = await authed(`${BASE}/candidatures/${id}/entretien-humain/completion`, rh, {
    method: 'POST'
  });
  expect(complete.status).toBe(200);
  expect((await complete.json()).statut).toBe('HUMAN_INTERVIEW_COMPLETED');
  return id;
}

async function decisionRow(id) {
  const { rows } = await pool.query(
    `SELECT c.statut, c.decision, c.decided_by, c.decided_at
     FROM candidature c WHERE c.id = $1`,
    [id]
  );
  return rows[0];
}

async function auditRows(id) {
  const { rows } = await pool.query(
    'SELECT * FROM candidature_decisions WHERE candidature_id = $1 ORDER BY decided_at',
    [id]
  );
  return rows;
}

describe('Décision finale après entretien humain (intégration)', () => {
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
  });

  test(
    'ACCEPTED : candidature en HUMAN_INTERVIEW_ACCEPTED, décision tracée et auditée',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createCompletedInterview(token, adminToken, rh, open);

      const res = await authed(`${BASE}/candidatures/${id}/entretien-humain/decision`, rh, {
        method: 'POST',
        body: JSON.stringify({ decision: 'ACCEPTED' })
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        id,
        statut: 'HUMAN_INTERVIEW_ACCEPTED',
        decision: 'ACCEPTED',
        decided_by: rhUserId
      });
      expect(body.decided_at).toBeTruthy();
      expect(new Date(body.decided_at).getTime()).not.toBeNaN();

      const row = await decisionRow(id);
      expect(row.statut).toBe('HUMAN_INTERVIEW_ACCEPTED');
      expect(row.decision).toBe('ACCEPTED');
      expect(row.decided_by).toBe(rhUserId);
      expect(row.decided_at).toBeTruthy();

      const audit = await auditRows(id);
      expect(audit.length).toBe(1);
      expect(audit[0]).toMatchObject({
        decision: 'ACCEPTED',
        decided_by: rhUserId,
        previous_status: 'HUMAN_INTERVIEW_COMPLETED',
        new_status: 'HUMAN_INTERVIEW_ACCEPTED'
      });
    },
    90000
  );

  test(
    'REJECTED : candidature en HUMAN_INTERVIEW_REJECTED, décision tracée et auditée',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createCompletedInterview(token, adminToken, rh, open);

      const res = await authed(`${BASE}/candidatures/${id}/entretien-humain/decision`, rh, {
        method: 'POST',
        body: JSON.stringify({ decision: 'REJECTED' })
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        id,
        statut: 'HUMAN_INTERVIEW_REJECTED',
        decision: 'REJECTED',
        decided_by: rhUserId
      });

      const row = await decisionRow(id);
      expect(row.statut).toBe('HUMAN_INTERVIEW_REJECTED');
      expect(row.decision).toBe('REJECTED');
      expect(row.decided_by).toBe(rhUserId);

      const audit = await auditRows(id);
      expect(audit.length).toBe(1);
      expect(audit[0]).toMatchObject({
        decision: 'REJECTED',
        previous_status: 'HUMAN_INTERVIEW_COMPLETED',
        new_status: 'HUMAN_INTERVIEW_REJECTED'
      });
    },
    90000
  );

  test(
    'les détails de la candidature exposent la décision',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createCompletedInterview(token, adminToken, rh, open);

      await authed(`${BASE}/candidatures/${id}/entretien-humain/decision`, rh, {
        method: 'POST',
        body: JSON.stringify({ decision: 'ACCEPTED' })
      });

      const details = await (await authed(`${BASE}/candidatures/${id}`, rh)).json();
      expect(details.statut).toBe('HUMAN_INTERVIEW_ACCEPTED');
      expect(details.decision).toBe('ACCEPTED');
      expect(details.decided_by).toBe(rhUserId);
      expect(details.decided_at).toBeTruthy();
      expect(Array.isArray(details.decision_history)).toBe(true);
      expect(details.decision_history.length).toBe(1);
      expect(details.decision_history[0]).toMatchObject({
        decision: 'ACCEPTED',
        previous_status: 'HUMAN_INTERVIEW_COMPLETED',
        new_status: 'HUMAN_INTERVIEW_ACCEPTED'
      });
      expect(details.decision_history[0].decided_by_name).toBeTruthy();
    },
    90000
  );

  test(
    'un candidat ne peut pas prendre la décision finale (403)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createCompletedInterview(token, adminToken, rh, open);

      const res = await authed(`${BASE}/candidatures/${id}/entretien-humain/decision`, token, {
        method: 'POST',
        body: JSON.stringify({ decision: 'ACCEPTED' })
      });
      expect(res.status).toBe(403);

      const row = await decisionRow(id);
      expect(row.statut).toBe('HUMAN_INTERVIEW_COMPLETED');
      expect(row.decision).toBeNull();
    },
    90000
  );

  test(
    'une décision invalide renvoie 400 sans effet de bord',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createCompletedInterview(token, adminToken, rh, open);

      const res = await authed(`${BASE}/candidatures/${id}/entretien-humain/decision`, rh, {
        method: 'POST',
        body: JSON.stringify({ decision: 'MAYBE' })
      });
      expect(res.status).toBe(400);

      const row = await decisionRow(id);
      expect(row.statut).toBe('HUMAN_INTERVIEW_COMPLETED');
      expect(row.decision).toBeNull();
      expect((await auditRows(id)).length).toBe(0);
    },
    90000
  );

  test(
    'une décision avant complétion de l’entretien renvoie 400',
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
          lien_visio: 'https://teams.microsoft.com/l/meetup-join/meeting/decision-early'
        })
      });

      const res = await authed(`${BASE}/candidatures/${id}/entretien-humain/decision`, rh, {
        method: 'POST',
        body: JSON.stringify({ decision: 'ACCEPTED' })
      });
      expect(res.status).toBe(400);
    },
    90000
  );

  test(
    'une décision déjà prise ne peut pas être refaite (400)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createCompletedInterview(token, adminToken, rh, open);

      const first = await authed(`${BASE}/candidatures/${id}/entretien-humain/decision`, rh, {
        method: 'POST',
        body: JSON.stringify({ decision: 'ACCEPTED' })
      });
      expect(first.status).toBe(200);

      const second = await authed(`${BASE}/candidatures/${id}/entretien-humain/decision`, rh, {
        method: 'POST',
        body: JSON.stringify({ decision: 'ACCEPTED' })
      });
      expect(second.status).toBe(400);
      expect((await auditRows(id)).length).toBe(1);
    },
    90000
  );

  test(
    'une candidature inexistante renvoie 404',
    async () => {
      const rh = await loginRH();
      const res = await authed(
        `${BASE}/candidatures/00000000-0000-0000-0000-000000000000/entretien-humain/decision`,
        rh,
        { method: 'POST', body: JSON.stringify({ decision: 'ACCEPTED' }) }
      );
      expect(res.status).toBe(404);
    },
    90000
  );
});

describe('Legacy decision-finale endpoint (délégation aux services modernes)', () => {
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
  });

  test(
    'REJECTED via decision-finale : met en HUMAN_INTERVIEW_REJECTED (pas REFUSEE)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createCompletedInterview(token, adminToken, rh, open);

      const res = await authed(`${BASE}/candidatures/${id}/decision-finale`, rh, {
        method: 'POST',
        body: JSON.stringify({ decision: 'REJECTED' })
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.statut).toBe('HUMAN_INTERVIEW_REJECTED');

      const row = await decisionRow(id);
      expect(row.statut).toBe('HUMAN_INTERVIEW_REJECTED');
    },
    90000
  );

  test(
    'ACCEPTED via decision-finale sans onboarding : échoue (readiness check)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createCompletedInterview(token, adminToken, rh, open);

      const res = await authed(`${BASE}/candidatures/${id}/decision-finale`, rh, {
        method: 'POST',
        body: JSON.stringify({ decision: 'ACCEPTED' })
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toMatch(/stage|période|documents/i);
    },
    90000
  );
});

afterAll(async () => {
  await pool.end();
});
