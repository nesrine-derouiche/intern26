const BASE = 'http://localhost:3000/api';

const USERS = {
  encadrantInfo: { email: 'ahmed.bensalah@steg.tn', password: 'encadrant123' },
  encadrantElec: { email: 'rachid.mansour@steg.tn', password: 'encadrant123' },
  stagiaireInfo: { email: 'fatma.trabelsi@steg.tn', password: 'stagiaire123' },
  stagiaireElec: { email: 'mohamed.bouchnak@steg.tn', password: 'stagiaire123' },
  admin: { email: 'admin@steg.tn', password: 'admin123' }
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

let stageInfoId = null;

async function findStageId() {
  if (stageInfoId) return stageInfoId;
  const res = await authFetch('stagiaireInfo', `${BASE}/dashboard/stats`);
  const data = await res.json();
  stageInfoId = data.recentStages[0].id;
  return stageInfoId;
}

function addWeeks(monday, n) {
  const date = new Date(`${monday}T00:00:00Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 7 * n))
    .toISOString()
    .slice(0, 10);
}

describe('Journals API', () => {
  let journalId = null;
  let week = null;

  beforeAll(async () => {
    const res = await authFetch('stagiaireInfo', `${BASE}/journals`);
    const data = await res.json();
    const existingWeeks = new Set(data.map((j) => j.semaine));
    for (let n = 0; n < 26; n++) {
      const candidate = addWeeks('2026-01-19', n);
      if (!existingWeeks.has(candidate)) {
        week = candidate;
        break;
      }
    }
    expect(week).not.toBeNull();
  });

  test('GET /journals returns 401 without token', async () => {
    const res = await fetch(`${BASE}/journals`);
    expect(res.status).toBe(401);
  });

  test('stagiaire can create a journal for an active stage week', async () => {
    const stageId = await findStageId();
    const res = await authFetch('stagiaireInfo', `${BASE}/journals`, {
      method: 'POST',
      body: JSON.stringify({
        stage_id: stageId,
        semaine: week,
        travaux: 'Développement du module des journaux',
        difficultes: 'Gestion des contraintes de validation',
        solutions: 'Revue de code avec l\'encadrant',
        competences: 'PostgreSQL, API REST',
        heures: 36,
        commentaire: 'Semaine productive'
      })
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.journal.statut).toBe('BROUILLON');
    expect(data.journal.semaine).toBe(week);
    expect(data.journal.heures).toBe(36);
    journalId = data.journal.id;
  });

  test('stagiaire cannot create a duplicate journal for the same week', async () => {
    const stageId = await findStageId();
    const res = await authFetch('stagiaireInfo', `${BASE}/journals`, {
      method: 'POST',
      body: JSON.stringify({
        stage_id: stageId,
        semaine: week,
        travaux: 'Doublon',
        heures: 20
      })
    });
    expect(res.status).toBe(400);
  });

  test('stagiaire cannot create a journal outside the stage period', async () => {
    const stageId = await findStageId();
    const res = await authFetch('stagiaireInfo', `${BASE}/journals`, {
      method: 'POST',
      body: JSON.stringify({
        stage_id: stageId,
        semaine: '2025-01-06',
        travaux: 'Hors période',
        heures: 10
      })
    });
    expect(res.status).toBe(400);
  });

  test('stagiaire can update a BROUILLON journal', async () => {
    const res = await authFetch('stagiaireInfo', `${BASE}/journals/${journalId}`, {
      method: 'PUT',
      body: JSON.stringify({
        travaux: 'Travaux mis à jour après révision',
        difficultes: 'Nouvelle difficulté',
        heures: 38
      })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.journal.travaux).toBe('Travaux mis à jour après révision');
    expect(data.journal.difficultes).toBe('Nouvelle difficulté');
    expect(data.journal.heures).toBe(38);
    expect(data.journal.statut).toBe('BROUILLON');
  });

  test('encadrant assigned to the stage sees the journal', async () => {
    const res = await authFetch('encadrantInfo', `${BASE}/journals`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const ids = data.map((j) => j.id);
    expect(ids).toContain(journalId);
  });

  test('stagiaire can submit the journal', async () => {
    const res = await authFetch('stagiaireInfo', `${BASE}/journals/${journalId}/soumettre`, {
      method: 'POST'
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.journal.statut).toBe('SOUMIS');
    expect(data.journal.date_soumission).toBeTruthy();
  });

  test('stagiaire cannot edit a submitted journal', async () => {
    const res = await authFetch('stagiaireInfo', `${BASE}/journals/${journalId}`, {
      method: 'PUT',
      body: JSON.stringify({ travaux: 'Modif interdite' })
    });
    expect(res.status).toBe(400);
  });

  test('stagiaire cannot resubmit an already submitted journal', async () => {
    const res = await authFetch('stagiaireInfo', `${BASE}/journals/${journalId}/soumettre`, {
      method: 'POST'
    });
    expect(res.status).toBe(400);
  });

  test('unrelated encadrant cannot validate the journal', async () => {
    const res = await authFetch('stagiaireElec', `${BASE}/journals`, {
      method: 'GET'
    });
    const data = await res.json();
    expect(data.map((j) => j.id)).not.toContain(journalId);

    const other = await authFetch('encadrantElec', `${BASE}/journals/${journalId}/valider`, {
      method: 'POST',
      body: JSON.stringify({ commentaire_encadrant: 'ok' })
    });
    expect(other.status).toBe(403);
  });

  test('assigned encadrant can reject the journal', async () => {
    const res = await authFetch('encadrantInfo', `${BASE}/journals/${journalId}/rejeter`, {
      method: 'POST',
      body: JSON.stringify({ commentaire_encadrant: 'Merci de détailler davantage les difficultés' })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.journal.statut).toBe('REJETE');
    expect(data.journal.commentaire_encadrant).toBe('Merci de détailler davantage les difficultés');
  });

  test('stagiaire can edit a REJETE journal', async () => {
    const res = await authFetch('stagiaireInfo', `${BASE}/journals/${journalId}`, {
      method: 'PUT',
      body: JSON.stringify({
        travaux: 'Travaux corrigés après rejet',
        difficultes: 'Difficultés détaillées comme demandé'
      })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.journal.travaux).toBe('Travaux corrigés après rejet');
    expect(data.journal.difficultes).toBe('Difficultés détaillées comme demandé');
    expect(data.journal.statut).toBe('REJETE');
  });

  test('stagiaire can resubmit a corrected REJETE journal', async () => {
    const res = await authFetch('stagiaireInfo', `${BASE}/journals/${journalId}/soumettre`, {
      method: 'POST'
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.journal.statut).toBe('SOUMIS');
  });

  test('assigned encadrant can validate the resubmitted journal', async () => {
    const res = await authFetch('encadrantInfo', `${BASE}/journals/${journalId}/valider`, {
      method: 'POST',
      body: JSON.stringify({ commentaire_encadrant: 'Très bon travail, validé' })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.journal.statut).toBe('VALIDE');
    expect(data.journal.commentaire_encadrant).toBe('Très bon travail, validé');
    expect(data.journal.date_validation).toBeTruthy();
  });

  test('stagiaire cannot edit a validated journal', async () => {
    const res = await authFetch('stagiaireInfo', `${BASE}/journals/${journalId}`, {
      method: 'PUT',
      body: JSON.stringify({ travaux: 'Modif interdite' })
    });
    expect(res.status).toBe(400);
  });

  test('GET /journals is paginated', async () => {
    const res = await authFetch('stagiaireInfo', `${BASE}/journals?page=1&limit=10`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.total).toBe('number');
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data[0].semaine).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('Journals API — delete and ownership', () => {
  let deleteJournalId = null;
  let deleteWeek = null;

  beforeAll(async () => {
    const res = await authFetch('stagiaireInfo', `${BASE}/journals`);
    const data = await res.json();
    const existingWeeks = new Set(data.map((j) => j.semaine));
    for (let n = 20; n <= 24; n++) {
      const candidate = addWeeks('2026-01-19', n);
      if (!existingWeeks.has(candidate)) {
        deleteWeek = candidate;
        break;
      }
    }
    expect(deleteWeek).not.toBeNull();
  });

  test('stagiaire can create and delete a BROUILLON journal', async () => {
    const stageId = await findStageId();
    const createRes = await authFetch('stagiaireInfo', `${BASE}/journals`, {
      method: 'POST',
      body: JSON.stringify({
        stage_id: stageId,
        semaine: deleteWeek,
        travaux: 'Journal à supprimer',
        heures: 10
      })
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    deleteJournalId = created.journal.id;

    const delRes = await authFetch('stagiaireInfo', `${BASE}/journals/${deleteJournalId}`, {
      method: 'DELETE'
    });
    expect(delRes.status).toBe(200);

    const getRes = await authFetch('stagiaireInfo', `${BASE}/journals?page=1&limit=200`);
    const listData = await getRes.json();
    const allIds = listData.data ? listData.data.map((j) => j.id) : listData.map((j) => j.id);
    expect(allIds).not.toContain(deleteJournalId);
  });

  test('stagiaire cannot delete a journal owned by another stagiaire', async () => {
    const res = await authFetch('stagiaireElec', `${BASE}/journals`);
    const data = await res.json();
    if (data.length > 0) {
      const otherId = data[0].id;
      const delRes = await authFetch('stagiaireInfo', `${BASE}/journals/${otherId}`, {
        method: 'DELETE'
      });
      expect(delRes.status).toBe(403);
    }
  });

  test('unrelated stagiaire cannot update another\'s journal', async () => {
    const res = await authFetch('stagiaireElec', `${BASE}/journals`);
    const data = await res.json();
    if (data.length > 0) {
      const otherId = data[0].id;
      const putRes = await authFetch('stagiaireInfo', `${BASE}/journals/${otherId}`, {
        method: 'PUT',
        body: JSON.stringify({ travaux: 'Vol' })
      });
      expect(putRes.status).toBe(403);
    }
  });
});
