require('dotenv').config();
const pool = require('../config/db');

const BASE = 'http://localhost:3000/api';

const MIGRATION_SQL = [
  `CREATE OR REPLACE FUNCTION trg_set_updated_at()
     RETURNS TRIGGER AS $$
     BEGIN
       NEW.updated_at = now();
       RETURN NEW;
     END;
   $$ LANGUAGE plpgsql`,
  `ALTER TABLE reunion ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()`,
  `ALTER TABLE reunion ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`,
  `DROP TRIGGER IF EXISTS set_updated_at_reunion ON reunion`,
  `CREATE TRIGGER set_updated_at_reunion BEFORE UPDATE ON reunion FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()`,
  `ALTER TABLE evaluation ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()`,
  `ALTER TABLE evaluation ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`,
  `DROP TRIGGER IF EXISTS set_updated_at_evaluation ON evaluation`,
  `CREATE TRIGGER set_updated_at_evaluation BEFORE UPDATE ON evaluation FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()`
];

async function getInfra() {
  const { rows } = await pool.query(
    `SELECT s.id AS stage_id, s.encadrant_id, s.stagiaire_id
     FROM stage s
     WHERE s.statut IN ('EN_COURS', 'TERMINE')
     ORDER BY s.date_debut DESC
     LIMIT 1`
  );
  return rows[0];
}

describe('M5 — horodatage réunion & évaluation (migration idempotente)', () => {
  test('la migration M5 est idempotente : rejouée sans erreur', async () => {
    const client = await pool.connect();
    try {
      for (let round = 0; round < 2; round++) {
        for (const sql of MIGRATION_SQL) {
          await client.query(sql);
        }
      }
    } finally {
      client.release();
    }
  });

  test('les triggers set_updated_at_* existent sur reunion et evaluation', async () => {
    const { rows } = await pool.query(
      `SELECT event_object_table, trigger_name
       FROM information_schema.triggers
       WHERE trigger_schema = 'public'
         AND trigger_name IN ('set_updated_at_reunion', 'set_updated_at_evaluation')
       ORDER BY trigger_name`
    );
    expect(rows.map((r) => r.trigger_name).sort()).toEqual(
      ['set_updated_at_evaluation', 'set_updated_at_reunion']
    );
  });
});

let cleanupReunion = [];
let cleanupEvaluation = [];

afterAll(async () => {
  for (const id of cleanupReunion) {
    await pool.query('DELETE FROM reunion WHERE id = $1', [id]);
  }
  for (const id of cleanupEvaluation) {
    await pool.query('DELETE FROM evaluation WHERE id = $1', [id]);
  }
  await pool.end();
});

describe('M5 — réunion : created_at/updated_at', () => {
  let stage;
  beforeAll(async () => {
    stage = await getInfra();
    expect(stage).toBeTruthy();
  });

  test('l\'INSERT initialise created_at et updated_at', async () => {
    const { rows } = await pool.query(
      `INSERT INTO reunion (stage_id, date, heure, sujet)
       VALUES ($1, CURRENT_DATE, '09:00', 'M5 test reunion timestamps')
       RETURNING id, created_at, updated_at`,
      [stage.stage_id]
    );
    const row = rows[0];
    cleanupReunion.push(row.id);
    expect(row.created_at).toBeTruthy();
    expect(row.updated_at).toBeTruthy();
  });

  test('un UPDATE fait avancer updated_at sans toucher created_at', async () => {
    const { rows } = await pool.query(
      `INSERT INTO reunion (stage_id, date, heure, sujet)
       VALUES ($1, CURRENT_DATE, '10:00', 'M5 test reunion update')
       RETURNING id, created_at, updated_at`,
      [stage.stage_id]
    );
    const row = rows[0];
    cleanupReunion.push(row.id);
    expect(row.created_at).toBeTruthy();
    expect(row.updated_at).toBeTruthy();

    const { rows: updated } = await pool.query(
      `UPDATE reunion SET sujet = 'M5 test reunion modifié' WHERE id = $1
       RETURNING created_at, updated_at`,
      [row.id]
    );
    expect(updated[0].created_at).toEqual(row.created_at);
    expect(new Date(updated[0].updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(row.updated_at).getTime()
    );
  });
});

describe('M5 — évaluation : created_at/updated_at', () => {
  let stage;
  beforeAll(async () => {
    stage = await getInfra();
    expect(stage).toBeTruthy();
  });

  test('l\'INSERT initialise created_at et updated_at', async () => {
    const { rows } = await pool.query(
      `INSERT INTO evaluation (stage_id, encadrant_id, technique, communication, autonomie, ponctualite, qualite, note_finale, commentaire)
       VALUES ($1, $2, 10, 12, 11, 13, 14, 12.00, 'M5 test evaluation timestamps')
       RETURNING id, created_at, updated_at`,
      [stage.stage_id, stage.encadrant_id]
    );
    const row = rows[0];
    cleanupEvaluation.push(row.id);
    expect(row.created_at).toBeTruthy();
    expect(row.updated_at).toBeTruthy();
  });

  test('un UPDATE fait avancer updated_at sans toucher created_at', async () => {
    const { rows } = await pool.query(
      `INSERT INTO evaluation (stage_id, encadrant_id, technique, communication, autonomie, ponctualite, qualite, note_finale, commentaire)
       VALUES ($1, $2, 10, 12, 11, 13, 14, 12.00, 'M5 test evaluation update')
       RETURNING id, created_at, updated_at`,
      [stage.stage_id, stage.encadrant_id]
    );
    const row = rows[0];
    cleanupEvaluation.push(row.id);
    expect(row.created_at).toBeTruthy();
    expect(row.updated_at).toBeTruthy();

    const { rows: updated } = await pool.query(
      `UPDATE evaluation SET commentaire = 'M5 test evaluation modifié' WHERE id = $1
       RETURNING created_at, updated_at`,
      [row.id]
    );
    expect(updated[0].created_at).toEqual(row.created_at);
    expect(new Date(updated[0].updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(row.updated_at).getTime()
    );
  });
});

describe('M5 — API : les endpoints réunion & évaluation exposent created_at/updated_at', () => {
  const ENCADRANT_EMAIL = 'rachid.mansour@steg.tn';
  const ENCADRANT_PASSWORD = 'encadrant123';
  let token = null;
  let stageId = null;
  let createdReunion = null;
  let createdEvaluation = null;

  async function login() {
    if (token) return token;
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ENCADRANT_EMAIL, password: ENCADRANT_PASSWORD })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    token = data.token;
    return token;
  }

  async function authFetch(url, body) {
    return fetch(`${BASE}${url}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await login()}`
      },
      body: body ? JSON.stringify(body) : undefined
    });
  }

  beforeAll(async () => {
    const { rows } = await pool.query(
      `SELECT s.id AS stage_id
       FROM stage s
       JOIN encadrant en ON en.id = s.encadrant_id
       JOIN utilisateur u ON u.id = en.id
       LEFT JOIN evaluation e ON e.stage_id = s.id
       WHERE u.email = $1 AND s.statut IN ('EN_COURS', 'TERMINE')
         AND e.id IS NULL
       ORDER BY s.date_debut DESC
       LIMIT 1`,
      [ENCADRANT_EMAIL]
    );
    expect(rows[0]).toBeTruthy();
    stageId = rows[0].stage_id;
  });

  afterAll(async () => {
    if (createdReunion) await pool.query('DELETE FROM reunion WHERE id = $1', [createdReunion]);
    if (createdEvaluation) await pool.query('DELETE FROM evaluation WHERE id = $1', [createdEvaluation]);
  });

  test('POST /reunions renvoie created_at et updated_at', async () => {
    const res = await authFetch('/reunions', {
      stage_id: stageId,
      date: new Date().toISOString().slice(0, 10),
      heure: '11:00',
      sujet: 'M5 test réunion timestamps API'
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    createdReunion = data.reunion.id;
    expect(data.reunion.created_at).toBeTruthy();
    expect(data.reunion.updated_at).toBeTruthy();
  });

  test('GET /reunions expose created_at et updated_at', async () => {
    const res = await authFetch('/reunions');
    expect(res.status).toBe(200);
    const reunions = await res.json();
    expect(Array.isArray(reunions)).toBe(true);
    expect(reunions.length).toBeGreaterThan(0);
    for (const r of reunions) {
      expect(r.created_at).toBeTruthy();
      expect(r.updated_at).toBeTruthy();
    }
  });

  test('POST /evaluations renvoie created_at et updated_at', async () => {
    const res = await authFetch('/evaluations', {
      stage_id: stageId,
      technique: 10,
      communication: 12,
      autonomie: 11,
      ponctualite: 13,
      qualite: 14,
      commentaire: 'M5 test évaluation timestamps API'
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    createdEvaluation = data.evaluation.id;
    expect(data.evaluation.created_at).toBeTruthy();
    expect(data.evaluation.updated_at).toBeTruthy();
  });

  test('GET /evaluations expose created_at et updated_at', async () => {
    const res = await authFetch('/evaluations');
    expect(res.status).toBe(200);
    const evaluations = await res.json();
    expect(Array.isArray(evaluations)).toBe(true);
    expect(evaluations.length).toBeGreaterThan(0);
    for (const e of evaluations) {
      expect(e.created_at).toBeTruthy();
      expect(e.updated_at).toBeTruthy();
    }
  });
});