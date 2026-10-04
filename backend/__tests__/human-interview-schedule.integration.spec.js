const BASE = 'http://localhost:3000/api';

require('dotenv').config();
const pool = require('../config/db');
const bcrypt = require('bcrypt');

let candidatToken = null;
let adminToken = null;
let rhToken = null;
let open = [];
let created = [];

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

async function loginCandidat() {
  if (candidatToken) return candidatToken;
  candidatToken = await login('candidat@steg.tn', 'Candidat123!');
  return candidatToken;
}

async function loginAdmin() {
  if (adminToken) return adminToken;
  adminToken = await login('admin@steg.tn', 'admin123');
  return adminToken;
}

async function loginRH() {
  if (rhToken) return rhToken;
  rhToken = await login('salma.bouazizi@steg.tn', 'rh1234');
  return rhToken;
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
    const toFree = (Array.isArray(mine) ? mine : []).find((c) => c.id);
    expect(toFree).toBeTruthy();
    const freeRes = await authed(`${BASE}/candidatures/${toFree.id}`, adminToken, {
      method: 'DELETE'
    });
    expect(freeRes.status).toBe(200);
    target =
      open.find((o) => o.id === toFree.offre_id) ||
      open.find((o) => o.nombre_places > 0) ||
      open[0];
  }
  return target;
}

/**
 * Candidature prête à la planification : le candidat postule, le RH accepte
 * pour l'entretien IA, puis la candidature est passée en AI_INTERVIEW_PASSED.
 * Ce raccourci isole la planification de l'entretien humain (le flux IA
 * complet est couvert par ai-interview-flow.integration.spec.js).
 */
async function createPassedCandidature(token, adminToken, rh, open) {
  const target = await pickFreeOffer(token, adminToken, open);
  const applyRes = await authed(`${BASE}/candidatures`, token, {
    method: 'POST',
    body: JSON.stringify({ offre_id: target.id })
  });
  expect(applyRes.status).toBe(201);
  const { candidature } = await applyRes.json();

  const putRes = await authed(`${BASE}/candidatures/${candidature.id}`, rh, {
    method: 'PUT',
    body: JSON.stringify({ statut: 'RH_ACCEPTED' })
  });
  expect(putRes.status).toBe(200);

  await pool.query("UPDATE candidature SET statut = 'AI_INTERVIEW_PASSED' WHERE id = $1", [candidature.id]);
  return { id: candidature.id, offre: { id: target.id, nombre_places: target.nombre_places } };
}

/** Crée un second compte CANDIDAT en base (pour tester l'isolation). */
async function createOtherCandidate() {
  const email = `autre-candidat-${Date.now()}@steg.tn`;
  const pwd = await bcrypt.hash('Candidat123!', 10);
  const { rows } = await pool.query(
    `INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone, adresse, role, email_verifie)
     VALUES ('Autre', 'Candidat', $1, $2, '+216 00 000 000', 'Tunis', 'CANDIDAT', true)
     RETURNING id`,
    [email, pwd]
  );
  await pool.query(
    `INSERT INTO candidat (id, universite, specialite, niveau, competences, langues)
     VALUES ($1, 'FST', 'Informatique', 'Licence', 'Python', 'Français')`,
    [rows[0].id]
  );
  return email;
}

const VALID = {
  date: '2026-09-10',
  heure: '10:30',
  duree: 45,
  interviewer: 'Salma Bouazizi',
  interviewer_email: 'salma.bouazizi@steg.tn',
  lien_visio: 'https://teams.microsoft.com/l/meetup-join/meeting/schedule-test'
};

describe('Planification d’un entretien humain (intégration)', () => {
  beforeAll(async () => {
    adminToken = await loginAdmin();
    const offresRes = await fetch(`${BASE}/public/offres`);
    expect(offresRes.status).toBe(200);
    open = await offresRes.json();
    expect(open.length).toBeGreaterThan(0);

    const { rows: users } = await pool.query(
      'SELECT id FROM utilisateur WHERE email = $1',
      ['candidat@steg.tn']
    );
    if (users[0]) {
      await pool.query('DELETE FROM human_interviews WHERE candidature_id IN (SELECT id FROM candidature WHERE candidat_id = $1)', [users[0].id]);
      await pool.query('DELETE FROM ai_interview_sessions WHERE candidature_id IN (SELECT id FROM candidature WHERE candidat_id = $1)', [users[0].id]);
      await pool.query('DELETE FROM candidature WHERE candidat_id = $1', [users[0].id]);
    }
  });

  afterAll(async () => {
    for (const id of created) {
      await authed(`${BASE}/candidatures/${id}`, adminToken, { method: 'DELETE' });
    }
    for (const id of created) {
      await pool.query('DELETE FROM human_interviews WHERE candidature_id = $1', [id]);
      await pool.query('DELETE FROM ai_interview_sessions WHERE candidature_id = $1', [id]);
    }
    await pool.end();
  });

  test(
    'RH planifie un entretien humain : statut EN_ENTRETIEN_HUMAIN et entretien retourné',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await createPassedCandidature(token, adminToken, rh, open);
      created.push(id);

      const res = await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
        method: 'POST',
        body: JSON.stringify(VALID)
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        date: '2026-09-10',
        heure: '10:30',
        duree: 45,
        interviewer: 'Salma Bouazizi',
        interviewer_email: 'salma.bouazizi@steg.tn',
        lien_visio: VALID.lien_visio,
        statut: 'PLANIFIE'
      });

      const details = await (await authed(`${BASE}/candidatures/${id}`, rh)).json();
      expect(details.statut).toBe('EN_ENTRETIEN_HUMAIN');
      expect(details.human_interview).toMatchObject({
        date: '2026-09-10',
        duree: 45,
        interviewer: 'Salma Bouazizi',
        interviewer_email: 'salma.bouazizi@steg.tn',
        statut: 'PLANIFIE'
      });
    },
    45000
  );

  test(
    'un utilisateur non autorisé ne peut pas planifier un entretien',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await createPassedCandidature(token, adminToken, rh, open);
      created.push(id);

      const res = await authed(`${BASE}/candidatures/${id}/entretien-humain`, token, {
        method: 'POST',
        body: JSON.stringify(VALID)
      });
      expect(res.status).toBe(403);
    },
    45000
  );

  test(
    'validations rejetées : date manquante, date passée, URL invalide, email manquant, durée manquante',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await createPassedCandidature(token, adminToken, rh, open);
      created.push(id);

      const invalidPayloads = [
        { ...VALID, date: '' },
        { ...VALID, date: '2020-01-01' },
        { ...VALID, lien_visio: 'not-a-url' },
        { ...VALID, interviewer_email: '' },
        { ...VALID, duree: undefined }
      ];

      for (const payload of invalidPayloads) {
        const res = await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        expect(res.status).toBe(400);
      }

      const details = await (await authed(`${BASE}/candidatures/${id}`, rh)).json();
      expect(details.statut).toBe('AI_INTERVIEW_PASSED');
    },
    45000
  );

  test(
    'deux entretiens humains actifs sont refusés pour la même candidature',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await createPassedCandidature(token, adminToken, rh, open);
      created.push(id);

      const first = await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
        method: 'POST',
        body: JSON.stringify(VALID)
      });
      expect(first.status).toBe(200);

      const second = await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
        method: 'POST',
        body: JSON.stringify(VALID)
      });
      expect(second.status).toBe(400);

      const { rows } = await pool.query(
        'SELECT COUNT(*)::int as n FROM human_interviews WHERE candidature_id = $1',
        [id]
      );
      expect(rows[0].n).toBe(1);
    },
    45000
  );

  test(
    'modification, annulation puis re-planification de l’entretien humain',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await createPassedCandidature(token, adminToken, rh, open);
      created.push(id);

      const schedule = await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
        method: 'POST',
        body: JSON.stringify(VALID)
      });
      expect(schedule.status).toBe(200);

      const edit = await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
        method: 'PUT',
        body: JSON.stringify({ ...VALID, date: '2026-09-15', heure: '14:00', duree: 60 })
      });
      expect(edit.status).toBe(200);
      const edited = await edit.json();
      expect(edited).toMatchObject({ date: '2026-09-15', heure: '14:00', duree: 60 });

      const cancel = await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
        method: 'DELETE'
      });
      expect(cancel.status).toBe(200);

      const after = await (await authed(`${BASE}/candidatures/${id}`, rh)).json();
      expect(after.statut).toBe('AI_INTERVIEW_PASSED');
      expect(after.human_interview).toMatchObject({ statut: 'ANNULE' });

      const reschedule = await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
        method: 'POST',
        body: JSON.stringify(VALID)
      });
      expect(reschedule.status).toBe(200);

      const { rows } = await pool.query(
        'SELECT COUNT(*)::int as n FROM human_interviews WHERE candidature_id = $1',
        [id]
      );
      expect(rows[0].n).toBe(1);

      const final = await (await authed(`${BASE}/candidatures/${id}`, rh)).json();
      expect(final.statut).toBe('EN_ENTRETIEN_HUMAIN');
      expect(final.human_interview).toMatchObject({ statut: 'PLANIFIE' });
    },
    45000
  );

  test(
    'la modification conserve le même identifiant sans créer de doublon',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await createPassedCandidature(token, adminToken, rh, open);
      created.push(id);

      const schedule = await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
        method: 'POST',
        body: JSON.stringify(VALID)
      });
      expect(schedule.status).toBe(200);
      const originalId = (await schedule.json()).id;
      expect(originalId).toBeTruthy();

      const edit = await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
        method: 'PUT',
        body: JSON.stringify({
          ...VALID,
          date: '2026-09-18',
          heure: '09:15',
          duree: 30,
          interviewer: 'Yosra Karray',
          interviewer_email: 'yosra.karray@steg.tn',
          lien_visio: 'https://teams.microsoft.com/l/meetup-join/meeting/edite'
        })
      });
      expect(edit.status).toBe(200);
      const edited = await edit.json();
      expect(edited.id).toBe(originalId);
      expect(edited).toMatchObject({
        date: '2026-09-18',
        heure: '09:15',
        duree: 30,
        interviewer: 'Yosra Karray',
        interviewer_email: 'yosra.karray@steg.tn',
        lien_visio: 'https://teams.microsoft.com/l/meetup-join/meeting/edite',
        statut: 'PLANIFIE'
      });

      const { rows } = await pool.query(
        'SELECT COUNT(*)::int as n FROM human_interviews WHERE candidature_id = $1',
        [id]
      );
      expect(rows[0].n).toBe(1);

      const details = await (await authed(`${BASE}/candidatures/${id}`, rh)).json();
      expect(details.human_interview).toMatchObject({
        date: '2026-09-18',
        statut: 'PLANIFIE'
      });
      expect(details.statut).toBe('EN_ENTRETIEN_HUMAIN');
    },
    45000
  );

  test(
    'la modification applique les mêmes validations que la planification',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await createPassedCandidature(token, adminToken, rh, open);
      created.push(id);

      await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
        method: 'POST',
        body: JSON.stringify(VALID)
      });

      const invalidPayloads = [
        { ...VALID, date: '' },
        { ...VALID, date: '2020-01-01' },
        { ...VALID, heure: '25:99' },
        { ...VALID, duree: 0 },
        { ...VALID, interviewer: '' },
        { ...VALID, interviewer_email: 'pas-un-email' },
        { ...VALID, lien_visio: 'ftp://invalide' }
      ];

      for (const payload of invalidPayloads) {
        const res = await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        expect(res.status).toBe(400);
      }

      const after = await (await authed(`${BASE}/candidatures/${id}`, rh)).json();
      expect(after.human_interview).toMatchObject({ date: '2026-09-10', statut: 'PLANIFIE' });
      expect(after.statut).toBe('EN_ENTRETIEN_HUMAIN');
    },
    45000
  );

  test(
    'la modification d’un entretien non planifié est refusée',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await createPassedCandidature(token, adminToken, rh, open);
      created.push(id);

      const res = await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
        method: 'PUT',
        body: JSON.stringify(VALID)
      });
      expect(res.status).toBe(400);
    },
    45000
  );

  test(
    'le candidat voit son entretien humain planifié (lecture seule)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await createPassedCandidature(token, adminToken, rh, open);
      created.push(id);

      await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
        method: 'POST',
        body: JSON.stringify(VALID)
      });

      const res = await authed(`${BASE}/candidatures/${id}/entretien-humain`, token);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.interview).toMatchObject({
        date: '2026-09-10',
        heure: '10:30',
        duree: 45,
        interviewer: 'Salma Bouazizi',
        interviewer_email: 'salma.bouazizi@steg.tn',
        lien_visio: VALID.lien_visio,
        statut: 'PLANIFIE'
      });
    },
    45000
  );

  test(
    'un autre candidat ne peut pas lire l’entretien (403)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await createPassedCandidature(token, adminToken, rh, open);
      created.push(id);

      await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
        method: 'POST',
        body: JSON.stringify(VALID)
      });

      const otherEmail = await createOtherCandidate();
      const otherToken = await login(otherEmail, 'Candidat123!');
      const res = await authed(`${BASE}/candidatures/${id}/entretien-humain`, otherToken);
      expect(res.status).toBe(403);
    },
    45000
  );

  test(
    'le candidat ne peut ni modifier ni annuler l’entretien (403)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await createPassedCandidature(token, adminToken, rh, open);
      created.push(id);

      await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
        method: 'POST',
        body: JSON.stringify(VALID)
      });

      const put = await authed(`${BASE}/candidatures/${id}/entretien-humain`, token, {
        method: 'PUT',
        body: JSON.stringify({ ...VALID, date: '2026-09-20' })
      });
      expect(put.status).toBe(403);

      const del = await authed(`${BASE}/candidatures/${id}/entretien-humain`, token, {
        method: 'DELETE'
      });
      expect(del.status).toBe(403);
    },
    45000
  );

  test(
    'sans entretien planifié, le candidat reçoit interview null',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await createPassedCandidature(token, adminToken, rh, open);
      created.push(id);

      const res = await authed(`${BASE}/candidatures/${id}/entretien-humain`, token);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.interview).toBeNull();
    },
    45000
  );

  test(
    'après annulation par le RH, le candidat voit le statut ANNULE',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const { id } = await createPassedCandidature(token, adminToken, rh, open);
      created.push(id);

      await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
        method: 'POST',
        body: JSON.stringify(VALID)
      });
      const cancel = await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
        method: 'DELETE'
      });
      expect(cancel.status).toBe(200);

      const res = await authed(`${BASE}/candidatures/${id}/entretien-humain`, token);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.interview).toMatchObject({ statut: 'ANNULE' });
    },
    45000
  );
});
