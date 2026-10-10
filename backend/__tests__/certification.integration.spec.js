require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const API = 'http://localhost:3000/api';
const STAGE = 'c144d580-e39d-481b-9c01-2758cb2138ae';
const STAGE_ELEC = '48629baa-cd0d-487c-9051-5c789b38b788';
const MISSING_UUID = '00000000-0000-4000-8000-000000000000';
const UPLOADS = '/Users/macbookm4pro/Documents/stage26/backend/uploads';

const ACCOUNTS = {
  admin: ['admin@steg.tn', 'admin123'],
  encadrant: ['ahmed.bensalah@steg.tn', 'encadrant123'],
  encadrantElec: ['rachid.mansour@steg.tn', 'encadrant123'],
  stagiaire: ['fatma.trabelsi@steg.tn', 'stagiaire123'],
  stagiaireElec: ['mohamed.bouchnak@steg.tn', 'stagiaire123']
};

const tokens = {};
let testStart = null;

const PDF_BYTES = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF',
  'latin1'
);
const FAKE_BYTES = Buffer.from('Ceci nest pas un vrai document PDF.', 'utf8');

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
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch (err) {
    json = null;
  }
  return { status: res.status, body: json, raw: text };
}

function uploadForm(bytes, filename, mime) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mime || 'application/pdf' }), filename);
  return form;
}

async function uploadDoc(token, stageId, kind, bytes, filename, mime) {
  return api(
    'POST',
    `${API}/stages/${stageId}/certification/documents/${kind}`,
    token,
    uploadForm(bytes, filename, mime)
  );
}

const certUrl = (stageId, suffix) => `${API}/stages/${stageId}/certification${suffix || ''}`;

async function cleanStage(stageId) {
  const { rows: docs } = await pool.query(
    `SELECT chemin FROM certification_document
      WHERE certification_id IN (SELECT id FROM certification WHERE stage_id = $1)`,
    [stageId]
  );
  for (const doc of docs) {
    try {
      fs.unlinkSync(path.join(UPLOADS, doc.chemin));
    } catch (err) {}
  }
  await pool.query('DELETE FROM certification WHERE stage_id = $1', [stageId]);
}

async function cleanNotifications() {
  const { rows: users } = await pool.query(
    `SELECT id FROM utilisateur WHERE email IN
     ('fatma.trabelsi@steg.tn', 'ahmed.bensalah@steg.tn',
      'mohamed.bouchnak@steg.tn', 'rachid.mansour@steg.tn')`
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

describe('P2-TASK6 — dépôt sécurisé', () => {
  test('1. état initial sans dossier → NOT_SUBMITTED virtuel', async () => {
    const res = await api('GET', certUrl(STAGE), await tokenFor('stagiaire'));

    expect(res.status).toBe(200);
    expect(res.body.statut).toBe('NOT_SUBMITTED');
    expect(res.body.certification).toBeNull();
    expect(res.body.documents.JOURNAL).toBeNull();
    expect(res.body.documents.RAPPORT).toBeNull();
    expect(res.body.decisions).toEqual([]);
  });

  test('2. dépôt JOURNAL valide → 201 sans chemin exposé', async () => {
    const res = await uploadDoc(
      await tokenFor('stagiaire'), STAGE, 'JOURNAL', PDF_BYTES, 'journal.pdf'
    );

    expect(res.status).toBe(201);
    expect(res.body.document.kind).toBe('JOURNAL');
    expect(res.body.document.version).toBe(1);
    expect(res.body.document.chemin).toBeUndefined();
    expect(res.body.document.nom).toBe('journal.pdf');
  });

  test('3. contenu non-PDF rejeté → 400 sans trace', async () => {
    const before = await pool.query('SELECT count(*)::int AS n FROM certification_document');
    const res = await uploadDoc(
      await tokenFor('stagiaire'), STAGE, 'RAPPORT', FAKE_BYTES, 'rapport.pdf'
    );

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    const after = await pool.query('SELECT count(*)::int AS n FROM certification_document');
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  test('4. fichier vide et extension non-pdf rejetés → 400', async () => {
    const empty = await uploadDoc(
      await tokenFor('stagiaire'), STAGE, 'RAPPORT', Buffer.alloc(0), 'rapport.pdf'
    );
    expect(empty.status).toBe(400);

    const badExt = await uploadDoc(
      await tokenFor('stagiaire'), STAGE, 'RAPPORT', PDF_BYTES, 'rapport.txt', 'text/plain'
    );
    expect(badExt.status).toBe(400);
  });

  test('5. stagiaire étranger et encadrant ne déposent pas → 403', async () => {
    const foreign = await uploadDoc(
      await tokenFor('stagiaireElec'), STAGE, 'JOURNAL', PDF_BYTES, 'journal.pdf'
    );
    expect(foreign.status).toBe(403);

    const encadrant = await uploadDoc(
      await tokenFor('encadrant'), STAGE, 'JOURNAL', PDF_BYTES, 'journal.pdf'
    );
    expect(encadrant.status).toBe(403);
  });

  test('6. soumission incomplète (journal seul) → 422', async () => {
    const res = await api(
      'POST', certUrl(STAGE, '/submit'), await tokenFor('stagiaire')
    );

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});

describe('P2-TASK6 — soumission et relecture', () => {
  test('7. dossier complet + soumission → SUBMITTED + décision historisée', async () => {
    const token = await tokenFor('stagiaire');
    const rapport = await uploadDoc(token, STAGE, 'RAPPORT', PDF_BYTES, 'rapport.pdf');
    expect(rapport.status).toBe(201);

    const res = await api('POST', certUrl(STAGE, '/submit'), token);
    expect(res.status).toBe(200);
    expect(res.body.certification.statut).toBe('SUBMITTED');

    const state = await api('GET', certUrl(STAGE), token);
    expect(state.body.statut).toBe('SUBMITTED');
    expect(state.body.documents.JOURNAL).not.toBeNull();
    expect(state.body.documents.RAPPORT).not.toBeNull();
    expect(state.body.decisions).toHaveLength(1);
    expect(state.body.decisions[0].to_statut).toBe('SUBMITTED');
  });

  test('8. refus sans motif → 400 ; avec motif → DENIED lisible', async () => {
    const encadrantToken = await tokenFor('encadrant');
    const stagiaireToken = await tokenFor('stagiaire');

    const noReason = await api(
      'POST', certUrl(STAGE, '/refuser'), encadrantToken, {}
    );
    expect(noReason.status).toBe(400);

    const deny = await api(
      'POST', certUrl(STAGE, '/refuser'), encadrantToken, { reason: 'Rapport illisible.' }
    );
    expect(deny.status).toBe(200);
    expect(deny.body.certification.statut).toBe('DENIED');

    const state = await api('GET', certUrl(STAGE), stagiaireToken);
    expect(state.body.statut).toBe('DENIED');
    expect(state.body.certification.reason).toBe('Rapport illisible.');
    expect(state.body.decisions[state.body.decisions.length - 1].to_statut).toBe('DENIED');
  });

  test('9. reprise sans motif → 400 ; avec motif + document → REDO_REQUESTED', async () => {
    const encadrantToken = await tokenFor('encadrant');

    const resubmit = await api(
      'POST', certUrl(STAGE, '/submit'), await tokenFor('stagiaire')
    );
    expect(resubmit.status).toBe(200);

    const noReason = await api(
      'POST', certUrl(STAGE, '/corriger'), encadrantToken, {}
    );
    expect(noReason.status).toBe(400);

    const redo = await api(
      'POST', certUrl(STAGE, '/corriger'), encadrantToken,
      { reason: 'Reprendre la conclusion.', document_concerne: 'RAPPORT' }
    );
    expect(redo.status).toBe(200);
    expect(redo.body.certification.statut).toBe('REDO_REQUESTED');
    expect(redo.body.certification.document_concerne).toBe('RAPPORT');
  });

  test('10. resoumission : versions et historique préservés', async () => {
    const stagiaireToken = await tokenFor('stagiaire');
    const encadrantToken = await tokenFor('encadrant');

    const v2 = await uploadDoc(stagiaireToken, STAGE, 'JOURNAL', PDF_BYTES, 'journal-v2.pdf');
    expect(v2.status).toBe(201);
    expect(v2.body.document.version).toBe(2);

    const resubmit = await api('POST', certUrl(STAGE, '/submit'), stagiaireToken);
    expect(resubmit.status).toBe(200);

    const state = await api('GET', certUrl(STAGE), stagiaireToken);
    const journalVersions = state.body.versions.filter((d) => d.kind === 'JOURNAL');
    expect(journalVersions).toHaveLength(2);
    expect(state.body.decisions.length).toBeGreaterThanOrEqual(4);

    const valid = await api('POST', certUrl(STAGE, '/valider'), encadrantToken);
    expect(valid.status).toBe(200);
    expect(valid.body.certification.statut).toBe('VALIDATED');
  });

  test('11. validation sans dossier complet → 422 (second stage)', async () => {
    const stagiaireToken = await tokenFor('stagiaireElec');
    const encadrantToken = await tokenFor('encadrantElec');

    const up = await uploadDoc(stagiaireToken, STAGE_ELEC, 'JOURNAL', PDF_BYTES, 'journal.pdf');
    expect(up.status).toBe(201);
    const submit = await api('POST', certUrl(STAGE_ELEC, '/submit'), stagiaireToken);
    expect(submit.status).toBe(422);

    const forced = await pool.query(
      `UPDATE certification SET statut = 'SUBMITTED' WHERE stage_id = $1 RETURNING id`,
      [STAGE_ELEC]
    );
    expect(forced.rows).toHaveLength(1);
    const valid = await api('POST', certUrl(STAGE_ELEC, '/valider'), encadrantToken);
    expect(valid.status).toBe(422);
  });

  test('12. téléchargement autorisé (stagiaire + encadrant), étranger refusé', async () => {
    const stagiaireToken = await tokenFor('stagiaire');
    const state = await api('GET', certUrl(STAGE), stagiaireToken);
    const docId = state.body.documents.JOURNAL.id;

    const dl = await api(
      'GET', `${API}/stages/${STAGE}/certification/documents/${docId}/download`, stagiaireToken
    );
    expect(dl.status).toBe(200);

    const enc = await api(
      'GET', `${API}/stages/${STAGE}/certification/documents/${docId}/download`,
      await tokenFor('encadrant')
    );
    expect(enc.status).toBe(200);

    const foreign = await api(
      'GET', `${API}/stages/${STAGE}/certification/documents/${docId}/download`,
      await tokenFor('stagiaireElec')
    );
    expect(foreign.status).toBe(403);

    const anon = await api(
      'GET', `${API}/stages/${STAGE}/certification/documents/${docId}/download`, null
    );
    expect(anon.status).toBe(401);
  });

  test('13. stagiaire ne relit pas, encadrant étranger non plus → 403', async () => {
    const stagiaireReview = await api(
      'POST', certUrl(STAGE, '/valider'), await tokenFor('stagiaire')
    );
    expect(stagiaireReview.status).toBe(403);

    const foreignReview = await api(
      'POST', certUrl(STAGE, '/valider'), await tokenFor('encadrantElec')
    );
    expect(foreignReview.status).toBe(403);
  });
});
