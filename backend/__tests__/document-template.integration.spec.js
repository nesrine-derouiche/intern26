require('dotenv').config();
const pool = require('../config/db');

const BASE = 'http://localhost:3000/api/document-templates';
const NAMESPACE = `P1-3A4-${Date.now()}`;
const NAMESPACE_LIKE = 'P1-3A4-%';
const MISSING_UUID = '00000000-0000-4000-8000-000000000000';

const ACCOUNTS = {
  admin: ['admin@steg.tn', 'admin123'],
  rh: ['salma.bouazizi@steg.tn', 'rh1234'],
  candidat: ['candidat@steg.tn', 'Candidat123!'],
  stagiaire: ['fatma.trabelsi@steg.tn', 'stagiaire123'],
  encadrant: ['ahmed.bensalah@steg.tn', 'encadrant123'],
  chef: ['nabil.khelifi@steg.tn', 'chef123']
};

const tokens = {};
let adminId = null;
let alpha = null;
let beta = null;
let gamma = null;
let delta = null;

const nom = (label) => `${NAMESPACE}-${label}`;

async function login(email, password) {
  const res = await fetch('http://localhost:3000/api/auth/login', {
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

async function cleanNamespace() {
  await pool.query(
    `DELETE FROM document_generated
      WHERE template_id IN (SELECT id FROM document_template WHERE nom LIKE $1)`,
    [NAMESPACE_LIKE]
  );
  await pool.query('DELETE FROM document_template WHERE nom LIKE $1', [NAMESPACE_LIKE]);
}

async function createTemplate(token, payload) {
  const res = await api('POST', BASE, token, payload);
  if (res.status !== 201) {
    throw new Error(`Création du template « ${payload.nom} » échouée (${res.status}) : ${JSON.stringify(res.body)}`);
  }
  return res.body.template;
}

async function countGenerated() {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM document_generated');
  return rows[0].n;
}

async function duplicateVersionCount() {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM (
       SELECT type, version FROM document_template
        WHERE nom LIKE $1
        GROUP BY type, version HAVING count(*) > 1
     ) d`,
    [NAMESPACE_LIKE]
  );
  return rows[0].n;
}

beforeAll(async () => {
  await cleanNamespace();

  adminId = (await pool.query("SELECT id FROM utilisateur WHERE email = 'admin@steg.tn'")).rows[0].id;
  const adminToken = await tokenFor('admin');

  alpha = await createTemplate(adminToken, {
    nom: nom('alpha'),
    type: 'CONVENTION',
    contenu: 'Convention de {{nom_stagiaire}}',
    variables: ['nom_stagiaire']
  });
  beta = await createTemplate(adminToken, {
    nom: nom('beta'),
    type: 'CV',
    contenu: 'CV de {{nom_stagiaire}}',
    variables: ['nom_stagiaire']
  });
  gamma = await createTemplate(adminToken, {
    nom: nom('gamma'),
    type: 'ATTESTATION',
    contenu: 'Attestation sans variable',
    variables: []
  });
  delta = await createTemplate(adminToken, {
    nom: nom('delta'),
    type: 'RAPPORT',
    contenu: 'Apercu de {{nom_stagiaire}} le {{date_debut}}',
    variables: ['nom_stagiaire', 'date_debut']
  });
});

afterAll(async () => {
  await cleanNamespace();
  await pool.end();
});

describe('P1-3A-4 — permissions', () => {
  test('1. GET list ADMIN → 200', async () => {
    const res = await api('GET', BASE, await tokenFor('admin'));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((t) => t.nom === nom('alpha'))).toBe(true);
  });

  test('2. GET list RH → 200', async () => {
    const res = await api('GET', BASE, await tokenFor('rh'));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((t) => t.nom === nom('beta'))).toBe(true);
  });

  test('3. GET list CANDIDAT → 403', async () => {
    const res = await api('GET', BASE, await tokenFor('candidat'));
    expect(res.status).toBe(403);
  });

  test('4. GET list STAGIAIRE → 403', async () => {
    const res = await api('GET', BASE, await tokenFor('stagiaire'));
    expect(res.status).toBe(403);
  });

  test('5. GET list ENCADRANT → 403', async () => {
    const res = await api('GET', BASE, await tokenFor('encadrant'));
    expect(res.status).toBe(403);
  });

  test('6. GET list CHEF_DEPARTEMENT → 403', async () => {
    const res = await api('GET', BASE, await tokenFor('chef'));
    expect(res.status).toBe(403);
  });

  test('7. GET list sans token → 401', async () => {
    const res = await api('GET', BASE, null);
    expect(res.status).toBe(401);
  });

  test('toutes les routes sont protégées (POST/PUT/PATCH/PREVIEW sans token → 401)', async () => {
    const calls = [
      api('POST', BASE, null, { nom: nom('x'), type: 'CV', contenu: 'c', variables: [] }),
      api('PUT', `${BASE}/${alpha.id}`, null, { nom: 'x' }),
      api('PATCH', `${BASE}/${alpha.id}/deactivate`, null),
      api('POST', `${BASE}/${alpha.id}/preview`, null, {})
    ];
    const results = await Promise.all(calls);
    results.forEach((res) => expect(res.status).toBe(401));
  });
});

describe('P1-3A-4 — lecture', () => {
  test('8. GET by id → 200', async () => {
    const res = await api('GET', `${BASE}/${alpha.id}`, await tokenFor('admin'));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(alpha.id);
    expect(res.body.type).toBe('CONVENTION');
    expect(res.body.variables).toEqual(['nom_stagiaire']);
  });

  test('9. GET id inexistant → 404', async () => {
    const res = await api('GET', `${BASE}/${MISSING_UUID}`, await tokenFor('admin'));
    expect(res.status).toBe(404);
  });

  test('10. GET id malformé → 404 (pas de 500, pas d\'erreur SQL)', async () => {
    const res = await api('GET', `${BASE}/pas-un-uuid`, await tokenFor('admin'));

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('uuid');
  });
});

describe('P1-3A-4 — création', () => {
  test('11. POST template valide → 201 avec created_by = utilisateur authentifié', async () => {
    const res = await api('POST', BASE, await tokenFor('admin'), {
      nom: nom('create-ok'),
      type: 'CONVENTION',
      contenu: 'Convention de {{nom_stagiaire}}',
      variables: ['nom_stagiaire']
    });

    expect(res.status).toBe(201);
    expect(res.body.template.id).toBeTruthy();
    expect(res.body.template.version).toBeGreaterThanOrEqual(1);
    expect(res.body.template.actif).toBe(true);
    expect(res.body.template.created_by).toBe(adminId);
    expect(res.body.message).toBe('Template créé.');
  });

  test('12. POST type invalide → 422', async () => {
    const res = await api('POST', BASE, await tokenFor('admin'), {
      nom: nom('type-invalid'),
      type: 'FACTURE',
      contenu: 'contenu',
      variables: []
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  test('13. POST variables invalides → 422', async () => {
    const res = await api('POST', BASE, await tokenFor('admin'), {
      nom: nom('vars-invalid'),
      type: 'CV',
      contenu: 'Bonjour {{nom_stagiaire}}',
      variables: ['nom stagiaire']
    });

    expect(res.status).toBe(422);
  });

  test('14. POST placeholder non déclaré → 422', async () => {
    const res = await api('POST', BASE, await tokenFor('admin'), {
      nom: nom('placeholder-non-declare'),
      type: 'CV',
      contenu: 'Bonjour {{entreprise_nom}}',
      variables: ['nom_stagiaire']
    });

    expect(res.status).toBe(422);
  });

  test('15. POST placeholder invalide → 422', async () => {
    const res = await api('POST', BASE, await tokenFor('admin'), {
      nom: nom('placeholder-invalid'),
      type: 'CV',
      contenu: 'Bonjour {{champ.invalide}}',
      variables: ['champ']
    });

    expect(res.status).toBe(422);
  });

  test('16. POST template RH → succès', async () => {
    const res = await api('POST', BASE, await tokenFor('rh'), {
      nom: nom('create-rh'),
      type: 'ASSURANCE',
      contenu: 'Assurance de {{nom_stagiaire}}',
      variables: ['nom_stagiaire']
    });

    expect(res.status).toBe(201);
    expect(res.body.template.created_by).toBeTruthy();
    expect(res.body.template.created_by).not.toBe(MISSING_UUID);
    expect(res.body.template.nom).toBe(nom('create-rh'));
  });

  test('17. POST rôle interdit → 403', async () => {
    const res = await api('POST', BASE, await tokenFor('candidat'), {
      nom: nom('create-candidat'),
      type: 'CV',
      contenu: 'contenu',
      variables: []
    });

    expect(res.status).toBe(403);
  });

  test('18. created_by arbitraire envoyé par le client est ignoré', async () => {
    const res = await api('POST', BASE, await tokenFor('admin'), {
      nom: nom('create-forge'),
      type: 'CV',
      contenu: 'contenu de test',
      variables: [],
      created_by: MISSING_UUID
    });

    expect(res.status).toBe(201);
    expect(res.body.template.created_by).toBe(adminId);
    expect(res.body.template.created_by).not.toBe(MISSING_UUID);
  });
});

describe('P1-3A-4 — mise à jour', () => {
  test('19. PUT template → 200', async () => {
    const res = await api('PUT', `${BASE}/${alpha.id}`, await tokenFor('admin'), {
      nom: nom('alpha-maj'),
      contenu: 'Convention {{nom_stagiaire}} mise a jour',
      variables: ['nom_stagiaire']
    });

    expect(res.status).toBe(200);
    expect(res.body.template.nom).toBe(nom('alpha-maj'));
    expect(res.body.template.contenu).toContain('mise a jour');
    expect(res.body.message).toBe('Template mis à jour.');
  });

  test('20. PUT ne peut pas modifier type, version ni actif', async () => {
    const res = await api('PUT', `${BASE}/${alpha.id}`, await tokenFor('admin'), {
      nom: nom('alpha-maj'),
      contenu: 'Convention {{nom_stagiaire}} mise a jour',
      variables: ['nom_stagiaire'],
      type: 'CV',
      version: 99,
      actif: false,
      created_by: MISSING_UUID
    });

    expect(res.status).toBe(200);
    expect(res.body.template.type).toBe('CONVENTION');
    expect(res.body.template.version).toBe(alpha.version);
    expect(res.body.template.actif).toBe(true);
    expect(res.body.template.created_by).toBe(adminId);
  });

  test('21. PUT template inexistant → 404', async () => {
    const res = await api('PUT', `${BASE}/${MISSING_UUID}`, await tokenFor('admin'), {
      nom: nom('inexistant'),
      contenu: 'contenu',
      variables: []
    });

    expect(res.status).toBe(404);
  });
});

describe('P1-3A-4 — désactivation', () => {
  test('22. PATCH deactivate → 200 avec actif=false', async () => {
    const res = await api('PATCH', `${BASE}/${gamma.id}/deactivate`, await tokenFor('admin'));

    expect(res.status).toBe(200);
    expect(res.body.template.actif).toBe(false);
    expect(res.body.template.id).toBe(gamma.id);
    expect(res.body.message).toBe('Template désactivé.');
  });

  test('23. la ligne est conservée après désactivation (GET → 200)', async () => {
    const res = await api('GET', `${BASE}/${gamma.id}`, await tokenFor('rh'));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(gamma.id);
  });

  test('24. GET après deactivate → actif=false', async () => {
    const res = await api('GET', `${BASE}/${gamma.id}`, await tokenFor('admin'));

    expect(res.status).toBe(200);
    expect(res.body.actif).toBe(false);
    expect(res.body.contenu).toBe('Attestation sans variable');
  });
});

describe('P1-3A-4 — preview', () => {
  test('25. POST preview → 200 avec le contenu rendu', async () => {
    const res = await api('POST', `${BASE}/${delta.id}/preview`, await tokenFor('admin'), {
      nom_stagiaire: 'Nesrine',
      date_debut: '01/10/2026'
    });

    expect(res.status).toBe(200);
    expect(res.body.preview).toBe('Apercu de Nesrine le 01/10/2026');
  });

  test('26. POST preview variable manquante → 422', async () => {
    const res = await api('POST', `${BASE}/${delta.id}/preview`, await tokenFor('admin'), {
      nom_stagiaire: 'Nesrine'
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  test('27. POST preview ne crée aucune ligne document_generated', async () => {
    const before = await countGenerated();

    const res = await api('POST', `${BASE}/${delta.id}/preview`, await tokenFor('admin'), {
      nom_stagiaire: 'Nesrine',
      date_debut: '01/10/2026'
    });
    const after = await countGenerated();

    expect(res.status).toBe(200);
    expect(after).toBe(before);
    expect((await pool.query('SELECT count(*)::int AS n FROM document_template WHERE nom LIKE $1', [NAMESPACE_LIKE])).rows[0].n)
      .toBeGreaterThanOrEqual(4);
  });
});

describe('P1-3A-4 — liste, filtres et contrainte de version', () => {
  test('28. pagination : { data, total, page, pages }', async () => {
    const res = await api('GET', `${BASE}?page=1&limit=2`, await tokenFor('admin'));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(res.body.total).toBeGreaterThanOrEqual(4);
    expect(res.body.page).toBe(1);
    expect(res.body.pages).toBeGreaterThanOrEqual(2);
  });

  test('29. filtre type', async () => {
    const res = await api('GET', `${BASE}?type=CONVENTION`, await tokenFor('admin'));

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((t) => t.type === 'CONVENTION')).toBe(true);
    expect(res.body.some((t) => t.nom === nom('alpha-maj'))).toBe(true);
  });

  test('30. filtre actif=false', async () => {
    const res = await api('GET', `${BASE}?actif=false`, await tokenFor('admin'));

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((t) => t.actif === false)).toBe(true);
    expect(res.body.some((t) => t.id === gamma.id)).toBe(true);
  });

  test('31. créations simultanées du même type : 201/409 uniquement, aucun doublon de version', async () => {
    const payloads = [1, 2, 3, 4].map((i) => ({
      nom: nom(`race-${i}`),
      type: 'ASSURANCE',
      contenu: `Course ${i} de {{nom_stagiaire}}`,
      variables: ['nom_stagiaire']
    }));

    const adminToken = await tokenFor('admin');
    const results = await Promise.all(
      payloads.map((payload) => api('POST', BASE, adminToken, payload))
    );

    const statuses = results.map((r) => r.status);
    statuses.forEach((status) => expect([201, 409]).toContain(status));
    results.filter((r) => r.status === 409).forEach((r) => {
      expect(r.body.success).toBe(false);
      expect(r.body.message).toContain('version');
    });
    expect(await duplicateVersionCount()).toBe(0);
  });

  test('32. filtre de liste invalide → 400 (validation HTTP du validator)', async () => {
    const res = await api('GET', `${BASE}?page=0`, await tokenFor('admin'));
    expect(res.status).toBe(400);
  });
});
