const BASE = 'http://localhost:3000/api';

require('dotenv').config();
const pool = require('../config/db');
const bcrypt = require('bcrypt');

let candidatToken = null;
let otherCandidatToken = null;
let adminToken = null;
let rhToken = null;
let open = [];
let created = [];
let otherCreated = [];
let firstCandidatureId = null;

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

async function pickFreeOffer(token, open) {
  const mineRes = await authed(`${BASE}/candidatures/mes-offres`, token);
  expect(mineRes.status).toBe(200);
  const mine = await mineRes.json();
  const applied = new Set((mine.offre_ids || []));
  return open.find((o) => !applied.has(o.id) && o.nombre_places > 0) || open[0];
}

async function createSecondCandidate() {
  const email = `autre-details-${Date.now()}@steg.tn`;
  const pwd = await bcrypt.hash('Candidat123!', 10);
  const { rows } = await pool.query(
    `INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone, adresse, role, email_verifie)
     VALUES ('Autre', 'Candidat', $1, $2, '+216 55 000 000', 'Sfax', 'CANDIDAT', true)
     RETURNING id`,
    [email, pwd]
  );
  await pool.query(
    `INSERT INTO candidat (id, universite, specialite, niveau, competences, langues)
     VALUES ($1, 'FST', 'Informatique', 'Licence', 'Java', 'Français')`,
    [rows[0].id]
  );
  return { email, userId: rows[0].id };
}

describe('Détails candidature — contrôle d\'accès par ownership (intégration)', () => {
  beforeAll(async () => {
    await pool.query(
      `DELETE FROM candidature WHERE candidat_id = (SELECT id FROM utilisateur WHERE email = 'candidat@steg.tn')`
    );
    const offresRes = await fetch(`${BASE}/public/offres`);
    expect(offresRes.status).toBe(200);
    open = await offresRes.json();
    expect(open.length).toBeGreaterThan(0);
  });

  afterAll(async () => {
    const adm = adminToken || (await loginAdmin());
    for (const id of created) {
      await authed(`${BASE}/candidatures/${id}`, adm, { method: 'DELETE' });
    }
    for (const id of otherCreated) {
      await authed(`${BASE}/candidatures/${id}`, adm, { method: 'DELETE' });
    }
    await pool.end();
  });

  test(
    'le candidat accède à sa propre candidature (200)',
    async () => {
      const token = await loginCandidat();
      const target = await pickFreeOffer(token, open);

      const applyRes = await authed(`${BASE}/candidatures`, token, {
        method: 'POST',
        body: JSON.stringify({ offre_id: target.id })
      });
      expect(applyRes.status).toBe(201);
      const { candidature } = await applyRes.json();
      created.push(candidature.id);
      firstCandidatureId = candidature.id;

      const detailsRes = await authed(`${BASE}/candidatures/${candidature.id}`, token);
      expect(detailsRes.status).toBe(200);
      const body = await detailsRes.json();
      expect(body.id).toBe(candidature.id);
      expect(body.candidat_id).toBeTruthy();
      expect(body.offre_titre).toBeTruthy();
      expect(body.statut).toBe('EN_ATTENTE');
      expect(body.nom).toBeTruthy();
      expect(body.prenom).toBeTruthy();
    },
    60000
  );

  test(
    'un autre candidat ne peut pas consulter cette candidature (403)',
    async () => {
      const token = await loginCandidat();
      const target = await pickFreeOffer(token, open);

      const applyRes = await authed(`${BASE}/candidatures`, token, {
        method: 'POST',
        body: JSON.stringify({ offre_id: target.id })
      });
      expect(applyRes.status).toBe(201);
      const { candidature } = await applyRes.json();
      created.push(candidature.id);

      const { email: otherEmail } = await createSecondCandidate();
      const otherToken = await login(otherEmail, 'Candidat123!');

      const detailsRes = await authed(`${BASE}/candidatures/${candidature.id}`, otherToken);
      expect(detailsRes.status).toBe(403);
      const body = await detailsRes.json();
      expect(body.error || body.message || '').toMatch(/appartient/);
    },
    60000
  );

  test(
    'le candidat intrus ne récupère aucune donnée sensible (pas de fuite d\'informations)',
    async () => {
      const token = await loginCandidat();
      const target = await pickFreeOffer(token, open);

      const applyRes = await authed(`${BASE}/candidatures`, token, {
        method: 'POST',
        body: JSON.stringify({ offre_id: target.id })
      });
      expect(applyRes.status).toBe(201);
      const { candidature } = await applyRes.json();
      created.push(candidature.id);

      const { email: otherEmail } = await createSecondCandidate();
      const otherToken = await login(otherEmail, 'Candidat123!');

      const detailsRes = await authed(`${BASE}/candidatures/${candidature.id}`, otherToken);
      expect(detailsRes.status).toBe(403);
      const text = await detailsRes.text();
      expect(text).not.toContain(candidature.id);
      expect(text).not.toContain(target.titre);
    },
    60000
  );

  test(
    'le RH accède aux détails de n\'importe quelle candidature (200)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const target = await pickFreeOffer(token, open);

      const applyRes = await authed(`${BASE}/candidatures`, token, {
        method: 'POST',
        body: JSON.stringify({ offre_id: target.id })
      });
      expect(applyRes.status).toBe(201);
      const { candidature } = await applyRes.json();
      created.push(candidature.id);

      const detailsRes = await authed(`${BASE}/candidatures/${candidature.id}`, rh);
      expect(detailsRes.status).toBe(200);
      const body = await detailsRes.json();
      expect(body.id).toBe(candidature.id);
      expect(body.offre_titre).toBeTruthy();
    },
    60000
  );

  test(
    'l\'admin accède aux détails de n\'importe quelle candidature (200)',
    async () => {
      const adm = await loginAdmin();

      const detailsRes = await authed(`${BASE}/candidatures/${firstCandidatureId}`, adm);
      expect(detailsRes.status).toBe(200);
      const body = await detailsRes.json();
      expect(body.id).toBe(firstCandidatureId);
    },
    60000
  );

  test(
    'une candidature inexistante retourne 404',
    async () => {
      const token = await loginCandidat();
      const res = await authed(`${BASE}/candidatures/00000000-0000-0000-0000-000000000000`, token);
      expect(res.status).toBe(404);
    },
    30000
  );

  test(
    'un utilisateur non connecté reçoit 401',
    async () => {
      const res = await fetch(`${BASE}/candidatures/00000000-0000-0000-0000-000000000000`);
      expect(res.status).toBe(401);
    },
    30000
  );

  test(
    'le CV téléchargé est accessible à l\'admin mais pas à un candidat étranger',
    async () => {
      const token = await loginCandidat();
      const adm = await loginAdmin();

      const candidaturesRes = await authed(`${BASE}/candidatures/mes-candidatures`, token);
      expect(candidaturesRes.status).toBe(200);
      const list = await candidaturesRes.json();
      const mine = (list.candidatures || []).find((c) => c.id);
      expect(mine).toBeTruthy();

      const cvAdmin = await authed(`${BASE}/candidatures/${mine.id}/cv`, adm);
      expect([200, 404]).toContain(cvAdmin.status);

      const { email: otherEmail } = await createSecondCandidate();
      const otherToken = await login(otherEmail, 'Candidat123!');
      const cvOther = await authed(`${BASE}/candidatures/${mine.id}/cv`, otherToken);
      expect(cvOther.status).toBe(403);
    },
    60000
  );
});
