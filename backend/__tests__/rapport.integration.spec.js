const BASE = 'http://localhost:3000/api';
const RAPPORTS = `${BASE}/rapports`;

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

let seededRapportId = null;
let seededStageId = null;
let stagiaireInfoStageId = null;
let stagiaireElecStageId = null;

async function findSeededData() {
  if (seededRapportId) return;
  const res = await authFetch('admin', RAPPORTS);
  const data = await res.json();
  const rapports = Array.isArray(data) ? data : (data.data || []);
  if (rapports.length > 0) {
    seededRapportId = rapports[0].id;
    seededStageId = rapports[0].stage_id;
  }
  const stagesRes = await authFetch('admin', `${BASE}/stages`);
  const stagesData = await stagesRes.json();
  const stages = Array.isArray(stagesData) ? stagesData : (stagesData.data || []);
  for (const s of stages) {
    if (s.stagiaire_nom === 'Trabelsi') stagiaireInfoStageId = s.id;
    if (s.stagiaire_nom === 'Bouchnak') stagiaireElecStageId = s.id;
  }
}

let createdRapportId = null;

describe('GET /api/rapports', () => {
  beforeAll(async () => { await findSeededData(); });

  test('returns 401 without token', async () => {
    const res = await fetch(RAPPORTS);
    expect(res.status).toBe(401);
  });

  test('returns 200 with rapport list as ADMIN', async () => {
    const res = await authFetch('admin', RAPPORTS);
    expect(res.status).toBe(200);
    const data = await res.json();
    const rapports = Array.isArray(data) ? data : (data.data || []);
    expect(rapports.length).toBeGreaterThan(0);
    expect(rapports[0]).toHaveProperty('id');
    expect(rapports[0]).toHaveProperty('type');
    expect(rapports[0]).toHaveProperty('statut');
    expect(rapports[0]).toHaveProperty('stage_id');
  });

  test('returns 200 as RH', async () => {
    const res = await authFetch('rh', RAPPORTS);
    expect(res.status).toBe(200);
  });

  test('filters by stage_id', async () => {
    if (!seededStageId) return;
    const res = await authFetch('admin', `${RAPPORTS}?stage_id=${seededStageId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const rapports = Array.isArray(data) ? data : (data.data || []);
    for (const r of rapports) expect(r.stage_id).toBe(seededStageId);
  });

  test('ENCADRANT sees only own stages rapports', async () => {
    const res = await authFetch('encadrantInfo', RAPPORTS);
    expect(res.status).toBe(200);
    const data = await res.json();
    const rapports = Array.isArray(data) ? data : (data.data || []);
    expect(rapports.length).toBeGreaterThan(0);
  });
});

describe('GET /api/rapports/:id', () => {
  beforeAll(async () => { await findSeededData(); });

  test('returns 200 with rapport detail', async () => {
    const res = await authFetch('admin', `${RAPPORTS}/${seededRapportId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('id', seededRapportId);
    expect(data).toHaveProperty('type');
    expect(data).toHaveProperty('statut');
    expect(data).toHaveProperty('stage_id');
  });

  test('returns 404 for non-existent rapport', async () => {
    const res = await authFetch('admin', `${RAPPORTS}/00000000-0000-0000-0000-000000000000`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/rapports', () => {
  beforeAll(async () => { await findSeededData(); });

  test('returns 401 without token', async () => {
    const res = await fetch(RAPPORTS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage_id: 'fake', type: 'INTERMEDIAIRE' })
    });
    expect(res.status).toBe(401);
  });

  test('ENCADRANT cannot create rapport (403)', async () => {
    const res = await authFetch('encadrantInfo', RAPPORTS, {
      method: 'POST',
      body: JSON.stringify({ stage_id: seededStageId, type: 'INTERMEDIAIRE', contenu: 'Test' })
    });
    expect(res.status).toBe(403);
  });

  test('CANDIDAT cannot create rapport (403)', async () => {
    const res = await authFetch('candidat', RAPPORTS, {
      method: 'POST',
      body: JSON.stringify({ stage_id: seededStageId, type: 'INTERMEDIAIRE', contenu: 'Test' })
    });
    expect(res.status).toBe(403);
  });

  test('STAGIAIRE cannot create for another stage (403)', async () => {
    const res = await authFetch('stagiaireInfo', RAPPORTS, {
      method: 'POST',
      body: JSON.stringify({ stage_id: stagiaireElecStageId, type: 'INTERMEDIAIRE', contenu: 'Invasion' })
    });
    expect(res.status).toBe(403);
  });

  test('returns 400 without type', async () => {
    const res = await authFetch('stagiaireInfo', RAPPORTS, {
      method: 'POST',
      body: JSON.stringify({ stage_id: stagiaireInfoStageId, contenu: 'Test' })
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 with invalid type', async () => {
    const res = await authFetch('stagiaireInfo', RAPPORTS, {
      method: 'POST',
      body: JSON.stringify({ stage_id: stagiaireInfoStageId, type: 'INVALID', contenu: 'Test' })
    });
    expect(res.status).toBe(400);
  });

  test('creates rapport as STAGIAIRE (201)', async () => {
    const res = await authFetch('stagiaireInfo', RAPPORTS, {
      method: 'POST',
      body: JSON.stringify({
        stage_id: stagiaireInfoStageId,
        type: 'INTERMEDIAIRE',
        contenu: 'Rapport de test intégration'
      })
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.rapport).toHaveProperty('id');
    expect(data.rapport.statut).toBe('SOUMIS');
    expect(data.rapport.type).toBe('INTERMEDIAIRE');
    createdRapportId = data.rapport.id;
  });

  test('created rapport is visible in list', async () => {
    if (!createdRapportId) return;
    const res = await authFetch('stagiaireInfo', RAPPORTS);
    const data = await res.json();
    const rapports = Array.isArray(data) ? data : (data.data || []);
    const found = rapports.find(r => r.id === createdRapportId);
    expect(found).toBeDefined();
  });
});

describe('PUT /api/rapports/:id', () => {
  beforeAll(async () => { await findSeededData(); });

  test('returns 401 without token', async () => {
    const res = await fetch(`${RAPPORTS}/${seededRapportId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenu: 'Updated' })
    });
    expect(res.status).toBe(401);
  });

  test('returns 404 for non-existent rapport', async () => {
    const res = await authFetch('stagiaireInfo', `${RAPPORTS}/00000000-0000-0000-0000-000000000000`, {
      method: 'PUT',
      body: JSON.stringify({ contenu: 'Updated' })
    });
    expect(res.status).toBe(404);
  });

  test('STAGIAIRE can update own rapport SOUMIS', async () => {
    if (!createdRapportId) return;
    const res = await authFetch('stagiaireInfo', `${RAPPORTS}/${createdRapportId}`, {
      method: 'PUT',
      body: JSON.stringify({ contenu: 'Contenu mis à jour' })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.rapport.contenu).toBe('Contenu mis à jour');
  });

  test('STAGIAIRE cannot update another stagiaire rapport (403)', async () => {
    if (!seededRapportId) return;
    const res = await authFetch('stagiaireElec', `${RAPPORTS}/${seededRapportId}`, {
      method: 'PUT',
      body: JSON.stringify({ contenu: 'Hacked' })
    });
    expect(res.status).toBe(403);
  });
});

describe('Workflow: SOUMIS → EN_REVISION → VALIDE', () => {
  let workflowRapportId = null;

  test('STAGIAIRE creates rapport for workflow test', async () => {
    const res = await authFetch('stagiaireInfo', RAPPORTS, {
      method: 'POST',
      body: JSON.stringify({
        stage_id: stagiaireInfoStageId,
        type: 'FINAL',
        contenu: 'Rapport workflow test'
      })
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    workflowRapportId = data.rapport.id;
    expect(data.rapport.statut).toBe('SOUMIS');
  });

  test('ENCADRANT sets EN_REVISION (200)', async () => {
    if (!workflowRapportId) return;
    const res = await authFetch('encadrantInfo', `${RAPPORTS}/${workflowRapportId}/en-revision`, {
      method: 'POST'
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.rapport.statut).toBe('EN_REVISION');
  });

  test('ENCADRANT validates rapport (200)', async () => {
    if (!workflowRapportId) return;
    const res = await authFetch('encadrantInfo', `${RAPPORTS}/${workflowRapportId}/valider`, {
      method: 'POST'
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.rapport.statut).toBe('VALIDE');
  });

  test('STAGIAIRE cannot modify VALIDE rapport', async () => {
    if (!workflowRapportId) return;
    const res = await authFetch('stagiaireInfo', `${RAPPORTS}/${workflowRapportId}`, {
      method: 'PUT',
      body: JSON.stringify({ contenu: 'Modified after validation' })
    });
    expect(res.status).toBe(400);
  });
});

describe('Workflow: SOUMIS → EN_REVISION → REJETE → SOUMIS', () => {
  let rejectRapportId = null;

  test('STAGIAIRE creates rapport for reject test', async () => {
    const res = await authFetch('stagiaireInfo', RAPPORTS, {
      method: 'POST',
      body: JSON.stringify({
        stage_id: stagiaireInfoStageId,
        type: 'INTERMEDIAIRE',
        contenu: 'Rapport reject test'
      })
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    rejectRapportId = data.rapport.id;
    expect(data.rapport.statut).toBe('SOUMIS');
  });

  test('ENCADRANT sets EN_REVISION', async () => {
    if (!rejectRapportId) return;
    const res = await authFetch('encadrantInfo', `${RAPPORTS}/${rejectRapportId}/en-revision`, {
      method: 'POST'
    });
    expect(res.status).toBe(200);
  });

  test('ENCADRANT rejects with commentaire (200)', async () => {
    if (!rejectRapportId) return;
    const res = await authFetch('encadrantInfo', `${RAPPORTS}/${rejectRapportId}/rejeter`, {
      method: 'POST',
      body: JSON.stringify({ commentaire: 'Veuillez compléter la partie technique.' })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.rapport.statut).toBe('REJETE');
    expect(data.rapport.commentaire).toBe('Veuillez compléter la partie technique.');
  });

  test('reject without commentaire fails (400)', async () => {
    const createRes = await authFetch('stagiaireInfo', RAPPORTS, {
      method: 'POST',
      body: JSON.stringify({ stage_id: stagiaireInfoStageId, type: 'INTERMEDIAIRE', contenu: 'Temp' })
    });
    const createData = await createRes.json();
    const tempId = createData.rapport.id;

    const revRes = await authFetch('encadrantInfo', `${RAPPORTS}/${tempId}/en-revision`, { method: 'POST' });
    expect(revRes.status).toBe(200);

    const rejRes = await authFetch('encadrantInfo', `${RAPPORTS}/${tempId}/rejeter`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    expect(rejRes.status).toBe(400);
  });

  test('STAGIAIRE can update REJETE rapport and resubmit', async () => {
    if (!rejectRapportId) return;
    const updRes = await authFetch('stagiaireInfo', `${RAPPORTS}/${rejectRapportId}`, {
      method: 'PUT',
      body: JSON.stringify({ contenu: 'Contenu corrigé après rejet.' })
    });
    expect(updRes.status).toBe(200);
  });
});

describe('Invalid transitions', () => {
  test('SOUMIS → VALIDE is invalid', async () => {
    const createRes = await authFetch('stagiaireInfo', RAPPORTS, {
      method: 'POST',
      body: JSON.stringify({ stage_id: stagiaireInfoStageId, type: 'INTERMEDIAIRE', contenu: 'Invalid test' })
    });
    const createData = await createRes.json();
    const tempId = createData.rapport.id;

    const valRes = await authFetch('encadrantInfo', `${RAPPORTS}/${tempId}/valider`, { method: 'POST' });
    expect(valRes.status).toBe(400);
  });

  test('SOUMIS → REJETE is invalid', async () => {
    const createRes = await authFetch('stagiaireInfo', RAPPORTS, {
      method: 'POST',
      body: JSON.stringify({ stage_id: stagiaireInfoStageId, type: 'INTERMEDIAIRE', contenu: 'Invalid test 2' })
    });
    const createData = await createRes.json();
    const tempId = createData.rapport.id;

    const rejRes = await authFetch('encadrantInfo', `${RAPPORTS}/${tempId}/rejeter`, {
      method: 'POST',
      body: JSON.stringify({ commentaire: 'Nope' })
    });
    expect(rejRes.status).toBe(400);
  });
});

describe('DELETE /api/rapports/:id', () => {
  let deleteRapportId = null;

  test('STAGIAIRE creates rapport for deletion', async () => {
    const res = await authFetch('stagiaireInfo', RAPPORTS, {
      method: 'POST',
      body: JSON.stringify({ stage_id: stagiaireInfoStageId, type: 'INTERMEDIAIRE', contenu: 'Delete me' })
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    deleteRapportId = data.rapport.id;
  });

  test('returns 401 without token', async () => {
    if (!deleteRapportId) return;
    const res = await fetch(`${RAPPORTS}/${deleteRapportId}`, { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  test('STAGIAIRE can delete SOUMIS rapport (200)', async () => {
    if (!deleteRapportId) return;
    const res = await authFetch('stagiaireInfo', `${RAPPORTS}/${deleteRapportId}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
  });

  test('deleted rapport is gone', async () => {
    if (!deleteRapportId) return;
    const res = await authFetch('admin', `${RAPPORTS}/${deleteRapportId}`);
    expect(res.status).toBe(404);
  });

  test('STAGIAIRE cannot delete EN_REVISION rapport', async () => {
    const createRes = await authFetch('stagiaireInfo', RAPPORTS, {
      method: 'POST',
      body: JSON.stringify({ stage_id: stagiaireInfoStageId, type: 'INTERMEDIAIRE', contenu: 'No delete' })
    });
    const createData = await createRes.json();
    const tempId = createData.rapport.id;

    await authFetch('encadrantInfo', `${RAPPORTS}/${tempId}/en-revision`, { method: 'POST' });

    const delRes = await authFetch('stagiaireInfo', `${RAPPORTS}/${tempId}`, { method: 'DELETE' });
    expect(delRes.status).toBe(400);
  });

  test('STAGIAIRE cannot delete another stagiaire rapport (403)', async () => {
    if (!seededRapportId) return;
    const res = await authFetch('stagiaireElec', `${RAPPORTS}/${seededRapportId}`, { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  test('ENCADRANT cannot delete rapport (403)', async () => {
    if (!seededRapportId) return;
    const res = await authFetch('encadrantInfo', `${RAPPORTS}/${seededRapportId}`, { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  test('returns 404 for non-existent rapport', async () => {
    const res = await authFetch('admin', `${RAPPORTS}/00000000-0000-0000-0000-000000000000`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

describe('Regression: dashboard and existing features', () => {
  beforeAll(async () => { await findSeededData(); });

  test('dashboard still returns rapportsEnAttente', async () => {
    const res = await authFetch('admin', `${BASE}/dashboard/stats`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.alerts).toHaveProperty('rapportsEnAttente');
    expect(Array.isArray(data.alerts.rapportsEnAttente)).toBe(true);
  });

  test('ENCADRANT dashboard still has rapports data', async () => {
    const res = await authFetch('encadrantElec', `${BASE}/dashboard/stats`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.encadrant).toHaveProperty('rapportsAValider');
    expect(data.encadrant).toHaveProperty('rapportsSoumis');
    expect(Array.isArray(data.encadrant.rapportsSoumis)).toBe(true);
  });

  test('GET /api/stagiaires/projet still works', async () => {
    const res = await authFetch('stagiaireInfo', `${BASE}/stagiaires/projet`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('project');
  });

  test('seeded rapports data is intact', async () => {
    if (!seededRapportId) return;
    const res = await authFetch('admin', `${RAPPORTS}/${seededRapportId}`);
    if (res.status === 404) return;
    const data = await res.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('type');
  });
});
