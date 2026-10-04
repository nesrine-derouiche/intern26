const path = require('path');
const BASE = 'http://localhost:3000/api';
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

require('dotenv').config();
const pool = require('../config/db');
const bcrypt = require('bcrypt');

jest.mock('../services/email.service', () => ({
  sendInternshipAcceptedEmail: jest.fn(),
  sendDocumentsRequestEmail: jest.fn(),
  sendCandidatureReceivedEmail: jest.fn()
}));

// Raccourci DEMO (acceptation directe après entretien IA, sans entretien humain) :
// endpoint `POST /candidatures/:id/accept-after-ai-interview`.
// NB : aucune logique existante modifiée ; le endpoint réutilise
// `_finalAcceptance` (ancienne méthode « v1 » de candidature.service.js).

const CANDIDAT_EMAIL = 'candidat.direct@steg.tn';
const RH_EMAIL = 'salma.bouazizi@steg.tn';
const URL = (id) => `${BASE}/candidatures/${id}/accept-after-ai-interview`;

let adminToken = null;
let rhToken = null;
let candidatId = null;
let open = [];
let created = [];
const offreBaselines = new Map();

async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error(`Login échoué (${res.status}) : ${await res.text()}`);
  const data = await res.json();
  return data.token;
}

async function loginAdmin() {
  if (adminToken) return adminToken;
  adminToken = await login('admin@steg.tn', 'admin123');
  return adminToken;
}

async function loginRH() {
  if (rhToken) return rhToken;
  rhToken = await login(RH_EMAIL, 'rh1234');
  return rhToken;
}

/**
 * Candidat dédié au raccourci : re-login systématique pour réinitialiser le rôle
 * (CANDIDAT) et car `_finalAcceptance` invalide le jeton (token_version + 1
 * après la promotion CANDIDAT → STAGIAIRE).
 */
async function loginCandidat() {
  await pool.query("UPDATE utilisateur SET role = 'CANDIDAT' WHERE email = $1", [CANDIDAT_EMAIL]);
  return login(CANDIDAT_EMAIL, 'Candidat123!');
}

async function authed(url, token, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
}

/** Crée une candidature portail (candidat → offre ouverte) et mémorise l'offre. */
async function applyForOffer(token) {
  const mineRes = await authed(`${BASE}/candidatures`, token);
  expect(mineRes.status).toBe(200);
  const mine = await mineRes.json();
  const applied = new Set((Array.isArray(mine) ? mine : []).map((c) => c.offre_id));
  const target = open.find((o) => !applied.has(o.id) && o.nombre_places > 0) || open[0];
  expect(target).toBeTruthy();

  const { rows } = await pool.query(
    'SELECT nombre_places, statut FROM offre_stage WHERE id = $1', [target.id]
  );
  if (rows[0] && !offreBaselines.has(target.id)) {
    offreBaselines.set(target.id, { nombre_places: rows[0].nombre_places, statut: rows[0].statut });
  }

  const res = await authed(`${BASE}/candidatures`, token, {
    method: 'POST',
    body: JSON.stringify({ offre_id: target.id })
  });
  expect(res.status).toBe(201);
  const { candidature } = await res.json();
  created.push(candidature.id);
  return candidature.id;
}

/** Simule la réussite de l'entretien IA (statut posé normalement par submitAiInterviewResult). */
async function forceAiPassed(id) {
  await pool.query("UPDATE candidature SET statut = 'AI_INTERVIEW_PASSED' WHERE id = $1", [id]);
}

/** Aujourd'hui dans le fuseau Africa/Tunis (attendu pour date_debut du stage). */
function todayTunis() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }));
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

describe('Acceptation directe après entretien IA (raccourci DEMO, intégration)', () => {
  beforeAll(async () => {
    adminToken = await loginAdmin();
    rhToken = await loginRH();

    const offresRes = await fetch(`${BASE}/public/offres`);
    expect(offresRes.status).toBe(200);
    open = await offresRes.json();
    expect(open.length).toBeGreaterThan(0);

    const { rows: users } = await pool.query('SELECT id FROM utilisateur WHERE email = $1', [CANDIDAT_EMAIL]);
    if (users[0]) {
      candidatId = users[0].id;
    } else {
      const password = await bcrypt.hash('Candidat123!', 12);
      const ins = await pool.query(
        `INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone, adresse, role, email_verifie)
         VALUES ('Direct', 'Accept', $1, $2, '+216 22 000 003', 'Tunis', 'CANDIDAT', true)
         RETURNING id`,
        [CANDIDAT_EMAIL, password]
      );
      candidatId = ins.rows[0].id;
      await pool.query(
        `INSERT INTO candidat (id, universite, specialite, niveau, competences, langues)
         VALUES ($1, 'ENIT', 'Génie Électrique', 'Master 2', 'Python, SQL', 'Français')`,
        [candidatId]
      );
    }
    expect(candidatId).toBeTruthy();
    await pool.query('DELETE FROM stagiaire WHERE id = $1', [candidatId]);
    await pool.query("UPDATE utilisateur SET role = 'CANDIDAT' WHERE id = $1", [candidatId]);
  });

  afterEach(async () => {
    for (const id of created) {
      await pool.query('DELETE FROM stage WHERE candidature_id = $1', [id]);
      await pool.query('DELETE FROM candidature WHERE id = $1', [id]);
    }
    created = [];
    for (const [offreId, baseline] of offreBaselines) {
      await pool.query(
        'UPDATE offre_stage SET nombre_places = $2, statut = $3 WHERE id = $1',
        [offreId, baseline.nombre_places, baseline.statut]
      );
    }
    offreBaselines.clear();
  });

  afterAll(async () => {
    if (candidatId) {
      await pool.query('DELETE FROM stagiaire WHERE id = $1', [candidatId]);
      await pool.query('DELETE FROM candidat WHERE id = $1', [candidatId]);
      await pool.query('DELETE FROM utilisateur WHERE id = $1', [candidatId]);
    }
    await pool.end();
  });

  test(
    'RH accepte directement après entretien IA → ACCEPTEE + stage créé + candidat promu STAGIAIRE',
    async () => {
      const id = await applyForOffer(await loginCandidat());
      await forceAiPassed(id);

      const res = await authed(URL(id), await loginRH(), { method: 'POST' });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.statut).toBe('ACCEPTEE');
      expect(data.candidature_id).toBe(id);
      expect(data.stage_id).toBeTruthy();

      const { rows: [cand] } = await pool.query(
        'SELECT statut, stagiaire_id FROM candidature WHERE id = $1', [id]
      );
      expect(cand.statut).toBe('ACCEPTEE');
      expect(cand.stagiaire_id).toBe(candidatId);

      const { rows: [stage] } = await pool.query(
        'SELECT date_debut::text AS date_debut, date_fin::text AS date_fin FROM stage WHERE candidature_id = $1',
        [id]
      );
      expect(stage.date_debut).toBe(todayTunis());
      expect(stage.date_fin > stage.date_debut).toBe(true);

      const role = await pool.query('SELECT role FROM utilisateur WHERE id = $1', [candidatId]);
      expect(role.rows[0].role).toBe('STAGIAIRE');
      const stagiaire = await pool.query('SELECT COUNT(*)::int AS n FROM stagiaire WHERE id = $1', [candidatId]);
      expect(stagiaire.rows[0].n).toBe(1);
    },
    120000
  );

  test(
    'garde : refus 400 si la candidature n\'est pas AI_INTERVIEW_PASSED',
    async () => {
      const id = await applyForOffer(await loginCandidat());

      const res = await authed(URL(id), await loginRH(), { method: 'POST' });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toMatch(/AI_INTERVIEW_PASSED/);
    },
    120000
  );

  test(
    'garde : un candidat ne peut pas s\'accepter lui-même (403)',
    async () => {
      const id = await applyForOffer(await loginCandidat());
      await forceAiPassed(id);

      const res = await authed(URL(id), await loginCandidat(), { method: 'POST' });
      expect(res.status).toBe(403);
    },
    120000
  );
});