const BASE = 'http://localhost:3000/api';
const CALENDAR = `${BASE}/stagiaires/calendar`;

const USERS = {
  stagiaireInfo: { email: 'fatma.trabelsi@steg.tn', password: 'stagiaire123' },
  stagiaireElec: { email: 'mohamed.bouchnak@steg.tn', password: 'stagiaire123' },
  stagiaireNoStage: { email: 'youssef.hadjali@steg.tn', password: 'stagiaire123' },
  admin: { email: 'admin@steg.tn', password: 'admin123' },
  encadrant: { email: 'ahmed.bensalah@steg.tn', password: 'encadrant123' },
  rh: { email: 'salma.bouazizi@steg.tn', password: 'rh1234' },
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

describe('GET /api/stagiaires/calendar', () => {
  test('returns 401 without token', async () => {
    const res = await fetch(CALENDAR);
    expect(res.status).toBe(401);
  });

  test('returns 403 as ADMIN', async () => {
    const res = await authFetch('admin', CALENDAR);
    expect(res.status).toBe(403);
  });

  test('returns 403 as RH', async () => {
    const res = await authFetch('rh', CALENDAR);
    expect(res.status).toBe(403);
  });

  test('returns 403 as ENCADRANT', async () => {
    const res = await authFetch('encadrant', CALENDAR);
    expect(res.status).toBe(403);
  });

  test('returns 200 with array for stagiaire with stage', async () => {
    const res = await authFetch('stagiaireInfo', CALENDAR);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('each event has required fields', async () => {
    const res = await authFetch('stagiaireInfo', CALENDAR);
    expect(res.status).toBe(200);
    const events = await res.json();

    for (const event of events) {
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('type');
      expect(event).toHaveProperty('title');
      expect(event).toHaveProperty('date');
      expect(event).toHaveProperty('status');
      expect(event).toHaveProperty('resource_id');
      expect(['INTERNSHIP', 'MEETING', 'TASK']).toContain(event.type);
    }
  });

  test('stagiaire only sees own events (ownership isolation)', async () => {
    const res1 = await authFetch('stagiaireInfo', CALENDAR);
    const events1 = await res1.json();

    const res2 = await authFetch('stagiaireElec', CALENDAR);
    const events2 = await res2.json();

    const ids1 = new Set(events1.map(e => e.id));
    const ids2 = new Set(events2.map(e => e.id));

    const overlap = [...ids1].filter(id => ids2.has(id));
    expect(overlap).toEqual([]);
  });

  test('returns 200 with empty array for stagiaire without stage', async () => {
    const res = await authFetch('stagiaireNoStage', CALENDAR);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toEqual([]);
  });

  test('includes internship start and end events', async () => {
    const res = await authFetch('stagiaireInfo', CALENDAR);
    const events = await res.json();

    const internshipEvents = events.filter(e => e.type === 'INTERNSHIP');
    expect(internshipEvents.length).toBeGreaterThanOrEqual(2);

    const starts = internshipEvents.filter(e => e.title === 'Début du stage');
    const ends = internshipEvents.filter(e => e.title === 'Fin du stage');
    expect(starts.length).toBe(1);
    expect(ends.length).toBe(1);
  });

  test('events are sorted by date ascending', async () => {
    const res = await authFetch('stagiaireInfo', CALENDAR);
    const events = await res.json();

    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1].date ? new Date(events[i - 1].date).getTime() : 0;
      const curr = events[i].date ? new Date(events[i].date).getTime() : 0;
      expect(prev).toBeLessThanOrEqual(curr);
    }
  });

  test('no credentials leak in response', async () => {
    const res = await authFetch('stagiaireInfo', CALENDAR);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toMatch(/mot_de_passe/i);
    expect(body).not.toMatch(/password/i);
    expect(body).not.toMatch(/token/i);
  });
});
