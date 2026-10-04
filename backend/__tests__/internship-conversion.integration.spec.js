const fs = require('fs');
const path = require('path');
const BASE = 'http://localhost:3000/api';
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

require('dotenv').config();
const pool = require('../config/db');
const bcrypt = require('bcrypt');

jest.mock('../services/email.service', () => ({
  sendMobileAccessEmail: jest.fn(),
  sendInternshipAcceptedEmail: jest.fn(),
  sendHumanInterviewInvitationEmail: jest.fn(),
  sendCandidatureReceivedEmail: jest.fn(),
  sendDocumentsRequestEmail: jest.fn()
}));

const REQUIRED_TYPES = ['CV', 'CIN', 'DEMANDE_STAGE', 'LETTRE_AFFECTATION'];
const CANDIDAT_EMAIL = 'candidat.conversion@steg.tn';
const RH_EMAIL = 'salma.bouazizi@steg.tn';
const CONVERTED = 'STAGIAIRE_CREATED';

let adminToken = null;
let rhToken = null;
let encadrantToken = null;
let candidatToken = null;
let candidatId = null;
let rhId = null;
let open = [];
let created = [];
let uploadedFiles = [];
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

async function loginEncadrant() {
  if (encadrantToken) return encadrantToken;
  encadrantToken = await login('ahmed.bensalah@steg.tn', 'encadrant123');
  return encadrantToken;
}

/** Candidat dédié à la conversion : toujours re-login (token_version change après conversion). */
async function loginCandidat() {
  const { rows: users } = await pool.query(
    'SELECT id FROM utilisateur WHERE email = $1',
    [CANDIDAT_EMAIL]
  );
  expect(users[0]).toBeTruthy();
  candidatId = users[0].id;
  await pool.query("UPDATE utilisateur SET role = 'CANDIDAT' WHERE id = $1", [candidatId]);
  candidatToken = await login(CANDIDAT_EMAIL, 'Candidat123!');
  return candidatToken;
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

async function pickFreeOffer(token, adminToken, open) {
  const mineRes = await authed(`${BASE}/candidatures`, token);
  expect(mineRes.status).toBe(200);
  const mine = await mineRes.json();
  const applied = new Set((Array.isArray(mine) ? mine : []).map((c) => c.offre_id));

  let target = open.find((o) => !applied.has(o.id) && o.nombre_places > 0);
  if (!target) {
    const { rows } = await pool.query(
      `SELECT c.id, c.offre_id FROM candidature c
       WHERE c.candidat_id = $1 AND c.deleted_at IS NULL
       LIMIT 1`,
      [candidatId]
    );
    expect(rows[0]).toBeTruthy();
    await pool.query('DELETE FROM stage WHERE candidature_id = $1', [rows[0].id]);
    const freeRes = await authed(`${BASE}/candidatures/${rows[0].id}`, adminToken, {
      method: 'DELETE'
    });
    expect(freeRes.status).toBe(200);
    await pool.query(
      `UPDATE offre_stage SET statut = 'OUVERTE', nombre_places = GREATEST(nombre_places, 1)
       WHERE id = $1`,
      [rows[0].offre_id]
    );
    target =
      open.find((o) => o.id === rows[0].offre_id) ||
      open.find((o) => o.nombre_places > 0) ||
      open[0];
  }
  return target;
}

/** Candidature acceptée après l'entretien humain (statut HUMAN_INTERVIEW_ACCEPTED). */
async function createAcceptedCandidature(token, adminToken, rh, open) {
  const target = await pickFreeOffer(token, adminToken, open);
  const applyRes = await authed(`${BASE}/candidatures`, token, {
    method: 'POST',
    body: JSON.stringify({ offre_id: target.id })
  });
  expect(applyRes.status).toBe(201);
  const { candidature } = await applyRes.json();
  created.push(candidature.id);

  const putRes = await authed(`${BASE}/candidatures/${candidature.id}`, rh, {
    method: 'PUT',
    body: JSON.stringify({ statut: 'RH_ACCEPTED' })
  });
  expect(putRes.status).toBe(200);

  await pool.query("UPDATE candidature SET statut = 'AI_INTERVIEW_PASSED' WHERE id = $1", [candidature.id]);

  const schedule = await authed(`${BASE}/candidatures/${candidature.id}/entretien-humain`, rh, {
    method: 'POST',
    body: JSON.stringify({
      date: futureDate(30),
      heure: '10:30',
      duree: 45,
      interviewer: 'Salma Bouazizi',
      interviewer_email: RH_EMAIL,
      lien_visio: 'https://teams.microsoft.com/l/meetup-join/meeting/conversion-test'
    })
  });
  expect(schedule.status).toBe(200);

  const complete = await authed(`${BASE}/candidatures/${candidature.id}/entretien-humain/completion`, rh, {
    method: 'POST'
  });
  expect(complete.status).toBe(200);

  const decision = await authed(`${BASE}/candidatures/${candidature.id}/entretien-humain/decision`, rh, {
    method: 'POST',
    body: JSON.stringify({ decision: 'ACCEPTED' })
  });
  expect(decision.status).toBe(200);

  return candidature.id;
}

/** Candidature avec période de stage validée par le RH (fenêtre d'onboarding). */
async function createOnboardingCandidature(token, adminToken, rh, open) {
  const id = await createAcceptedCandidature(token, adminToken, rh, open);
  const prefs = await authed(`${BASE}/candidatures/${id}/stage-preferences`, token, {
    method: 'PUT',
    body: JSON.stringify({ internship_start_date: futureDate(30), internship_duration_months: 4 })
  });
  expect(prefs.status).toBe(200);
  const validated = await authed(`${BASE}/candidatures/${id}/stage-preferences/validate`, rh, {
    method: 'POST'
  });
  expect(validated.status).toBe(200);
  return id;
}

function futureDate(daysFromNow = 30) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }));
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) + daysFromNow * 86400000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

async function uploadDocument(candidatureId, type, token, { filename } = {}) {
  const form = new FormData();
  form.append('file', new Blob(['contenu du document'], { type: 'application/pdf' }), filename || `${type.toLowerCase()}.pdf`);
  const res = await fetch(`${BASE}/candidatures/${candidatureId}/documents/${type}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  if (res.ok) {
    const { rows } = await pool.query(
      'SELECT chemin FROM candidature_document WHERE candidature_id = $1',
      [candidatureId]
    );
    for (const r of rows) {
      if (!uploadedFiles.includes(r.chemin)) uploadedFiles.push(r.chemin);
    }
  }
  return res;
}

async function setVerificationStatus(candidatureId, type, verificationStatus) {
  await pool.query(
    'UPDATE candidature_document SET verification_status = $1 WHERE candidature_id = $2 AND type = $3',
    [verificationStatus, candidatureId, type]
  );
}

async function uploadAllValidDocuments(candidatureId, token) {
  for (const type of REQUIRED_TYPES) {
    const res = await uploadDocument(candidatureId, type, token);
    expect(res.status).toBe(200);
  }
  for (const type of REQUIRED_TYPES) {
    await setVerificationStatus(candidatureId, type, 'VALID');
  }
}

async function uploadValidTypes(candidatureId, token, types) {
  for (const type of types) {
    const res = await uploadDocument(candidatureId, type, token);
    expect(res.status).toBe(200);
    await setVerificationStatus(candidatureId, type, 'VALID');
  }
}

/** POST /convert-to-trainee en mémorisant l'état de l'offre (restauration afterAll). */
async function convert(candidatureId, token) {
  const { rows } = await pool.query(
    'SELECT id, nombre_places, statut FROM offre_stage WHERE id = (SELECT offre_id FROM candidature WHERE id = $1)',
    [candidatureId]
  );
  const offre = rows[0];
  if (offre && !offreBaselines.has(offre.id)) {
    offreBaselines.set(offre.id, { nombre_places: offre.nombre_places, statut: offre.statut });
  }
  return authed(`${BASE}/candidatures/${candidatureId}/convert-to-trainee`, token, { method: 'POST' });
}

describe('Conversion du dossier prêt en stagiaire (intégration)', () => {
  beforeAll(async () => {
    adminToken = await loginAdmin();
    rhToken = await loginRH();
    rhId = (await pool.query('SELECT id FROM utilisateur WHERE email = $1', [RH_EMAIL])).rows[0].id;

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
         VALUES ('Test', 'Conversion', $1, $2, '+216 22 000 002', 'Tunis', 'CANDIDAT', true)
         RETURNING id`,
        [CANDIDAT_EMAIL, password]
      );
      candidatId = ins.rows[0].id;
      await pool.query(
        `INSERT INTO candidat (id, universite, specialite, niveau, competences, langues)
         VALUES ($1, 'ENIT', 'Génie Civil', 'Master 2', 'BIM, AutoCAD', 'Français')`,
        [candidatId]
      );
    }
    expect(candidatId).toBeTruthy();
  });

  afterAll(async () => {
    for (const id of created) {
      await pool.query('DELETE FROM stage WHERE candidature_id = $1', [id]);
      await pool.query('DELETE FROM candidature WHERE id = $1', [id]);
    }
    for (const [offreId, baseline] of offreBaselines) {
      await pool.query(
        `UPDATE offre_stage SET nombre_places = $2, statut = $3 WHERE id = $1`,
        [offreId, baseline.nombre_places, baseline.statut]
      );
    }
    for (const filename of uploadedFiles) {
      try {
        const filePath = path.join(UPLOAD_DIR, path.basename(filename));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) {}
    }
    if (candidatId) {
      await pool.query('DELETE FROM stagiaire WHERE id = $1', [candidatId]);
      await pool.query('DELETE FROM candidat WHERE id = $1', [candidatId]);
      await pool.query('DELETE FROM utilisateur WHERE id = $1', [candidatId]);
    }
    await pool.end();
  });

  test(
    'RH convertit un dossier prêt → stagiaire + stage créés (sans donnée sensible)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadAllValidDocuments(id, token);

      const res = await convert(id, rh);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.candidature_id).toBe(id);
      expect(data.statut).toBe(CONVERTED);
      expect(data.already_converted).toBe(false);
      expect(data.stagiaire_id).toBe(candidatId);
      expect(data.stage_id).toBeTruthy();
      expect(data.stagiaire.email).toBe(CANDIDAT_EMAIL);
      expect(data.stagiaire.nom).toBe('Test');
      expect(data.stage.encadrant).toBeTruthy();
      expect(data.stage.encadrant.nom).toBeTruthy();
      const raw = JSON.stringify(data);
      expect(raw).not.toMatch(/mot_de_passe|password|token|credential|mobile_access|identifiant/i);
    },
    120000
  );

  test(
    'Administrateur convertit un dossier prêt → 200',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadAllValidDocuments(id, token);

      const res = await convert(id, adminToken);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.statut).toBe(CONVERTED);
      expect(data.stage_id).toBeTruthy();
    },
    120000
  );

  test(
    'le candidat ne peut pas convertir sa propre candidature (403)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);

      const res = await convert(id, token);
      expect(res.status).toBe(403);
    },
    120000
  );

  test(
    'un encadrant ne peut pas convertir une candidature (403)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);

      const res = await convert(id, await loginEncadrant());
      expect(res.status).toBe(403);
    },
    120000
  );

  test(
    'dossier incomplet (document manquant) → 400 avec la raison',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadValidTypes(id, token, ['CIN', 'DEMANDE_STAGE', 'LETTRE_AFFECTATION']);

      const res = await convert(id, rh);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toMatch(/documents du dossier sont manquants/);
      expect(data.message).toMatch(/Impossible de créer le stagiaire/);
    },
    120000
  );

  test(
    'document REVIEW_REQUIRED → 400 (DOCUMENTS_INVALID)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadAllValidDocuments(id, token);
      await setVerificationStatus(id, 'DEMANDE_STAGE', 'REVIEW_REQUIRED');

      const res = await convert(id, rh);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toMatch(/documents du dossier sont invalides/);
    },
    120000
  );

  test(
    'document REJECTED → 400 (DOCUMENTS_INVALID)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadAllValidDocuments(id, token);
      await setVerificationStatus(id, 'CIN', 'REJECTED');

      const res = await convert(id, rh);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toMatch(/documents du dossier sont invalides/);
    },
    120000
  );

  test(
    'période de stage non validée → 400 (INTERNSHIP_PERIOD_NOT_VALIDATED)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createAcceptedCandidature(token, adminToken, rh, open);
      await pool.query('UPDATE candidature SET internship_period_validated_at = now() WHERE id = $1', [id]);
      await uploadAllValidDocuments(id, token);
      await pool.query('UPDATE candidature SET internship_period_validated_at = NULL WHERE id = $1', [id]);

      const res = await convert(id, rh);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toMatch(/période de stage n'a pas été validée/);
    },
    120000
  );

  test(
    'entretien humain non accepté → 400 (HUMAN_INTERVIEW_NOT_ACCEPTED)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadAllValidDocuments(id, token);
      await pool.query("UPDATE candidature SET statut = 'AI_INTERVIEW_PASSED' WHERE id = $1", [id]);

      const res = await convert(id, rh);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toMatch(/entretien humain n'a pas été accepté/);
    },
    120000
  );

  test(
    'exactement un stagiaire créé : fiche unique + rôle promu CANDIDAT → STAGIAIRE',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadAllValidDocuments(id, token);

      await convert(id, rh);
      const count = await pool.query('SELECT COUNT(*)::int AS n FROM stagiaire WHERE id = $1', [candidatId]);
      expect(count.rows[0].n).toBe(1);
      const role = await pool.query('SELECT role FROM utilisateur WHERE id = $1', [candidatId]);
      expect(role.rows[0].role).toBe('STAGIAIRE');
    },
    120000
  );

  test(
    'candidature liée au stagiaire et passée en STAGIAIRE_CREATED',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadAllValidDocuments(id, token);

      await convert(id, rh);
      const { rows } = await pool.query('SELECT statut, stagiaire_id FROM candidature WHERE id = $1', [id]);
      expect(rows[0].statut).toBe(CONVERTED);
      expect(rows[0].stagiaire_id).toBe(candidatId);
    },
    120000
  );

  test(
    'dates du stage = période validée (début + durée en mois)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadAllValidDocuments(id, token);

      const before = await pool.query(
        `SELECT internship_start_date::text AS internship_start_date, internship_duration_months
         FROM candidature WHERE id = $1`,
        [id]
      );
      const start = before.rows[0].internship_start_date;
      const months = before.rows[0].internship_duration_months;

      const res = await convert(id, rh);
      const data = await res.json();
      const end = new Date(`${start}T00:00:00Z`);
      end.setUTCMonth(end.getUTCMonth() + months);
      const expectedEnd = end.toISOString().slice(0, 10);

      expect(data.stage.date_debut).toBe(start);
      expect(data.stage.date_fin).toBe(expectedEnd);
      expect(data.stage.duree_mois).toBe(months);

      const stage = await pool.query(
        'SELECT date_debut::text AS date_debut, date_fin::text AS date_fin FROM stage WHERE candidature_id = $1',
        [id]
      );
      expect(stage.rows[0].date_debut).toBe(start);
      expect(stage.rows[0].date_fin).toBe(expectedEnd);
    },
    120000
  );

  test(
    'offre, département et encadrant conservés',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadAllValidDocuments(id, token);

      const info = await pool.query(
        `SELECT c.offre_id, o.departement_id, o.encadrant_id
         FROM candidature c JOIN offre_stage o ON o.id = c.offre_id
         WHERE c.id = $1`,
        [id]
      );
      const { offre_id, departement_id, encadrant_id } = info.rows[0];

      await convert(id, rh);
      const stage = await pool.query(
        'SELECT offre_id, departement_id, encadrant_id FROM stage WHERE candidature_id = $1',
        [id]
      );
      expect(stage.rows[0].offre_id).toBe(offre_id);
      expect(stage.rows[0].departement_id).toBe(departement_id);
      expect(stage.rows[0].encadrant_id).toBeTruthy();

      if (encadrant_id) {
        const enc = await pool.query('SELECT disponibilite FROM encadrant WHERE id = $1', [encadrant_id]);
        if (enc.rows[0] && enc.rows[0].disponibilite) {
          expect(stage.rows[0].encadrant_id).toBe(encadrant_id);
        }
      }
    },
    120000
  );

  test(
    'double conversion idempotente : même stagiaire et même stage, already_converted=true',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadAllValidDocuments(id, token);

      const first = await (await convert(id, rh)).json();
      expect(first.already_converted).toBe(false);

      const secondRes = await convert(id, rh);
      expect(secondRes.status).toBe(200);
      const second = await secondRes.json();
      expect(second.already_converted).toBe(true);
      expect(second.stagiaire_id).toBe(first.stagiaire_id);
      expect(second.stage_id).toBe(first.stage_id);
      expect(second.statut).toBe(CONVERTED);

      const stages = await pool.query('SELECT COUNT(*)::int AS n FROM stage WHERE candidature_id = $1', [id]);
      expect(stages.rows[0].n).toBe(1);
    },
    120000
  );

  test(
    'échec transactionnel → annulation intégrale (rollback)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadAllValidDocuments(id, token);

      const info = await pool.query(
        'SELECT offre_id FROM candidature WHERE id = $1',
        [id]
      );
      const { offre_id } = info.rows[0];
      const placesBefore = (await pool.query('SELECT nombre_places, statut FROM offre_stage WHERE id = $1', [offre_id])).rows[0];
      const roleBefore = (await pool.query('SELECT role FROM utilisateur WHERE id = $1', [candidatId])).rows[0].role;

      // Période invalidée (durée négative) : le CHECK date_fin > date_debut du stage
      // échoue APRÈS la création du stagiaire, la promotion et les mises à jour
      // (le tout dans la même transaction) → annulation intégrale.
      await pool.query('UPDATE candidature SET internship_duration_months = -1 WHERE id = $1', [id]);

      const res = await convert(id, rh);
      expect(res.status).toBeGreaterThanOrEqual(400);

      const role = await pool.query('SELECT role FROM utilisateur WHERE id = $1', [candidatId]);
      expect(role.rows[0].role).toBe(roleBefore);
      const candidature = await pool.query('SELECT statut, stagiaire_id FROM candidature WHERE id = $1', [id]);
      expect(candidature.rows[0].statut).toBe('HUMAN_INTERVIEW_ACCEPTED');
      expect(candidature.rows[0].stagiaire_id).toBeNull();
      const audits = await pool.query(
        "SELECT COUNT(*)::int AS n FROM candidature_decisions WHERE candidature_id = $1 AND action = 'TRAINEE_CREATED'",
        [id]
      );
      expect(audits.rows[0].n).toBe(0);
      const places = await pool.query('SELECT nombre_places, statut FROM offre_stage WHERE id = $1', [offre_id]);
      expect(places.rows[0].nombre_places).toBe(placesBefore.nombre_places);
      expect(places.rows[0].statut).toBe(placesBefore.statut);
      const stages = await pool.query('SELECT COUNT(*)::int AS n FROM stage WHERE candidature_id = $1', [id]);
      expect(stages.rows[0].n).toBe(0);
    },
    120000
  );

  test(
    'entrée d\'audit CONVERTED / TRAINEE_CREATED enregistrée',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const id = await createOnboardingCandidature(token, adminToken, rh, open);
      await uploadAllValidDocuments(id, token);

      await convert(id, rh);
      const { rows } = await pool.query(
        `SELECT decision, action, decided_by, previous_status, new_status, internship_start_date, internship_duration_months
         FROM candidature_decisions WHERE candidature_id = $1 AND action = 'TRAINEE_CREATED'`,
        [id]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].decision).toBe('CONVERTED');
      expect(rows[0].decided_by).toBe(rhId);
      expect(rows[0].previous_status).toBe('HUMAN_INTERVIEW_ACCEPTED');
      expect(rows[0].new_status).toBe(CONVERTED);
      expect(rows[0].internship_start_date).toBeTruthy();
      expect(rows[0].internship_duration_months).toBe(4);
    },
    120000
  );

  test(
    'candidature inconnue → 404',
    async () => {
      const rh = await loginRH();
      const res = await convert('00000000-0000-4000-8000-000000000000', rh);
      expect(res.status).toBe(404);
    },
    120000
  );

  // ── Sélection du token invalidé après conversion (token_version) ───────────

  describe('Token invalidation after conversion', () => {
    let oldCandidatToken = null;

    test(
      'ancien token CANDIDAT rejeté (401) après conversion → reconnexion requise',
      async () => {
        const token = await loginCandidat();
        const rh = await loginRH();

        // Sauvegarder le token AVANT conversion
        oldCandidatToken = token;

        // L'ancien token fonctionne encore (tant que la conversion n'a pas eu lieu)
        const meBefore = await fetch(`${BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${oldCandidatToken}` }
        });
        expect(meBefore.status).toBe(200);

        // Créer une candidature complète pour la conversion
        const id = await createOnboardingCandidature(token, adminToken, rh, open);
        await uploadAllValidDocuments(id, token);
        await convert(id, rh);

        // Maintenant, l'ancien token CANDIDAT doit être rejeté (401)
        const meAfter = await fetch(`${BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${oldCandidatToken}` }
        });
        expect(meAfter.status).toBe(401);
        const body = await meAfter.json();
        expect(body.message).toMatch(/reconnecter/i);
      },
      120000
    );

    test(
      'nouveau token après reconnexion contient le rôle STAGIAIRE',
      async () => {
        // Re-login avec les mêmes identifiants → doit recevoir un token STAGIAIRE
        const newToken = await login(CANDIDAT_EMAIL, 'Candidat123!');
        const me = await fetch(`${BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${newToken}` }
        });
        expect(me.status).toBe(200);
        const { user } = await me.json();
        expect(user.role).toBe('STAGIAIRE');
      },
      120000
    );
  });
});
