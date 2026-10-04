const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const BASE = 'http://localhost:3000/api';
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'candidats');

require('dotenv').config();
const pool = require('../config/db');

let candidatToken = null;
let candidatId = null;
let uploadedCv = null;

async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  expect(res.status).toBe(200);
  return res.json();
}

async function loginCandidat() {
  if (candidatToken) return candidatToken;
  const data = await login('candidat@steg.tn', 'Candidat123!');
  candidatToken = data.token;
  candidatId = data.user.id;
  return candidatToken;
}

function buildCvForm({ content = '%PDF-1.4\n% test cv', filename = 'cv-test.pdf', fileType = 'application/pdf', file = true } = {}) {
  const form = new FormData();
  if (file) form.append('cv', new Blob([content], { type: fileType }), filename);
  return form;
}

function expiredToken() {
  return jwt.sign(
    { id: candidatId, email: 'candidat@steg.tn', role: 'CANDIDAT' },
    process.env.JWT_SECRET,
    { expiresIn: -10 }
  );
}

afterAll(async () => {
  if (candidatToken) {
    await fetch(`${BASE}/candidat/cv`, { method: 'DELETE', headers: { Authorization: `Bearer ${candidatToken}` } });
  }
  await pool.end();
});

describe('CV candidat API — upload', () => {
  test('refuse l’upload sans jeton (401)', async () => {
    const res = await fetch(`${BASE}/candidat/cv`, { method: 'POST', body: buildCvForm() });
    expect(res.status).toBe(401);
    expect((await res.json()).message).toContain('Token d\'accès requis');
  });

  test('refuse un jeton invalide (401)', async () => {
    const res = await fetch(`${BASE}/candidat/cv`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-pas-verifiable' },
      body: buildCvForm()
    });
    expect(res.status).toBe(401);
    expect((await res.json()).message).toContain('Token invalide');
  });

  test('refuse un jeton expiré (401) avec un message clair', async () => {
    const res = await fetch(`${BASE}/candidat/cv`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${expiredToken()}` },
      body: buildCvForm()
    });
    expect(res.status).toBe(401);
    expect((await res.json()).message).toContain('session a expiré');
  });

  test('refuse un fichier sans extension PDF (400)', async () => {
    const res = await fetch(`${BASE}/candidat/cv`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await loginCandidat()}` },
      body: buildCvForm({ filename: 'cv.txt', fileType: 'text/plain' })
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain('Seuls les fichiers PDF');
  });

  test('refuse un fichier renommé en .pdf mais pas un vrai PDF (400)', async () => {
    const res = await fetch(`${BASE}/candidat/cv`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await loginCandidat()}` },
      body: buildCvForm({ filename: 'fake.pdf', content: 'Ceci nest pas un PDF', fileType: 'application/pdf' })
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain('Seuls les fichiers PDF');
  });

  test('refuse un fichier de plus de 10 Mo (400)', async () => {
    const big = new Blob([Buffer.alloc(10 * 1024 * 1024 + 1)], { type: 'application/pdf' });
    const form = new FormData();
    form.append('cv', big, 'big.pdf');
    const res = await fetch(`${BASE}/candidat/cv`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await loginCandidat()}` },
      body: form
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain('trop volumineux');
  });

  test('refuse un upload sans fichier (400)', async () => {
    const res = await fetch(`${BASE}/candidat/cv`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await loginCandidat()}` },
      body: buildCvForm({ file: false })
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain('Aucun fichier CV');
  });

  test('refuse un upload par un stagiaire (403)', async () => {
    const data = await login('fatma.trabelsi@steg.tn', 'stagiaire123');
    const res = await fetch(`${BASE}/candidat/cv`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.token}` },
      body: buildCvForm()
    });
    expect(res.status).toBe(403);
  });

  test('dépose un CV valide : réponse, fichier sur disque et association au bon utilisateur', async () => {
    const res = await fetch(`${BASE}/candidat/cv`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await loginCandidat()}` },
      body: buildCvForm()
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cv).toBeDefined();
    expect(body.cv.originalName).toBe('cv-test.pdf');
    expect(typeof body.cv.filename).toBe('string');
    expect(body.cv.size).toBeGreaterThan(0);

    uploadedCv = body.cv;

    const filePath = path.join(UPLOAD_DIR, uploadedCv.filename);
    expect(fs.existsSync(filePath)).toBe(true);

    const { rows } = await pool.query(
      'SELECT cv_path, cv_original_name FROM candidat WHERE id = $1',
      [candidatId]
    );
    expect(rows.length).toBe(1);
    expect(path.basename(rows[0].cv_path)).toBe(uploadedCv.filename);
    expect(rows[0].cv_original_name).toBe('cv-test.pdf');

    const infoRes = await fetch(`${BASE}/candidat/cv/info`, {
      headers: { Authorization: `Bearer ${candidatToken}` }
    });
    expect(infoRes.status).toBe(200);
    const info = await infoRes.json();
    expect(info.cv.filename).toBe(uploadedCv.filename);
  });

  test('un nouveau dépôt remplace l’ancien fichier CV', async () => {
    const first = uploadedCv;
    const res = await fetch(`${BASE}/candidat/cv`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await loginCandidat()}` },
      body: buildCvForm({ filename: 'cv-v2.pdf' })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cv.filename).not.toBe(first.filename);
    expect(fs.existsSync(path.join(UPLOAD_DIR, first.filename))).toBe(false);
    uploadedCv = body.cv;
  });
});
