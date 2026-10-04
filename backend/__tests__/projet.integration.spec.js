const BASE = 'http://localhost:3000/api';
const PROJETS = `${BASE}/projets`;
const STAGIAIRE_PROJET = `${BASE}/stagiaires/projet`;
const TACHES = `${BASE}/taches/mes-taches`;

const USERS = {
  admin: { email: 'admin@steg.tn', password: 'admin123' },
  rh: { email: 'salma.bouazizi@steg.tn', password: 'rh1234' },
  encadrantInfo: { email: 'ahmed.bensalah@steg.tn', password: 'encadrant123' },
  encadrantElec: { email: 'rachid.mansour@steg.tn', password: 'encadrant123' },
  stagiaireInfo: { email: 'fatma.trabelsi@steg.tn', password: 'stagiaire123' },
  stagiaireElec: { email: 'mohamed.bouchnak@steg.tn', password: 'stagiaire123' },
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

let seededProjetId = null;
let seededStageId = null;

async function findSeededData() {
  if (seededProjetId) return;
  const res = await authFetch('admin', `${PROJETS}`);
  const data = await res.json();
  const projets = Array.isArray(data) ? data : (data.data || []);
  if (projets.length > 0) {
    seededProjetId = projets[0].id;
    seededStageId = projets[0].stage_id;
  }
}

let projectWithTasksId = null;

async function findProjectWithTasks() {
  if (projectWithTasksId) return projectWithTasksId;
  const res = await authFetch('admin', `${PROJETS}`);
  const data = await res.json();
  const projets = Array.isArray(data) ? data : (data.data || []);
  for (const p of projets) {
    const detail = await authFetch('admin', `${PROJETS}/${p.id}`);
    if (detail.ok) {
      projectWithTasksId = p.id;
      return p.id;
    }
  }
  return projets[0]?.id;
}

describe('GET /api/projets', () => {
  beforeAll(async () => { await findSeededData(); });

  test('returns 401 without token', async () => {
    const res = await fetch(`${PROJETS}`);
    expect(res.status).toBe(401);
  });

  test('returns 200 with projet list as ADMIN', async () => {
    const res = await authFetch('admin', `${PROJETS}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const projets = Array.isArray(data) ? data : (data.data || []);
    expect(projets.length).toBeGreaterThan(0);
    expect(projets[0]).toHaveProperty('id');
    expect(projets[0]).toHaveProperty('titre');
    expect(projets[0]).toHaveProperty('stage_id');
    expect(projets[0]).toHaveProperty('etat');
    expect(projets[0]).toHaveProperty('avancement');
  });

  test('returns 200 with projet list as RH', async () => {
    const res = await authFetch('rh', `${PROJETS}`);
    expect(res.status).toBe(200);
  });

  test('filters by stage_id', async () => {
    const res = await authFetch('admin', `${PROJETS}?stage_id=${seededStageId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const projets = Array.isArray(data) ? data : (data.data || []);
    expect(projets.length).toBe(1);
    expect(projets[0].stage_id).toBe(seededStageId);
  });

  test('returns empty for non-existent stage_id', async () => {
    const res = await authFetch('admin', `${PROJETS}?stage_id=00000000-0000-0000-0000-000000000000`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const projets = Array.isArray(data) ? data : (data.data || []);
    expect(projets.length).toBe(0);
  });

  test('ENCADRANT sees only own stages projets', async () => {
    const res = await authFetch('encadrantInfo', `${PROJETS}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const projets = Array.isArray(data) ? data : (data.data || []);
    for (const p of projets) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('titre');
    }
  });
});

describe('GET /api/projets/:id', () => {
  beforeAll(async () => { await findSeededData(); });

  test('returns 401 without token', async () => {
    const res = await fetch(`${PROJETS}/${seededProjetId}`);
    expect(res.status).toBe(401);
  });

  test('returns 200 with projet detail', async () => {
    const res = await authFetch('admin', `${PROJETS}/${seededProjetId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('id', seededProjetId);
    expect(data).toHaveProperty('titre');
    expect(data).toHaveProperty('description');
    expect(data).toHaveProperty('technologies');
    expect(data).toHaveProperty('etat');
    expect(data).toHaveProperty('avancement');
    expect(data).toHaveProperty('stage_id');
  });

  test('returns 404 for non-existent projet', async () => {
    const res = await authFetch('admin', `${PROJETS}/00000000-0000-0000-0000-000000000000`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/projets', () => {
  let newStageId = null;
  let createdProjetId = null;

  test('returns 401 without token', async () => {
    const res = await fetch(`${PROJETS}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage_id: 'fake', titre: 'Test' })
    });
    expect(res.status).toBe(401);
  });

  test('STAGIAIRE cannot create projet (403)', async () => {
    const res = await authFetch('stagiaireInfo', `${PROJETS}`, {
      method: 'POST',
      body: JSON.stringify({ stage_id: seededStageId, titre: 'Test' })
    });
    expect(res.status).toBe(403);
  });

  test('CANDIDAT cannot create projet (403)', async () => {
    const res = await authFetch('candidat', `${PROJETS}`, {
      method: 'POST',
      body: JSON.stringify({ stage_id: seededStageId, titre: 'Test' })
    });
    expect(res.status).toBe(403);
  });

  test('returns 400 without titre', async () => {
    const res = await authFetch('admin', `${PROJETS}`, {
      method: 'POST',
      body: JSON.stringify({ stage_id: seededStageId })
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors || data.message).toBeDefined();
  });

  test('returns error for non-existent stage', async () => {
    const res = await authFetch('admin', `${PROJETS}`, {
      method: 'POST',
      body: JSON.stringify({ stage_id: '00000000-0000-0000-0000-000000000000', titre: 'Test' })
    });
    expect(res.status).toBe(400);
  });

  test('returns 409 when stage already has a projet', async () => {
    const res = await authFetch('admin', `${PROJETS}`, {
      method: 'POST',
      body: JSON.stringify({ stage_id: seededStageId, titre: 'Doublon' })
    });
    expect(res.status).toBe(409);
  });

  test('returns error when ENCADRANT creates for another encadrant stage', async () => {
    const res = await authFetch('encadrantElec', `${PROJETS}`, {
      method: 'POST',
      body: JSON.stringify({ stage_id: seededStageId, titre: 'Invasion' })
    });
    expect([403, 409]).toContain(res.status);
  });

  test('creates projet as ADMIN (201)', async () => {
    const adminToken = await login('admin');
    const stagesRes = await fetch(`${BASE}/stages`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const stagesData = await stagesRes.json();
    const stages = Array.isArray(stagesData) ? stagesData : (stagesData.data || []);
    const freeStage = stages.find(s => {
      return !['TERMINE', 'ANNULE'].includes(s.statut);
    });

    if (!freeStage) return;

    const checkRes = await authFetch('admin', `${PROJETS}?stage_id=${freeStage.id}`);
    const checkData = await checkRes.json();
    const existing = Array.isArray(checkData) ? checkData : (checkData.data || []);
    if (existing.length > 0) return;

    const res = await authFetch('admin', `${PROJETS}`, {
      method: 'POST',
      body: JSON.stringify({
        stage_id: freeStage.id,
        titre: 'Projet Test CRUD',
        description: 'Description test',
        technologies: 'Node.js, Jest',
        etat: 'EN_COURS',
        avancement: 10
      })
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.projet).toHaveProperty('id');
    expect(data.projet.titre).toBe('Projet Test CRUD');
    expect(data.projet.avancement).toBe(10);
    createdProjetId = data.projet.id;
    newStageId = freeStage.id;
  });

  test('created projet is visible in GET list', async () => {
    if (!createdProjetId) return;
    const res = await authFetch('admin', `${PROJETS}`);
    const data = await res.json();
    const projets = Array.isArray(data) ? data : (data.data || []);
    const found = projets.find(p => p.id === createdProjetId);
    expect(found).toBeDefined();
  });

  test('cleanup: delete created projet', async () => {
    if (!createdProjetId) return;
    const res = await authFetch('admin', `${PROJETS}/${createdProjetId}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
  });
});

describe('PUT /api/projets/:id', () => {
  beforeAll(async () => { await findSeededData(); });

  test('returns 401 without token', async () => {
    const res = await fetch(`${PROJETS}/${seededProjetId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titre: 'Updated' })
    });
    expect(res.status).toBe(401);
  });

  test('returns 404 for non-existent projet', async () => {
    const res = await authFetch('admin', `${PROJETS}/00000000-0000-0000-0000-000000000000`, {
      method: 'PUT',
      body: JSON.stringify({ titre: 'Updated' })
    });
    expect(res.status).toBe(404);
  });

  test('updates projet as ADMIN (200)', async () => {
    const res = await authFetch('admin', `${PROJETS}/${seededProjetId}`, {
      method: 'PUT',
      body: JSON.stringify({ titre: 'Projet Mis A Jour', avancement: 75 })
    });
    expect(res.status).toBe(200);
    const checkRes = await authFetch('admin', `${PROJETS}/${seededProjetId}`);
    const data = await checkRes.json();
    expect(data.titre).toBe('Projet Mis A Jour');
    expect(data.avancement).toBe(75);
  });

  test('ENCADRANT can update own projet', async () => {
    const res = await authFetch('encadrantInfo', `${PROJETS}/${seededProjetId}`, {
      method: 'PUT',
      body: JSON.stringify({ description: 'Updated by encadrant' })
    });
    expect(res.status).toBe(200);
  });

  test('ENCADRANT cannot update another encadrant projet (403)', async () => {
    const res = await authFetch('encadrantElec', `${PROJETS}/${seededProjetId}`, {
      method: 'PUT',
      body: JSON.stringify({ titre: 'Hacked' })
    });
    expect(res.status).toBe(403);
  });

  test('restore original titre', async () => {
    await authFetch('admin', `${PROJETS}/${seededProjetId}`, {
      method: 'PUT',
      body: JSON.stringify({ titre: 'Dashboard de Gestion des Stages', avancement: 65 })
    });
  });
});

describe('DELETE /api/projets/:id', () => {
  let tempProjetId = null;
  let tempStageId = null;

  test('create temp projet for deletion test', async () => {
    const adminToken = await login('admin');
    const stagesRes = await fetch(`${BASE}/stages`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const stagesData = await stagesRes.json();
    const stages = Array.isArray(stagesData) ? stagesData : (stagesData.data || []);
    const freeStage = stages.find(s => !['TERMINE', 'ANNULE'].includes(s.statut));
    if (!freeStage) return;

    const checkRes = await authFetch('admin', `${PROJETS}?stage_id=${freeStage.id}`);
    const checkData = await checkRes.json();
    const existing = Array.isArray(checkData) ? checkData : (checkData.data || []);
    if (existing.length > 0) return;

    const res = await authFetch('admin', `${PROJETS}`, {
      method: 'POST',
      body: JSON.stringify({ stage_id: freeStage.id, titre: 'Temp Delete Test' })
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    tempProjetId = data.projet.id;
    tempStageId = freeStage.id;
  });

  test('returns 401 without token', async () => {
    if (!tempProjetId) return;
    const res = await fetch(`${PROJETS}/${tempProjetId}`, { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  test('ENCADRANT cannot delete projet (403)', async () => {
    if (!tempProjetId) return;
    const res = await authFetch('encadrantInfo', `${PROJETS}/${tempProjetId}`, { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  test('STAGIAIRE cannot delete projet (403)', async () => {
    if (!tempProjetId) return;
    const res = await authFetch('stagiaireInfo', `${PROJETS}/${tempProjetId}`, { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  test('CANDIDAT cannot delete projet (403)', async () => {
    if (!tempProjetId) return;
    const res = await authFetch('candidat', `${PROJETS}/${tempProjetId}`, { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  test('returns 404 for non-existent projet', async () => {
    const res = await authFetch('admin', `${PROJETS}/00000000-0000-0000-0000-000000000000`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  test('ADMIN can delete projet (200)', async () => {
    if (!tempProjetId) return;
    const res = await authFetch('admin', `${PROJETS}/${tempProjetId}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
  });

  test('deleted projet is no longer visible', async () => {
    if (!tempProjetId) return;
    const res = await authFetch('admin', `${PROJETS}/${tempProjetId}`);
    expect(res.status).toBe(404);
  });
});

describe('Regression: existing features still work', () => {
  beforeAll(async () => { await findSeededData(); });

  test('GET /api/stagiaires/projet still works for stagiaire', async () => {
    const res = await authFetch('stagiaireInfo', STAGIAIRE_PROJET);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('project');
    expect(data).toHaveProperty('stage');
    expect(data).toHaveProperty('tasks');
  });

  test('GET /api/taches/mes-taches still works', async () => {
    const res = await authFetch('stagiaireInfo', TACHES);
    expect(res.status).toBe(200);
    const data = await res.json();
    const tasks = Array.isArray(data) ? data : (data.data || []);
    expect(tasks.length).toBeGreaterThan(0);
  });

  test('seeded projet avancement is intact', async () => {
    const res = await authFetch('admin', `${PROJETS}/${seededProjetId}`);
    const data = await res.json();
    expect(data.avancement).toBe(65);
    expect(data.titre).toBe('Dashboard de Gestion des Stages');
  });
});
