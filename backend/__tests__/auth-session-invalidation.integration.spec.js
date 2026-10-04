require('dotenv').config();
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const BASE = 'http://localhost:3000/api';
const JWT_SECRET = process.env.JWT_SECRET;

let tempEmail = null;
let tempUser = null;
let oldToken = null;
let newToken = null;

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json() };
}

async function login(email, password) {
  return api('/auth/login', {
    method: 'POST',
    body: { email, password }
  });
}

function tokenFromLink(link) {
  expect(link).toBeTruthy();
  const token = new URL(link).searchParams.get('token');
  expect(token).toBeTruthy();
  return token;
}

describe('Invalidation de session : token_version et mot de passe', () => {
  beforeAll(async () => {
    // Compte temporaire créé via l'API publique pour ne pas impacter les seeds.
    tempEmail = `tmp-session-${Date.now()}@steg.tn`;
    const pwd = 'AuthTmp123!';

    const reg = await api('/auth/register', {
      method: 'POST',
      body: {
        nom: 'Session',
        prenom: 'Test',
        email: tempEmail,
        password: pwd,
        telephone: '55123456',
        adresse: 'Tunis',
        universite: 'INSAT',
        specialite: 'Informatique',
        niveau: 'Master',
        competences: ['Node.js'],
        langues: ['Français', 'Anglais']
      }
    });
    expect(reg.status).toBe(201);
    const verifyToken = tokenFromLink(reg.data.dev.verificationLink);

    const ver = await api('/auth/verify-email', {
      method: 'POST',
      body: { token: verifyToken }
    });
    expect(ver.status).toBe(200);

    const loginRes = await login(tempEmail, pwd);
    expect(loginRes.status).toBe(200);
    oldToken = loginRes.data.token;

    const me = await api('/auth/me', { token: oldToken });
    expect(me.status).toBe(200);
    tempUser = me.data.user;
    expect(tempUser.id).toBeTruthy();
  });

  afterAll(async () => {
    if (tempUser?.id) {
      await pool.query('DELETE FROM utilisateur WHERE id = $1', [tempUser.id]);
    }
    await pool.end();
  });

  test('la réinitialisation du mot de passe invalide l\'ancien jeton JWT', async () => {
    const newPassword = 'ResetaBcd123!';

    const forgot = await api('/auth/forgot-password', {
      method: 'POST',
      body: { email: tempEmail }
    });
    expect(forgot.status).toBe(200);
    const resetToken = tokenFromLink(forgot.data.dev.verificationLink);

    const reset = await api('/auth/reset-password', {
      method: 'POST',
      body: { token: resetToken, password: newPassword }
    });
    expect(reset.status).toBe(200);

    // L'ancien mot de passe ne fonctionne plus.
    const oldLogin = await login(tempEmail, 'AuthTmp123!');
    expect(oldLogin.status).toBe(401);

    // Le nouveau mot de passe reconnecte avec un jeton frais.
    const freshLogin = await login(tempEmail, newPassword);
    expect(freshLogin.status).toBe(200);
    newToken = freshLogin.data.token;

    // L'ancien jeton (émis avant la réinitialisation) est révoqué.
    const oldMe = await api('/auth/me', { token: oldToken });
    expect(oldMe.status).toBe(401);

    // Le jeton post-réinitialisation reste valide (token_version à jour).
    const freshMe = await api('/auth/me', { token: newToken });
    expect(freshMe.status).toBe(200);
  });

  test('un jeton forgé avec un token_version obsolète est rejeté', async () => {
    const admin = await login('admin@steg.tn', 'admin123');
    expect(admin.status).toBe(200);
    const adminId = admin.data.user.id;

    const stale = jwt.sign(
      { id: adminId, email: 'admin@steg.tn', role: 'ADMIN', token_version: 999999 },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await api('/auth/me', { token: stale });
    expect(res.status).toBe(401);
  });

  test('un jeton sans token_version ne contourne pas la vérification de session', async () => {
    const admin = await login('admin@steg.tn', 'admin123');
    expect(admin.status).toBe(200);
    const adminId = admin.data.user.id;

    const noVersion = jwt.sign(
      { id: adminId, email: 'admin@steg.tn', role: 'ADMIN' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await api('/auth/me', { token: noVersion });
    expect(res.status).toBe(401);
  });
});