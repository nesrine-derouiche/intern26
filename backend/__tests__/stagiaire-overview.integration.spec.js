const BASE = 'http://localhost:3000/api';

const OVERVIEW = `${BASE}/stagiaires/overview`;

const USERS = {
  stagiaireInfo: { email: 'fatma.trabelsi@steg.tn', password: 'stagiaire123' },
  stagiaireElec: { email: 'mohamed.bouchnak@steg.tn', password: 'stagiaire123' },
  stagiaireNoStage: { email: 'youssef.hadjali@steg.tn', password: 'stagiaire123' },
  admin: { email: 'admin@steg.tn', password: 'admin123' },
  encadrant: { email: 'ahmed.bensalah@steg.tn', password: 'encadrant123' },
  rh: { email: 'salma.bouazizi@steg.tn', password: 'rh1234' }
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

describe('GET /api/stagiaire/overview', () => {
  test('returns 401 without token', async () => {
    const res = await fetch(`${OVERVIEW}`);
    expect(res.status).toBe(401);
  });

  test('returns 403 as ADMIN', async () => {
    const res = await authFetch('admin', `${OVERVIEW}`);
    expect(res.status).toBe(403);
  });

  test('returns 403 as RH', async () => {
    const res = await authFetch('rh', `${OVERVIEW}`);
    expect(res.status).toBe(403);
  });

  test('returns 403 as ENCADRANT', async () => {
    const res = await authFetch('encadrant', `${OVERVIEW}`);
    expect(res.status).toBe(403);
  });

  test('returns 200 with full overview for stagiaire with stage', async () => {
    const res = await authFetch('stagiaireInfo', `${OVERVIEW}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('trainee');
    expect(data).toHaveProperty('internship');
    expect(data).toHaveProperty('project');
    expect(data).toHaveProperty('tasks');
    expect(data).toHaveProperty('upcoming_meetings');
    expect(data).toHaveProperty('journal');
    expect(data).toHaveProperty('evaluation');

    expect(data.trainee).toMatchObject({
      id: expect.any(String),
      nom: 'Trabelsi',
      prenom: 'Fatma',
      email: 'fatma.trabelsi@steg.tn'
    });

    expect(data.internship).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      start_date: expect.any(String),
      end_date: expect.any(String),
      status: 'EN_COURS',
      supervisor: {
        id: expect.any(String),
        full_name: expect.any(String)
      }
    });

    expect(data.project).toMatchObject({
      id: expect.any(String),
      titre: expect.any(String),
      description: expect.any(String),
      avancement: expect.any(Number)
    });
  });

  test('task counters are accurate', async () => {
    const res = await authFetch('stagiaireInfo', `${OVERVIEW}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const { tasks } = data;

    expect(tasks.total).toBeGreaterThanOrEqual(0);
    expect(tasks.todo).toBeGreaterThanOrEqual(0);
    expect(tasks.in_progress).toBeGreaterThanOrEqual(0);
    expect(tasks.completed).toBeGreaterThanOrEqual(0);
    expect(tasks.overdue).toBeGreaterThanOrEqual(0);
    expect(tasks.todo + tasks.in_progress + tasks.completed + tasks.overdue).toBeGreaterThanOrEqual(tasks.total);
    expect(Array.isArray(tasks.next)).toBe(true);
    expect(tasks.next.length).toBeLessThanOrEqual(3);
  });

  test('upcoming meetings returns at most 3', async () => {
    const res = await authFetch('stagiaireInfo', `${OVERVIEW}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.upcoming_meetings)).toBe(true);
    expect(data.upcoming_meetings.length).toBeLessThanOrEqual(3);
  });

  test('journal state is returned', async () => {
    const res = await authFetch('stagiaireInfo', `${OVERVIEW}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.journal).not.toBeNull();
    expect(data.journal).toMatchObject({
      total: expect.any(Number),
      submitted: expect.any(Number),
      pending: expect.any(Number)
    });
  });

  test('returns ownership isolation for different stagiaire', async () => {
    const res1 = await authFetch('stagiaireInfo', `${OVERVIEW}`);
    const data1 = await res1.json();

    const res2 = await authFetch('stagiaireElec', `${OVERVIEW}`);
    const data2 = await res2.json();

    expect(data1.trainee.id).not.toBe(data2.trainee.id);
    expect(data1.internship.id).not.toBe(data2.internship.id);
  });

  test('returns 200 with null internship for stagiaire without stage', async () => {
    const res = await authFetch('stagiaireNoStage', `${OVERVIEW}`);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.trainee).toMatchObject({
      id: expect.any(String),
      nom: 'Hadj Ali',
      prenom: 'Youssef',
      email: 'youssef.hadjali@steg.tn'
    });
    expect(data.internship).toBeNull();
    expect(data.project).toBeNull();
    expect(data.tasks.total).toBe(0);
    expect(data.tasks.next).toEqual([]);
    expect(data.upcoming_meetings).toEqual([]);
    expect(data.journal).toBeNull();
    expect(data.evaluation).toBeNull();
  });

  test('no credentials leak in response', async () => {
    const res = await authFetch('stagiaireInfo', `${OVERVIEW}`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toMatch(/mot_de_passe/i);
    expect(body).not.toMatch(/password/i);
    expect(body).not.toMatch(/token/i);
  });
});
