const BASE = 'http://localhost:3000/api';

require('dotenv').config();
const pool = require('../config/db');

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
      date: '2026-09-10',
      heure: '10:30',
      duree: 45,
      interviewer: 'Salma Bouazizi',
      interviewer_email: 'salma.bouazizi@steg.tn',
      lien_visio: 'https://teams.microsoft.com/l/meetup-join/meeting/stage-period-validation-test'
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

/** Date strictement future (YYYY-MM-DD) dans le fuseau Africa/Tunis. */
function futureDate(daysFromNow = 30) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }));
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) + daysFromNow * 86400000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Formate une DATE PostgreSQL (objet Date JS) en YYYY-MM-DD. */
function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Ligne complète de période de stage (préférences + validation) d'une candidature. */
async function periodRow(id) {
  const { rows } = await pool.query(
    `SELECT internship_start_date, internship_duration_months, internship_details_submitted_at,
            internship_period_validated_at, internship_period_validated_by, internship_modification_requested_at
     FROM candidature WHERE id = $1`,
    [id]
  );
  return rows[0];
}

/** Vérifie qu'un candidat a reçu une notification dont le titre correspond. */
async function hasNotification(token, expectedTitle) {
  const res = await authed(`${BASE}/notifications`, token);
  expect(res.status).toBe(200);
  const body = await res.json();
  const list = body && Array.isArray(body) ? body : body && body.data ? body.data : [];
  return list.some((n) => n && n.titre === expectedTitle);
}

describe('Validation RH de la période de stage (intégration)', () => {
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
    'le RH peut valider la période de stage soumise par le candidat',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createSubmittedCandidature(token, adminToken, rh, open);

      const res = await authed(`${BASE}/candidatures/${id}/stage-preferences/validate`, rh, {
        method: 'POST'
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.internship_period_validated_at).toBeTruthy();
      expect(body.internship_period_validated_by).toBe(rhId);
      expect(body.internship_modification_requested_at).toBeNull();

      const row = await periodRow(id);
      expect(row.internship_period_validated_at).toBeTruthy();
      expect(row.internship_period_validated_by).toBe(rhId);
    },
    45000
  );

  test(
    'une période validée est figée : le candidat ne peut plus la modifier (400)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createSubmittedCandidature(token, adminToken, rh, open);
      await authed(`${BASE}/candidatures/${id}/stage-preferences/validate`, rh, { method: 'POST' });

      const res = await authed(`${BASE}/candidatures/${id}/stage-preferences`, token, {
        method: 'PUT',
        body: JSON.stringify({ internship_start_date: futureDate(45), internship_duration_months: 6 })
      });
      expect(res.status).toBe(400);

      const row = await periodRow(id);
      expect(formatDate(row.internship_start_date)).toBe(futureDate(30));
      expect(Number(row.internship_duration_months)).toBe(4);
    },
    45000
  );

  test(
    'le RH ne peut pas valider deux fois la même période (400)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createSubmittedCandidature(token, adminToken, rh, open);
      await authed(`${BASE}/candidatures/${id}/stage-preferences/validate`, rh, { method: 'POST' });

      const second = await authed(`${BASE}/candidatures/${id}/stage-preferences/validate`, rh, {
        method: 'POST'
      });
      expect(second.status).toBe(400);
    },
    45000
  );

  test(
    'le RH ne peut pas valider tant que le candidat n’a pas renseigné sa période (400)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createAcceptedCandidature(token, adminToken, rh, open);

      const res = await authed(`${BASE}/candidatures/${id}/stage-preferences/validate`, rh, {
        method: 'POST'
      });
      expect(res.status).toBe(400);

      const row = await periodRow(id);
      expect(row.internship_period_validated_at).toBeNull();
    },
    45000
  );

  test(
    'le candidat ne peut pas valider sa propre période (403)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createSubmittedCandidature(token, adminToken, rh, open);

      const res = await authed(`${BASE}/candidatures/${id}/stage-preferences/validate`, token, {
        method: 'POST'
      });
      expect(res.status).toBe(403);

      const row = await periodRow(id);
      expect(row.internship_period_validated_at).toBeNull();
    },
    45000
  );

  test(
    'le RH ne peut pas valider une candidature pas encore acceptée après entretien humain (400)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createSubmittedCandidature(token, adminToken, rh, open);

      await pool.query("UPDATE candidature SET statut = 'HUMAN_INTERVIEW_COMPLETED' WHERE id = $1", [id]);

      const res = await authed(`${BASE}/candidatures/${id}/stage-preferences/validate`, rh, {
        method: 'POST'
      });
      expect(res.status).toBe(400);
    },
    45000
  );

  test(
    'le RH peut demander une modification de la période (200) et le candidat est prévenu',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createSubmittedCandidature(token, adminToken, rh, open);

      const res = await authed(`${BASE}/candidatures/${id}/stage-preferences/request-modification`, rh, {
        method: 'POST'
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.internship_modification_requested_at).toBeTruthy();
      expect(body.internship_period_validated_at).toBeNull();

      const row = await periodRow(id);
      expect(row.internship_modification_requested_at).toBeTruthy();
      expect(await hasNotification(token, 'Modification de période de stage demandée')).toBe(true);
    },
    45000
  );

  test(
    'après demande de modification, le candidat peut resoumettre et la période repasse en attente',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createSubmittedCandidature(token, adminToken, rh, open);
      await authed(`${BASE}/candidatures/${id}/stage-preferences/request-modification`, rh, { method: 'POST' });

      const res = await authed(`${BASE}/candidatures/${id}/stage-preferences`, token, {
        method: 'PUT',
        body: JSON.stringify({ internship_start_date: futureDate(60), internship_duration_months: 6 })
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.internship_modification_requested_at).toBeNull();
      expect(body.internship_period_validated_at).toBeNull();

      const row = await periodRow(id);
      expect(row.internship_modification_requested_at).toBeNull();
      expect(formatDate(row.internship_start_date)).toBe(futureDate(60));
      expect(Number(row.internship_duration_months)).toBe(6);
    },
    45000
  );

  test(
    'après resoumission, le RH peut valider la période corrigée',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createSubmittedCandidature(token, adminToken, rh, open);
      await authed(`${BASE}/candidatures/${id}/stage-preferences/request-modification`, rh, { method: 'POST' });
      await authed(`${BASE}/candidatures/${id}/stage-preferences`, token, {
        method: 'PUT',
        body: JSON.stringify({ internship_start_date: futureDate(75), internship_duration_months: 8 })
      });

      const res = await authed(`${BASE}/candidatures/${id}/stage-preferences/validate`, rh, {
        method: 'POST'
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.internship_start_date).toBe(futureDate(75));
      expect(body.internship_duration_months).toBe(8);
      expect(body.internship_period_validated_at).toBeTruthy();
    },
    45000
  );

  test(
    'le candidat reçoit une notification après la validation de sa période',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createSubmittedCandidature(token, adminToken, rh, open);
      await authed(`${BASE}/candidatures/${id}/stage-preferences/validate`, rh, { method: 'POST' });

      expect(await hasNotification(token, 'Période de stage validée')).toBe(true);
    },
    45000
  );

  test(
    'le RH ne peut pas demander de modification sur une période déjà validée (400)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createSubmittedCandidature(token, adminToken, rh, open);
      await authed(`${BASE}/candidatures/${id}/stage-preferences/validate`, rh, { method: 'POST' });

      const res = await authed(`${BASE}/candidatures/${id}/stage-preferences/request-modification`, rh, {
        method: 'POST'
      });
      expect(res.status).toBe(400);

      const row = await periodRow(id);
      expect(row.internship_modification_requested_at).toBeNull();
    },
    45000
  );

  test(
    'le RH ne peut pas demander de modification avant la soumission du candidat (400)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createAcceptedCandidature(token, adminToken, rh, open);

      const res = await authed(`${BASE}/candidatures/${id}/stage-preferences/request-modification`, rh, {
        method: 'POST'
      });
      expect(res.status).toBe(400);
    },
    45000
  );

  test(
    'la validation est tracée dans l’historique d’audit (action, RH, période)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createSubmittedCandidature(token, adminToken, rh, open);
      await authed(`${BASE}/candidatures/${id}/stage-preferences/validate`, rh, { method: 'POST' });

      const { rows } = await pool.query(
        `SELECT decision, action, decided_by, internship_start_date, internship_duration_months
         FROM candidature_decisions
         WHERE candidature_id = $1 AND action = 'STAGE_PERIOD_VALIDATED'
         ORDER BY decided_at DESC
         LIMIT 1`,
        [id]
      );
      expect(rows.length).toBe(1);
      expect(rows[0].decision).toBe('VALIDATED');
      expect(rows[0].decided_by).toBe(rhId);
      expect(formatDate(rows[0].internship_start_date)).toBe(futureDate(30));
      expect(Number(rows[0].internship_duration_months)).toBe(4);
    },
    45000
  );

  test(
    'les détails RH exposent la validation (validé par, horodatage, période)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createSubmittedCandidature(token, adminToken, rh, open);
      await authed(`${BASE}/candidatures/${id}/stage-preferences/validate`, rh, { method: 'POST' });

      const details = await (await authed(`${BASE}/candidatures/${id}`, rh)).json();
      expect(details.internship_period_validated_at).toBeTruthy();
      expect(details.internship_period_validated_by).toBe(rhId);
      expect(details.validated_by_name).toBeTruthy();
      expect(details.internship_modification_requested_at).toBeNull();

      const entry = details.decision_history.find((d) => d.action === 'STAGE_PERIOD_VALIDATED');
      expect(entry).toBeTruthy();
      expect(entry.decision).toBe('VALIDATED');
      expect(entry.internship_start_date).toBe(futureDate(30));
    },
    45000
  );

  test(
    'une candidature inexistante renvoie 404 pour la validation',
    async () => {
      const rh = await loginRH();
      const res = await authed(
        `${BASE}/candidatures/00000000-0000-0000-0000-000000000000/stage-preferences/validate`,
        rh,
        { method: 'POST' }
      );
      expect(res.status).toBe(404);
    },
    45000
  );
});
