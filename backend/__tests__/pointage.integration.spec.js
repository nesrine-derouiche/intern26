const BASE = 'http://localhost:3000/api';
const POINTAGES = `${BASE}/pointages`;

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

let stagiaireInfoStageId = null;
let stagiaireElecStageId = null;
let encadrantInfoStageId = null;

async function findStages() {
  if (stagiaireInfoStageId) return;
  const res = await authFetch('admin', `${BASE}/stages`);
  const data = await res.json();
  const stages = Array.isArray(data) ? data : (data.data || []);
  for (const s of stages) {
    if (s.stagiaire_nom === 'Trabelsi') stagiaireInfoStageId = s.id;
    if (s.stagiaire_nom === 'Bouchnak') stagiaireElecStageId = s.id;
    if (s.encadrant_nom === 'Bensalah') encadrantInfoStageId = s.id;
  }
}

async function cleanPointages(stageId) {
  const res = await authFetch('admin', `${POINTAGES}/stage/${stageId}`);
  const data = await res.json();
  const pointages = Array.isArray(data) ? data : (data.data || []);
  for (const p of pointages) {
    await authFetch('admin', `${BASE}/pointages/${p.id}/corriger`, {
      method: 'PUT',
      body: JSON.stringify({ statut: 'ABSENT' })
    });
  }
  const del = await authFetch('admin', `${BASE}/pointages`);
  const allData = await del.json();
  const all = Array.isArray(allData) ? allData : (allData.data || []);
  for (const p of all) {
    await fetch(`${BASE}/pointages/${p.id}/corriger`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await login('admin')}` },
      body: JSON.stringify({ statut: 'ABSENT' })
    });
  }
}

let testPointageId = null;

beforeAll(async () => {
  await findStages();
  // Clean any leftover pointages from previous runs
  const { Pool } = require('pg');
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433'),
    database: process.env.DB_NAME || 'steg_stage',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '0007'
  });
  await pool.query('DELETE FROM pointage');
  await pool.end();
});

describe('AUTH', () => {
  test('sans token → 401', async () => {
    const res = await fetch(POINTAGES);
    expect(res.status).toBe(401);
  });

  test('CANDIDAT → 403', async () => {
    const res = await authFetch('candidat', POINTAGES);
    expect(res.status).toBe(403);
  });
});

describe('ENTRÉE', () => {
  beforeAll(async () => { await findStages(); });

  test('entrée réussie', async () => {
    const res = await authFetch('stagiaireInfo', `${POINTAGES}/entree`, {
      method: 'POST',
      body: JSON.stringify({ stage_id: stagiaireInfoStageId })
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.pointage).toHaveProperty('id');
    expect(data.pointage.stage_id).toBe(stagiaireInfoStageId);
    expect(data.pointage.heure_entree).toBeTruthy();
    expect(['PRESENT', 'RETARD']).toContain(data.pointage.statut);
    testPointageId = data.pointage.id;
  });

  test('deuxième entrée → 409', async () => {
    const res = await authFetch('stagiaireInfo', `${POINTAGES}/entree`, {
      method: 'POST',
      body: JSON.stringify({ stage_id: stagiaireInfoStageId })
    });
    expect(res.status).toBe(409);
  });

  test('stage inexistant → 404', async () => {
    const res = await authFetch('stagiaireInfo', `${POINTAGES}/entree`, {
      method: 'POST',
      body: JSON.stringify({ stage_id: '00000000-0000-0000-0000-000000000000' })
    });
    expect(res.status).toBe(404);
  });

  test('stage d\'un autre stagiaire → 403', async () => {
    const res = await authFetch('stagiaireInfo', `${POINTAGES}/entree`, {
      method: 'POST',
      body: JSON.stringify({ stage_id: stagiaireElecStageId })
    });
    expect(res.status).toBe(403);
  });

  test('sans stage_id → 400', async () => {
    const res = await authFetch('stagiaireInfo', `${POINTAGES}/entree`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    expect(res.status).toBe(400);
  });
});

describe('SORTIE', () => {
  beforeAll(async () => { await findStages(); });

  test('sortie réussie', async () => {
    const res = await authFetch('stagiaireInfo', `${POINTAGES}/sortie`, {
      method: 'POST',
      body: JSON.stringify({ stage_id: stagiaireInfoStageId })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pointage.heure_sortie).toBeTruthy();
  });

  test('deuxième sortie → 409', async () => {
    const res = await authFetch('stagiaireInfo', `${POINTAGES}/sortie`, {
      method: 'POST',
      body: JSON.stringify({ stage_id: stagiaireInfoStageId })
    });
    expect(res.status).toBe(409);
  });

  test('sortie sans entrée (autre stage) → 400', async () => {
    const res = await authFetch('stagiaireElec', `${POINTAGES}/sortie`, {
      method: 'POST',
      body: JSON.stringify({ stage_id: stagiaireElecStageId })
    });
    expect(res.status).toBe(400);
  });
});

describe('HISTORIQUE / MES PRÉSENCES', () => {
  beforeAll(async () => { await findStages(); });

  test('liste personnelle', async () => {
    const res = await authFetch('stagiaireInfo', `${POINTAGES}/mes-presences`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const pointages = Array.isArray(data) ? data : (data.data || []);
    expect(pointages.length).toBeGreaterThan(0);
  });

  test('stagiaireElec ne voit pas les pointages de stagiaireInfo', async () => {
    const res = await authFetch('stagiaireElec', `${POINTAGES}/mes-presences`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const pointages = Array.isArray(data) ? data : (data.data || []);
    for (const p of pointages) {
      expect(p.stage_id).not.toBe(stagiaireInfoStageId);
    }
  });
});

describe('ENCADRANT', () => {
  beforeAll(async () => { await findStages(); });

  test('voit les présences de ses stages', async () => {
    const res = await authFetch('encadrantInfo', `${POINTAGES}/stage/${stagiaireInfoStageId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toBeDefined();
  });

  test('ne voit pas les stages d\'un autre encadrant', async () => {
    if (!stagiaireElecStageId) return;
    const res = await authFetch('encadrantInfo', `${POINTAGES}/stage/${stagiaireElecStageId}`);
    expect(res.status).toBe(403);
  });
});

describe('ADMIN / RH', () => {
  beforeAll(async () => { await findStages(); });

  test('ADMIN voit toutes les présences', async () => {
    const res = await authFetch('admin', POINTAGES);
    expect(res.status).toBe(200);
  });

  test('RH voit toutes les présences', async () => {
    const res = await authFetch('rh', POINTAGES);
    expect(res.status).toBe(200);
  });

  test('ADMIN voit les présences d\'un stage spécifique', async () => {
    const res = await authFetch('admin', `${POINTAGES}/stage/${stagiaireInfoStageId}`);
    expect(res.status).toBe(200);
  });
});

describe('CORRECTION', () => {
  beforeAll(async () => { await findStages(); });

  test('ADMIN peut corriger un pointage', async () => {
    if (!testPointageId) return;
    const res = await authFetch('admin', `${POINTAGES}/${testPointageId}/corriger`, {
      method: 'PUT',
      body: JSON.stringify({ commentaire: 'Corrigé par admin' })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pointage.commentaire).toBe('Corrigé par admin');
  });

  test('RH peut corriger un pointage', async () => {
    if (!testPointageId) return;
    const res = await authFetch('rh', `${POINTAGES}/${testPointageId}/corriger`, {
      method: 'PUT',
      body: JSON.stringify({ statut: 'RETARD', retard_minutes: 15 })
    });
    expect(res.status).toBe(200);
  });

  test('STAGIAIRE ne peut pas corriger → 403', async () => {
    if (!testPointageId) return;
    const res = await authFetch('stagiaireInfo', `${POINTAGES}/${testPointageId}/corriger`, {
      method: 'PUT',
      body: JSON.stringify({ commentaire: 'Hack' })
    });
    expect(res.status).toBe(403);
  });

  test('ENCADRANT ne peut pas corriger → 403', async () => {
    if (!testPointageId) return;
    const res = await authFetch('encadrantInfo', `${POINTAGES}/${testPointageId}/corriger`, {
      method: 'PUT',
      body: JSON.stringify({ commentaire: 'Hack encadrant' })
    });
    expect(res.status).toBe(403);
  });

  test('pointage inexistant → 404', async () => {
    const res = await authFetch('admin', `${POINTAGES}/00000000-0000-0000-0000-000000000000/corriger`, {
      method: 'PUT',
      body: JSON.stringify({ commentaire: 'Test' })
    });
    expect(res.status).toBe(404);
  });
});

describe('HORAIRES', () => {
  beforeAll(async () => { await findStages(); });

  test('récupérer horaire (défaut si inexistant)', async () => {
    const res = await authFetch('stagiaireInfo', `${POINTAGES}/horaires/${stagiaireInfoStageId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('heure_debut');
    expect(data).toHaveProperty('heure_fin');
  });

  test('ENCADRANT peut créer/upsert un horaire', async () => {
    const res = await authFetch('encadrantInfo', `${POINTAGES}/horaires/${stagiaireInfoStageId}`, {
      method: 'PUT',
      body: JSON.stringify({ heure_debut: '08:30', heure_fin: '16:30', duree_pause_minutes: 45 })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.horaire.heure_debut).toMatch(/^08:30/);
  });

  test('STAGIAIRE ne peut pas modifier les horaires → 403', async () => {
    const res = await authFetch('stagiaireInfo', `${POINTAGES}/horaires/${stagiaireInfoStageId}`, {
      method: 'PUT',
      body: JSON.stringify({ heure_debut: '06:00' })
    });
    expect(res.status).toBe(403);
  });

  test('ADMIN peut modifier les horaires', async () => {
    const res = await authFetch('admin', `${POINTAGES}/horaires/${stagiaireInfoStageId}`, {
      method: 'PUT',
      body: JSON.stringify({ heure_debut: '09:00', heure_fin: '17:00' })
    });
    expect(res.status).toBe(200);
  });
});

describe('STATS', () => {
  beforeAll(async () => { await findStages(); });

  test('ADMIN peut récupérer les stats', async () => {
    const res = await authFetch('admin', `${POINTAGES}/stats/${stagiaireInfoStageId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('total_jours');
    expect(data).toHaveProperty('presents');
    expect(data).toHaveProperty('retards');
  });

  test('STAGIAIRE peut récupérer les stats de son stage', async () => {
    const res = await authFetch('stagiaireInfo', `${POINTAGES}/stats/${stagiaireInfoStageId}`);
    expect(res.status).toBe(200);
  });

  test('STAGIAIRE ne peut pas récupérer les stats d\'un autre stage → 403', async () => {
    if (!stagiaireElecStageId) return;
    const res = await authFetch('stagiaireInfo', `${POINTAGES}/stats/${stagiaireElecStageId}`);
    expect(res.status).toBe(403);
  });
});

describe('RÉGRESSION', () => {
  beforeAll(async () => { await findStages(); });

  test('GET /api/projets still works', async () => {
    const res = await authFetch('admin', `${BASE}/projets`);
    expect(res.status).toBe(200);
  });

  test('GET /api/rapports still works', async () => {
    const res = await authFetch('admin', `${BASE}/rapports`);
    expect(res.status).toBe(200);
  });

  test('GET /api/personal-taches still works', async () => {
    const res = await authFetch('stagiaireInfo', `${BASE}/personal-taches`);
    expect(res.status).toBe(200);
  });

  test('GET /api/journals still works', async () => {
    const res = await authFetch('stagiaireInfo', `${BASE}/journals`);
    expect(res.status).toBe(200);
  });

  test('GET /api/stagiaires/projet still works', async () => {
    const res = await authFetch('stagiaireInfo', `${BASE}/stagiaires/projet`);
    expect(res.status).toBe(200);
  });

  test('GET /api/dashboard/stats still works', async () => {
    const res = await authFetch('admin', `${BASE}/dashboard/stats`);
    expect(res.status).toBe(200);
  });
});
