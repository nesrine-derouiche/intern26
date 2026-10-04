const BASE = 'http://localhost:3000/api';

const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5433),
  database: process.env.DB_NAME || 'steg_stage',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '0007'
});

afterAll(async () => {
  await pool.end();
});

const USERS = {
  encadrantInfo: { email: 'ahmed.bensalah@steg.tn', password: 'encadrant123' },
  encadrantElec: { email: 'rachid.mansour@steg.tn', password: 'encadrant123' },
  stagiaireInfo: { email: 'fatma.trabelsi@steg.tn', password: 'stagiaire123' },
  stagiaireElec: { email: 'mohamed.bouchnak@steg.tn', password: 'stagiaire123' },
  admin: { email: 'admin@steg.tn', password: 'admin123' },
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

let stageInfoId = null;
let stageElecId = null;

async function findStageIds() {
  if (stageInfoId && stageElecId) return;
  const res = await authFetch('stagiaireInfo', `${BASE}/dashboard/stats`);
  const data = await res.json();
  stageInfoId = data.recentStages[0].id;
  const res2 = await authFetch('stagiaireElec', `${BASE}/dashboard/stats`);
  const data2 = await res2.json();
  stageElecId = data2.recentStages[0].id;
}

async function cleanupEvaluation(stageId) {
  const token = await login('encadrantInfo');
  const evals = await fetch(`${BASE}/evaluations`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const evalData = await evals.json();
  const list = evalData.data || evalData;
  for (const e of list) {
    if (e.stage_id === stageId) {
      await fetch(`${BASE}/evaluations/${e.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
    }
  }
}

async function resetStage(statut) {
  const token = await login('admin');
  const res = await fetch(`${BASE}/stages/${stageInfoId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ statut })
  });
  if (res.status === 200) return;

  /*
   * Repli : l'API ne peut pas repasser un stage terminé « aujourd'hui » en
   * EN_COURS (date_debut = maintenant ⇒ CHECK date_fin > date_debut violé).
   * On force alors l'état directement en base pour garder le test auto-réparant.
   */
  if (statut === 'EN_COURS') {
    await pool.query(
      `UPDATE stage SET statut = 'EN_COURS', date_debut = '2026-05-01'::date, date_fin = '2026-12-31'::date
       WHERE id = $1`,
      [stageInfoId]
    );
  } else {
    await pool.query('UPDATE stage SET statut = $1 WHERE id = $2', [statut, stageInfoId]);
  }
}

describe('Evaluation API — workflow', () => {
  beforeAll(async () => {
    await findStageIds();
    await cleanupEvaluation(stageInfoId);
    await resetStage('EN_COURS');
  });

  afterAll(async () => {
    await resetStage('EN_COURS');
  });

  test('encadrant can create evaluation for EN_COURS stage', async () => {
    const res = await authFetch('encadrantInfo', `${BASE}/evaluations`, {
      method: 'POST',
      body: JSON.stringify({
        stage_id: stageInfoId,
        technique: 16,
        communication: 14,
        autonomie: 15,
        ponctualite: 18,
        qualite: 17,
        commentaire: 'Bon travail global.'
      })
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.evaluation).toBeDefined();
    expect(data.evaluation.note_finale).toBeDefined();
    expect(parseFloat(data.evaluation.note_finale)).toBeGreaterThan(0);
    expect(data.evaluation.validee).toBe(true);
  });

  test('cannot create duplicate evaluation for same stage', async () => {
    const res = await authFetch('encadrantInfo', `${BASE}/evaluations`, {
      method: 'POST',
      body: JSON.stringify({
        stage_id: stageInfoId,
        technique: 10,
        communication: 10,
        autonomie: 10,
        ponctualite: 10,
        qualite: 10
      })
    });
    expect(res.status).toBe(400);
  });

  test('stagiaire cannot create evaluation', async () => {
    const res = await authFetch('stagiaireInfo', `${BASE}/evaluations`, {
      method: 'POST',
      body: JSON.stringify({
        stage_id: stageInfoId,
        technique: 10,
        communication: 10,
        autonomie: 10,
        ponctualite: 10,
        qualite: 10
      })
    });
    expect(res.status).toBe(403);
  });

  test('evaluation cannot be modified (validated)', async () => {
    const evals = await authFetch('encadrantInfo', `${BASE}/evaluations`);
    const evalData = await evals.json();
    const list = evalData.data || evalData;
    const evaluation = list.find((e) => e.stage_id === stageInfoId);
    expect(evaluation).toBeDefined();

    const res = await authFetch('encadrantInfo', `${BASE}/evaluations/${evaluation.id}`, {
      method: 'PUT',
      body: JSON.stringify({ commentaire: 'Modified' })
    });
    expect(res.status).toBe(400);
  });

  test('stagiaire can read evaluations', async () => {
    const res = await authFetch('stagiaireInfo', `${BASE}/evaluations`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const list = data.data || data;
    expect(Array.isArray(list)).toBe(true);
    const own = list.find((e) => e.stage_id === stageInfoId);
    expect(own).toBeDefined();
  });

  test('unrelated stagiaire cannot see another stagiaire evaluation', async () => {
    const res = await authFetch('stagiaireElec', `${BASE}/evaluations`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const list = data.data || data;
    const other = list.find((e) => e.stage_id === stageInfoId);
    expect(other).toBeUndefined();
  });
});

describe('Completion API — workflow', () => {
  beforeAll(async () => {
    await findStageIds();
    await cleanupEvaluation(stageInfoId);
    await resetStage('EN_COURS');
  });

  afterAll(async () => {
    await resetStage('EN_COURS');
  });

  test('cannot complete stage without evaluation', async () => {
    const res = await authFetch('encadrantInfo', `${BASE}/stages/${stageInfoId}/complete`, {
      method: 'POST'
    });
    expect(res.status).toBe(400);
  });

  test('encadrant completes stage after evaluation', async () => {
    const evalRes = await authFetch('encadrantInfo', `${BASE}/evaluations`, {
      method: 'POST',
      body: JSON.stringify({
        stage_id: stageInfoId,
        technique: 16,
        communication: 14,
        autonomie: 15,
        ponctualite: 18,
        qualite: 17,
        commentaire: 'Évaluation avant clôture.'
      })
    });
    expect(evalRes.status).toBe(201);

    const res = await authFetch('encadrantInfo', `${BASE}/stages/${stageInfoId}/complete`, {
      method: 'POST'
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.stage).toBeDefined();
    expect(data.stage.statut).toBe('TERMINE');
    expect(data.evaluation).toBeDefined();
    expect(data.available_documents).toContain('convention');
    expect(data.available_documents).toContain('attestation');
    expect(data.available_documents).toContain('evaluation');
  });

  test('cannot complete an already completed stage', async () => {
    const res = await authFetch('encadrantInfo', `${BASE}/stages/${stageInfoId}/complete`, {
      method: 'POST'
    });
    expect(res.status).toBe(400);
  });

  test('stagiaire cannot complete a stage', async () => {
    const res = await authFetch('stagiaireInfo', `${BASE}/stages/${stageInfoId}/complete`, {
      method: 'POST'
    });
    expect(res.status).toBe(403);
  });

  test('trainee sees completion data', async () => {
    const res = await authFetch('stagiaireInfo', `${BASE}/stagiaires/completion`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.is_completed).toBe(true);
    expect(data.evaluation).toBeDefined();
    expect(data.evaluation.note_finale).toBeDefined();
    expect(data.completion_date).toBeDefined();
    expect(data.available_documents).toContain('convention');
    expect(data.available_documents).toContain('attestation');
    expect(data.available_documents).toContain('evaluation');
  });

  test('unrelated stagiaire sees their own completion data', async () => {
    const res = await authFetch('stagiaireElec', `${BASE}/stagiaires/completion`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.stage).toBeDefined();
    expect(data.is_completed).toBeDefined();
  });

  test('admin cannot access stagiaire completion endpoint', async () => {
    const res = await authFetch('admin', `${BASE}/stagiaires/completion`);
    expect(res.status).toBe(403);
  });
});
