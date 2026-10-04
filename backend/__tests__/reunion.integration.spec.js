const BASE = 'http://localhost:3000/api';

const USERS = {
  encadrantInfo: { email: 'ahmed.bensalah@steg.tn', password: 'encadrant123' },
  encadrantElec: { email: 'rachid.mansour@steg.tn', password: 'encadrant123' },
  stagiaireInfo: { email: 'fatma.trabelsi@steg.tn', password: 'stagiaire123' },
  stagiaireElec: { email: 'mohamed.bouchnak@steg.tn', password: 'stagiaire123' },
  admin: { email: 'admin@steg.tn', password: 'admin123' }
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

let stageInfoId = null;

async function findStageId() {
  if (stageInfoId) return stageInfoId;
  const res = await authFetch('stagiaireInfo', `${BASE}/dashboard/stats`);
  const data = await res.json();
  stageInfoId = data.recentStages[0].id;
  return stageInfoId;
}

describe('Reunions API — STAGIAIRE access', () => {
  test('GET /reunions returns 401 without token', async () => {
    const res = await fetch(`${BASE}/reunions`);
    expect(res.status).toBe(401);
  });

  test('stagiaire can list reunions scoped to own stage', async () => {
    const res = await authFetch('stagiaireInfo', `${BASE}/reunions`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const list = data.data || data;
    expect(Array.isArray(list)).toBe(true);

    for (const r of list) {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('date');
      expect(r).toHaveProperty('heure');
      expect(r).toHaveProperty('sujet');
      expect(r).toHaveProperty('stage_id');
      expect(r).toHaveProperty('encadrant_nom');
      expect(r).toHaveProperty('encadrant_prenom');
    }
  });

  test('stagiaire only sees own stage reunions (ownership isolation)', async () => {
    const infoRes = await authFetch('stagiaireInfo', `${BASE}/reunions`);
    const infoData = await infoRes.json();
    const infoList = infoData.data || infoData;

    const elecRes = await authFetch('stagiaireElec', `${BASE}/reunions`);
    const elecData = await elecRes.json();
    const elecList = elecData.data || elecData;

    const infoIds = new Set(infoList.map((r) => r.id));
    const elecIds = new Set(elecList.map((r) => r.id));

    const overlap = [...infoIds].filter((id) => elecIds.has(id));
    expect(overlap).toHaveLength(0);
  });

  test('stagiaire cannot create a reunion', async () => {
    const stageId = await findStageId();
    const res = await authFetch('stagiaireInfo', `${BASE}/reunions`, {
      method: 'POST',
      body: JSON.stringify({
        stage_id: stageId,
        date: '2026-08-01',
        heure: '10:00',
        sujet: 'Test reunion'
      })
    });
    expect(res.status).toBe(403);
  });

  test('stagiaire cannot delete a reunion', async () => {
    const listRes = await authFetch('stagiaireInfo', `${BASE}/reunions`);
    const listData = await listRes.json();
    const list = listData.data || listData;
    if (list.length > 0) {
      const delRes = await authFetch('stagiaireInfo', `${BASE}/reunions/${list[0].id}`, {
        method: 'DELETE'
      });
      expect(delRes.status).toBe(403);
    }
  });

  test('GET /reunions is paginated', async () => {
    const res = await authFetch('stagiaireInfo', `${BASE}/reunions?page=1&limit=10`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.total).toBe('number');
    expect(Array.isArray(data.data)).toBe(true);
  });
});

describe('Reunions API — ENCADRANT access', () => {
  test('encadrant can list reunions scoped to supervised stages', async () => {
    const res = await authFetch('encadrantInfo', `${BASE}/reunions`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const list = data.data || data;
    expect(Array.isArray(list)).toBe(true);
    for (const r of list) {
      expect(r).toHaveProperty('date');
      expect(r).toHaveProperty('sujet');
    }
  });

  test('unrelated encadrant sees no reunions from another encadrant stage', async () => {
    const infoRes = await authFetch('encadrantInfo', `${BASE}/reunions`);
    const infoData = await infoRes.json();
    const infoList = infoData.data || infoData;

    const elecRes = await authFetch('encadrantElec', `${BASE}/reunions`);
    const elecData = await elecRes.json();
    const elecList = elecData.data || elecData;

    const infoIds = new Set(infoList.map((r) => r.id));
    const elecIds = new Set(elecList.map((r) => r.id));

    const overlap = [...infoIds].filter((id) => elecIds.has(id));
    expect(overlap).toHaveLength(0);
  });
});

describe('Reunions API — ADMIN access', () => {
  test('admin can list all reunions', async () => {
    const res = await authFetch('admin', `${BASE}/reunions`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const list = data.data || data;
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });
});
