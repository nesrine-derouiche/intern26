/**
 * Intégration — Chemin d'acceptation LÉGACY encore vivant en production :
 *
 *   PUT /api/candidatures/:id  { "statut": "ACCEPTEE" }
 *   → candidature.controller.updateStatut
 *   → candidatureService.updateCandidatureStatut(id, 'ACCEPTEE', role)
 *   → _acceptCandidature()  (création du stage, refus des candidatures sœurs,
 *                            décrément des places, notification + email)
 *
 * Ce chemin est déclenché par le backoffice (« Accepter » →
 * applicationService.updateStatus). Il est distinct du chemin MORDERNE
 * (recordHumanInterviewDecision → decideHumanInterview →
 * internshipConversionService.convertCandidatureToStagiaire), qui ne doit PAS
 * être modifié ici.
 *
 * Les données de test sont entièrement isolées (département, offre, encadrant,
 * stagiaire, candidat dédiés créés puis supprimés) : aucune dépendance aux
 * comptes du seed pour les assertions métier.
 */
const BASE = 'http://localhost:3000/api';

require('dotenv').config();
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { todayTunisIso, addCalendarMonths, weeksToMonths } = require('../utils/stage-period.util');

jest.mock('../services/email.service', () => ({
  sendInternshipAcceptedEmail: jest.fn(),
  sendApplicationRejectedEmail: jest.fn(),
  sendCandidatureReceivedEmail: jest.fn(),
  sendDocumentsRequestEmail: jest.fn(),
  sendMobileAccessEmail: jest.fn(),
  sendHumanInterviewInvitationEmail: jest.fn(),
  sendHumanInterviewReminderEmail: jest.fn(),
  sendRhPreselectionEmail: jest.fn(),
  sendRhPreselectedEmail: jest.fn(),
  sendAiInterviewPassedEmail: jest.fn(),
  sendAiInterviewFailedEmail: jest.fn(),
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendWelcomeEmail: jest.fn(),
  sendInterviewInvitationEmail: jest.fn()
}));
const emailService = require('../services/email.service');
const candidatureService = require('../services/candidature.service');

const ACCEPTED_NOTIF_TITLE = 'Candidature Acceptée 🎉';
const OFFRE_DUREE_SEMAINES = 16;
const SAME_ROLE_PASSWORD = 'M6B12345!';

let rhToken = null;
let adminToken = null;
let stagiaireToken = null;
let candidatToken = null;

let suffix = null;
let stagiaireId = null;
let candidatId = null;
let encadrantId = null;
let departementId = null;
let offreId = null;
let offreTitre = null;
let stagiaireEmail = null;
const createdCandidatures = [];

/* ── helpers HTTP ──────────────────────────────────────────────────────────── */

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

/** Acceptation LÉGACY via la route HTTP réelle (token utilisé pour le rôle attendu). */
async function acceptViaRoute(id, token) {
  return authed(`${BASE}/candidatures/${id}`, token, {
    method: 'PUT',
    body: JSON.stringify({ statut: 'ACCEPTEE' })
  });
}

/* ── helpers données isolées ───────────────────────────────────────────────── */

async function insertFixtureUser(email, role, label) {
  const password = await bcrypt.hash(SAME_ROLE_PASSWORD, 12);
  const ins = await pool.query(
    `INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, role, email_verifie, actif)
     VALUES ($1, $2, $3, $4, $5, true, true)
     RETURNING id`,
    [label, label, email, password, role]
  );
  return ins.rows[0].id;
}

async function createStagiaireCandidature() {
  const r = await pool.query(
    `INSERT INTO candidature (stagiaire_id, offre_id, statut)
     VALUES ($1, $2, 'EN_ATTENTE') RETURNING id`,
    [stagiaireId, offreId]
  );
  createdCandidatures.push(r.rows[0].id);
  return r.rows[0].id;
}

/** Candidature « portail » (candidat_id renseigné, AUCUN stagiaire associé). */
async function createPortailCandidature() {
  const r = await pool.query(
    `INSERT INTO candidature (candidat_id, offre_id, statut)
     VALUES ($1, $2, 'EN_ATTENTE') RETURNING id`,
    [candidatId, offreId]
  );
  createdCandidatures.push(r.rows[0].id);
  return r.rows[0].id;
}

async function stageFor(candidatureId) {
  const { rows } = await pool.query(
    `SELECT st.id, st.stagiaire_id, st.encadrant_id, st.departement_id, st.offre_id,
            st.date_debut::text AS date_debut, st.date_fin::text AS date_fin, st.statut
     FROM stage st WHERE st.candidature_id = $1`,
    [candidatureId]
  );
  return rows[0];
}

async function notifCount() {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM notification WHERE utilisateur_id = $1 AND titre = $2 AND type = $3',
    [stagiaireId, ACCEPTED_NOTIF_TITLE, 'CANDIDATURE']
  );
  return rows[0].n;
}

/* ── lifecycle ─────────────────────────────────────────────────────────────── */

beforeAll(async () => {
  suffix = `m6b${Date.now().toString(36)}`;

  stagiaireId = await insertFixtureUser(`stagiaire.${suffix}@steg.tn`, 'STAGIAIRE', 'Stagiaire');
  await pool.query(
    'INSERT INTO stagiaire (id, ecole, specialite, niveau) VALUES ($1, $2, $3, $4)',
    [stagiaireId, 'ENIT', 'Génie Civil', 'Master 2']
  );

  candidatId = await insertFixtureUser(`candidat.${suffix}@steg.tn`, 'CANDIDAT', 'Candidat');
  await pool.query(
    'INSERT INTO candidat (id, universite, specialite, niveau) VALUES ($1, $2, $3, $4)',
    [candidatId, 'ENIT', 'Génie Civil', 'Master 2']
  );

  encadrantId = await insertFixtureUser(`encadrant.${suffix}@steg.tn`, 'ENCADRANT', 'Encadrant');
  const deptRes = await pool.query(
    `INSERT INTO departement (nom) VALUES ('Département M6B ${suffix}') RETURNING id`
  );
  departementId = deptRes.rows[0].id;
  await pool.query(
    `INSERT INTO encadrant (id, service, nombre_max_stagiaires, disponibilite, departement_id)
     VALUES ($1, 'Service Génie', 10, true, $2)`,
    [encadrantId, departementId]
  );

  const offreRes = await pool.query(
    `INSERT INTO offre_stage (departement_id, titre, duree, nombre_places, date_limite, statut)
     VALUES ($1, 'Offre M6B ${suffix}', $2, 20, '2027-12-31', 'OUVERTE')
     RETURNING id, titre`,
    [departementId, OFFRE_DUREE_SEMAINES]
  );
  offreId = offreRes.rows[0].id;
  offreTitre = offreRes.rows[0].titre;

  stagiaireEmail = (await pool.query('SELECT email FROM utilisateur WHERE id = $1', [stagiaireId])).rows[0].email;

  rhToken = await login('salma.bouazizi@steg.tn', 'rh1234');
  adminToken = await login('admin@steg.tn', 'admin123');
  stagiaireToken = await login(stagiaireEmail, SAME_ROLE_PASSWORD);
  candidatToken = await login(`candidat.${suffix}@steg.tn`, SAME_ROLE_PASSWORD);
});

afterEach(async () => {
  jest.clearAllMocks();
  for (const id of createdCandidatures) {
    await pool.query('DELETE FROM stage WHERE candidature_id = $1', [id]);
    await pool.query('DELETE FROM candidature WHERE id = $1', [id]);
  }
  createdCandidatures.length = 0;
  await pool.query('DELETE FROM notification WHERE utilisateur_id = $1', [stagiaireId]);
});

afterAll(async () => {
  for (const id of createdCandidatures) {
    await pool.query('DELETE FROM stage WHERE candidature_id = $1', [id]);
    await pool.query('DELETE FROM candidature WHERE id = $1', [id]);
  }
  await pool.query('DELETE FROM offre_stage WHERE id = $1', [offreId]);
  await pool.query('DELETE FROM encadrant WHERE id = $1', [encadrantId]);
  await pool.query('DELETE FROM departement WHERE id = $1', [departementId]);
  await pool.query('DELETE FROM stagiaire WHERE id = $1', [stagiaireId]);
  await pool.query('DELETE FROM candidat WHERE id = $1', [candidatId]);
  await pool.query('DELETE FROM utilisateur WHERE id = ANY($1)', [
    [stagiaireId, candidatId, encadrantId]
  ]);
  await pool.end();
});

describe('Chemin LÉGACY : PUT /api/candidatures/:id { statut: ACCEPTEE }', () => {
  test('1. le RH peut accepter une candidature éligible (200, message stage créé)', async () => {
    const id = await createStagiaireCandidature();
    const res = await acceptViaRoute(id, rhToken);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('Candidature acceptée et stage créé.');
  }, 60000);

  test('2. l\'ADMIN peut accepter une candidature éligible (200)', async () => {
    const id = await createStagiaireCandidature();
    const res = await acceptViaRoute(id, adminToken);
    expect(res.status).toBe(200);
  }, 60000);

  test('3. le CANDIDAT ne peut pas accepter une candidature (403)', async () => {
    const id = await createStagiaireCandidature();
    const res = await acceptViaRoute(id, candidatToken);
    expect(res.status).toBe(403);
    const { rows } = await pool.query('SELECT statut FROM candidature WHERE id = $1', [id]);
    expect(rows[0].statut).toBe('EN_ATTENTE');
  }, 60000);

  test('4. le STAGIAIRE ne peut pas accepter une candidature (403)', async () => {
    const id = await createStagiaireCandidature();
    const res = await acceptViaRoute(id, stagiaireToken);
    expect(res.status).toBe(403);
    const { rows } = await pool.query('SELECT statut FROM candidature WHERE id = $1', [id]);
    expect(rows[0].statut).toBe('EN_ATTENTE');
  }, 60000);

  test('5. requête non authentifiée → 401', async () => {
    const res = await fetch(`${BASE}/candidatures/00000000-0000-4000-8000-000000000000`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: 'ACCEPTEE' })
    });
    expect(res.status).toBe(401);
  }, 60000);

  test('6. candidature inexistante → 404', async () => {
    const res = await acceptViaRoute('00000000-0000-4000-8000-000000000000', rhToken);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toMatch(/Candidature introuvable/);
  }, 60000);

  test('7. statut invalide → 400 (validation)', async () => {
    const id = await createStagiaireCandidature();
    const res = await authed(`${BASE}/candidatures/${id}`, rhToken, {
      method: 'PUT',
      body: JSON.stringify({ statut: 'FOO' })
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors[0].field).toBe('statut');
    const { rows } = await pool.query('SELECT statut FROM candidature WHERE id = $1', [id]);
    expect(rows[0].statut).toBe('EN_ATTENTE');
  }, 60000);

  test('8. acceptation → statut ACCEPTEE et aucune trace d\'audit (candidature_decisions)', async () => {
    const acceptedId = await createStagiaireCandidature();

    const res = await acceptViaRoute(acceptedId, rhToken);
    expect(res.status).toBe(200);

    const accepted = await pool.query('SELECT statut FROM candidature WHERE id = $1', [acceptedId]);
    expect(accepted.rows[0].statut).toBe('ACCEPTEE');

    const audits = await pool.query(
      'SELECT COUNT(*)::int AS n FROM candidature_decisions WHERE candidature_id = $1',
      [acceptedId]
    );
    expect(audits.rows[0].n).toBe(0);
  }, 60000);

  test(
    '8b. une candidature sœur active est impossible en base (contrainte idx_candidature_unique_active)' +
      ' → refuseOtherCandidatures n\'a jamais de ligne à refuser',
    async () => {
      await createStagiaireCandidature();
      await expect(
        pool.query(
          `INSERT INTO candidature (stagiaire_id, offre_id, statut)
           VALUES ($1, $2, 'EN_ATTENTE')`,
          [stagiaireId, offreId]
        )
      ).rejects.toMatchObject({ code: '23505' });
    },
    60000
  );

  test('9. acceptation → exactement UN stage et UN projet créés', async () => {
    const id = await createStagiaireCandidature();
    await expect(acceptViaRoute(id, rhToken)).resolves.toHaveProperty('status', 200);

    const stages = await pool.query(
      'SELECT COUNT(*)::int AS n FROM stage WHERE candidature_id = $1',
      [id]
    );
    expect(stages.rows[0].n).toBe(1);

    const stage = await stageFor(id);
    const projets = await pool.query('SELECT COUNT(*)::int AS n FROM projet WHERE stage_id = $1', [stage.id]);
    expect(projets.rows[0].n).toBe(1);
    expect(stage.statut).toBe('EN_COURS');
  }, 60000);

  test('10. stage avec date_debut et date_fin valides (début = aujourd\'hui Tunis, fin > début)', async () => {
    const id = await createStagiaireCandidature();
    await expect(acceptViaRoute(id, rhToken)).resolves.toHaveProperty('status', 200);

    const stage = await stageFor(id);
    const today = todayTunisIso();
    expect(stage.date_debut).toBe(today);
    expect(stage.date_fin > stage.date_debut).toBe(true);

    const expectedMois = weeksToMonths(OFFRE_DUREE_SEMAINES);
    expect(stage.date_fin).toBe(addCalendarMonths(today, expectedMois));
  }, 60000);

  test('11. date_fin = début + durée en MOIS CALENDARES (durée lue dans internship_duration_months)', async () => {
    const id = await createStagiaireCandidature();
    await pool.query('UPDATE candidature SET internship_duration_months = 5 WHERE id = $1', [id]);

    await expect(acceptViaRoute(id, rhToken)).resolves.toHaveProperty('status', 200);

    const stage = await stageFor(id);
    const today = todayTunisIso();
    expect(stage.date_debut).toBe(today);
    expect(stage.date_fin).toBe(addCalendarMonths(today, 5));
  }, 60000);

  test('12. encadrant assigné valide (disponible, du même département)', async () => {
    const id = await createStagiaireCandidature();
    await expect(acceptViaRoute(id, rhToken)).resolves.toHaveProperty('status', 200);

    const stage = await stageFor(id);
    expect(stage.encadrant_id).toBeTruthy();

    const expected = await pool.query(
      `SELECT id FROM encadrant WHERE departement_id = $1 AND disponibilite = true ORDER BY id LIMIT 1`,
      [departementId]
    );
    const expectedFallback = await pool.query(
      `SELECT id FROM encadrant WHERE disponibilite = true ORDER BY id LIMIT 1`
    );

    const expectedId = expected.rows[0] ? expected.rows[0].id : expectedFallback.rows[0].id;
    expect(stage.encadrant_id).toBe(expectedId);
    expect(stage.departement_id).toBe(departementId);
    expect(stage.offre_id).toBe(offreId);
    expect(stage.stagiaire_id).toBe(stagiaireId);
  }, 60000);

  test('13. accepter deux fois la même candidature → 400 et aucun stage en double', async () => {
    const id = await createStagiaireCandidature();
    const first = await acceptViaRoute(id, rhToken);
    expect(first.status).toBe(200);

    const second = await acceptViaRoute(id, rhToken);
    expect(second.status).toBe(400);
    const body = await second.json();
    expect(body.message).toMatch(/déjà été traitée/i);

    const stages = await pool.query(
      'SELECT COUNT(*)::int AS n FROM stage WHERE candidature_id = $1',
      [id]
    );
    expect(stages.rows[0].n).toBe(1);
    expect(await notifCount()).toBe(1);
  }, 60000);

  test('14. échec à la création du stage → annulation intégrale (transaction) sans données partielles', async () => {
    // Candidature « portail » sans stagiaire : l'INSERT du stage viole la
    // contrainte NOT NULL stagiaire_id APRÈS la mise à jour du statut → le
    // rollback doit tout annuler.
    const id = await createPortailCandidature();

    const placesBefore = (
      await pool.query('SELECT nombre_places FROM offre_stage WHERE id = $1', [offreId])
    ).rows[0].nombre_places;

    const res = await acceptViaRoute(id, rhToken);
    expect(res.status).toBe(500);

    const cand = await pool.query('SELECT statut, stagiaire_id FROM candidature WHERE id = $1', [id]);
    expect(cand.rows[0].statut).toBe('EN_ATTENTE');
    expect(cand.rows[0].stagiaire_id).toBeNull();

    const stages = await pool.query('SELECT COUNT(*)::int AS n FROM stage WHERE candidature_id = $1', [id]);
    expect(stages.rows[0].n).toBe(0);

    const placesAfter = (
      await pool.query('SELECT nombre_places FROM offre_stage WHERE id = $1', [offreId])
    ).rows[0].nombre_places;
    expect(placesAfter).toBe(placesBefore);

    expect(await notifCount()).toBe(0);
    // L'email est inobservable depuis le process HTTP : la production d'aucune
    // donnée partielle en base EST la preuve du rollback complet.
  }, 60000);

  test('15. notification interne + email d\'acceptation (observés en process, base réelle)', async () => {
    const id = await createStagiaireCandidature();
    const before = await notifCount();

    // Le serveur HTTP tourne dans un process séparé : il ne partage pas le mock
    // email du process Jest. Comme dans human-interview-reminder.integration.spec,
    // l'EMAIL est vérifié en appelant le service directement (même transaction
    // PostgreSQL réelle, mêmes repositories) ; la route HTTP est couverte par 1-14.
    await expect(
      candidatureService.updateCandidatureStatut(id, 'ACCEPTEE', 'RH')
    ).resolves.toEqual({ message: 'Candidature acceptée et stage créé.' });

    expect(await notifCount()).toBe(before + 1);
    const notif = await pool.query(
      `SELECT titre, message, type FROM notification
       WHERE utilisateur_id = $1 AND titre = $2 ORDER BY date DESC LIMIT 1`,
      [stagiaireId, ACCEPTED_NOTIF_TITLE]
    );
    expect(notif.rows[0].type).toBe('CANDIDATURE');
    expect(notif.rows[0].message).toMatch(/Félicitations/);

    expect(emailService.sendInternshipAcceptedEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendInternshipAcceptedEmail).toHaveBeenCalledWith(
      stagiaireEmail,
      expect.objectContaining({ titreOffre: offreTitre })
    );
    expect(emailService.sendDocumentsRequestEmail).not.toHaveBeenCalled();
    expect(emailService.sendApplicationRejectedEmail).not.toHaveBeenCalled();
  }, 60000);
});