const BASE = 'http://localhost:3000/api';

const PROJET = `${BASE}/stagiaires/projet`;
const TACHES = `${BASE}/taches/mes-taches`;
const TACHE_UPDATE = (id) => `${BASE}/taches/${id}`;

const USERS = {
  stagiaireInfo: { email: 'fatma.trabelsi@steg.tn', password: 'stagiaire123' },
  stagiaireElec: { email: 'mohamed.bouchnak@steg.tn', password: 'stagiaire123' },
  stagiaireNoStage: { email: 'youssef.hadjali@steg.tn', password: 'stagiaire123' },
  admin: { email: 'admin@steg.tn', password: 'admin123' },
  encadrant: { email: 'ahmed.bensalah@steg.tn', password: 'encadrant123' },
  rh: { email: 'salma.bouazizi@steg.tn', password: 'rh1234' },
  candidat: { email: 'candidat@steg.tn', password: 'Candidat123!' }
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

describe('GET /api/stagiaires/projet', () => {
  test('returns 401 without token', async () => {
    const res = await fetch(`${PROJET}`);
    expect(res.status).toBe(401);
  });

  test('returns 403 as ADMIN', async () => {
    const res = await authFetch('admin', `${PROJET}`);
    expect(res.status).toBe(403);
  });

  test('returns 403 as RH', async () => {
    const res = await authFetch('rh', `${PROJET}`);
    expect(res.status).toBe(403);
  });

  test('returns 403 as ENCADRANT', async () => {
    const res = await authFetch('encadrant', `${PROJET}`);
    expect(res.status).toBe(403);
  });

  test('returns 200 with full project for stagiaire with stage', async () => {
    const res = await authFetch('stagiaireInfo', `${PROJET}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('project');
    expect(data).toHaveProperty('stage');
    expect(data).toHaveProperty('tasks');

    expect(data.project).toMatchObject({
      id: expect.any(String),
      titre: expect.any(String),
      description: expect.any(String),
      technologies: expect.any(String),
      etat: expect.any(String),
      avancement: expect.any(Number),
      supervisor: {
        id: expect.any(String),
        full_name: expect.any(String)
      },
      departement: expect.any(String)
    });

    expect(data.stage).toMatchObject({
      id: expect.any(String),
      date_debut: expect.any(String),
      date_fin: expect.any(String),
      statut: expect.any(String)
    });

    expect(data.tasks).toMatchObject({
      total: expect.any(Number),
      todo: expect.any(Number),
      in_progress: expect.any(Number),
      completed: expect.any(Number),
      blocked: expect.any(Number),
      overdue: expect.any(Number)
    });
  });

  test('returns ownership isolation between stagiaires', async () => {
    const res1 = await authFetch('stagiaireInfo', `${PROJET}`);
    const data1 = await res1.json();

    const res2 = await authFetch('stagiaireElec', `${PROJET}`);
    const data2 = await res2.json();

    expect(data1.project.id).not.toBe(data2.project.id);
    expect(data1.stage.id).not.toBe(data2.stage.id);
  });

  test('returns 404 for stagiaire without stage', async () => {
    const res = await authFetch('stagiaireNoStage', `${PROJET}`);
    expect(res.status).toBe(404);
  });

  test('no credentials leak in response', async () => {
    const res = await authFetch('stagiaireInfo', `${PROJET}`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toMatch(/mot_de_passe/i);
    expect(body).not.toMatch(/password/i);
    expect(body).not.toMatch(/token/i);
  });
});

describe('GET /api/taches/mes-taches (stagiaire)', () => {
  test('returns 200 with own tasks only', async () => {
    const res = await authFetch('stagiaireInfo', `${TACHES}`);
    expect(res.status).toBe(200);
    const data = await res.json();

    const tasks = Array.isArray(data) ? data : (data.data || []);
    for (const task of tasks) {
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('titre');
      expect(task).toHaveProperty('statut');
      expect(task).toHaveProperty('priorite');
      expect(task).toHaveProperty('date_fin');
      expect(task).toHaveProperty('progress');
    }
  });

  test('stagiaire sees only own tasks (isolation)', async () => {
    const res1 = await authFetch('stagiaireInfo', `${TACHES}`);
    const data1 = await res1.json();
    const tasks1 = Array.isArray(data1) ? data1 : (data1.data || []);

    const res2 = await authFetch('stagiaireElec', `${TACHES}`);
    const data2 = await res2.json();
    const tasks2 = Array.isArray(data2) ? data2 : (data2.data || []);

    const ids1 = new Set(tasks1.map(t => t.id));
    const ids2 = new Set(tasks2.map(t => t.id));
    const overlap = [...ids1].filter(id => ids2.has(id));
    expect(overlap).toEqual([]);
  });
});

describe('PUT /api/taches/:id (stagiaire ownership)', () => {
  test('returns 403 when stagiaire tries to update a task', async () => {
    const tachesRes = await authFetch('stagiaireInfo', `${TACHES}`);
    const tachesData = await tachesRes.json();
    const tasks = Array.isArray(tachesData) ? tachesData : (tachesData.data || []);

    if (tasks.length === 0) return;

    const taskId = tasks[0].id;
    const res = await authFetch('stagiaireInfo', TACHE_UPDATE(taskId), {
      method: 'PUT',
      body: JSON.stringify({ statut: 'TERMINEE' })
    });

    expect(res.status).toBe(403);
  });

  test('returns 403 when stagiaire tries to update another stagiaire task', async () => {
    const tachesRes = await authFetch('stagiaireElec', `${TACHES}`);
    const tachesData = await tachesRes.json();
    const tasks = Array.isArray(tachesData) ? tachesData : (tachesData.data || []);

    if (tasks.length === 0) return;

    const taskId = tasks[0].id;
    const res = await authFetch('stagiaireInfo', TACHE_UPDATE(taskId), {
      method: 'PUT',
      body: JSON.stringify({ statut: 'TERMINEE' })
    });

    expect(res.status).toBe(403);
  });
});
