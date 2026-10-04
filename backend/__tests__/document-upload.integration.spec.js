const fs = require('fs');
const path = require('path');
const BASE = 'http://localhost:3000/api';
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

let adminToken = null;
let stage = null;
let uploadedDoc = null;

async function login() {
  if (adminToken) return adminToken;
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@steg.tn', password: 'admin123' })
  });
  const data = await res.json();
  adminToken = data.token;
  return adminToken;
}

async function pickStage() {
  if (stage) return stage;
  const res = await fetch(`${BASE}/stages`, {
    headers: { Authorization: `Bearer ${await login()}` }
  });
  const stages = await res.json();
  if (Array.isArray(stages) && stages.length > 0) {
    stage = stages.find((s) => s.stagiaire_id && s.encadrant_id) || stages[0];
  }
  return stage;
}

function buildForm(type, { content = 'Contenu du document de test', filename = 'cv.pdf', fileType = 'application/pdf', file = true } = {}) {
  const form = new FormData();
  form.append('type', type);
  if (file) form.append('file', new Blob([content], { type: fileType }), filename);
  return form;
}

describe('Documents API — upload', () => {
  test('rejects upload without token', async () => {
    const s = await pickStage();
    if (!s) return;
    const res = await fetch(`${BASE}/stages/${s.id}/documents`, {
      method: 'POST',
      body: buildForm('CV')
    });
    expect(res.status).toBe(401);
  });

  test('rejects upload without type', async () => {
    const s = await pickStage();
    if (!s) return;
    const res = await fetch(`${BASE}/stages/${s.id}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await login()}` },
      body: buildForm('', { file: false })
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.some((e) => e.message.includes('Type de document requis'))).toBe(true);
  });

  test('rejects upload with invalid type', async () => {
    const s = await pickStage();
    if (!s) return;
    const res = await fetch(`${BASE}/stages/${s.id}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await login()}` },
      body: buildForm('PDF')
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.some((e) => e.message.includes('Type invalide'))).toBe(true);
  });

  test('rejects upload without file', async () => {
    const s = await pickStage();
    if (!s) return;
    const res = await fetch(`${BASE}/stages/${s.id}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await login()}` },
      body: buildForm('CV', { file: false })
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain('Aucun fichier fourni');
  });

  test('rejects upload with invalid stage id', async () => {
    const res = await fetch(`${BASE}/stages/not-a-uuid/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await login()}` },
      body: buildForm('CV')
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.some((e) => e.message.includes('ID stage invalide'))).toBe(true);
  });

  test('rejects file larger than 10 Mo', async () => {
    const s = await pickStage();
    if (!s) return;
    const bigFile = new Blob([Buffer.alloc(10 * 1024 * 1024 + 1)], { type: 'application/octet-stream' });
    const form = new FormData();
    form.append('type', 'CV');
    form.append('file', bigFile, 'big.pdf');
    const res = await fetch(`${BASE}/stages/${s.id}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await login()}` },
      body: form
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain('trop volumineux');
  });

  test('uploads a multipart document successfully', async () => {
    const s = await pickStage();
    if (!s) return;
    const res = await fetch(`${BASE}/stages/${s.id}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await login()}` },
      body: buildForm('CV')
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.document).toBeDefined();
    expect(data.document.id).toBeDefined();
    expect(data.document.type).toBe('CV');
    expect(data.document.nom).toBe('cv.pdf');
    expect(data.document.stage_id).toBe(s.id);
    expect(typeof data.document.chemin).toBe('string');
    uploadedDoc = data.document;
  });

  test('uploaded document appears in the stage document list', async () => {
    if (!uploadedDoc) return;
    const res = await fetch(`${BASE}/stages/${uploadedDoc.stage_id}/documents`, {
      headers: { Authorization: `Bearer ${await login()}` }
    });
    expect(res.status).toBe(200);
    const docs = await res.json();
    expect(Array.isArray(docs)).toBe(true);
    expect(docs.some((d) => d.id === uploadedDoc.id)).toBe(true);
  });

  test('uploaded file is stored on disk', async () => {
    if (!uploadedDoc) return;
    const filePath = path.join(UPLOAD_DIR, uploadedDoc.chemin);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  test('uploaded document can be downloaded', async () => {
    if (!uploadedDoc) return;
    const res = await fetch(`${BASE}/documents/${uploadedDoc.id}/download`, {
      headers: { Authorization: `Bearer ${await login()}` }
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
  });

  test('uploaded document can be deleted and removes the physical file', async () => {
    if (!uploadedDoc) return;
    const filePath = path.join(UPLOAD_DIR, uploadedDoc.chemin);
    const res = await fetch(`${BASE}/documents/${uploadedDoc.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${await login()}` }
    });
    expect(res.status).toBe(200);

    const listRes = await fetch(`${BASE}/stages/${uploadedDoc.stage_id}/documents`, {
      headers: { Authorization: `Bearer ${await login()}` }
    });
    const docs = await listRes.json();
    expect(docs.some((d) => d.id === uploadedDoc.id)).toBe(false);
    expect(fs.existsSync(filePath)).toBe(false);
    uploadedDoc = null;
  });
});
