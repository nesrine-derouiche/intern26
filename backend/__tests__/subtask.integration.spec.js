require('dotenv').config();
const pool = require('../config/db');

const API = 'http://localhost:3000/api';
const NAMESPACE = `P2-TASK2-${Date.now()}`;
const NAMESPACE_LIKE = 'P2-TASK2-%';
const MISSING_UUID = '00000000-0000-4000-8000-000000000000';

const ACCOUNTS = {
  admin: ['admin@steg.tn', 'admin123'],
  encadrant: ['ahmed.bensalah@steg.tn', 'encadrant123'],
  encadrantElec: ['rachid.mansour@steg.tn', 'encadrant123'],
  stagiaire: ['fatma.trabelsi@steg.tn', 'stagiaire123'],
  stagiaireElec: ['mohamed.bouchnak@steg.tn', 'stagiaire123'],
  candidat: ['candidat@steg.tn', 'Candidat123!']
};

const tokens = {};
let parentTask = null;
let foreignTask = null;
const projetSnapshots = [];

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error(`Login échoué (${res.status}) : ${await res.text()}`);
  const data = await res.json();
  return data.token;
}

async function tokenFor(role) {
  if (tokens[role]) return tokens[role];
  const [email, password] = ACCOUNTS[role];
  tokens[role] = await login(email, password);
  return tokens[role];
}

async function api(method, url, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let json = null;
  try {
    json = await res.json();
  } catch (err) {
    json = null;
  }
  return { status: res.status, body: json };
}

async function snapshotProjet(projetId) {
  const { rows } = await pool.query(
    'SELECT avancement FROM projet WHERE id = $1',
    [projetId]
  );
  if (rows[0]) projetSnapshots.push({ id: projetId, avancement: rows[0].avancement });
}

async function restoreProjets() {
  for (const snap of projetSnapshots) {
    await pool.query('UPDATE projet SET avancement = $1 WHERE id = $2', [snap.avancement, snap.id]);
  }
  projetSnapshots.length = 0;
}

async function cleanNamespace() {
  await pool.query('DELETE FROM subtask WHERE titre LIKE $1', [NAMESPACE_LIKE]);
  await pool.query('DELETE FROM tache WHERE titre LIKE $1', [NAMESPACE_LIKE]);
}

async function createParentTask(token, projetId, executantId, label) {
  const res = await api('POST', `${API}/taches`, token, {
    projet_id: projetId,
    executant_id: executantId,
    titre: `${NAMESPACE}-${label}`
  });
  if (res.status !== 201) {
    throw new Error(`Création tâche parente échouée (${res.status}) : ${JSON.stringify(res.body)}`);
  }
  return res.body.tache || res.body.data || res.body;
}

async function createSubtask(token, taskId, payload) {
  return api('POST', `${API}/taches/${taskId}/subtasks`, token, payload);
}

const titre = (label) => `${NAMESPACE}-${label}`;

beforeAll(async () => {
  await cleanNamespace();

  const encadrantToken = await tokenFor('encadrant');
  const { rows: projets } = await pool.query(
    `SELECT p.id FROM projet p
      JOIN stage s ON s.id = p.stage_id
     WHERE s.stagiaire_id = (SELECT id FROM utilisateur WHERE email = 'fatma.trabelsi@steg.tn')
     LIMIT 1`
  );
  if (!projets[0]) throw new Error('Aucun projet pour le stage de démonstration.');
  const { rows: users } = await pool.query(
    `SELECT id, email FROM utilisateur WHERE email IN ('fatma.trabelsi@steg.tn', 'mohamed.bouchnak@steg.tn')`
  );
  const stagiaireId = users.find((u) => u.email === 'fatma.trabelsi@steg.tn').id;
  const stagiaireElecId = users.find((u) => u.email === 'mohamed.bouchnak@steg.tn').id;

  parentTask = await createParentTask(encadrantToken, projets[0].id, stagiaireId, 'parent');
  await snapshotProjet(projets[0].id);

  const { rows: elecProjets } = await pool.query(
    `SELECT p.id FROM projet p
      JOIN stage s ON s.id = p.stage_id
     WHERE s.stagiaire_id = (SELECT id FROM utilisateur WHERE email = 'mohamed.bouchnak@steg.tn')
     LIMIT 1`
  );
  if (elecProjets[0]) {
    const elecToken = await tokenFor('encadrantElec');
    foreignTask = await createParentTask(elecToken, elecProjets[0].id, stagiaireElecId, 'parent-etranger');
    await snapshotProjet(elecProjets[0].id);
  }
});

afterAll(async () => {
  await cleanNamespace();
  if (parentTask && parentTask.id) {
    await api('DELETE', `${API}/taches/${parentTask.id}`, await tokenFor('admin'));
  }
  if (foreignTask && foreignTask.id) {
    await api('DELETE', `${API}/taches/${foreignTask.id}`, await tokenFor('admin'));
  }
  await cleanNamespace();
  await pool.query("DELETE FROM notification WHERE message LIKE '%P2-TASK2-%'");
  await restoreProjets();
  await pool.end();
});

beforeEach(async () => {
  await pool.query('DELETE FROM subtask WHERE titre LIKE $1', [NAMESPACE_LIKE]);
});

describe('P2-TASK2 — création et lecture', () => {
  test('1. ENCADRANT crée une sous-tâche sur sa tâche → 201', async () => {
    const res = await createSubtask(await tokenFor('encadrant'), parentTask.id, {
      titre: titre('a'),
      description: 'Première sous-tâche'
    });

    expect(res.status).toBe(201);
    expect(res.body.subtask.titre).toBe(titre('a'));
    expect(res.body.subtask.statut).toBe('TODO');
    expect(res.body.subtask.tache_id).toBe(parentTask.id);
  });

  test('2. ENCADRANT sur la tâche d un autre encadrant → 403', async () => {
    if (!foreignTask) return;
    const res = await createSubtask(await tokenFor('encadrant'), foreignTask.id, {
      titre: titre('interdit')
    });

    expect(res.status).toBe(403);
  });

  test('3. STAGIAIRE lit les sous-tâches de sa tâche → 200 avec agrégat', async () => {
    const adminLike = await tokenFor('encadrant');
    await createSubtask(adminLike, parentTask.id, { titre: titre('l1') });
    await createSubtask(adminLike, parentTask.id, { titre: titre('l2') });

    const res = await api(
      'GET',
      `${API}/taches/${parentTask.id}/subtasks`,
      await tokenFor('stagiaire')
    );

    expect(res.status).toBe(200);
    expect(res.body.subtasks).toHaveLength(2);
    expect(res.body.aggregate.total).toBe(2);
    expect(res.body.aggregate.progress).toBe(0);
    expect(res.body.aggregate.empty).toBe(false);
  });

  test('4. STAGIAIRE d un autre stage → 403', async () => {
    const res = await api(
      'GET',
      `${API}/taches/${parentTask.id}/subtasks`,
      await tokenFor('stagiaireElec')
    );

    expect(res.status).toBe(403);
  });

  test('5. sans token → 401', async () => {
    const res = await api('GET', `${API}/taches/${parentTask.id}/subtasks`, null);
    expect(res.status).toBe(401);
  });

  test('6. tâche inconnue → 404', async () => {
    const res = await api(
      'GET',
      `${API}/taches/${MISSING_UUID}/subtasks`,
      await tokenFor('admin')
    );
    expect(res.status).toBe(404);
  });
});

describe('P2-TASK2 — statuts et progression', () => {
  test('7. STAGIAIRE assigné met à jour le statut → 200', async () => {
    const token = await tokenFor('encadrant');
    const created = await createSubtask(token, parentTask.id, { titre: titre('s1') });
    expect(created.status).toBe(201);

    const res = await api(
      'PATCH',
      `${API}/subtasks/${created.body.subtask.id}/status`,
      await tokenFor('stagiaire'),
      { statut: 'IN_PROGRESS' }
    );

    expect(res.status).toBe(200);
    expect(res.body.subtask.statut).toBe('IN_PROGRESS');
  });

  test('8. STAGIAIRE non assigné → 403', async () => {
    const token = await tokenFor('encadrant');
    const created = await createSubtask(token, parentTask.id, { titre: titre('s2') });

    const res = await api(
      'PATCH',
      `${API}/subtasks/${created.body.subtask.id}/status`,
      await tokenFor('stagiaireElec'),
      { statut: 'DONE' }
    );

    expect(res.status).toBe(403);
  });

  test('9. statut invalide → erreur, valeur refusée', async () => {
    const token = await tokenFor('encadrant');
    const created = await createSubtask(token, parentTask.id, { titre: titre('s3') });

    const res = await api(
      'PATCH',
      `${API}/subtasks/${created.body.subtask.id}/status`,
      await tokenFor('stagiaire'),
      { statut: 'TERMINEE' }
    );

    expect([400, 422]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  test('10. TODO + IN_PROGRESS = 25 %', async () => {
    const encadrantToken = await tokenFor('encadrant');
    const stagiaireToken = await tokenFor('stagiaire');
    const a = await createSubtask(encadrantToken, parentTask.id, { titre: titre('p1') });
    const b = await createSubtask(encadrantToken, parentTask.id, { titre: titre('p2') });
    await api('PATCH', `${API}/subtasks/${b.body.subtask.id}/status`, stagiaireToken, { statut: 'IN_PROGRESS' });

    const res = await api('GET', `${API}/taches/${parentTask.id}/progress`, encadrantToken);

    expect(res.status).toBe(200);
    expect(res.body.aggregate.total).toBe(2);
    expect(res.body.aggregate.progress).toBe(25);
    expect(a.body.subtask.statut).toBe('TODO');
  });

  test('11. TODO + DONE = 50 %, DONE + DONE = 100 %', async () => {
    const encadrantToken = await tokenFor('encadrant');
    const stagiaireToken = await tokenFor('stagiaire');
    const a = await createSubtask(encadrantToken, parentTask.id, { titre: titre('q1') });
    await createSubtask(encadrantToken, parentTask.id, { titre: titre('q2') });
    await api('PATCH', `${API}/subtasks/${a.body.subtask.id}/status`, stagiaireToken, { statut: 'DONE' });

    const half = await api('GET', `${API}/taches/${parentTask.id}/progress`, encadrantToken);
    expect(half.body.aggregate.progress).toBe(50);

    const rows = await pool.query('SELECT id FROM subtask WHERE titre LIKE $1', [NAMESPACE_LIKE]);
    for (const row of rows.rows) {
      await api('PATCH', `${API}/subtasks/${row.id}/status`, encadrantToken, { statut: 'DONE' });
    }
    const full = await api('GET', `${API}/taches/${parentTask.id}/progress`, encadrantToken);
    expect(full.body.aggregate.progress).toBe(100);
  });

  test('12. sans sous-tâche : état vide explicite, jamais NaN', async () => {
    const res = await api(
      'GET',
      `${API}/taches/${parentTask.id}/progress`,
      await tokenFor('encadrant')
    );

    expect(res.status).toBe(200);
    expect(res.body.aggregate.total).toBe(0);
    expect(res.body.aggregate.progress).toBeNull();
    expect(res.body.aggregate.empty).toBe(true);
  });
});

describe('P2-TASK2 — édition, suppression et rôles', () => {
  test('13. ENCADRANT modifie titre et statut → 200', async () => {
    const token = await tokenFor('encadrant');
    const created = await createSubtask(token, parentTask.id, { titre: titre('m1') });

    const res = await api('PUT', `${API}/subtasks/${created.body.subtask.id}`, token, {
      titre: titre('m1-renomme'),
      statut: 'DONE'
    });

    expect(res.status).toBe(200);
    expect(res.body.subtask.titre).toBe(titre('m1-renomme'));
    expect(res.body.subtask.statut).toBe('DONE');
  });

  test('14. ENCADRANT supprime → 200 puis 404', async () => {
    const token = await tokenFor('encadrant');
    const created = await createSubtask(token, parentTask.id, { titre: titre('d1') });

    const del = await api('DELETE', `${API}/subtasks/${created.body.subtask.id}`, token);
    expect(del.status).toBe(200);

    const again = await api('DELETE', `${API}/subtasks/${created.body.subtask.id}`, token);
    expect(again.status).toBe(404);
  });

  test('15. CANDIDAT ne peut ni créer ni lire → 403', async () => {
    const candidatToken = await tokenFor('candidat');
    const create = await createSubtask(candidatToken, parentTask.id, { titre: titre('c1') });
    expect(create.status).toBe(403);

    const read = await api('GET', `${API}/taches/${parentTask.id}/subtasks`, candidatToken);
    expect(read.status).toBe(403);
  });
});
