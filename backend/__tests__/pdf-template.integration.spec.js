require('dotenv').config();
const fs = require('fs');
const zlib = require('zlib');
const pool = require('../config/db');
const { UPLOAD_DIR } = require('../config/uploads');

const API = 'http://localhost:3000/api';
const TEMPLATES_URL = `${API}/document-templates`;
const STAGES_URL = `${API}/stages`;
const NAMESPACE = `P1-3A6-${Date.now()}`;
const NAMESPACE_LIKE = 'P1-3A6-%';
const MISSING_UUID = '00000000-0000-4000-8000-000000000000';

const ACCOUNTS = {
  admin: ['admin@steg.tn', 'admin123'],
  rh: ['salma.bouazizi@steg.tn', 'rh1234'],
  stagiaire: ['fatma.trabelsi@steg.tn', 'stagiaire123'],
  encadrant: ['ahmed.bensalah@steg.tn', 'encadrant123'],
  chef: ['nabil.khelifi@steg.tn', 'chef123'],
  candidat: ['candidat@steg.tn', 'Candidat123!']
};

const tokens = {};
let ownerStage = null;
let foreignStage = null;
let uploadsBefore = 0;

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

async function fetchDoc(url, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  const buffer = Buffer.from(await res.arrayBuffer());
  let json = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      json = JSON.parse(buffer.toString('utf8'));
    } catch (err) {
      json = null;
    }
  }
  return {
    status: res.status,
    contentType,
    disposition: res.headers.get('content-disposition') || '',
    buffer,
    json
  };
}

async function postJson(url, token, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

function decodePdfTokens(streamText) {
  const tokensOut = [];
  const re = /<[0-9A-Fa-f\s]*>|\((?:\\[\s\S]|[^\\()])*\)/g;
  let match;
  while ((match = re.exec(streamText)) !== null) {
    const token = match[0];
    if (token[0] === '<') {
      const bytes = Buffer.from(token.slice(1, -1).replace(/\s+/g, ''), 'hex');
      tokensOut.push(
        bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff
          ? bytes.subarray(2).toString('utf16le')
          : bytes.toString('latin1')
      );
    } else {
      tokensOut.push(
        token
          .slice(1, -1)
          .replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (all, esc) => {
            if (esc === 'n') return '\n';
            if (esc === 'r') return '\r';
            if (esc === 't') return '\t';
            if (esc === 'b') return '\b';
            if (esc === 'f') return '\f';
            if (esc === '(') return '(';
            if (esc === ')') return ')';
            if (esc === '\\') return '\\';
            return String.fromCharCode(parseInt(esc, 8));
          })
      );
    }
  }
  return tokensOut.join('');
}

function extractPdfText(buffer) {
  const raw = buffer.toString('latin1');
  const re = /stream\r?\n/g;
  let match;
  let text = '';
  while ((match = re.exec(raw)) !== null) {
    const start = match.index + match[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) break;
    let payload = buffer.subarray(start, end);
    while (payload.length && (payload[payload.length - 1] === 0x0a || payload[payload.length - 1] === 0x0d)) {
      payload = payload.subarray(0, payload.length - 1);
    }
    try {
      text += decodePdfTokens(zlib.inflateSync(payload).toString('latin1'));
    } catch (err) {
      text += '';
    }
    re.lastIndex = end;
  }
  return text;
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
  const res = await postJson(TEMPLATES_URL, token, payload);
  if (res.status !== 201) {
    throw new Error(`Création du template « ${payload.nom} » échouée (${res.status}) : ${JSON.stringify(res.body)}`);
  }
  return res.body.template;
}

async function generatedRows(stageId) {
  const { rows } = await pool.query(
    `SELECT g.id, g.template_id, g.template_version, g.stage_id, g.variables, t.type
       FROM document_generated g
       LEFT JOIN document_template t ON t.id = g.template_id
      WHERE g.stage_id = $1`,
    [stageId]
  );
  return rows;
}

beforeAll(async () => {
  await cleanNamespace();

  const { rows } = await pool.query(`
    SELECT s.id, su.nom AS stagiaire_nom, su.prenom AS stagiaire_prenom, su.email
      FROM stage s
      JOIN utilisateur su ON su.id = s.stagiaire_id
  `);
  const owner = rows.find((row) => row.email === ACCOUNTS.stagiaire[0]);
  const foreign = rows.find((row) => row.email === 'mohamed.bouchnak@steg.tn');
  if (!owner || !foreign) throw new Error('Stages de démonstration introuvables dans la base.');
  ownerStage = owner;
  foreignStage = foreign;

  uploadsBefore = fs.readdirSync(UPLOAD_DIR).length;
});

afterAll(async () => {
  await cleanNamespace();
  expect(fs.readdirSync(UPLOAD_DIR).length).toBe(uploadsBefore);
  await pool.end();
});

beforeEach(async () => {
  await cleanNamespace();
});

const historicalConventionFilename = () =>
  `convention_stage_${ownerStage.stagiaire_nom}_${ownerStage.stagiaire_prenom}.pdf`;

const historicalAttestationFilename = () =>
  `attestation_stage_${ownerStage.stagiaire_nom}_${ownerStage.stagiaire_prenom}.pdf`;

const historicalEvaluationFilename = () =>
  `evaluation_${ownerStage.stagiaire_nom}_${ownerStage.stagiaire_prenom}.pdf`;

describe('P1-3A-6 — PDF historiques sans template (rétrocompatibilité)', () => {
  test('1. convention sans template actif → PDF historique, aucune historisation', async () => {
    const res = await fetchDoc(`${STAGES_URL}/${ownerStage.id}/pdf/convention`, await tokenFor('admin'));

    expect(res.status).toBe(200);
    expect(res.contentType).toContain('application/pdf');
    expect(res.disposition).toContain(`filename="${historicalConventionFilename()}"`);
    expect(res.buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(extractPdfText(res.buffer)).toContain('CONVENTION DE STAGE');
    expect(await generatedRows(ownerStage.id)).toHaveLength(0);
  });

  test('2. attestation sans template actif → PDF historique', async () => {
    const res = await fetchDoc(`${STAGES_URL}/${ownerStage.id}/pdf/attestation`, await tokenFor('admin'));

    expect(res.status).toBe(200);
    expect(res.contentType).toContain('application/pdf');
    expect(res.disposition).toContain(`filename="${historicalAttestationFilename()}"`);
    expect(extractPdfText(res.buffer)).toContain('ATTESTATION DE STAGE');
    expect(await generatedRows(ownerStage.id)).toHaveLength(0);
  });

  test('3. évaluation → PDF historique (type EVALUATION absent de type_document)', async () => {
    const res = await fetchDoc(`${STAGES_URL}/${ownerStage.id}/pdf/evaluation`, await tokenFor('admin'));

    expect(res.status).toBe(200);
    expect(res.contentType).toContain('application/pdf');
    expect(res.disposition).toContain(`filename="${historicalEvaluationFilename()}"`);
    expect(extractPdfText(res.buffer)).toContain("FICHE D'ÉVALUATION DE STAGE");
    expect(await generatedRows(ownerStage.id)).toHaveLength(0);
  });

  test('4. template désactivé → repli sur le PDF historique', async () => {
    const token = await tokenFor('admin');
    const template = await createTemplate(token, {
      nom: `${NAMESPACE}-conv-inactif`,
      type: 'CONVENTION',
      contenu: 'P13A6-INACTIF-MARQUEUR {{stagiaire_prenom}}',
      variables: ['stagiaire_prenom']
    });
    const deactivated = await fetch(`${TEMPLATES_URL}/${template.id}/deactivate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    });
    const deactivatedBody = await deactivated.json();
    expect(deactivated.status).toBe(200);
    expect(deactivatedBody.template.actif).toBe(false);

    const res = await fetchDoc(`${STAGES_URL}/${ownerStage.id}/pdf/convention`, token);

    expect(res.status).toBe(200);
    expect(res.contentType).toContain('application/pdf');
    expect(res.disposition).toContain(`filename="${historicalConventionFilename()}"`);
    const text = extractPdfText(res.buffer);
    expect(text).toContain('CONVENTION DE STAGE');
    expect(text).not.toContain('P13A6-INACTIF-MARQUEUR');
    expect(await generatedRows(ownerStage.id)).toHaveLength(0);
  });
});

describe('P1-3A-6 — PDF générés depuis un template actif', () => {
  test('5. convention avec template actif → PDF du template + historisation', async () => {
    const token = await tokenFor('admin');
    const template = await createTemplate(token, {
      nom: `${NAMESPACE}-conv-v1`,
      type: 'CONVENTION',
      contenu: 'P13A6-CONVENTION-MARQUEUR {{stagiaire_prenom}} {{stagiaire_nom}} ({{departement_nom}})',
      variables: ['stagiaire_prenom', 'stagiaire_nom', 'departement_nom']
    });

    const res = await fetchDoc(`${STAGES_URL}/${ownerStage.id}/pdf/convention`, token);

    expect(res.status).toBe(200);
    expect(res.contentType).toContain('application/pdf');
    expect(res.disposition).toContain(`filename="${historicalConventionFilename()}"`);
    const text = extractPdfText(res.buffer);
    expect(text).toContain('P13A6-CONVENTION-MARQUEUR');
    expect(text).toContain(`${ownerStage.stagiaire_prenom} ${ownerStage.stagiaire_nom}`);
    expect(text).not.toContain('CONVENTION DE STAGE');

    const rows = await generatedRows(ownerStage.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].template_id).toBe(template.id);
    expect(rows[0].template_version).toBe(template.version);
    expect(rows[0].type).toBe('CONVENTION');
    expect(rows[0].variables.stagiaire_prenom).toBe(ownerStage.stagiaire_prenom);
  });

  test('6. attestation avec template actif → PDF du template + historisation', async () => {
    const token = await tokenFor('admin');
    const template = await createTemplate(token, {
      nom: `${NAMESPACE}-att-v1`,
      type: 'ATTESTATION',
      contenu: 'P13A6-ATTESTATION-MARQUEUR de {{stagiaire_prenom}} {{stagiaire_nom}}',
      variables: ['stagiaire_prenom', 'stagiaire_nom']
    });

    const res = await fetchDoc(`${STAGES_URL}/${ownerStage.id}/pdf/attestation`, token);

    expect(res.status).toBe(200);
    expect(res.contentType).toContain('application/pdf');
    expect(res.disposition).toContain(`filename="${historicalAttestationFilename()}"`);
    const text = extractPdfText(res.buffer);
    expect(text).toContain('P13A6-ATTESTATION-MARQUEUR');
    expect(text).not.toContain('ATTESTATION DE STAGE');

    const rows = await generatedRows(ownerStage.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].template_id).toBe(template.id);
    expect(rows[0].template_version).toBe(template.version);
    expect(rows[0].type).toBe('ATTESTATION');
  });

  test('7. plusieurs versions actives → la version maximale est utilisée', async () => {
    const token = await tokenFor('admin');
    const v1 = await createTemplate(token, {
      nom: `${NAMESPACE}-conv-v1-max`,
      type: 'CONVENTION',
      contenu: 'P13A6-VERSION-1 {{stagiaire_prenom}}',
      variables: ['stagiaire_prenom']
    });
    const v2 = await createTemplate(token, {
      nom: `${NAMESPACE}-conv-v2-max`,
      type: 'CONVENTION',
      contenu: 'P13A6-VERSION-2 {{stagiaire_prenom}}',
      variables: ['stagiaire_prenom']
    });

    const res = await fetchDoc(`${STAGES_URL}/${ownerStage.id}/pdf/convention`, token);

    expect(res.status).toBe(200);
    const text = extractPdfText(res.buffer);
    expect(text).toContain('P13A6-VERSION-2');
    expect(text).not.toContain('P13A6-VERSION-1');

    const rows = await generatedRows(ownerStage.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].template_id).toBe(v2.id);
    expect(rows[0].template_version).toBe(v2.version);
    expect(rows[0].template_version).toBeGreaterThan(v1.version);
  });

  test('8. template dont une variable est absente des données → 422 sans PDF ni historisation', async () => {
    const token = await tokenFor('admin');
    await createTemplate(token, {
      nom: `${NAMESPACE}-conv-var-absente`,
      type: 'CONVENTION',
      contenu: 'P13A6-MISSING {{entreprise_nom}}',
      variables: ['entreprise_nom']
    });

    const res = await fetchDoc(`${STAGES_URL}/${ownerStage.id}/pdf/convention`, token);

    expect(res.status).toBe(422);
    expect(res.contentType).toContain('application/json');
    expect(res.json.success).toBe(false);
    expect(res.json.message).toContain('entreprise_nom');
    expect(res.buffer.subarray(0, 5).toString('latin1')).not.toBe('%PDF-');
    expect(await generatedRows(ownerStage.id)).toHaveLength(0);
  });

  test('9. les templates de convention/attestation ne modifient pas l endpoint évaluation', async () => {
    const token = await tokenFor('admin');
    await createTemplate(token, {
      nom: `${NAMESPACE}-conv-leak`,
      type: 'CONVENTION',
      contenu: 'P13A6-CONVENTION-MARQUEUR {{stagiaire_prenom}}',
      variables: ['stagiaire_prenom']
    });
    await createTemplate(token, {
      nom: `${NAMESPACE}-att-leak`,
      type: 'ATTESTATION',
      contenu: 'P13A6-ATTESTATION-MARQUEUR {{stagiaire_prenom}}',
      variables: ['stagiaire_prenom']
    });

    const res = await fetchDoc(`${STAGES_URL}/${ownerStage.id}/pdf/evaluation`, token);

    expect(res.status).toBe(200);
    expect(res.contentType).toContain('application/pdf');
    expect(res.disposition).toContain(`filename="${historicalEvaluationFilename()}"`);
    const text = extractPdfText(res.buffer);
    expect(text).toContain("FICHE D'ÉVALUATION DE STAGE");
    expect(text).not.toContain('P13A6-CONVENTION-MARQUEUR');
    expect(text).not.toContain('P13A6-ATTESTATION-MARQUEUR');
    expect(await generatedRows(ownerStage.id)).toHaveLength(0);
  });
});

describe('P1-3A-6 — permissions inchangées sur les endpoints PDF', () => {
  test('10. sans token → 401', async () => {
    const res = await fetchDoc(`${STAGES_URL}/${ownerStage.id}/pdf/convention`, null);
    expect(res.status).toBe(401);
  });

  test('11. STAGIAIRE sur le stage d un autre stagiaire → 403 (template actif présent)', async () => {
    const adminToken = await tokenFor('admin');
    await createTemplate(adminToken, {
      nom: `${NAMESPACE}-conv-perm`,
      type: 'CONVENTION',
      contenu: 'P13A6-PERMISSION-MARQUEUR {{stagiaire_prenom}}',
      variables: ['stagiaire_prenom']
    });

    const res = await fetchDoc(
      `${STAGES_URL}/${foreignStage.id}/pdf/convention`,
      await tokenFor('stagiaire')
    );

    expect(res.status).toBe(403);
    expect(await generatedRows(foreignStage.id)).toHaveLength(0);
  });

  test('12. ENCADRANT sur le stage d un autre encadrant → 403', async () => {
    const res = await fetchDoc(
      `${STAGES_URL}/${foreignStage.id}/pdf/attestation`,
      await tokenFor('encadrant')
    );
    expect(res.status).toBe(403);
  });

  test('13. CANDIDAT sur un stage → 403', async () => {
    const res = await fetchDoc(`${STAGES_URL}/${ownerStage.id}/pdf/convention`, await tokenFor('candidat'));
    expect(res.status).toBe(403);
  });

  test('14. STAGIAIRE propriétaire avec template actif → 200 et PDF du template', async () => {
    const token = await tokenFor('admin');
    await createTemplate(token, {
      nom: `${NAMESPACE}-conv-owner`,
      type: 'CONVENTION',
      contenu: 'P13A6-OWNER-MARQUEUR {{stagiaire_prenom}}',
      variables: ['stagiaire_prenom']
    });

    const res = await fetchDoc(`${STAGES_URL}/${ownerStage.id}/pdf/convention`, await tokenFor('stagiaire'));

    expect(res.status).toBe(200);
    expect(res.contentType).toContain('application/pdf');
    expect(extractPdfText(res.buffer)).toContain('P13A6-OWNER-MARQUEUR');
    const rows = await generatedRows(ownerStage.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('CONVENTION');
  });

  test('15. stage inconnu → 404 sans historisation', async () => {
    const res = await fetchDoc(`${STAGES_URL}/${MISSING_UUID}/pdf/convention`, await tokenFor('admin'));
    expect(res.status).toBe(404);
    expect(await generatedRows(MISSING_UUID)).toHaveLength(0);
  });

  test('16. RH (accès total) → 200 sur convention et attestation', async () => {
    const token = await tokenFor('rh');
    await createTemplate(token, {
      nom: `${NAMESPACE}-conv-rh`,
      type: 'CONVENTION',
      contenu: 'P13A6-RH-MARQUEUR {{stagiaire_prenom}}',
      variables: ['stagiaire_prenom']
    });

    const convention = await fetchDoc(`${STAGES_URL}/${ownerStage.id}/pdf/convention`, token);
    expect(convention.status).toBe(200);
    expect(convention.contentType).toContain('application/pdf');
    expect(extractPdfText(convention.buffer)).toContain('P13A6-RH-MARQUEUR');

    const attestation = await fetchDoc(`${STAGES_URL}/${ownerStage.id}/pdf/attestation`, token);
    expect(attestation.status).toBe(200);
    expect(attestation.contentType).toContain('application/pdf');
  });

  test('17. CHEF_DEPARTEMENT sur un stage de son département → 200', async () => {
    const adminToken = await tokenFor('admin');
    await createTemplate(adminToken, {
      nom: `${NAMESPACE}-conv-chef`,
      type: 'CONVENTION',
      contenu: 'P13A6-CHEF-MARQUEUR {{stagiaire_prenom}}',
      variables: ['stagiaire_prenom']
    });

    const res = await fetchDoc(`${STAGES_URL}/${ownerStage.id}/pdf/convention`, await tokenFor('chef'));
    expect(res.status).toBe(200);
    expect(res.contentType).toContain('application/pdf');
    expect(extractPdfText(res.buffer)).toContain('P13A6-CHEF-MARQUEUR');
  });
});
