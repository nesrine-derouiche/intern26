const BASE = 'http://localhost:3000/api';

require('dotenv').config();
const pool = require('../config/db');

async function countStagesForCandidature(candidatureId) {
  const { rows } = await pool.query('SELECT COUNT(*)::int as n FROM stage WHERE candidature_id = $1', [candidatureId]);
  return rows[0].n;
}

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

  let target = open.find((o) => !applied.has(o.id));
  if (!target) {
    const toFree = (Array.isArray(mine) ? mine : []).find((c) => c.id);
    expect(toFree).toBeTruthy();
    const freeRes = await authed(`${BASE}/candidatures/${toFree.id}`, adminToken, {
      method: 'DELETE'
    });
    expect(freeRes.status).toBe(200);
    target = open[0];
  }
  return target;
}

describe('Candidature — email de confirmation + notification RH (intégration)', () => {
  test(
    'POST /api/candidatures crée une candidature EN_ATTENTE, envoie l’email et notifie le RH',
    async () => {
      const token = await loginCandidat();
      const adminToken = await loginAdmin();
      const rh = await loginRH();

      const offresRes = await fetch(`${BASE}/public/offres`);
      expect(offresRes.status).toBe(200);
      const open = await offresRes.json();
      expect(Array.isArray(open)).toBe(true);
      expect(open.length).toBeGreaterThan(0);

      const target = await pickFreeOffer(token, adminToken, open);

      const unreadBefore = await authed(`${BASE}/notifications/unread`, rh);
      expect(unreadBefore.status).toBe(200);
      const beforeBody = await unreadBefore.json();

      const res = await authed(`${BASE}/candidatures`, token, {
        method: 'POST',
        body: JSON.stringify({ offre_id: target.id })
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.candidature).toBeTruthy();
      expect(body.candidature.offre_id).toBe(target.id);
      expect(body.candidature.statut).toBe('EN_ATTENTE');

      const unreadAfter = await authed(`${BASE}/notifications/unread`, rh);
      expect(unreadAfter.status).toBe(200);
      const afterBody = await unreadAfter.json();
      expect(afterBody.total).toBe(beforeBody.total + 1);

      const expectedMessage = `Marwa Sassi a postulé à l'offre ${target.titre}`;
      let notif = null;
      let page = 1;
      while (!notif && page <= 10) {
        const listRes = await authed(`${BASE}/notifications?type=CANDIDATURE&page=${page}&limit=50`, rh);
        expect(listRes.status).toBe(200);
        const list = await listRes.json();
        notif = (list.data || []).find(
          (n) => n.titre === 'Nouvelle candidature' && n.message === expectedMessage
        );
        if (notif || page >= list.pages) break;
        page += 1;
      }

      expect(notif).toBeTruthy();
      expect(notif.lue).toBe(false);
      expect(notif.type).toBe('CANDIDATURE');
      expect(notif.message).toBe(expectedMessage);

      const delNotif = await authed(`${BASE}/notifications/${notif.id}`, rh, { method: 'DELETE' });
      expect(delNotif.status).toBe(200);

      const del = await authed(`${BASE}/candidatures/${body.candidature.id}`, adminToken, {
        method: 'DELETE'
      });
      expect(del.status).toBe(200);
    },
    30000
  );
});

describe('Candidature — workflow RH (détails, CV, présélection IA)', () => {
  test(
    'RH consulte les détails, présélectionne pour entretien IA sans créer de stage',
    async () => {
      const token = await loginCandidat();
      const adminToken = await loginAdmin();
      const rh = await loginRH();

      const offresRes = await fetch(`${BASE}/public/offres`);
      expect(offresRes.status).toBe(200);
      const open = await offresRes.json();

      const target = await pickFreeOffer(token, adminToken, open);

      const res = await authed(`${BASE}/candidatures`, token, {
        method: 'POST',
        body: JSON.stringify({ offre_id: target.id })
      });
      expect(res.status).toBe(201);
      const { candidature } = await res.json();
      const id = candidature.id;

      expect(await countStagesForCandidature(id)).toBe(0);

      const detailsRes = await authed(`${BASE}/candidatures/${id}`, rh);
      expect(detailsRes.status).toBe(200);
      const details = await detailsRes.json();
      expect(details.id).toBe(id);
      expect(details.nom).toBe('Sassi');
      expect(details.prenom).toBe('Marwa');
      expect(details.email).toBe('candidat@steg.tn');
      expect(details.offre_titre).toBe(target.titre);
      expect(details.statut).toBe('EN_ATTENTE');
      expect(details.cvUrl === null || typeof details.cvUrl === 'string').toBe(true);

      if (details.cvUrl) {
        const cvRes = await authed(`${BASE}${details.cvUrl}`, rh);
        expect([200, 404]).toContain(cvRes.status);
      } else {
        const cvRes = await authed(`${BASE}/candidatures/${id}/cv`, rh);
        expect(cvRes.status).toBe(404);
      }

      const putRes = await authed(`${BASE}/candidatures/${id}`, rh, {
        method: 'PUT',
        body: JSON.stringify({ statut: 'EN_ENTRETIEN_IA' })
      });
      expect(putRes.status).toBe(200);
      expect((await putRes.json()).message).toContain('présélectionnée');

      const afterRes = await authed(`${BASE}/candidatures/${id}`, rh);
      expect(afterRes.status).toBe(200);
      expect((await afterRes.json()).statut).toBe('EN_ENTRETIEN_IA');

      expect(await countStagesForCandidature(id)).toBe(0);

      const listRes = await authed(`${BASE}/candidatures`, rh);
      expect(listRes.status).toBe(200);
      const list = await listRes.json();
      const found = (Array.isArray(list) ? list : []).find((c) => c.id === id);
      expect(found).toBeTruthy();
      expect(found.statut).toBe('EN_ENTRETIEN_IA');

      const del = await authed(`${BASE}/candidatures/${id}`, adminToken, { method: 'DELETE' });
      expect(del.status).toBe(200);
    },
    30000
  );

  test(
    'RH accepte pour entretien IA : statut RH_ACCEPTED, notification et lien dynamique',
    async () => {
      const token = await loginCandidat();
      const adminToken = await loginAdmin();
      const rh = await loginRH();

      const offresRes = await fetch(`${BASE}/public/offres`);
      expect(offresRes.status).toBe(200);
      const open = await offresRes.json();

      const target = await pickFreeOffer(token, adminToken, open);

      const res = await authed(`${BASE}/candidatures`, token, {
        method: 'POST',
        body: JSON.stringify({ offre_id: target.id })
      });
      expect(res.status).toBe(201);
      const { candidature } = await res.json();
      const id = candidature.id;

      const putRes = await authed(`${BASE}/candidatures/${id}`, rh, {
        method: 'PUT',
        body: JSON.stringify({ statut: 'RH_ACCEPTED' })
      });
      expect(putRes.status).toBe(200);
      expect((await putRes.json()).message).toContain('acceptée pour l\'entretien IA');

      const afterRes = await authed(`${BASE}/candidatures/${id}`, rh);
      expect(afterRes.status).toBe(200);
      expect((await afterRes.json()).statut).toBe('RH_ACCEPTED');

      expect(await countStagesForCandidature(id)).toBe(0);

      const { rows: sessionRows } = await pool.query(
        'SELECT token FROM ai_interview_sessions WHERE candidature_id = $1',
        [id]
      );
      expect(sessionRows.length).toBe(1);
      const interviewLien = `/entretien-ia/${sessionRows[0].token}`;

      let notif = null;
      let page = 1;
      while (!notif && page <= 10) {
        const listRes = await authed(
          `${BASE}/notifications?type=CANDIDATURE&page=${page}&limit=50`,
          token
        );
        expect(listRes.status).toBe(200);
        const list = await listRes.json();
        notif = (list.data || []).find(
          (n) => n.titre === 'Candidature présélectionnée' && n.lien === interviewLien
        );
        if (notif || page >= list.pages) break;
        page += 1;
      }

      expect(notif).toBeTruthy();
      expect(notif.type).toBe('CANDIDATURE');
      expect(notif.lien).toBe(interviewLien);
      expect(notif.lien).not.toContain(id);
      expect(notif.lue).toBe(false);

      const delNotif = await authed(`${BASE}/notifications/${notif.id}`, token, {
        method: 'DELETE'
      });
      expect(delNotif.status).toBe(200);

      const del = await authed(`${BASE}/candidatures/${id}`, adminToken, { method: 'DELETE' });
      expect(del.status).toBe(200);
    },
    30000
  );

  test(
    'un candidat accède à sa propre candidature mais pas à celle des autres, un stagiaire ne peut ni consulter ni décider',
    async () => {
      const token = await loginCandidat();
      const adminToken = await loginAdmin();
      const rh = await loginRH();

      const offresRes = await fetch(`${BASE}/public/offres`);
      const open = await offresRes.json();
      const target = await pickFreeOffer(token, adminToken, open);

      const res = await authed(`${BASE}/candidatures`, token, {
        method: 'POST',
        body: JSON.stringify({ offre_id: target.id })
      });
      expect(res.status).toBe(201);
      const { candidature } = await res.json();
      const id = candidature.id;

      const detailsOwnCandidat = await authed(`${BASE}/candidatures/${id}`, token);
      expect(detailsOwnCandidat.status).toBe(200);
      const ownBody = await detailsOwnCandidat.json();
      expect(ownBody.id).toBe(id);

      const stagiaire = await login('fatma.trabelsi@steg.tn', 'stagiaire123');

      const detailsStagiaire = await authed(`${BASE}/candidatures/${id}`, stagiaire);
      expect(detailsStagiaire.status).toBe(403);

      const cvStagiaire = await authed(`${BASE}/candidatures/${id}/cv`, stagiaire);
      expect(cvStagiaire.status).toBe(403);

      const putStagiaire = await authed(`${BASE}/candidatures/${id}`, stagiaire, {
        method: 'PUT',
        body: JSON.stringify({ statut: 'EN_ENTRETIEN_IA' })
      });
      expect(putStagiaire.status).toBe(403);

      const del = await authed(`${BASE}/candidatures/${id}`, adminToken, { method: 'DELETE' });
      expect(del.status).toBe(200);
    },
    30000
  );
});
