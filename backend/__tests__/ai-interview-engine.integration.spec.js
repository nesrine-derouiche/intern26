const BASE = 'http://localhost:3000/api';

require('dotenv').config();
const pool = require('../config/db');

let adminToken = null;
let rhToken = null;
let candidatToken = null;

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
  rhToken = await login('salma.bouazizi@steg.tn', 'rh1234');
  return rhToken;
}

async function loginCandidat() {
  if (candidatToken) return candidatToken;
  candidatToken = await login('candidat@steg.tn', 'Candidat123!');
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

async function pickFreeOffer(token, open) {
  const mineRes = await authed(`${BASE}/candidatures`, token);
  const mine = await mineRes.json();
  const applied = new Set((Array.isArray(mine) ? mine : []).map((c) => c.offre_id));
  return open.find((o) => !applied.has(o.id) && o.nombre_places > 0) || open[0];
}

const ANSWERS = Array.from({ length: 8 }, (_, i) =>
  `Réponse ${i + 1} : je suis motivé(e), j'ai travaillé en équipe sur des projets, j'analyse et je résous les problèmes avec méthode, et mes compétences techniques (Node.js, Python, SQL) sont en lien direct avec l'offre.`
);

async function cleanupInterview(candidatureId, token) {
  await pool.query('DELETE FROM ai_interviews WHERE candidature_id = $1', [candidatureId]);
  await pool.query('DELETE FROM human_interviews WHERE candidature_id = $1', [candidatureId]);
  await pool.query('DELETE FROM ai_interview_sessions WHERE candidature_id = $1', [candidatureId]);
  await authed(`${BASE}/candidatures/${candidatureId}`, token, { method: 'DELETE' });
}

describe('Entretien IA vocal — pont Node <-> Python (intégration)', () => {
  let open = [];
  let created = [];

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
      await pool.query('DELETE FROM ai_interviews WHERE candidature_id IN (SELECT id FROM candidature WHERE candidat_id = $1)', [users[0].id]);
      await pool.query('DELETE FROM human_interviews WHERE candidature_id IN (SELECT id FROM candidature WHERE candidat_id = $1)', [users[0].id]);
      await pool.query('DELETE FROM ai_interview_sessions WHERE candidature_id IN (SELECT id FROM candidature WHERE candidat_id = $1)', [users[0].id]);
      await pool.query('DELETE FROM candidature WHERE candidat_id = $1', [users[0].id]);
    }
  });

  afterAll(async () => {
    for (const id of created) {
      await cleanupInterview(id, adminToken);
    }
    await pool.end();
  });

  test(
    'flux complet : create (RH) → get (RH/candidat) → start → complete → report (RH)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();

      const target = await pickFreeOffer(token, open);
      const applyRes = await authed(`${BASE}/candidatures`, token, {
        method: 'POST',
        body: JSON.stringify({ offre_id: target.id })
      });
      expect(applyRes.status).toBe(201);
      const { candidature } = await applyRes.json();
      const id = candidature.id;
      created.push(id);

      const putRes = await authed(`${BASE}/candidatures/${id}`, rh, {
        method: 'PUT',
        body: JSON.stringify({ statut: 'RH_ACCEPTED' })
      });
      expect(putRes.status).toBe(200);

      // 1. Création par la RH
      const createRes = await authed(`${BASE}/ai-interviews/create/${id}`, rh, { method: 'POST' });
      expect(createRes.status).toBe(201);
      const createdInterview = await createRes.json();
      expect(createdInterview.statut).toBe('CREATED');
      expect(createdInterview.candidature_id).toBe(id);

      // 2. Lecture RH + candidat propriétaire
      const asRH = await authed(`${BASE}/ai-interviews/${createdInterview.id}`, rh);
      expect(asRH.status).toBe(200);
      const asCandidat = await authed(`${BASE}/ai-interviews/${createdInterview.id}`, token);
      expect(asCandidat.status).toBe(200);
      expect((await asCandidat.json()).statut).toBe('CREATED');

      // 3. Le rapport est interdit au candidat (sensibilité)
      const reportForbidden = await authed(`${BASE}/ai-interviews/${createdInterview.id}/report`, token);
      expect(reportForbidden.status).toBe(403);

      // 4. Démarrage par le candidat → première question
      const startRes = await authed(`${BASE}/ai-interviews/${createdInterview.id}/start`, token, {
        method: 'POST'
      });
      expect(startRes.status).toBe(200);
      const started = await startRes.json();
      expect(started.statut).toBe('STARTED');
      expect(started.questions).toHaveLength(1);
      expect(started.questions[0].question_number).toBe(1);

      // 5. Réponses une à une → chaque réponse ajoute la question suivante
      let questions = started.questions;
      for (let i = 0; i < ANSWERS.length; i += 1) {
        const answerRes = await authed(`${BASE}/ai-interviews/${createdInterview.id}/answer`, token, {
          method: 'POST',
          body: JSON.stringify({ question_number: i + 1, answer: ANSWERS[i] })
        });
        expect(answerRes.status).toBe(200);
        questions = (await answerRes.json()).questions;
      }
      expect(questions).toHaveLength(8);
      expect(questions.map((q) => q.question_number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

      // 6. Complétion → rapport évalué
      const completeRes = await authed(`${BASE}/ai-interviews/${createdInterview.id}/complete`, token, {
        method: 'POST'
      });
      expect(completeRes.status).toBe(200);
      const completed = await completeRes.json();
      expect(completed.statut).toBe('COMPLETED');

      // 7. Rapport RH
      const reportRes = await authed(`${BASE}/ai-interviews/${createdInterview.id}/report`, rh);
      expect(reportRes.status).toBe(200);
      const report = await reportRes.json();
      expect(report.statut).toBe('COMPLETED');
      expect(report.report.score_global).toBeGreaterThanOrEqual(0);
      expect(report.report.score_global).toBeLessThanOrEqual(100);
      expect(['FAVORABLE', 'A_REVOIR', 'DEFAVORABLE']).toContain(report.report.recommendation);
      expect(typeof report.report.resume).toBe('string');
      expect(typeof report.report.compatibilite_offre).toBe('number');
      expect(typeof report.report.competences_techniques).toBe('number');
    },
    45000
  );

  test(
    'erreurs : id inconnu → 404, re-création active → 409, double start/complete → 409',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();

      const target = await pickFreeOffer(token, open);
      const applyRes = await authed(`${BASE}/candidatures`, token, {
        method: 'POST',
        body: JSON.stringify({ offre_id: target.id })
      });
      const { candidature } = await applyRes.json();
      const id = candidature.id;
      created.push(id);
      await authed(`${BASE}/candidatures/${id}`, rh, {
        method: 'PUT',
        body: JSON.stringify({ statut: 'RH_ACCEPTED' })
      });

      // id inconnu (UUID bien formé mais inexistant)
      const ghost = await authed(`${BASE}/ai-interviews/00000000-0000-0000-0000-000000000000`, rh);
      expect(ghost.status).toBe(404);

      // création puis re-création active → 409
      const createRes = await authed(`${BASE}/ai-interviews/create/${id}`, rh, { method: 'POST' });
      expect(createRes.status).toBe(201);
      const interview = await createRes.json();

      const createAgain = await authed(`${BASE}/ai-interviews/create/${id}`, rh, { method: 'POST' });
      expect(createAgain.status).toBe(409);

      // double start → 409
      const start1 = await authed(`${BASE}/ai-interviews/${interview.id}/start`, token, { method: 'POST' });
      expect(start1.status).toBe(200);
      const start2 = await authed(`${BASE}/ai-interviews/${interview.id}/start`, token, { method: 'POST' });
      expect(start2.status).toBe(409);

      // réponses séquentielles 1..8 (le moteur Python exige les 8 réponses avant « complete »)
      for (let n = 1; n <= 8; n += 1) {
        const answerRes = await authed(`${BASE}/ai-interviews/${interview.id}/answer`, token, {
          method: 'POST',
          body: JSON.stringify({
            question_number: n,
            answer: `Réponse ${n} : je suis motivé(e), j'ai une bonne expérience en équipe et je résous les problèmes avec méthode.`
          })
        });
        expect(answerRes.status).toBe(200);
      }

      // complete après les 8 réponses → 200, puis double complete → 409
      const complete1 = await authed(`${BASE}/ai-interviews/${interview.id}/complete`, token, {
        method: 'POST'
      });
      expect(complete1.status).toBe(200);
      const complete2 = await authed(`${BASE}/ai-interviews/${interview.id}/complete`, token, {
        method: 'POST'
      });
      expect(complete2.status).toBe(409);

      // answer avec réponse vide → 400 (l'entretien est déjà COMPLETED)
      const emptyAnswer = await authed(`${BASE}/ai-interviews/${interview.id}/answer`, token, {
        method: 'POST',
        body: JSON.stringify({ question_number: 1, answer: '   ' })
      });
      expect(emptyAnswer.status).toBe(400);

      // rapport avant complétion déjà couvert ; id inconnu pour report → 404
      const reportGhost = await authed(`${BASE}/ai-interviews/00000000-0000-0000-0000-000000000000/report`, rh);
      expect(reportGhost.status).toBe(404);
    },
    45000
  );
});
