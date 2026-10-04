require('dotenv').config();
const pool = require('../config/db');

const BASE = 'http://localhost:3000/api';
const PLANNING = `${BASE}/planning`;

const ALLOWED_EVENT_TYPES = [
  'STAGE_START',
  'STAGE_END',
  'REUNION',
  'TASK_DEADLINE',
  'POINTAGE_ENTREE',
  'POINTAGE_SORTIE'
];

const USERS = {
  admin: { email: 'admin@steg.tn', password: 'admin123' },
  rh: { email: 'salma.bouazizi@steg.tn', password: 'rh1234' },
  chef: { email: 'nabil.khelifi@steg.tn', password: 'chef123' },
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

function query(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `${PLANNING}?${qs}` : PLANNING;
}

async function getPlanning(key, params = {}) {
  const res = await authFetch(key, query(params));
  const body = await res.json();
  return { res, body, planning: body.planning };
}

async function userIdByEmail(email) {
  const { rows } = await pool.query('SELECT id FROM utilisateur WHERE email = $1', [email]);
  return rows[0] ? rows[0].id : null;
}

/** Découverte des fixtures (lecture seule) : stages, horaires, tâches datées, réunions, pointages. */
async function discover() {
  const res = await authFetch('admin', `${BASE}/stages`);
  const payload = await res.json();
  const stages = Array.isArray(payload) ? payload : (payload.data || []);

  const { rows: horaireRows } = await pool.query('SELECT stage_id FROM horaire');
  const stageIdsWithHoraire = new Set(horaireRows.map((r) => r.stage_id));

  const fatmaStage = stages.find((s) => s.stagiaire_nom === 'Trabelsi') || null;
  const elecStage = stages.find((s) => s.stagiaire_nom === 'Bouchnak') || null;
  const stageSansHoraire =
    stages.find((s) => !stageIdsWithHoraire.has(s.id) && s.id !== (fatmaStage && fatmaStage.id)) || null;

  const { rows: tacheRows } = await pool.query(`
    SELECT p.stage_id, MIN(t.date_fin) AS min_fin, MAX(t.date_fin) AS max_fin, COUNT(*) AS nb
    FROM tache t
    JOIN projet p ON p.id = t.projet_id
    WHERE t.date_fin IS NOT NULL
    GROUP BY p.stage_id
    ORDER BY COUNT(*) DESC
    LIMIT 1
  `);

  const { rows: reunionRows } = await pool.query(
    'SELECT stage_id, date FROM reunion ORDER BY date ASC LIMIT 1'
  );

  const { rows: pointageRows } = await pool.query(
    'SELECT stage_id, date_pointage FROM pointage ORDER BY date_pointage DESC LIMIT 1'
  );

  // Département du chef de département + un stage dedans / un stage ailleurs.
  const { rows: chefDeptRows } = await pool.query(
    `SELECT d.id FROM departement d
     JOIN utilisateur u ON u.id = d.chef_departement_id
     WHERE u.email = $1`,
    [USERS.chef.email]
  );
  const chefDeptId = chefDeptRows[0] ? chefDeptRows[0].id : null;
  const { rows: stagesByDept } = await pool.query(
    'SELECT id, departement_id FROM stage ORDER BY date_debut ASC'
  );

  return {
    stages,
    fatmaStage,
    elecStage,
    stageSansHoraire,
    tacheStage: tacheRows[0] || null,
    reunion: reunionRows[0] || null,
    pointage: pointageRows[0] || null,
    stageIdsWithHoraire,
    chefDeptId,
    chefStage: chefDeptId ? stagesByDept.find((s) => s.departement_id === chefDeptId) || null : null,
    otherDeptStage: chefDeptId
      ? stagesByDept.find((s) => s.departement_id !== chefDeptId) || null
      : null
  };
}

function toDateOnly(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

let fixtures = null;
let fatmaUserId = null;
let encadrantInfoUserId = null;

beforeAll(async () => {
  fixtures = await discover();
  fatmaUserId = await userIdByEmail(USERS.stagiaireInfo.email);
  encadrantInfoUserId = await userIdByEmail(USERS.encadrantInfo.email);

  // Garantit un horaire connu sur le stage de Fatma (valeurs identiques au seed).
  if (fixtures.fatmaStage) {
    await authFetch('admin', `${BASE}/pointages/horaires/${fixtures.fatmaStage.id}`, {
      method: 'PUT',
      body: JSON.stringify({ heure_debut: '09:00', heure_fin: '17:00', duree_pause_minutes: 60 })
    });
  }
}, 30000);

afterAll(async () => {
  await pool.end();
});

describe('GET /api/planning — structure', () => {
  test('200 : planning complet (horaire, événements, réunions, tâches, pointages, période)', async () => {
    const { res, planning } = await getPlanning('admin', { stage_id: fixtures.fatmaStage.id });

    expect(res.status).toBe(200);
    expect(planning).toBeDefined();
    expect(planning.stage_id).toBe(fixtures.fatmaStage.id);
    expect(Array.isArray(planning.stages)).toBe(true);
    expect(Array.isArray(planning.evenements)).toBe(true);
    expect(Array.isArray(planning.reunions)).toBe(true);
    expect(Array.isArray(planning.taches)).toBe(true);
    expect(Array.isArray(planning.pointages)).toBe(true);
    expect(planning).toHaveProperty('horaire');
    expect(planning).toHaveProperty('periode');
    expect(planning.pagination).toEqual({ page: 1, limit: 100, total: expect.any(Number), pages: expect.any(Number) });
  });

  test("chaque événement respecte la structure du calendrier existant", async () => {
    const { planning } = await getPlanning('admin', { stage_id: fixtures.fatmaStage.id });
    expect(planning.evenements.length).toBeGreaterThan(0);

    for (const event of planning.evenements) {
      expect(Object.keys(event).sort()).toEqual(
        ['date', 'id', 'metadata', 'resource_id', 'status', 'time', 'title', 'type'].sort()
      );
      expect(ALLOWED_EVENT_TYPES).toContain(event.type);
      expect(typeof event.id).toBe('string');
      expect(typeof event.title).toBe('string');
      expect(event.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(event.time === null || /^\d{2}:\d{2}$/.test(event.time)).toBe(true);
      expect(event.metadata).toHaveProperty('stage_id');
      expect(event.resource_id).toBeDefined();
    }
  });

  test('STAGE_START porte la date de début du stage', async () => {
    const { planning } = await getPlanning('admin', { stage_id: fixtures.fatmaStage.id });
    const start = planning.evenements.find((e) => e.type === 'STAGE_START');
    expect(start).toBeDefined();
    expect(start.date).toBe(toDateOnly(fixtures.fatmaStage.date_debut));
    expect(start.resource_id).toBe(fixtures.fatmaStage.id);
    expect(start.time).toBeNull();
  });

  test('STAGE_END porte la date de fin du stage', async () => {
    const { planning } = await getPlanning('admin', { stage_id: fixtures.fatmaStage.id });
    const end = planning.evenements.find((e) => e.type === 'STAGE_END');
    expect(end).toBeDefined();
    expect(end.date).toBe(toDateOnly(fixtures.fatmaStage.date_fin));
    expect(end.time).toBeNull();
  });

  test('REUNION : la réunion du stage apparaît dans les événements', async () => {
    expect(fixtures.reunion).toBeTruthy();

    const date = toDateOnly(fixtures.reunion.date);
    const { res, planning } = await getPlanning('admin', {
      stage_id: fixtures.reunion.stage_id,
      date_debut: date,
      date_fin: date
    });

    expect(res.status).toBe(200);
    const reunionEvent = planning.evenements.find(
      (e) => e.type === 'REUNION' && e.metadata.stage_id === fixtures.reunion.stage_id && e.date === date
    );
    expect(reunionEvent).toBeDefined();
    expect(reunionEvent.time).toMatch(/^\d{2}:\d{2}$/);
    expect(planning.reunions.length).toBeGreaterThanOrEqual(1);
  });

  test('TASK_DEADLINE : les échéances de tâches datées apparaissent', async () => {
    expect(fixtures.tacheStage).toBeTruthy();

    const { res, planning } = await getPlanning('admin', {
      stage_id: fixtures.tacheStage.stage_id,
      date_debut: toDateOnly(fixtures.tacheStage.min_fin),
      date_fin: toDateOnly(fixtures.tacheStage.max_fin)
    });

    expect(res.status).toBe(200);
    expect(planning.taches.length).toBeGreaterThan(0);

    const deadlines = planning.evenements.filter((e) => e.type === 'TASK_DEADLINE');
    expect(deadlines.length).toBe(planning.taches.length);
    for (const task of planning.taches) {
      expect(deadlines.map((e) => e.resource_id)).toContain(task.id);
    }
  });

  test('POINTAGE_ENTREE et POINTAGE_SORTIE apparaissent dans le planning', async () => {
    const stageId = fixtures.fatmaStage.id;
    const date = '2026-06-15';

    const seedPointage = () =>
      pool.query(
        `INSERT INTO pointage (stage_id, date_pointage, heure_entree, heure_sortie, statut)
         VALUES ($1, $2::date, $3::timestamptz, $4::timestamptz, 'PRESENT')
         ON CONFLICT (stage_id, date_pointage)
         DO UPDATE SET heure_entree = EXCLUDED.heure_entree,
                       heure_sortie = EXCLUDED.heure_sortie,
                       statut = 'PRESENT'`,
        [stageId, date, `${date} 08:30:00+01:00`, `${date} 16:45:00+01:00`]
      );

    try {
      let planning = null;
      for (let attempt = 0; attempt < 3 && !planning; attempt += 1) {
        await seedPointage();
        const { res, planning: body } = await getPlanning('admin', {
          stage_id: stageId,
          date_debut: date,
          date_fin: date
        });
        expect(res.status).toBe(200);
        if (body.pointages.length > 0) planning = body;
      }

      expect(planning).not.toBeNull();
      expect(planning.pointages[0].date_pointage).toBe(date);
      expect(planning.pointages[0].heure_entree).toBeTruthy();
      expect(planning.pointages[0].heure_sortie).toBeTruthy();

      const types = planning.evenements.map((e) => e.type);
      expect(types).toContain('POINTAGE_ENTREE');
      expect(types).toContain('POINTAGE_SORTIE');
    } finally {
      await pool.query('DELETE FROM pointage WHERE stage_id = $1 AND date_pointage = $2::date', [
        stageId,
        date
      ]);
    }
  });

  test('horaire présent et normalisé en HH:MM', async () => {
    const { planning } = await getPlanning('admin', { stage_id: fixtures.fatmaStage.id });

    expect(planning.horaire).not.toBeNull();
    expect(planning.horaire.stage_id).toBe(fixtures.fatmaStage.id);
    expect(planning.horaire.heure_debut).toMatch(/^\d{2}:\d{2}$/);
    expect(planning.horaire.heure_fin).toMatch(/^\d{2}:\d{2}$/);
    expect(typeof planning.horaire.duree_pause_minutes).toBe('number');
    expect(planning.stages[0].horaire).toEqual(planning.horaire);
  });

  test('horaire absent → null', async () => {
    expect(fixtures.stageSansHoraire).toBeTruthy();

    const { res, planning } = await getPlanning('admin', { stage_id: fixtures.stageSansHoraire.id });
    expect(res.status).toBe(200);
    expect(planning.horaire).toBeNull();
    expect(planning.stages[0].horaire).toBeNull();
  });

  test("l'horaire du planning est cohérent avec GET /pointages/horaires/:id", async () => {
    const fromPlanning = (await getPlanning('admin', { stage_id: fixtures.fatmaStage.id })).planning.horaire;

    const res = await authFetch('admin', `${BASE}/pointages/horaires/${fixtures.fatmaStage.id}`);
    const fromPointage = await res.json();

    expect(res.status).toBe(200);
    expect(fromPlanning.heure_debut).toBe(String(fromPointage.heure_debut).slice(0, 5));
    expect(fromPlanning.heure_fin).toBe(String(fromPointage.heure_fin).slice(0, 5));
    expect(Number(fromPlanning.duree_pause_minutes)).toBe(Number(fromPointage.duree_pause_minutes));
  });

  test('stages[] expose période, statut et horaire par stage', async () => {
    const { planning } = await getPlanning('admin', { stage_id: fixtures.fatmaStage.id });

    expect(planning.stages).toHaveLength(1);
    const stage = planning.stages[0];
    expect(stage.id).toBe(fixtures.fatmaStage.id);
    expect(stage.date_debut).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(stage.date_fin).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(stage.statut).toBeTruthy();
    expect(stage).toHaveProperty('horaire');
    expect(stage).toHaveProperty('stagiaire_id');
    expect(stage).toHaveProperty('encadrant_id');
  });

  test('periode reflète les bornes du stage consulté', async () => {
    const { planning } = await getPlanning('admin', { stage_id: fixtures.fatmaStage.id });
    expect(planning.periode.date_debut).toBe(toDateOnly(fixtures.fatmaStage.date_debut));
    expect(planning.periode.date_fin).toBe(toDateOnly(fixtures.fatmaStage.date_fin));
  });
});

describe('GET /api/planning — filtres', () => {
  test('stage_id borne le planning à un seul stage', async () => {
    const { res, planning } = await getPlanning('admin', { stage_id: fixtures.elecStage.id });

    expect(res.status).toBe(200);
    expect(planning.stage_id).toBe(fixtures.elecStage.id);
    expect(planning.stages).toHaveLength(1);
    expect(planning.stages[0].id).toBe(fixtures.elecStage.id);
    for (const event of planning.evenements) {
      expect(event.metadata.stage_id).toBe(fixtures.elecStage.id);
    }
  });

  test("date_debut/date_fin bornent les événements à la période demandée", async () => {
    const dateDebut = toDateOnly(fixtures.reunion.date);
    const dateFin = toDateOnly(fixtures.reunion.date);

    const { res, planning } = await getPlanning('admin', {
      stage_id: fixtures.reunion.stage_id,
      date_debut: dateDebut,
      date_fin: dateFin
    });

    expect(res.status).toBe(200);
    expect(planning.periode).toEqual({ date_debut: dateDebut, date_fin: dateFin });

    for (const event of planning.evenements) {
      expect(event.date >= dateDebut).toBe(true);
      expect(event.date <= dateFin).toBe(true);
    }
    expect(planning.evenements.some((e) => e.type === 'REUNION')).toBe(true);
  });

  test('fenêtre sans données → planning vide', async () => {
    const { res, planning } = await getPlanning('admin', {
      date_debut: '2019-01-01',
      date_fin: '2019-12-31'
    });

    expect(res.status).toBe(200);
    expect(planning.evenements).toEqual([]);
    expect(planning.reunions).toEqual([]);
    expect(planning.taches).toEqual([]);
    expect(planning.pointages).toEqual([]);
    expect(planning.pagination.total).toBe(0);
  });

  test('les listes sources sont cohérentes avec les événements', async () => {
    const { planning } = await getPlanning('admin', { stage_id: fixtures.fatmaStage.id });

    const reunionEvents = planning.evenements.filter((e) => e.type === 'REUNION');
    const entreeEvents = planning.evenements.filter((e) => e.type === 'POINTAGE_ENTREE');
    const sortiesEvents = planning.evenements.filter((e) => e.type === 'POINTAGE_SORTIE');

    expect(reunionEvents).toHaveLength(planning.reunions.length);
    expect(entreeEvents).toHaveLength(planning.pointages.filter((p) => p.heure_entree).length);
    expect(sortiesEvents).toHaveLength(planning.pointages.filter((p) => p.heure_sortie).length);
  });

  test('pagination : limit borne le nombre d’événements renvoyés', async () => {
    const full = await getPlanning('admin', { stage_id: fixtures.tacheStage.stage_id });
    expect(full.planning.pagination.total).toBeGreaterThan(2);

    const { res, planning } = await getPlanning('admin', {
      stage_id: fixtures.tacheStage.stage_id,
      page: 1,
      limit: 2
    });

    expect(res.status).toBe(200);
    expect(planning.evenements).toHaveLength(2);
    expect(planning.pagination).toEqual({
      page: 1,
      limit: 2,
      total: full.planning.pagination.total,
      pages: Math.ceil(full.planning.pagination.total / 2)
    });
  });

  test('page hors limites → aucune erreur, événements vides, pagination inchangée', async () => {
    const first = await getPlanning('admin', { page: 1, limit: 3 });
    expect(first.res.status).toBe(200);
    expect(first.planning.pagination.total).toBeGreaterThan(0);

    const beyond = first.planning.pagination.pages + 1;
    const { res, planning } = await getPlanning('admin', { page: beyond, limit: 3 });

    expect(res.status).toBe(200);
    expect(planning.evenements).toEqual([]);
    expect(planning.pagination.page).toBe(beyond);
    expect(planning.pagination.limit).toBe(3);
    expect(planning.pagination.total).toBe(first.planning.pagination.total);
    expect(planning.pagination.pages).toBe(first.planning.pagination.pages);
  });

  test('pagination.total est identique quelle que soit la page et cohérent avec le nombre de pages', async () => {
    const p1 = await getPlanning('admin', { page: 1, limit: 4 });
    const p2 = await getPlanning('admin', { page: 2, limit: 4 });
    const pAll = await getPlanning('admin', { page: 1, limit: 500 });

    expect(p1.res.status).toBe(200);
    expect(p2.res.status).toBe(200);

    expect(p1.planning.pagination.total).toBe(p2.planning.pagination.total);
    expect(p1.planning.pagination.total).toBe(pAll.planning.pagination.total);
    expect(p1.planning.pagination.pages).toBe(Math.ceil(p1.planning.pagination.total / 4));
    expect(p1.planning.pagination.total).toBe(pAll.planning.evenements.length);

    // La somme des pages reconstitue exactement l'ensemble des événements.
    let seen = 0;
    for (let page = 1; page <= p1.planning.pagination.pages; page += 1) {
      const chunk = await getPlanning('admin', { page, limit: 4 });
      seen += chunk.planning.evenements.length;
    }
    expect(seen).toBe(p1.planning.pagination.total);
  });
});

describe('GET /api/planning — permissions', () => {
  test('STAGIAIRE : accès à son propre stage', async () => {
    const { res, planning } = await getPlanning('stagiaireInfo', { stage_id: fixtures.fatmaStage.id });
    expect(res.status).toBe(200);
    expect(planning.stages).toHaveLength(1);
    expect(planning.stages[0].stagiaire_id).toBe(fatmaUserId);
  });

  test('STAGIAIRE : accès à un stage qui n’est pas le sien → 403', async () => {
    const { res } = await getPlanning('stagiaireInfo', { stage_id: fixtures.elecStage.id });
    expect(res.status).toBe(403);
  });

  test('STAGIAIRE : sans stage_id, uniquement ses propres stages', async () => {
    const { res, planning } = await getPlanning('stagiaireInfo');
    expect(res.status).toBe(200);
    expect(planning.stage_id).toBeNull();
    expect(planning.stages.length).toBeGreaterThanOrEqual(1);
    for (const stage of planning.stages) {
      expect(stage.stagiaire_id).toBe(fatmaUserId);
    }
  });

  test('ENCADRANT : accès à tous ses stages', async () => {
    const { res, planning } = await getPlanning('encadrantInfo');
    expect(res.status).toBe(200);
    expect(planning.stages.length).toBeGreaterThanOrEqual(2);
    for (const stage of planning.stages) {
      expect(stage.encadrant_id).toBe(encadrantInfoUserId);
    }
  });

  test('ENCADRANT : accès à un stage d’un autre encadrant → 403', async () => {
    const { res } = await getPlanning('encadrantInfo', { stage_id: fixtures.elecStage.id });
    expect(res.status).toBe(403);
  });

  test('ADMIN : accès global', async () => {
    const { res, planning } = await getPlanning('admin');
    expect(res.status).toBe(200);
    expect(planning.stages.length).toBeGreaterThanOrEqual(3);
    const ids = planning.stages.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining([fixtures.fatmaStage.id, fixtures.elecStage.id]));
  });

  test('RH : accès global', async () => {
    const { res, planning } = await getPlanning('rh');
    expect(res.status).toBe(200);
    expect(planning.stages.length).toBeGreaterThanOrEqual(3);
    const ids = planning.stages.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining([fixtures.fatmaStage.id, fixtures.elecStage.id]));
  });

  test('CANDIDAT : sans stage_id → 403', async () => {
    const { res } = await getPlanning('candidat');
    expect(res.status).toBe(403);
  });

  test('CANDIDAT : avec stage_id → 403', async () => {
    const { res } = await getPlanning('candidat', { stage_id: fixtures.fatmaStage.id });
    expect(res.status).toBe(403);
  });

  test('CANDIDAT : avec stage_id inexistant → 403 (aucune fuite sur l’existence du stage)', async () => {
    const existing = await getPlanning('candidat', { stage_id: fixtures.fatmaStage.id });
    const missing = await getPlanning('candidat', { stage_id: '00000000-0000-0000-0000-000000000000' });

    expect(missing.res.status).toBe(403);
    expect(missing.res.status).toBe(existing.res.status);
    expect(missing.body.success).toBe(false);
    expect(JSON.stringify(missing.body)).not.toContain('introuvable');
  });

  test('CHEF_DEPARTEMENT : accès à un stage de son département → 200', async () => {
    expect(fixtures.chefStage).toBeTruthy();

    const { res, planning } = await getPlanning('chef', { stage_id: fixtures.chefStage.id });

    expect(res.status).toBe(200);
    expect(planning.stages).toHaveLength(1);
    expect(planning.stages[0].id).toBe(fixtures.chefStage.id);
  });

  test('CHEF_DEPARTEMENT : accès à un stage d’un autre département → 403', async () => {
    expect(fixtures.otherDeptStage).toBeTruthy();

    const { res } = await getPlanning('chef', { stage_id: fixtures.otherDeptStage.id });

    expect(res.status).toBe(403);
  });

  test('CHEF_DEPARTEMENT : sans stage_id, uniquement les stages de son département', async () => {
    const { res, planning } = await getPlanning('chef');

    expect(res.status).toBe(200);
    expect(planning.stages.length).toBeGreaterThanOrEqual(1);
    const ids = planning.stages.map((s) => s.id);
    expect(ids).toContain(fixtures.chefStage.id);
    expect(ids).not.toContain(fixtures.otherDeptStage.id);
  });

  test('sans token → 401', async () => {
    const res = await fetch(PLANNING);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/planning — validation', () => {
  test('stage inexistant → 404', async () => {
    const { res } = await getPlanning('admin', { stage_id: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
  });

  test('stage_id non UUID → 400', async () => {
    const { res } = await getPlanning('admin', { stage_id: 'pas-un-uuid' });
    expect(res.status).toBe(400);
  });

  test('date_debut invalide → 400', async () => {
    const { res, body } = await getPlanning('admin', { date_debut: 'abc' });
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  test('date_fin invalide → 400', async () => {
    const { res } = await getPlanning('admin', { date_fin: '31/12/2026' });
    expect(res.status).toBe(400);
  });

  test('date_debut calendairement inexistante → 400 (jamais 500)', async () => {
    const invalidDates = ['2026-02-29', '2026-02-31', '2026-04-31', '2026-13-01'];

    for (const date of invalidDates) {
      const debut = await getPlanning('admin', { date_debut: date });
      expect({ date, status: debut.res.status }).toEqual({ date, status: 400 });
      expect(debut.body.success).toBe(false);

      const fin = await getPlanning('admin', { date_fin: date });
      expect({ date, status: fin.res.status }).toEqual({ date, status: 400 });
    }
  });

  test('date_debut valide (fin de mois, année non bissextile) → 200', async () => {
    const { res, planning } = await getPlanning('admin', { date_debut: '2026-02-28', date_fin: '2026-02-28' });

    expect(res.status).toBe(200);
    expect(planning.periode).toEqual({ date_debut: '2026-02-28', date_fin: '2026-02-28' });
    for (const event of planning.evenements) {
      expect(event.date).toBe('2026-02-28');
    }
  });

  test('dates valides → 200 et événements bornés', async () => {
    const { res, planning } = await getPlanning('admin', { date_debut: '2026-01-01', date_fin: '2026-12-31' });

    expect(res.status).toBe(200);
    expect(planning.pagination.total).toBeGreaterThan(0);
    for (const event of planning.evenements) {
      expect(event.date >= '2026-01-01').toBe(true);
      expect(event.date <= '2026-12-31').toBe(true);
    }
  });

  test('date_debut > date_fin → 400', async () => {
    const { res, body } = await getPlanning('admin', { date_debut: '2026-12-01', date_fin: '2026-01-01' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(body)).toContain('date_debut doit être antérieure ou égale à date_fin.');
  });

  test('page/limit invalides → 400', async () => {
    const page = await getPlanning('admin', { page: 0 });
    expect(page.res.status).toBe(400);

    const limit = await getPlanning('admin', { limit: 1000 });
    expect(limit.res.status).toBe(400);
  });
});

describe('GET /api/planning — fuseau horaire et périmètre des listes', () => {
  test("timezone : l'heure des événements de pointage est exprimée en Africa/Tunis", async () => {
    const stageId = fixtures.fatmaStage.id;
    const date = '2026-06-16';
    // Instants choisis en UTC : 07:30Z → 08:30 en Tunisie, 15:45Z → 16:45 en Tunisie.
    const entreeUtc = `${date} 07:30:00+00:00`;
    const sortieUtc = `${date} 15:45:00+00:00`;

    await pool.query(
      `INSERT INTO pointage (stage_id, date_pointage, heure_entree, heure_sortie, statut)
       VALUES ($1, $2::date, $3::timestamptz, $4::timestamptz, 'PRESENT')
       ON CONFLICT (stage_id, date_pointage)
       DO UPDATE SET heure_entree = EXCLUDED.heure_entree,
                     heure_sortie = EXCLUDED.heure_sortie,
                     statut = 'PRESENT'`,
      [stageId, date, entreeUtc, sortieUtc]
    );

    try {
      const { res, planning } = await getPlanning('admin', {
        stage_id: stageId,
        date_debut: date,
        date_fin: date
      });

      expect(res.status).toBe(200);

      const entree = planning.evenements.find((e) => e.type === 'POINTAGE_ENTREE');
      const sortie = planning.evenements.find((e) => e.type === 'POINTAGE_SORTIE');
      expect(entree).toBeDefined();
      expect(sortie).toBeDefined();

      // Contrôle croisé : même calcul que le service (Intl, timeZone Africa/Tunis).
      const tunisTime = (iso) =>
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Africa/Tunis',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23'
        }).format(new Date(iso));

      expect(entree.time).toBe(tunisTime(entreeUtc));
      expect(sortie.time).toBe(tunisTime(sortieUtc));
      expect(entree.time).toBe('08:30');
      expect(sortie.time).toBe('16:45');

      // La date du jour reste celle du pointage (pas de décalage d'une journée).
      expect(entree.date).toBe(date);
      expect(sortie.date).toBe(date);
    } finally {
      await pool.query('DELETE FROM pointage WHERE stage_id = $1 AND date_pointage = $2::date', [
        stageId,
        date
      ]);
    }
  });

  test('STAGIAIRE : réunions, tâches et pointages n’appartiennent qu’à ses propres stages', async () => {
    const { res, planning } = await getPlanning('stagiaireInfo');

    expect(res.status).toBe(200);
    const ownStageIds = new Set(planning.stages.map((s) => s.id));
    expect(ownStageIds.size).toBeGreaterThanOrEqual(1);

    for (const reunion of planning.reunions) {
      expect(ownStageIds.has(reunion.stage_id)).toBe(true);
    }
    for (const tache of planning.taches) {
      expect(ownStageIds.has(tache.stage_id)).toBe(true);
    }
    for (const pointage of planning.pointages) {
      expect(ownStageIds.has(pointage.stage_id)).toBe(true);
    }
    for (const event of planning.evenements) {
      if (event.metadata && event.metadata.stage_id) {
        expect(ownStageIds.has(event.metadata.stage_id)).toBe(true);
      }
    }

    // Le filtre est réellement actif : l'admin voit des réunions et des tâches
    // situées hors de ce périmètre.
    const { planning: all } = await getPlanning('admin');
    expect(all.reunions.some((r) => !ownStageIds.has(r.stage_id))).toBe(true);
    expect(all.taches.some((t) => !ownStageIds.has(t.stage_id))).toBe(true);
  });
});

describe('Régressions P1-1 / calendrier existant', () => {
  test('/stagiaires/calendar répond 200 et reste un tableau', async () => {
    const res = await authFetch('stagiaireInfo', `${BASE}/stagiaires/calendar`);
    expect(res.status).toBe(200);
    const events = await res.json();
    expect(Array.isArray(events)).toBe(true);
    for (const event of events) {
      expect(['INTERNSHIP', 'MEETING', 'TASK']).toContain(event.type);
      expect(event).toHaveProperty('resource_id');
    }
  });

  test('/pointages/horaires/:id répond 200', async () => {
    const res = await authFetch('admin', `${BASE}/pointages/horaires/${fixtures.fatmaStage.id}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('heure_debut');
    expect(data).toHaveProperty('heure_fin');
    expect(data).toHaveProperty('duree_pause_minutes');
  });

  test('/pointages/stage/:id répond 200', async () => {
    const res = await authFetch('admin', `${BASE}/pointages/stage/${fixtures.fatmaStage.id}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const rows = Array.isArray(data) ? data : (data.data || []);
    expect(Array.isArray(rows)).toBe(true);
  });

  test('/pointages/retards répond 200', async () => {
    const res = await authFetch('admin', `${BASE}/pointages/retards`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const rows = Array.isArray(data) ? data : (data.data || []);
    expect(Array.isArray(rows)).toBe(true);
    for (const row of rows) expect(row.statut).toBe('RETARD');
  });

  test('/reunions répond 200 et le stagiaire ne voit que ses réunions', async () => {
    const res = await authFetch('stagiaireInfo', `${BASE}/reunions`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const rows = Array.isArray(data) ? data : (data.data || []);
    expect(Array.isArray(rows)).toBe(true);
    for (const row of rows) expect(row.stage_id).toBe(fixtures.fatmaStage.id);
  });

  test('le calcul de retard P1-1 reste inchangé (statut RETARD si horaire respecté)', async () => {
    const res = await authFetch('admin', `${BASE}/pointages/stage/${fixtures.fatmaStage.id}`);
    const data = await res.json();
    const rows = Array.isArray(data) ? data : (data.data || []);
    for (const row of rows) {
      expect(['PRESENT', 'RETARD', 'ABSENT']).toContain(row.statut);
      expect(typeof row.retard_minutes).toBe('number');
    }
  });
});
