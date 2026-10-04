const BASE = 'http://localhost:3000/api';

require('dotenv').config();
const pool = require('../config/db');

let candidatToken = null;
let adminToken = null;
let rhToken = null;

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
    target = open.find((o) => o.nombre_places > 0) || open[0];
  }
  return target;
}

async function createAcceptedCandidature(token, adminToken, rh, open) {
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
  return { id: candidature.id, offre: { id: target.id, nombre_places: target.nombre_places } };
}

async function sessionToken(candidatureId) {
  const { rows } = await pool.query(
    'SELECT token FROM ai_interview_sessions WHERE candidature_id = $1',
    [candidatureId]
  );
  return rows[0] ? rows[0].token : null;
}

async function answerAll(token, candidat, count) {
  for (let n = 1; n <= count; n += 1) {
    const res = await authed(`${BASE}/entretien-ia/${token}/reponses/${n}`, candidat, {
      method: 'PUT',
      body: JSON.stringify({
        answer: `Réponse à la question ${n} : je suis motivé(e) par ce stage, j'ai travaillé en équipe sur des projets, j'analyse et je résous les problèmes avec méthode, et mes compétences techniques (Node.js, Python, SQL) sont en lien direct avec l'offre.`
      })
    });
    expect(res.status).toBe(200);
  }
}

async function cleanupNotifications(userToken, titre, contains) {
  const listRes = await authed(`${BASE}/notifications?page=1&limit=50`, userToken);
  const list = await listRes.json();
  for (const n of list.data || []) {
    if (n.titre === titre && n.message.includes(contains)) {
      await authed(`${BASE}/notifications/${n.id}`, userToken, { method: 'DELETE' });
    }
  }
}

/**
 * Décision RH sur le résultat de l'entretien IA (étape « Décision RH » du
 * pipeline). L'IA ne décide jamais : le RH applique le résultat en s'appuyant
 * sur l'analyse sauvegardée (score_global + recommandation).
 * @returns {Promise<'AI_INTERVIEW_PASSED'|'AI_INTERVIEW_FAILED'|'INDISPONIBLE'>}
 */
async function decideInterviewAsRh(candidatureId, rh) {
  const details = await (await authed(`${BASE}/candidatures/${candidatureId}`, rh)).json();
  const evaluation = details.ai_interview && details.ai_interview.evaluation;
  if (!evaluation || typeof evaluation.score_global !== 'number') return 'INDISPONIBLE';
  const status = evaluation.recommendation === 'DEFAVORABLE' ? 'FAILED' : 'PASSED';
  const res = await authed(`${BASE}/candidatures/${candidatureId}/entretien-ia/result`, rh, {
    method: 'POST',
    body: JSON.stringify({ score: evaluation.score_global, status })
  });
  expect(res.status).toBe(200);
  return (await res.json()).statut;
}

describe('Entretien IA — flux complet par token (intégration)', () => {
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
    'session créée à l’acceptation RH, questions générées, réponses conservées, évaluation réelle appliquée',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();

      const { id } = await createAcceptedCandidature(token, adminToken, rh, open);
      created.push(id);

      const interviewToken = await sessionToken(id);
      expect(interviewToken).toBeTruthy();
      expect(interviewToken).not.toContain(id);

      const ctxRes = await authed(`${BASE}/entretien-ia/${interviewToken}`, token);
      expect(ctxRes.status).toBe(200);
      const ctx = await ctxRes.json();
      expect(ctx.statut).toBe('EN_ATTENTE');
      expect(ctx.candidat.prenom).toBe('Marwa');
      expect(ctx.offre.titre).toBeTruthy();
      expect(ctx.questions).toBeUndefined();

      const startRes = await authed(`${BASE}/entretien-ia/${interviewToken}/commencer`, token, {
        method: 'POST'
      });
      expect(startRes.status).toBe(200);
      const start = await startRes.json();
      expect(start.total_questions).toBe(8);
      expect(start.question).toBeTruthy();
      expect(start.question.question_number).toBe(1);
      expect(start.audio).toBeTruthy();
      expect(start.audio_format).toBeTruthy();

      await answerAll(interviewToken, token, 8);

      const resumeRes = await authed(`${BASE}/entretien-ia/${interviewToken}`, token);
      expect(resumeRes.status).toBe(200);
      const resumed = await resumeRes.json();
      expect(resumed.statut).toBe('EN_COURS');
      expect(resumed.questions).toHaveLength(8);
      expect(resumed.answers.filter((a) => a.answer).length).toBe(8);

      const doneRes = await authed(`${BASE}/entretien-ia/${interviewToken}/terminer`, token, {
        method: 'POST'
      });
      expect(doneRes.status).toBe(200);
      const done = await doneRes.json();
      expect(done.statut).toBe('TERMINE');
      expect(done.evaluation_status).toBe('EVALUEE');

      const decided = await decideInterviewAsRh(id, rh);
      expect(['AI_INTERVIEW_PASSED', 'AI_INTERVIEW_FAILED']).toContain(decided);

      const details = await authed(`${BASE}/candidatures/${id}`, rh);
      expect(details.status).toBe(200);
      const body = await details.json();
      expect(body.statut).toBe(decided);
      expect(body.ai_interview.evaluation_status).toBe('EVALUEE');
      expect(body.ai_interview.evaluation.score_global).toBeGreaterThanOrEqual(0);
      expect(body.ai_interview.evaluation.score_global).toBeLessThanOrEqual(100);
      expect(typeof body.ai_interview.evaluation.score_global).toBe('number');
      expect(body.ai_interview.evaluation.recommendation).toBeTruthy();

      const { rows } = await pool.query('SELECT COUNT(*)::int as n FROM stage WHERE candidature_id = $1', [id]);
      expect(rows[0].n).toBe(0);

      if (body.statut === 'AI_INTERVIEW_PASSED') {
        await cleanupNotifications(token, 'Entretien IA réussi', 'éligible pour un entretien humain');
        await cleanupNotifications(rh, 'Entretien IA réussi', 'a réussi l\'entretien IA');
      } else {
        await cleanupNotifications(token, 'Entretien IA non réussi', 'n\'a pas abouti');
      }
    },
    45000
  );

  test(
    'sécurité : un autre rôle ne peut pas lire un entretien, token inconnu → 404, relance bloquée',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();
      const stagiaire = await login('fatma.trabelsi@steg.tn', 'stagiaire123');

      const { id } = await createAcceptedCandidature(token, adminToken, rh, open);
      created.push(id);
      const interviewToken = await sessionToken(id);

      const asStagiaire = await authed(`${BASE}/entretien-ia/${interviewToken}`, stagiaire);
      expect(asStagiaire.status).toBe(403);

      const ghost = await authed(`${BASE}/entretien-ia/${'0'.repeat(64)}`, token);
      expect(ghost.status).toBe(404);

      const startRes = await authed(`${BASE}/entretien-ia/${interviewToken}/commencer`, token, {
        method: 'POST'
      });
      expect(startRes.status).toBe(200);

      const answerRes = await authed(`${BASE}/entretien-ia/${interviewToken}/reponses/1`, token, {
        method: 'PUT',
        body: JSON.stringify({ answer: 'Première réponse courte' })
      });
      expect(answerRes.status).toBe(200);

      const secondStart = await authed(`${BASE}/entretien-ia/${interviewToken}/commencer`, token, {
        method: 'POST'
      });
      expect(secondStart.status).toBe(400);

      const terminate = await authed(`${BASE}/entretien-ia/${interviewToken}/terminer`, token, {
        method: 'POST'
      });
      expect(terminate.status).toBe(200);
      await decideInterviewAsRh(id, rh);
      await cleanupNotifications(token, 'Entretien IA non réussi', 'n\'a pas abouti');
      await cleanupNotifications(rh, 'Entretien IA réussi', 'a réussi l\'entretien IA');
    },
    45000
  );

  test(
    'entretien humain : planification RH puis refus (REJECTED)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();

      const { id } = await createAcceptedCandidature(token, adminToken, rh, open);
      created.push(id);
      const interviewToken = await sessionToken(id);

      await authed(`${BASE}/entretien-ia/${interviewToken}/commencer`, token, { method: 'POST' });
      await answerAll(interviewToken, token, 8);
      const done = await (await authed(`${BASE}/entretien-ia/${interviewToken}/terminer`, token, { method: 'POST' })).json();
      expect(done.statut).toBe('TERMINE');

      const decided = await decideInterviewAsRh(id, rh);
      if (decided !== 'AI_INTERVIEW_PASSED') {
        await cleanupNotifications(token, 'Entretien IA non réussi', 'n\'a pas abouti');
        return;
      }
      await cleanupNotifications(token, 'Entretien IA réussi', 'éligible pour un entretien humain');
      await cleanupNotifications(rh, 'Entretien IA réussi', 'a réussi l\'entretien IA');

      const scheduleRes = await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
        method: 'POST',
        body: JSON.stringify({
          date: '2026-08-25',
          heure: '09:30',
          duree: 45,
          interviewer: 'Salma Bouazizi',
          interviewer_email: 'salma.bouazizi@steg.tn',
          lien_visio: 'https://teams.microsoft.com/l/meetup-join/meeting/abc'
        })
      });
      expect(scheduleRes.status).toBe(200);

      const humanRes = await authed(`${BASE}/candidatures/${id}`, rh);
      const humanBody = await humanRes.json();
      expect(humanBody.statut).toBe('EN_ENTRETIEN_HUMAIN');
      expect(humanBody.human_interview).toMatchObject({
        date: '2026-08-25',
        interviewer: 'Salma Bouazizi',
        interviewer_email: 'salma.bouazizi@steg.tn',
        duree: 45,
        statut: 'PLANIFIE'
      });

      const decisionRes = await authed(`${BASE}/candidatures/${id}/decision-finale`, rh, {
        method: 'POST',
        body: JSON.stringify({ decision: 'REJECTED' })
      });
      expect(decisionRes.status).toBe(200);

      const after = await (await authed(`${BASE}/candidatures/${id}`, rh)).json();
      expect(after.statut).toBe('REFUSEE');

      await cleanupNotifications(token, 'Candidature non retenue', 'entretien humain');
    },
    45000
  );

  test(
    'entretien humain : ACCEPTED promeut le candidat et crée le stage (avec nettoyage du rôle)',
    async () => {
      const token = await loginCandidat();
      const rh = await loginRH();

      const { id, offre } = await createAcceptedCandidature(token, adminToken, rh, open);
      created.push(id);
      const interviewToken = await sessionToken(id);

      await authed(`${BASE}/entretien-ia/${interviewToken}/commencer`, token, { method: 'POST' });
      await answerAll(interviewToken, token, 8);
      const done = await (await authed(`${BASE}/entretien-ia/${interviewToken}/terminer`, token, { method: 'POST' })).json();
      expect(done.statut).toBe('TERMINE');

      const decided = await decideInterviewAsRh(id, rh);
      if (decided !== 'AI_INTERVIEW_PASSED') {
        await cleanupNotifications(token, 'Entretien IA non réussi', 'n\'a pas abouti');
        return;
      }
      await cleanupNotifications(token, 'Entretien IA réussi', 'éligible pour un entretien humain');
      await cleanupNotifications(rh, 'Entretien IA réussi', 'a réussi l\'entretien IA');

      await authed(`${BASE}/candidatures/${id}/entretien-humain`, rh, {
        method: 'POST',
        body: JSON.stringify({
          date: '2026-08-26',
          heure: '14:00',
          duree: 60,
          interviewer: 'Salma Bouazizi',
          interviewer_email: 'salma.bouazizi@steg.tn',
          lien_visio: 'https://teams.microsoft.com/l/meetup-join/meeting/def'
        })
      });

      const decisionRes = await authed(`${BASE}/candidatures/${id}/decision-finale`, rh, {
        method: 'POST',
        body: JSON.stringify({ decision: 'ACCEPTED' })
      });
      expect(decisionRes.status).toBe(200);

      const after = await (await authed(`${BASE}/candidatures/${id}`, rh)).json();
      expect(after.statut).toBe('ACCEPTEE');

      const { rows } = await pool.query(
        `SELECT s.id FROM stage s WHERE s.candidature_id = $1`,
        [id]
      );
      expect(rows.length).toBe(1);

      const me = await (await authed(`${BASE}/auth/me`, token)).json();
      expect(me.user.role).toBe('STAGIAIRE');

      await cleanupNotifications(token, 'Candidature acceptée 🎉', 'a été acceptée');
      await cleanupNotifications(token, 'Documents requis pour votre stage', 'documents');

      const { rows: userRows } = await pool.query(
        'SELECT id FROM utilisateur WHERE email = $1',
        ['candidat@steg.tn']
      );
      const userId = userRows[0].id;

      await pool.query('DELETE FROM projet WHERE stage_id = $1', [rows[0].id]);
      await pool.query('DELETE FROM stage WHERE id = $1', [rows[0].id]);
      await pool.query('DELETE FROM stagiaire WHERE id = $1', [userId]);
      await pool.query("UPDATE utilisateur SET role = 'CANDIDAT' WHERE id = $1", [userId]);
      await pool.query(
        'UPDATE offre_stage SET nombre_places = $2, statut = \'OUVERTE\' WHERE id = $1',
        [offre.id, offre.nombre_places]
      );
    },
    45000
  );
});
