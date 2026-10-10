require('dotenv').config();
const pool = require('../config/db');

const API = 'http://localhost:3000/api/notes';
const MISSING_UUID = '00000000-0000-4000-8000-000000000000';

const ACCOUNTS = {
  admin: ['admin@steg.tn', 'admin123'],
  encadrant: ['ahmed.bensalah@steg.tn', 'encadrant123'],
  stagiaire: ['fatma.trabelsi@steg.tn', 'stagiaire123'],
  stagiaireElec: ['mohamed.bouchnak@steg.tn', 'stagiaire123'],
  candidat: ['candidat@steg.tn', 'Candidat123!']
};

const tokens = {};

async function login(email, password) {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error(`Login échoué (${res.status}) : ${await res.text()}`);
  const data = await res.json();
  return { token: data.token, id: data.user.id };
}

async function tokenFor(role) {
  if (tokens[role]) return tokens[role];
  const [email, password] = ACCOUNTS[role];
  tokens[role] = await login(email, password);
  return tokens[role];
}

async function api(method, url, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let json = null;
  try {
    json = await res.json();
  } catch (err) {
    json = null;
  }
  return { status: res.status, body: json };
}

async function cleanNotes() {
  const { rows } = await pool.query(
    `SELECT id FROM utilisateur WHERE email IN ('fatma.trabelsi@steg.tn', 'mohamed.bouchnak@steg.tn')`
  );
  for (const row of rows) {
    await pool.query('DELETE FROM note WHERE stagiaire_id = $1', [row.id]);
  }
}

beforeAll(async () => {
  await cleanNotes();
});

afterAll(async () => {
  await cleanNotes();
  await pool.end();
});

describe('P2-TASK5 — CRUD et persistance', () => {
  test('1. liste vide au départ → tableau vide', async () => {
    const res = await api('GET', API, (await tokenFor('stagiaire')).token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  test('2. création → 201 avec note persistée', async () => {
    const res = await api('POST', API, (await tokenFor('stagiaire')).token, {
      titre: 'Idées PFE',
      contenu: 'Explorer les architectures.'
    });

    expect(res.status).toBe(201);
    expect(res.body.note.titre).toBe('Idées PFE');
    expect(res.body.note.contenu).toBe('Explorer les architectures.');
    expect(res.body.note.pinned).toBe(false);

    const list = await api('GET', API, (await tokenFor('stagiaire')).token);
    expect(list.body.some((n) => n.id === res.body.note.id)).toBe(true);
  });

  test('3. mise à jour titre + contenu → 200', async () => {
    const created = await api('POST', API, (await tokenFor('stagiaire')).token, {
      titre: 'Brouillon',
      contenu: 'v1'
    });
    const id = created.body.note.id;

    const res = await api('PUT', `${API}/${id}`, (await tokenFor('stagiaire')).token, {
      titre: 'Brouillon revu',
      contenu: 'v2'
    });

    expect(res.status).toBe(200);
    expect(res.body.note.titre).toBe('Brouillon revu');
    expect(res.body.note.contenu).toBe('v2');
  });

  test('4. épinglage → 200 et tri épinglée d abord', async () => {
    const token = (await tokenFor('stagiaire')).token;
    const a = await api('POST', API, token, { titre: 'A', contenu: 'a' });
    await api('POST', API, token, { titre: 'B', contenu: 'b' });

    const pin = await api('PUT', `${API}/${a.body.note.id}`, token, { pinned: true });
    expect(pin.status).toBe(200);
    expect(pin.body.note.pinned).toBe(true);

    const list = await api('GET', API, token);
    expect(list.body[0].id).toBe(a.body.note.id);
  });

  test('5. suppression avec confirmation → 200 puis absente', async () => {
    const token = (await tokenFor('stagiaire')).token;
    const created = await api('POST', API, token, { titre: 'À jeter', contenu: 'x' });
    const id = created.body.note.id;

    const del = await api('DELETE', `${API}/${id}`, token);
    expect(del.status).toBe(200);

    const list = await api('GET', API, token);
    expect(list.body.some((n) => n.id === id)).toBe(false);
  });

  test('6. création idempotente (même client_key) → pas de doublon', async () => {
    const token = (await tokenFor('stagiaire')).token;
    const key = `idem-${Date.now()}`;
    const first = await api('POST', API, token, { titre: 'Retry', contenu: 'r', client_key: key });
    expect(first.status).toBe(201);

    const second = await api('POST', API, token, { titre: 'Retry', contenu: 'r', client_key: key });
    expect(second.status).toBe(200);
    expect(second.body.note.id).toBe(first.body.note.id);

    const list = await api('GET', API, token);
    expect(list.body.filter((n) => n.titre === 'Retry')).toHaveLength(1);
  });
});

describe('P2-TASK5 — isolement et autorisations', () => {
  test('7. autre stagiaire : lecture impossible → 404 sans fuite', async () => {
    const token = (await tokenFor('stagiaire')).token;
    const created = await api('POST', API, token, { titre: 'Privé', contenu: 'secret' });
    const id = created.body.note.id;

    const other = (await tokenFor('stagiaireElec')).token;
    const read = await api('PUT', `${API}/${id}`, other, { titre: 'Piraté' });
    expect(read.status).toBe(404);

    const del = await api('DELETE', `${API}/${id}`, other);
    expect(del.status).toBe(404);

    const check = await api('GET', API, token);
    expect(check.body.find((n) => n.id === id).titre).toBe('Privé');
  });

  test('8. listes cloisonnées entre stagiaires', async () => {
    const list = await api('GET', API, (await tokenFor('stagiaireElec')).token);
    expect(list.status).toBe(200);
    const mine = await api('GET', API, (await tokenFor('stagiaire')).token);
    const mineIds = new Set(mine.body.map((n) => n.id));
    expect(list.body.every((n) => !mineIds.has(n.id))).toBe(true);
  });

  test('9. ENCADRANT, ADMIN, CANDIDAT refusés → 403', async () => {
    for (const role of ['encadrant', 'admin', 'candidat']) {
      const token = (await tokenFor(role)).token;
      const res = await api('GET', API, token);
      expect(res.status).toBe(403);
    }
  });

  test('10. sans token → 401', async () => {
    const res = await api('GET', API, null);
    expect(res.status).toBe(401);
  });

  test('11. note inconnue → 404', async () => {
    const res = await api(
      'PUT',
      `${API}/${MISSING_UUID}`,
      (await tokenFor('stagiaire')).token,
      { titre: 'X' }
    );
    expect(res.status).toBe(404);
  });

  test('12. titre trop long → 400', async () => {
    const res = await api('POST', API, (await tokenFor('stagiaire')).token, {
      titre: 'x'.repeat(201),
      contenu: 'c'
    });
    expect(res.status).toBe(400);
  });
});
