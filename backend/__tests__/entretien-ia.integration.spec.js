const BASE = 'http://localhost:3000/api';

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

describe('Entretien IA — portail candidat (intégration)', () => {
  test(
    'GET /candidatures/:id/entretien-ia : 404 avant RH_ACCEPTED, 200 après, 403 hors rôle, 404 inexistante',
    async () => {
      const token = await loginCandidat();
      const adminToken = await loginAdmin();
      const rh = await loginRH();
      const stagiaire = await login('fatma.trabelsi@steg.tn', 'stagiaire123');

      const offresRes = await fetch(`${BASE}/public/offres`);
      expect(offresRes.status).toBe(200);
      const open = await offresRes.json();

      const target = await pickFreeOffer(token, adminToken, open);

      const applyRes = await authed(`${BASE}/candidatures`, token, {
        method: 'POST',
        body: JSON.stringify({ offre_id: target.id })
      });
      expect(applyRes.status).toBe(201);
      const { candidature } = await applyRes.json();
      const id = candidature.id;

      const beforeRes = await authed(`${BASE}/candidatures/${id}/entretien-ia`, token);
      expect(beforeRes.status).toBe(404);

      const putRes = await authed(`${BASE}/candidatures/${id}`, rh, {
        method: 'PUT',
        body: JSON.stringify({ statut: 'RH_ACCEPTED' })
      });
      expect(putRes.status).toBe(200);

      const okRes = await authed(`${BASE}/candidatures/${id}/entretien-ia`, token);
      expect(okRes.status).toBe(200);
      const body = await okRes.json();
      expect(body.id).toBe(id);
      expect(body.statut).toBe('RH_ACCEPTED');
      expect(body.date_candidature).toBeTruthy();
      expect(body.candidat).toEqual({ prenom: 'Marwa', nom: 'Sassi' });
      expect(body.offre.id).toBe(target.id);
      expect(body.offre.titre).toBe(target.titre);
      expect(typeof body.offre.departement_nom).toBe('string');

      const stagiaireRes = await authed(`${BASE}/candidatures/${id}/entretien-ia`, stagiaire);
      expect(stagiaireRes.status).toBe(403);

      const ghostRes = await authed(
        `${BASE}/candidatures/00000000-0000-4000-8000-000000000000/entretien-ia`,
        token
      );
      expect(ghostRes.status).toBe(404);

      const del = await authed(`${BASE}/candidatures/${id}`, adminToken, { method: 'DELETE' });
      expect(del.status).toBe(200);
    },
    30000
  );
});
