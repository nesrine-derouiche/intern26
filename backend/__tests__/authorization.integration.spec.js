const BASE = 'http://localhost:3000/api';
require('dotenv').config();
const pool = require('../config/db');
const bcrypt = require('bcrypt');

const USERS = {
  admin: { email: 'admin@steg.tn', password: 'admin123' },
  rh: { email: 'salma.bouazizi@steg.tn', password: 'rh1234' },
  chef: { email: 'nabil.khelifi@steg.tn', password: 'chef123' },
  encadrantInfo: { email: 'ahmed.bensalah@steg.tn', password: 'encadrant123' },
  encadrantElec: { email: 'rachid.mansour@steg.tn', password: 'encadrant123' },
  stagiaireInfo: { email: 'fatma.trabelsi@steg.tn', password: 'stagiaire123' },
  stagiaireElec: { email: 'mohamed.bouchnak@steg.tn', password: 'stagiaire123' }
};

const tokens = {};

async function login(key) {
  if (tokens[key]) return tokens[key];
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: USERS[key].email, password: USERS[key].password })
  });
  const data = await res.json();
  if (!data.token) {
    delete tokens[key];
    return null;
  }
  tokens[key] = data.token;
  return tokens[key];
}

async function authFetch(key, url, options = {}) {
  const token = await login(key);
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
}

function buildForm(type, { content = 'Contenu du document de test', filename = 'cv.pdf' } = {}) {
  const form = new FormData();
  form.append('type', type);
  form.append('file', new Blob([content], { type: 'application/pdf' }), filename);
  return form;
}

describe('Ownership authorization', () => {
  let adminToken = null;
  let stageInfo = null;
  let stageElec = null;
  let internInfo = null;
  let internElec = null;
  let internNoStage = null;
  let encadrantInfoId = null;
  let tacheElec = null;
  let tacheInfo = null;
  let evaluationInfo = null;
  let reunionElec = null;
  let chefDeptId = null;

  beforeAll(async () => {
    const stagiaireHash = await bcrypt.hash('stagiaire123', 10);
    await pool.query("UPDATE utilisateur SET mot_de_passe = $1 WHERE email IN ('fatma.trabelsi@steg.tn', 'mohamed.bouchnak@steg.tn')", [stagiaireHash]);
    await pool.query("UPDATE utilisateur SET nom = 'Trabelsi', prenom = 'Fatma' WHERE email = 'fatma.trabelsi@steg.tn'");

    const staleUser = await pool.query("SELECT id FROM utilisateur WHERE nom = 'Test' AND prenom = 'Conversion'");
    if (staleUser.rows.length > 0) {
      const staleId = staleUser.rows[0].id;
      await pool.query("DELETE FROM notification WHERE utilisateur_id = $1", [staleId]);
      await pool.query("DELETE FROM stage WHERE stagiaire_id = $1", [staleId]);
      await pool.query("DELETE FROM utilisateur WHERE id = $1", [staleId]);
    }

    tokens.admin = null;
    tokens.stagiaireInfo = null;
    tokens.stagiaireElec = null;
    adminToken = await login('admin');

    const stages = await (await authFetch('admin', `${BASE}/stages`)).json();
    stageInfo = stages.find((s) => s.stagiaire_nom === 'Trabelsi') || null;
    stageElec = stages.find((s) => s.stagiaire_nom === 'Bouchnak') || null;

    const internes = await (await authFetch('admin', `${BASE}/stagiaires`)).json();
    internInfo = internes.find((s) => s.nom === 'Trabelsi') || null;
    internElec = internes.find((s) => s.nom === 'Bouchnak') || null;
    internNoStage = internes.find((s) => s.nom === 'Gharbi') || internes.find((s) => s.nom === 'Hadj Ali') || null;

    const encadrants = await (await authFetch('admin', `${BASE}/encadrants`)).json();
    const encadrantInfo = encadrants.find((e) => e.nom === 'Ben Salah') || null;
    encadrantInfoId = encadrantInfo ? encadrantInfo.id : null;

    const taches = await (await authFetch('admin', `${BASE}/taches`)).json();
    tacheElec = taches.find((t) => t.createur_nom === 'Mansour') || taches.find((t) => t.executant_nom === 'Bouchnak') || null;
    tacheInfo = taches.find((t) => t.executant_nom === 'Trabelsi' && t.statut !== 'TERMINEE')
      || taches.find((t) => t.executant_nom === 'Trabelsi')
      || null;

    const evaluations = await (await authFetch('admin', `${BASE}/evaluations`)).json();
    evaluationInfo = Array.isArray(evaluations) && evaluations.length > 0 ? evaluations[0] : null;

    const reunions = await (await authFetch('admin', `${BASE}/reunions`)).json();
    reunionElec = reunions.find((r) => r.encadrant_nom === 'Mansour') || reunions.find((r) => r.stagiaire_nom === 'Bouchnak') || null;

    const departements = await (await authFetch('admin', `${BASE}/departements`)).json();
    const chefDept = departements.find((d) => d.chef_nom === 'Khelifi') || null;
    chefDeptId = chefDept ? chefDept.id : null;
  });

  describe('scoping des listes (pas de fuite)', () => {
    test('STAGIAIRE: ne voit que ses propres stagiaires', async () => {
      const internes = await (await authFetch('stagiaireInfo', `${BASE}/stagiaires`)).json();
      expect(Array.isArray(internes)).toBe(true);
      for (const s of internes) expect(s.id).toBe(internInfo.id);
    });

    test('STAGIAIRE: ne voit que son propre stage', async () => {
      const stages = await (await authFetch('stagiaireInfo', `${BASE}/stages`)).json();
      expect(Array.isArray(stages)).toBe(true);
      for (const s of stages) expect(s.stagiaire_id).toBe(internInfo.id);
    });

    test('STAGIAIRE: ne voit que ses propres tâches', async () => {
      const taches = await (await authFetch('stagiaireInfo', `${BASE}/taches`)).json();
      expect(Array.isArray(taches)).toBe(true);
      for (const t of taches) expect(t.executant_id).toBe(internInfo.id);
    });

    test('STAGIAIRE: ne voit que ses réunions et évaluations', async () => {
      const reunions = await (await authFetch('stagiaireInfo', `${BASE}/reunions`)).json();
      for (const r of reunions) expect(r.stagiaire_nom).toBe('Trabelsi');

      const evaluations = await (await authFetch('stagiaireInfo', `${BASE}/evaluations`)).json();
      for (const e of evaluations) expect(e.stagiaire_nom).toBe('Trabelsi');
    });

    test('STAGIAIRE: ne voit que ses candidatures', async () => {
      const candidatures = await (await authFetch('stagiaireInfo', `${BASE}/candidatures`)).json();
      expect(Array.isArray(candidatures)).toBe(true);
      for (const c of candidatures) expect(c.stagiaire_id).toBe(internInfo.id);
    });

    test('STAGIAIRE: offre non ouverte exclue', async () => {
      const offres = await (await authFetch('stagiaireInfo', `${BASE}/offres`)).json();
      expect(Array.isArray(offres)).toBe(true);
      for (const o of offres) expect(o.statut).toBe('OUVERTE');
    });

    test('ENCADRANT: ne voit que ses stagiaires et stages', async () => {
      const internes = await (await authFetch('encadrantInfo', `${BASE}/stagiaires`)).json();
      for (const s of internes) expect(s.id).toBe(internInfo.id);

      const stages = await (await authFetch('encadrantInfo', `${BASE}/stages`)).json();
      for (const s of stages) expect(s.encadrant_id).toBe(encadrantInfoId);
    });

    test('ENCADRANT: dashboard scoped à ses stages', async () => {
      const data = await (await authFetch('encadrantInfo', `${BASE}/dashboard/stats`)).json();
      expect(data.encadrant).toBeTruthy();
      expect(typeof data.encadrant.stagiairesTotal).toBe('number');
      expect(typeof data.encadrant.reunionsTotal).toBe('number');
      expect(Array.isArray(data.encadrant.reunionsParMois)).toBe(true);
      expect(Array.isArray(data.encadrant.tachesDuJour)).toBe(true);
      expect(Array.isArray(data.encadrant.tachesEnRetard)).toBe(true);
      expect(Array.isArray(data.encadrant.rapportsSoumis)).toBe(true);
      expect(Array.isArray(data.encadrant.progressStages)).toBe(true);
      for (const s of data.encadrant.progressStages) expect(s.stagiaire_nom).toBe('Trabelsi');
    });

    test('ENCADRANT: rapports et tâches du dashboard scopes à ses stages', async () => {
      const data = await (await authFetch('encadrantElec', `${BASE}/dashboard/stats`)).json();
      expect(data.encadrant).toBeTruthy();
      expect(data.encadrant.rapportsAValider).toBeGreaterThanOrEqual(1);
      for (const r of data.encadrant.rapportsSoumis) expect(r.stagiaire_nom).toBe('Bouchnak');
      for (const s of data.encadrant.progressStages) expect(s.stagiaire_nom).toBe('Bouchnak');
      for (const t of data.encadrant.tachesDuJour) expect(t.executant_nom).toBeTruthy();
      for (const t of data.encadrant.tachesEnRetard) expect(t.executant_nom).toBeTruthy();
      for (const r of data.alerts.rapportsEnAttente) expect(r.stagiaire_nom).toBe('Bouchnak');

      const info = await (await authFetch('encadrantInfo', `${BASE}/dashboard/stats`)).json();
      expect(info.encadrant.rapportsAValider).toBe(0);
    });

    test('CHEF_DEPARTEMENT: ne voit que son département', async () => {
      if (!chefDeptId) return;

      const departements = await (await authFetch('chef', `${BASE}/departements`)).json();
      for (const d of departements) expect(d.id).toBe(chefDeptId);

      const offres = await (await authFetch('chef', `${BASE}/offres`)).json();
      for (const o of offres) expect(o.departement_id).toBe(chefDeptId);

      const encadrants = await (await authFetch('chef', `${BASE}/encadrants`)).json();
      for (const e of encadrants) expect(e.departement_id).toBe(chefDeptId);

      const stages = await (await authFetch('chef', `${BASE}/stages`)).json();
      for (const s of stages) expect(s.departement_nom).toBe('Informatique');

      const internes = await (await authFetch('chef', `${BASE}/stagiaires`)).json();
      for (const s of internes) expect(s.id).toBe(internInfo.id);
    });

    test('CHEF_DEPARTEMENT: pagination scoped', async () => {
      if (!stageInfo) return;
      const res = await authFetch('stagiaireInfo', `${BASE}/stages?page=1&limit=5`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.total).toBe(1);
      expect(Array.isArray(data.data)).toBe(true);
      for (const s of data.data) expect(s.stagiaire_id).toBe(internInfo.id);
    });
  });

  describe('Notifications (module)', () => {
    test("GET /api/notifications paginé, plus récentes d'abord", async () => {
      const res = await (await authFetch('stagiaireInfo', `${BASE}/notifications?page=1&limit=2`)).json();
      expect(res).toHaveProperty('data');
      expect(res).toHaveProperty('total');
      expect(res.page).toBe(1);
      expect(res.pages).toBeGreaterThanOrEqual(1);
      expect(res.data.length).toBeLessThanOrEqual(2);
      for (let i = 1; i < res.data.length; i++) {
        expect(new Date(res.data[i - 1].date).getTime()).toBeGreaterThanOrEqual(new Date(res.data[i].date).getTime());
      }
      for (const n of res.data) expect(n.utilisateur_id).toBe(internInfo.id);
    });

    test('GET /api/notifications?type= filtre par catégorie', async () => {
      const res = await (await authFetch('stagiaireInfo', `${BASE}/notifications?type=TACHE&page=1&limit=10`)).json();
      for (const n of res.data) expect(n.type).toBe('TACHE');

      const multi = await (await authFetch('stagiaireInfo', `${BASE}/notifications?type=TACHE,REUNION&page=1&limit=10`)).json();
      for (const n of multi.data) expect(['TACHE', 'REUNION']).toContain(n.type);
    });

    test('GET /api/notifications/unread retourne le nombre de non-lues', async () => {
      const res = await (await authFetch('stagiaireInfo', `${BASE}/notifications/unread`)).json();
      expect(typeof res.total).toBe('number');
    });

    test('PUT /api/notifications/:id/lire marque la notification comme lue', async () => {
      const list = await (await authFetch('stagiaireInfo', `${BASE}/notifications?page=1&limit=1`)).json();
      if (!list.data || list.data.length === 0) return;
      const n = list.data[0];
      const putRes = await authFetch('stagiaireInfo', `${BASE}/notifications/${n.id}/lire`, { method: 'PUT' });
      expect(putRes.status).toBe(200);
      const check = await (await authFetch('stagiaireInfo', `${BASE}/notifications?page=1&limit=20`)).json();
      const updated = check.data.find((x) => x.id === n.id);
      expect(updated).toBeTruthy();
      expect(updated.lue).toBe(true);
    });
  });

  describe('accès objet (403)', () => {
    test('STAGIAIRE lisant un autre stagiaire → 403', async () => {
      if (!internElec) return;
      const res = await authFetch('stagiaireInfo', `${BASE}/stagiaires/${internElec.id}`);
      expect(res.status).toBe(403);
    });

    test('STAGIAIRE lisant son propre profil → 200', async () => {
      if (!internInfo) return;
      const res = await authFetch('stagiaireInfo', `${BASE}/stagiaires/${internInfo.id}`);
      expect(res.status).toBe(200);
    });

    test('STAGIAIRE lisant un stagiaire sans stage → 403', async () => {
      if (!internNoStage) return;
      const res = await authFetch('stagiaireInfo', `${BASE}/stagiaires/${internNoStage.id}`);
      expect(res.status).toBe(403);
    });

    test('ENCADRANT lisant un stagiaire qui n\'est pas le sien → 403', async () => {
      if (!internElec) return;
      const res = await authFetch('encadrantInfo', `${BASE}/stagiaires/${internElec.id}`);
      expect(res.status).toBe(403);
    });

    test('ENCADRANT lisant son propre stagiaire → 200', async () => {
      if (!internInfo) return;
      const res = await authFetch('encadrantInfo', `${BASE}/stagiaires/${internInfo.id}`);
      expect(res.status).toBe(200);
    });

    test('CHEF_DEPARTEMENT lisant un stagiaire d\'un autre département → 403', async () => {
      if (!internElec) return;
      const res = await authFetch('chef', `${BASE}/stagiaires/${internElec.id}`);
      expect(res.status).toBe(403);
    });

    test('CHEF_DEPARTEMENT lisant un stagiaire de son département → 200', async () => {
      if (!internInfo) return;
      const res = await authFetch('chef', `${BASE}/stagiaires/${internInfo.id}`);
      expect(res.status).toBe(200);
    });

    test('ENCADRANT modifiant le stage d\'un autre encadrant → 403', async () => {
      if (!stageElec) return;
      const res = await authFetch('encadrantInfo', `${BASE}/stages/${stageElec.id}`, {
        method: 'PUT',
        body: JSON.stringify({ statut: 'EN_COURS' })
      });
      expect(res.status).toBe(403);
    });

    test('ENCADRANT modifiant son propre stage → 200', async () => {
      if (!stageInfo) return;
      const res = await authFetch('encadrantInfo', `${BASE}/stages/${stageInfo.id}`, {
        method: 'PUT',
        body: JSON.stringify({ statut: stageInfo.statut })
      });
      expect(res.status).toBe(200);
    });

    test('ENCADRANT modifiant la tâche d\'un autre encadrant → 403', async () => {
      if (!tacheElec) return;
      const res = await authFetch('encadrantInfo', `${BASE}/taches/${tacheElec.id}`, {
        method: 'PUT',
        body: JSON.stringify({ titre: 'Tentative non autorisée' })
      });
      expect(res.status).toBe(403);
    });

    test('ENCADRANT modifiant sa propre tâche → 200', async () => {
      if (!tacheInfo) return;
      const original = tacheInfo.titre;
      const res = await authFetch('encadrantInfo', `${BASE}/taches/${tacheInfo.id}`, {
        method: 'PUT',
        body: JSON.stringify({ titre: 'Tâche interne mise à jour' })
      });
      expect(res.status).toBe(200);
      await authFetch('encadrantInfo', `${BASE}/taches/${tacheInfo.id}`, {
        method: 'PUT',
        body: JSON.stringify({ titre: original })
      });
    });

    test('ENCADRANT modifiant l\'évaluation d\'un autre encadrant → 403', async () => {
      if (!evaluationInfo) return;
      const res = await authFetch('encadrantElec', `${BASE}/evaluations/${evaluationInfo.id}`, {
        method: 'PUT',
        body: JSON.stringify({ technique: 3 })
      });
      expect(res.status).toBe(403);
    });

    test('ENCADRANT supprimant la réunion d\'un autre encadrant → 403', async () => {
      if (!reunionElec) return;
      const res = await authFetch('encadrantInfo', `${BASE}/reunions/${reunionElec.id}`, {
        method: 'DELETE'
      });
      expect(res.status).toBe(403);
    });

    test('suppression d\'un stagiaire réservée au RH/ADMIN → 403 pour STAGIAIRE', async () => {
      if (!internInfo) return;
      const res = await authFetch('stagiaireInfo', `${BASE}/stagiaires/${internInfo.id}`, {
        method: 'DELETE'
      });
      expect(res.status).toBe(403);
    });
  });

  describe('accès ADMIN / RH (accès complet)', () => {
    test('ADMIN accède au profil d\'un autre stagiaire → 200', async () => {
      if (!internElec) return;
      const res = await authFetch('admin', `${BASE}/stagiaires/${internElec.id}`);
      expect(res.status).toBe(200);
    });

    test('RH accède au profil d\'un autre stagiaire → 200', async () => {
      if (!internElec) return;
      const res = await authFetch('rh', `${BASE}/stagiaires/${internElec.id}`);
      expect(res.status).toBe(200);
    });

    test('RH liste l\'ensemble des stages → 200', async () => {
      const res = await authFetch('rh', `${BASE}/stages`);
      expect(res.status).toBe(200);
      const stages = await res.json();
      expect(Array.isArray(stages)).toBe(true);
      expect(stages.length).toBeGreaterThan(0);
    });

    test('ADMIN modifie un stage hors de son périmètre → 200', async () => {
      if (!stageElec) return;
      const res = await authFetch('admin', `${BASE}/stages/${stageElec.id}`, {
        method: 'PUT',
        body: JSON.stringify({ statut: 'EN_COURS' })
      });
      expect(res.status).toBe(200);
    });
  });

  describe('documents (upload / lecture / suppression)', () => {
    let uploadedDoc = null;

    afterAll(async () => {
      if (uploadedDoc) {
        await authFetch('admin', `${BASE}/documents/${uploadedDoc.id}`, { method: 'DELETE' });
      }
    });

    test('upload par le stagiaire sur son stage → 201', async () => {
      if (!stageInfo) return;
      const res = await fetch(`${BASE}/stages/${stageInfo.id}/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await login('stagiaireInfo')}` },
        body: buildForm('CV')
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      uploadedDoc = data.document;
    });

    test('téléchargement du document par un autre stagiaire → 403', async () => {
      if (!uploadedDoc) return;
      const res = await authFetch('stagiaireElec', `${BASE}/documents/${uploadedDoc.id}/download`);
      expect(res.status).toBe(403);
    });

    test('téléchargement du document par un encadrant d\'un autre stage → 403', async () => {
      if (!uploadedDoc) return;
      const res = await authFetch('encadrantElec', `${BASE}/documents/${uploadedDoc.id}/download`);
      expect(res.status).toBe(403);
    });

    test('téléchargement par le stagiaire propriétaire → 200', async () => {
      if (!uploadedDoc) return;
      const res = await authFetch('stagiaireInfo', `${BASE}/documents/${uploadedDoc.id}/download`);
      expect(res.status).toBe(200);
    });

    test('téléchargement par l\'encadrant du stage → 200', async () => {
      if (!uploadedDoc) return;
      const res = await authFetch('encadrantInfo', `${BASE}/documents/${uploadedDoc.id}/download`);
      expect(res.status).toBe(200);
    });

    test('téléchargement par le chef du département → 200', async () => {
      if (!uploadedDoc) return;
      const res = await authFetch('chef', `${BASE}/documents/${uploadedDoc.id}/download`);
      expect(res.status).toBe(200);
    });

    test('téléchargement par un encadrant d\'un autre département de la liste d\'un stage étranger → 403', async () => {
      if (!stageElec || !stageInfo) return;
      const res = await authFetch('encadrantElec', `${BASE}/stages/${stageInfo.id}/documents`);
      expect(res.status).toBe(403);
    });
  });

  describe('pdfs (convention / attestation / évaluation)', () => {
    test('STAGIAIRE télécharge la convention de son stage → 200', async () => {
      if (!stageInfo) return;
      const res = await authFetch('stagiaireInfo', `${BASE}/stages/${stageInfo.id}/pdf/convention`);
      expect(res.status).toBe(200);
    });

    test('STAGIAIRE télécharge la convention d\'un autre stage → 403', async () => {
      if (!stageElec) return;
      const res = await authFetch('stagiaireInfo', `${BASE}/stages/${stageElec.id}/pdf/convention`);
      expect(res.status).toBe(403);
    });

    test('ENCADRANT télécharge l\'attestation d\'un stage étranger → 403', async () => {
      if (!stageElec) return;
      const res = await authFetch('encadrantInfo', `${BASE}/stages/${stageElec.id}/pdf/attestation`);
      expect(res.status).toBe(403);
    });

    test('CHEF_DEPARTEMENT télécharge l\'évaluation de son département → 200', async () => {
      if (!stageInfo) return;
      const res = await authFetch('chef', `${BASE}/stages/${stageInfo.id}/pdf/evaluation`);
      expect(res.status).toBe(200);
    });

    test('CHEF_DEPARTEMENT télécharge l\'évaluation d\'un autre département → 403', async () => {
      if (!stageElec) return;
      const res = await authFetch('chef', `${BASE}/stages/${stageElec.id}/pdf/evaluation`);
      expect(res.status).toBe(403);
    });
  });
});
