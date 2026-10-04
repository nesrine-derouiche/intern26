const BASE = 'http://localhost:3000/api';
let adminToken = null;

async function login() {
  if (adminToken) return adminToken;
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@steg.tn', password: 'admin123' })
  });
  const data = await res.json();
  adminToken = data.token;
  return adminToken;
}

async function authFetch(url, options = {}) {
  const token = await login();
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
}

describe('Notifications API', () => {
  test('GET /api/notifications returns array for authenticated user', async () => {
    const res = await authFetch(`${BASE}/notifications`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/notifications returns 401 without token', async () => {
    const res = await fetch(`${BASE}/notifications`);
    expect(res.status).toBe(401);
  });

  test('PUT /api/notifications/:id/lire marks notification as read', async () => {
    const listRes = await authFetch(`${BASE}/notifications`);
    const notifs = await listRes.json();
    if (notifs.length > 0) {
      const n = notifs[0];
      const res = await authFetch(`${BASE}/notifications/${n.id}/lire`, { method: 'PUT' });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toContain('lue');
    }
  });

  test('PUT /api/notifications/lire-tout marks all as read', async () => {
    const res = await authFetch(`${BASE}/notifications/lire-tout`, { method: 'PUT' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toContain('lues');
  });

  test('GET /api/notifications?type= filters by notification type', async () => {
    const res = await authFetch(`${BASE}/notifications?type=REUNION,TACHE`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    data.forEach((n) => {
      expect(['REUNION', 'TACHE']).toContain(n.type);
    });
  });

  test('POST /api/notifications/device-token registers a token', async () => {
    const res = await authFetch(`${BASE}/notifications/device-token`, {
      method: 'POST',
      body: JSON.stringify({ token: 'test-token-123', platform: 'android' })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toContain('enregistré');
  });

  test('POST /api/notifications/device-token rejects empty token', async () => {
    const res = await authFetch(`${BASE}/notifications/device-token`, {
      method: 'POST',
      body: JSON.stringify({ token: '' })
    });
    expect(res.status).toBe(400);
  });

  test('DELETE /api/notifications/device-token removes a token', async () => {
    const res = await authFetch(`${BASE}/notifications/device-token`, {
      method: 'DELETE',
      body: JSON.stringify({ token: 'test-token-123' })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toContain('supprimé');
  });

  test('GET /api/dashboard/stats includes notificationsNonLues', async () => {
    const res = await authFetch(`${BASE}/dashboard/stats`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.notificationsNonLues).toBe('number');
  });

  test('GET /api/dashboard/stats exposes admin KPI fields', async () => {
    const res = await authFetch(`${BASE}/dashboard/stats`);
    const data = await res.json();
    ['stagiairesTotal', 'encadrantsTotal', 'departementsTotal', 'offresTotal', 'candidaturesTotal', 'stagesEnCours', 'stagesTermines', 'stagesSuspendus'].forEach((k) => {
      expect(typeof data[k]).toBe('number');
    });
  });

  test('GET /api/dashboard/stats exposes widgets, charts and alerts arrays', async () => {
    const res = await authFetch(`${BASE}/dashboard/stats`);
    const data = await res.json();
    expect(Array.isArray(data.recentCandidatures)).toBe(true);
    expect(Array.isArray(data.recentStages)).toBe(true);
    expect(Array.isArray(data.recentDocuments)).toBe(true);
    expect(Array.isArray(data.prochainesReunions)).toBe(true);
    expect(Array.isArray(data.recentNotifications)).toBe(true);
    expect(Array.isArray(data.applicationsParMois)).toBe(true);
    expect(Array.isArray(data.stagesParDepartement)).toBe(true);
    expect(Array.isArray(data.repartitionStatutsStages)).toBe(true);
    expect(Array.isArray(data.topEncadrants)).toBe(true);
    expect(data.alerts).toHaveProperty('stagesSeTerminantSous7Jours');
    expect(data.alerts).toHaveProperty('evaluationsManquantes');
    expect(data.alerts).toHaveProperty('rapportsEnAttente');
    expect(data.alerts).toHaveProperty('offresExpirantBientot');
    expect(data.alerts).toHaveProperty('documentsManquants');
    expect(data.alerts).toHaveProperty('entretiensAPrevoir');
    expect(data.alerts).toHaveProperty('stagesDemarrantCetteSemaine');
  });

  test('GET /api/dashboard/stats exposes RH (recruitment) fields', async () => {
    const res = await authFetch(`${BASE}/dashboard/stats`);
    const data = await res.json();
    expect(typeof data.candidaturesNouvelles).toBe('number');
    expect(Array.isArray(data.recentInternsAcceptes)).toBe(true);
    expect(Array.isArray(data.prochainsStages)).toBe(true);
    expect(Array.isArray(data.applicationsParDepartement)).toBe(true);
    expect(Array.isArray(data.offresParDepartement)).toBe(true);
    expect(Array.isArray(data.recrutementStatistiques)).toBe(true);
    data.applicationsParDepartement.forEach((r) => {
      expect(typeof r.departement).toBe('string');
      expect(typeof r.total).toBe('number');
    });
    data.recrutementStatistiques.forEach((r) => {
      expect(typeof r.statut).toBe('string');
      expect(typeof r.total).toBe('number');
    });
  });
});

describe('Tasks API', () => {
  test('GET /api/taches returns array', async () => {
    const res = await authFetch(`${BASE}/taches`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/taches returns tasks with required fields', async () => {
    const res = await authFetch(`${BASE}/taches`);
    const data = await res.json();
    if (data.length > 0) {
      const t = data[0];
      expect(t).toHaveProperty('id');
      expect(t).toHaveProperty('titre');
      expect(t).toHaveProperty('statut');
      expect(t).toHaveProperty('priorite');
      expect(t).toHaveProperty('executant_nom');
      expect(t).toHaveProperty('projet_titre');
    }
  });

  test('POST /api/taches returns 400 without required fields', async () => {
    const res = await authFetch(`${BASE}/taches`, {
      method: 'POST',
      body: JSON.stringify({ titre: '', projet_id: '', executant_id: '' })
    });
    expect(res.status).toBe(400);
  });

  test('PUT /api/taches/:id returns 404 for non-existent task', async () => {
    const res = await authFetch(`${BASE}/taches/00000000-0000-0000-0000-000000000000`, {
      method: 'PUT',
      body: JSON.stringify({ titre: 'Test' })
    });
    expect(res.status).toBe(404);
  });
});

describe('Stages API', () => {
  test('GET /api/stages returns array with stage details', async () => {
    const res = await authFetch(`${BASE}/stages`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      const s = data[0];
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('stagiaire_nom');
      expect(s).toHaveProperty('encadrant_nom');
      expect(s).toHaveProperty('departement_nom');
      expect(s).toHaveProperty('statut');
    }
  });

  test('PUT /api/stages/:id with invalid status returns 400', async () => {
    const res = await authFetch(`${BASE}/stages/1`, {
      method: 'PUT',
      body: JSON.stringify({ statut: 'INVALID_STATUS' })
    });
    expect(res.status).toBe(400);
  });

  test('PUT /api/stages/:id with valid status succeeds', async () => {
    const listRes = await authFetch(`${BASE}/stages`);
    const stages = await listRes.json();
    if (stages.length > 0) {
      const s = stages[0];
      const res = await authFetch(`${BASE}/stages/${s.id}`, {
        method: 'PUT',
        body: JSON.stringify({ statut: s.statut })
      });
      expect(res.status).toBe(200);
    }
  });

  test('GET /api/stages/:id/documents returns array', async () => {
    const listRes = await authFetch(`${BASE}/stages`);
    const stages = await listRes.json();
    if (stages.length > 0) {
      const res = await authFetch(`${BASE}/stages/${stages[0].id}/documents`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    }
  });
});

describe('Candidatures API', () => {
  test('GET /api/candidatures returns array', async () => {
    const res = await authFetch(`${BASE}/candidatures`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      const c = data[0];
      expect(c).toHaveProperty('id');
      expect(c).toHaveProperty('stagiaire_nom');
      expect(c).toHaveProperty('offre_titre');
      expect(c).toHaveProperty('statut');
    }
  });

  test('POST /api/candidatures without fields returns 400', async () => {
    const res = await authFetch(`${BASE}/candidatures`, {
      method: 'POST',
      body: JSON.stringify({ stagiaire_id: '', offre_id: '' })
    });
    expect(res.status).toBe(400);
  });

  test('DELETE /api/candidatures/:id works for existing candidature', async () => {
    const listRes = await authFetch(`${BASE}/candidatures`);
    const cands = await listRes.json();
    if (cands.length > 0) {
      const c = cands[cands.length - 1];
      const res = await authFetch(`${BASE}/candidatures/${c.id}`, { method: 'DELETE' });
      expect(res.status).toBe(200);
    }
  });
});

describe('Evaluations API', () => {
  test('GET /api/evaluations returns array', async () => {
    const res = await authFetch(`${BASE}/evaluations`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      const e = data[0];
      expect(e).toHaveProperty('id');
      expect(e).toHaveProperty('stagiaire_nom');
      expect(e).toHaveProperty('note_finale');
      expect(e).toHaveProperty('technique');
    }
  });

  test('GET /api/evaluations without auth returns 401', async () => {
    const res = await fetch(`${BASE}/evaluations`);
    expect(res.status).toBe(401);
  });

  test('POST /api/evaluations without stage_id returns 403 for admin', async () => {
    const res = await authFetch(`${BASE}/evaluations`, {
      method: 'POST',
      body: JSON.stringify({ stage_id: '', technique: 15 })
    });
    expect(res.status).toBe(403);
  });
});

describe('Search API', () => {
  test('GET /api/search?q=test returns results object', async () => {
    const res = await authFetch(`${BASE}/search?q=test`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('results');
    expect(data).toHaveProperty('query');
  });

  test('GET /api/search with type filter returns scoped results', async () => {
    const res = await authFetch(`${BASE}/search?q=&type=taches`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toHaveProperty('taches');
  });
});
