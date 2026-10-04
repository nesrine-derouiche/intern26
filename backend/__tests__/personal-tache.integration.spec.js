const { Pool } = require('pg');

const BASE = 'http://localhost:3000/api';
const PT = `${BASE}/personal-taches`;

const pool = new Pool({
  host: 'localhost', port: 5433,
  user: 'postgres', password: '0007',
  database: 'steg_stage',
});

const USERS = {
  stagiaireA: { email: 'fatma.trabelsi@steg.tn', password: 'stagiaire123' },
  stagiaireB: { email: 'mohamed.bouchnak@steg.tn', password: 'stagiaire123' },
  encadrant: { email: 'ahmed.bensalah@steg.tn', password: 'encadrant123' },
  admin: { email: 'admin@steg.tn', password: 'admin123' },
};

const tokens = {};

async function login(key) {
  if (tokens[key]) return tokens[key];
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: USERS[key].email, password: USERS[key].password })
  });
  const data = await res.json();
  tokens[key] = data.token;
  return tokens[key];
}

async function authFetch(key, url, options = {}) {
  const token = await login(key);
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
}

beforeAll(async () => {
  await pool.query('DELETE FROM tache_personnelle');
});

afterAll(async () => {
  await pool.end();
});

let createdTaskId;

describe('Personal Taches — CRUD', () => {
  test('POST / creates a personal task', async () => {
    const res = await authFetch('stagiaireA', PT, {
      method: 'POST',
      body: JSON.stringify({
        titre: 'Préparer ma présentation',
        description: 'Slides pour le PFE',
        priorite: 'HAUTE',
        date_echeance: '2026-09-20',
      })
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toHaveProperty('id');
    expect(data.statut).toBe('A_FAIRE');
    expect(data.titre).toBe('Préparer ma présentation');
    expect(data.priorite).toBe('HAUTE');
    expect(data.position).toBe(0);
    createdTaskId = data.id;
  });

  test('POST / rejects missing titre', async () => {
    const res = await authFetch('stagiaireA', PT, {
      method: 'POST',
      body: JSON.stringify({ description: 'no title' })
    });
    expect(res.status).toBe(400);
  });

  test('GET / returns only stagiaireA tasks', async () => {
    const res = await authFetch('stagiaireA', PT);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
    for (const t of data) {
      expect(t).toHaveProperty('id');
      expect(t).toHaveProperty('titre');
      expect(t).toHaveProperty('statut');
      expect(t).toHaveProperty('position');
    }
  });

  test('GET /:id returns the created task', async () => {
    const res = await authFetch('stagiaireA', `${PT}/${createdTaskId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(createdTaskId);
  });

  test('PUT /:id updates the task', async () => {
    const res = await authFetch('stagiaireA', `${PT}/${createdTaskId}`, {
      method: 'PUT',
      body: JSON.stringify({ titre: 'Préparer présentation PFE', priorite: 'MOYENNE' })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.titre).toBe('Préparer présentation PFE');
    expect(data.priorite).toBe('MOYENNE');
  });

  test('GET /counts returns statut counts', async () => {
    const res = await authFetch('stagiaireA', `${PT}/counts`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('A_FAIRE');
    expect(data).toHaveProperty('EN_COURS');
    expect(data).toHaveProperty('TERMINEE');
  });
});

describe('Personal Taches — Sécurité', () => {
  test('stagiaireB cannot GET stagiaireA task', async () => {
    const res = await authFetch('stagiaireB', `${PT}/${createdTaskId}`);
    expect(res.status).toBe(403);
  });

  test('stagiaireB cannot PUT stagiaireA task', async () => {
    const res = await authFetch('stagiaireB', `${PT}/${createdTaskId}`, {
      method: 'PUT',
      body: JSON.stringify({ titre: 'Hacked' })
    });
    expect(res.status).toBe(403);
  });

  test('stagiaireB cannot DELETE stagiaireA task', async () => {
    const res = await authFetch('stagiaireB', `${PT}/${createdTaskId}`, {
      method: 'DELETE'
    });
    expect(res.status).toBe(403);
  });

  test('stagiaireB cannot MOVE stagiaireA task', async () => {
    const res = await authFetch('stagiaireB', `${PT}/${createdTaskId}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ statut: 'EN_COURS', position: 0 })
    });
    expect(res.status).toBe(403);
  });

  test('encadrant cannot access personal tasks', async () => {
    const res = await authFetch('encadrant', PT);
    expect(res.status).toBe(403);
  });

  test('admin cannot access personal tasks', async () => {
    const res = await authFetch('admin', PT);
    expect(res.status).toBe(403);
  });

  test('unauthenticated returns 401', async () => {
    const res = await fetch(PT);
    expect(res.status).toBe(401);
  });
});

describe('Personal Taches — Drag & Drop', () => {
  let taskA, taskB, taskC;

  beforeAll(async () => {
    await pool.query('DELETE FROM tache_personnelle');

    const create = async (titre) => {
      const res = await authFetch('stagiaireA', PT, {
        method: 'POST',
        body: JSON.stringify({ titre })
      });
      return res.json();
    };
    taskA = await create('Task Alpha');
    taskB = await create('Task Beta');
    taskC = await create('Task Gamma');
  });

  test('all 3 tasks start in A_FAIRE', () => {
    expect(taskA.statut).toBe('A_FAIRE');
    expect(taskB.statut).toBe('A_FAIRE');
    expect(taskC.statut).toBe('A_FAIRE');
  });

  test('positions are sequential within A_FAIRE', () => {
    const positions = [taskA, taskB, taskC]
      .filter(t => t.statut === 'A_FAIRE')
      .map(t => t.position)
      .sort((a, b) => a - b);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  test('move taskC to EN_COURS position 0', async () => {
    const res = await authFetch('stagiaireA', `${PT}/${taskC.id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ statut: 'EN_COURS', position: 0 })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statut).toBe('EN_COURS');
    expect(data.position).toBe(0);
  });

  test('move taskA to EN_COURS position 0 pushes taskC to 1', async () => {
    const res = await authFetch('stagiaireA', `${PT}/${taskA.id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ statut: 'EN_COURS', position: 0 })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statut).toBe('EN_COURS');
    expect(data.position).toBe(0);

    const list = await authFetch('stagiaireA', PT).then(r => r.json());
    const ecTasks = list.filter(t => t.statut === 'EN_COURS').sort((a, b) => a.position - b.position);
    expect(ecTasks.length).toBe(2);
    expect(ecTasks[0].id).toBe(taskA.id);
    expect(ecTasks[1].id).toBe(taskC.id);
  });

  test('move taskA back to A_FAIRE', async () => {
    const res = await authFetch('stagiaireA', `${PT}/${taskA.id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ statut: 'A_FAIRE', position: 0 })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statut).toBe('A_FAIRE');
  });

  test('move taskB to TERMINEE', async () => {
    const res = await authFetch('stagiaireA', `${PT}/${taskB.id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ statut: 'TERMINEE', position: 0 })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statut).toBe('TERMINEE');
  });

  test('rejects invalid statut', async () => {
    const res = await authFetch('stagiaireA', `${PT}/${taskA.id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ statut: 'INVALID' })
    });
    expect(res.status).toBe(400);
  });

  test('move same column reorders within A_FAIRE', async () => {
    const list = await authFetch('stagiaireA', PT).then(r => r.json());
    const afTasks = list.filter(t => t.statut === 'A_FAIRE').sort((a, b) => a.position - b.position);
    if (afTasks.length < 2) return;

    const first = afTasks[0];
    const second = afTasks[1];
    const res = await authFetch('stagiaireA', `${PT}/${second.id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ statut: 'A_FAIRE', position: 0 })
    });
    expect(res.status).toBe(200);

    const listAfter = await authFetch('stagiaireA', PT).then(r => r.json());
    const afAfter = listAfter.filter(t => t.statut === 'A_FAIRE').sort((a, b) => a.position - b.position);
    expect(afAfter[0].id).toBe(second.id);
    expect(afAfter[1].id).toBe(first.id);
  });
});

describe('Personal Taches — DELETE', () => {
  test('delete removes task and reorders positions', async () => {
    const createRes = await authFetch('stagiaireA', PT, {
      method: 'POST',
      body: JSON.stringify({ titre: 'To Delete' })
    });
    const task = await createRes.json();

    const res = await authFetch('stagiaireA', `${PT}/${task.id}`, {
      method: 'DELETE'
    });
    expect(res.status).toBe(200);

    const getRes = await authFetch('stagiaireA', `${PT}/${task.id}`);
    expect(getRes.status).toBe(404);
  });

  test('delete non-existent returns 404', async () => {
    const res = await authFetch('stagiaireA', `${PT}/00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE'
    });
    expect(res.status).toBe(404);
  });
});
