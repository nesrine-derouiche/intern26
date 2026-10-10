require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const API = 'http://localhost:3000/api';
const STAGE = 'c144d580-e39d-481b-9c01-2758cb2138ae';
const STAGE_ELEC = '48629baa-cd0d-487c-9051-5c789b38b788';
const UPLOADS = '/Users/macbookm4pro/Documents/stage26/backend/uploads';

const ACCOUNTS = {
  admin: ['admin@steg.tn', 'admin123'],
  encadrant: ['ahmed.bensalah@steg.tn', 'encadrant123'],
  encadrantElec: ['rachid.mansour@steg.tn', 'encadrant123'],
  stagiaire: ['fatma.trabelsi@steg.tn', 'stagiaire123'],
  stagiaireElec: ['mohamed.bouchnak@steg.tn', 'stagiaire123'],
  candidat: ['candidat@steg.tn', 'Candidat123!']
};

const tokens = {};
let testStart = null;

const PDF_BYTES = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF',
  'latin1'
);

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
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (err) {
    json = null;
  }
  return { status: res.status, body: json };
}

function uploadForm(bytes, filename) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'application/pdf' }), filename);
  return form;
}

const certUrl = (stageId, suffix) => `${API}/stages/${stageId}/certification${suffix || ''}`;

async function setupValidatedDossier(stagiaireToken, encadrantToken, stageId) {
  for (const kind of ['JOURNAL', 'RAPPORT']) {
    const up = await api(
      'POST',
      certUrl(stageId, `/documents/${kind}`),
      stagiaireToken,
      uploadForm(PDF_BYTES, `${kind.toLowerCase()}.pdf`)
    );
    if (up.status !== 201) {
      throw new Error(`Dépôt ${kind} échoué (${up.status}) : ${JSON.stringify(up.body)}`);
    }
  }
  const submit = await api('POST', certUrl(stageId, '/submit'), stagiaireToken);
  if (submit.status !== 200) {
    throw new Error(`Soumission échouée (${submit.status}) : ${JSON.stringify(submit.body)}`);
  }
  const valid = await api('POST', certUrl(stageId, '/valider'), encadrantToken);
  if (valid.status !== 200) {
    throw new Error(`Validation échouée (${valid.status}) : ${JSON.stringify(valid.body)}`);
  }
}

async function cleanStage(stageId) {
  const { rows: docs } = await pool.query(
    `SELECT chemin FROM certification_document
      WHERE certification_id IN (SELECT id FROM certification WHERE stage_id = $1)`,
    [stageId]
  );
  const { rows: certs } = await pool.query(
    'SELECT attestation_chemin FROM certification WHERE stage_id = $1',
    [stageId]
  );
  for (const doc of docs) {
    try {
      fs.unlinkSync(path.join(UPLOADS, doc.chemin));
    } catch (err) {}
  }
  for (const cert of certs) {
    if (cert.attestation_chemin) {
      try {
        fs.unlinkSync(path.join(UPLOADS, cert.attestation_chemin));
      } catch (err) {}
    }
  }
  await pool.query('DELETE FROM certification WHERE stage_id = $1', [stageId]);
}

async function cleanNotifications() {
  const { rows: users } = await pool.query(
    `SELECT id FROM utilisateur WHERE email IN
     ('fatma.trabelsi@steg.tn', 'ahmed.bensalah@steg.tn')`
  );
  for (const user of users) {
    await pool.query(
      'DELETE FROM notification WHERE utilisateur_id = $1 AND date > $2',
      [user.id, testStart]
    );
  }
}

beforeAll(async () => {
  testStart = new Date();
  await cleanStage(STAGE);
  await cleanStage(STAGE_ELEC);
});

afterAll(async () => {
  await cleanStage(STAGE);
  await cleanStage(STAGE_ELEC);
  await cleanNotifications();
  await pool.end();
});

describe('P2-TASK8 — table de suivi', () => {
  test('1. ENCADRANT liste ses dossiers + recherche + pagination', async () => {
    const token = await tokenFor('encadrant');

    const list = await api('GET', `${API}/certifications`, token);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data)).toBe(true);
    expect(list.body.page).toBe(1);
    expect(list.body.pages).toBeGreaterThanOrEqual(1);
    expect(list.body.total).toBeGreaterThanOrEqual(1);
    const mine = list.body.data.filter((r) => r.stage_id === STAGE);
    expect(mine.length).toBe(1);
    expect(mine[0].stagiaire_nom).toBe('Trabelsi');
    expect(mine[0].departement_nom).toBe('Informatique');
    expect(mine[0].statut).toBe('NOT_SUBMITTED');
    expect(mine[0].journal.present).toBe(false);

    const search = await api('GET', `${API}/certifications?search=trabelsi`, token);
    expect(search.status).toBe(200);
    expect(search.body.data.some((r) => r.stage_id === STAGE)).toBe(true);

    const paged = await api('GET', `${API}/certifications?page=1&limit=1`, token);
    expect(paged.status).toBe(200);
    expect(paged.body.data).toHaveLength(1);
    expect(paged.body.total).toBeGreaterThanOrEqual(1);
    expect(paged.body.page).toBe(1);

    const filtered = await api('GET', `${API}/certifications?statut=VALIDATED`, token);
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.every((r) => r.statut === 'VALIDATED')).toBe(true);
  });

  test('2. STAGIAIRE ne voit que son stage, CANDIDAT refusé, sans token 401', async () => {
    const mine = await api('GET', `${API}/certifications`, await tokenFor('stagiaire'));
    expect(mine.status).toBe(200);
    expect(mine.body.data.every((r) => r.stage_id === STAGE)).toBe(true);

    const candidat = await api('GET', `${API}/certifications`, await tokenFor('candidat'));
    expect(candidat.status).toBe(403);

    const anon = await api('GET', `${API}/certifications`, null);
    expect(anon.status).toBe(401);
  });
});

describe('P2-TASK8 — génération attestation', () => {
  test('3. génération avant validation → 422', async () => {
    const res = await api(
      'POST', certUrl(STAGE, '/attestation'), await tokenFor('encadrant')
    );
    expect(res.status).toBe(422);
  });

  test('4. dossier validé → génération 200, PDF stocké vérifié', async () => {
    await setupValidatedDossier(
      await tokenFor('stagiaire'), await tokenFor('encadrant'), STAGE
    );

    const res = await api(
      'POST', certUrl(STAGE, '/attestation'), await tokenFor('encadrant')
    );

    expect(res.status).toBe(200);
    expect(res.body.attestation.generated).toBe(true);
    expect(res.body.attestation.nom).toContain('attestation_stage_');
    expect(res.body.attestation.taille).toBeGreaterThan(0);
    expect(res.body.attestation.chemin).toBeUndefined();

    const state = await api('GET', certUrl(STAGE), await tokenFor('stagiaire'));
    expect(state.body.statut).toBe('CERTIFICATE_GENERATED');
    expect(state.body.decisions[state.body.decisions.length - 1].to_statut)
      .toBe('CERTIFICATE_GENERATED');
  });

  test('5. génération idempotente : pas de doublon', async () => {
    const token = await tokenFor('encadrant');
    const before = await pool.query(
      `SELECT attestation_chemin FROM certification WHERE stage_id = $1`, [STAGE]
    );

    const res = await api('POST', certUrl(STAGE, '/attestation'), token);
    expect(res.status).toBe(200);
    expect(res.body.attestation.generated).toBe(true);

    const after = await pool.query(
      `SELECT attestation_chemin FROM certification WHERE stage_id = $1`, [STAGE]
    );
    expect(after.rows[0].attestation_chemin).toBe(before.rows[0].attestation_chemin);

    const files = fs.readdirSync(UPLOADS).filter((f) => f.startsWith(`attestation-${STAGE}`));
    expect(files).toHaveLength(1);
  });

  test('6. téléchargement attestation (encadrant + stagiaire), étranger 403', async () => {
    const stagiaireToken = await tokenFor('stagiaire');
    const dl = await api('GET', certUrl(STAGE, '/attestation'), stagiaireToken);
    expect(dl.status).toBe(200);

    const enc = await api(
      'GET', certUrl(STAGE, '/attestation'), await tokenFor('encadrant')
    );
    expect(enc.status).toBe(200);

    const foreign = await api(
      'GET', certUrl(STAGE, '/attestation'), await tokenFor('stagiaireElec')
    );
    expect(foreign.status).toBe(403);
  });

  test('7. stagiaire ou encadrant étranger ne génèrent pas → 403', async () => {
    const byStagiaire = await api(
      'POST', certUrl(STAGE, '/attestation'), await tokenFor('stagiaire')
    );
    expect(byStagiaire.status).toBe(403);

    const byForeign = await api(
      'POST', certUrl(STAGE, '/attestation'), await tokenFor('encadrantElec')
    );
    expect(byForeign.status).toBe(403);
  });
});
