const BASE = 'http://localhost:3000/api';

require('dotenv').config();
const pool = require('../config/db');

async function countStagesForCandidature(candidatureId) {
  const { rows } = await pool.query('SELECT COUNT(*)::int as n FROM stage WHERE candidature_id = $1', [candidatureId]);
  return rows[0].n;
}

let candidatToken = null;
let adminToken = null;
let rhToken = null;

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

  let target = open.find((o) => !applied.has(o.id));
  if (!target) {
    const toFree = (Array.isArray(mine) ? mine : []).find((c) => c.id);
    expect(toFree).toBeTruthy();
    const freeRes = await authed(`${BASE}/candidatures/${toFree.id}`, adminToken, {
      method: 'DELETE'
    });
    expect(freeRes.status).toBe(200);
    target = open[0];
  }
  return target;
}

async function createAcceptedCandidature(token, adminToken, rh, open) {
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
  return candidature.id;
}

async function findNotification(userToken, titre, contains) {
  const listRes = await authed(`${BASE}/notifications?page=1&limit=50`, userToken);
  expect(listRes.status).toBe(200);
  const list = await listRes.json();
  return (list.data || []).find(
    (n) => n.titre === titre && n.message.includes(contains)
  );
}

async function cleanupNotifications(userToken, titre, contains) {
  const listRes = await authed(`${BASE}/notifications?page=1&limit=50`, userToken);
  const list = await listRes.json();
  for (const n of list.data || []) {
    if (n.titre === titre && n.message.includes(contains)) {
      await authed(`${BASE}/notifications/${n.id}`, userToken, { method: 'DELETE' });
    }
  }
}

describe('Entretien IA — résultat (intégration)', () => {
  let open = [];
  let created = [];

  beforeAll(async () => {
    const token = await loginCandidat();
    const aToken = await loginAdmin();
    const rh = await loginRH();
    adminToken = aToken;
    const offresRes = await fetch(`${BASE}/public/offres`);
    expect(offresRes.status).toBe(200);
    open = await offresRes.json();
    expect(open.length).toBeGreaterThan(0);
  });

  afterAll(async () => {
    for (const id of created) {
      await authed(`${BASE}/candidatures/${id}`, adminToken, { method: 'DELETE' });
    }
  });

  test(
    'PASSED : statut AI_INTERVIEW_PASSED, notification RH + candidat, aucun stage créé',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();

      const id = await createAcceptedCandidature(token, adminToken, rh, open);
      created.push(id);

      const res = await authed(`${BASE}/candidatures/${id}/entretien-ia/result`, adminToken, {
        method: 'POST',
        body: JSON.stringify({ score: 85, status: 'PASSED' })
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.statut).toBe('AI_INTERVIEW_PASSED');
      expect(body.score).toBe(85);

      const details = await authed(`${BASE}/candidatures/${id}`, rh);
      expect(details.status).toBe(200);
      expect((await details.json()).statut).toBe('AI_INTERVIEW_PASSED');

      expect(await countStagesForCandidature(id)).toBe(0);

      const rhNotif = await findNotification(rh, 'Entretien IA réussi', 'a réussi l\'entretien IA');
      expect(rhNotif).toBeTruthy();
      expect(rhNotif.lien).toBe(`/candidatures/${id}`);

      const candNotif = await findNotification(token, 'Entretien IA réussi', 'éligible pour un entretien humain');
      expect(candNotif).toBeTruthy();

      await cleanupNotifications(rh, 'Entretien IA réussi', 'a réussi l\'entretien IA');
      await cleanupNotifications(token, 'Entretien IA réussi', 'éligible pour un entretien humain');
    },
    30000
  );

  test(
    'FAILED : statut AI_INTERVIEW_FAILED, notification de rejet, aucun stage créé',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();

      const id = await createAcceptedCandidature(token, adminToken, rh, open);
      created.push(id);

      const res = await authed(`${BASE}/candidatures/${id}/entretien-ia/result`, adminToken, {
        method: 'POST',
        body: JSON.stringify({ score: 34, status: 'FAILED' })
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.statut).toBe('AI_INTERVIEW_FAILED');

      const details = await authed(`${BASE}/candidatures/${id}`, rh);
      expect((await details.json()).statut).toBe('AI_INTERVIEW_FAILED');

      expect(await countStagesForCandidature(id)).toBe(0);

      const candNotif = await findNotification(token, 'Entretien IA non réussi', 'n\'a pas abouti');
      expect(candNotif).toBeTruthy();

      await cleanupNotifications(token, 'Entretien IA non réussi', 'n\'a pas abouti');
    },
    30000
  );

  test(
    'corps vide : le moteur MOCK produit un résultat et le workflow s’applique',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();

      const id = await createAcceptedCandidature(token, adminToken, rh, open);
      created.push(id);

      const res = await authed(`${BASE}/candidatures/${id}/entretien-ia/result`, adminToken, {
        method: 'POST',
        body: JSON.stringify({})
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(['AI_INTERVIEW_PASSED', 'AI_INTERVIEW_FAILED']).toContain(body.statut);
      expect(typeof body.score).toBe('number');
    },
    30000
  );

  test(
    'refuse un résultat sur une candidature pas en RH_ACCEPTED et interdit le CANDIDAT',
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
      const id = candidature.id;
      created.push(id);

      const onPending = await authed(`${BASE}/candidatures/${id}/entretien-ia/result`, adminToken, {
        method: 'POST',
        body: JSON.stringify({ score: 80, status: 'PASSED' })
      });
      expect(onPending.status).toBe(400);

      const asCandidat = await authed(`${BASE}/candidatures/${id}/entretien-ia/result`, token, {
        method: 'POST',
        body: JSON.stringify({ score: 80, status: 'PASSED' })
      });
      expect(asCandidat.status).toBe(403);
    },
    30000
  );
});
