const BASE = 'http://localhost:3000/api';
let adminToken = null;
const originalPassword = 'stagiaire123';

async function loginAsAdmin() {
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

async function loginStagiaire(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email || 'fatma.trabelsi@steg.tn', password: password || originalPassword })
  });
  return { status: res.status, data: await res.json() };
}

async function authFetch(token, url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
}

describe('PUT /api/auth/profile — Profile Update', () => {
  let token;
  let userId;

  beforeAll(async () => {
    const res = await loginStagiaire();
    token = res.data.token;
    userId = res.data.user?.id;
  });

  test('1. Successful update of allowed fields', async () => {
    const res = await authFetch(token, `${BASE}/auth/profile`, {
      method: 'PUT',
      body: JSON.stringify({ nom: 'Trabelsi', prenom: 'Fatma', telephone: '55123456' })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toContain('succès');
    expect(data.user).toBeDefined();
    expect(data.user.nom).toBe('Trabelsi');
    expect(data.user.prenom).toBe('Fatma');
    expect(data.user.telephone).toBe('55123456');
    expect(data.user.id).toBe(userId);
  });

  test('2. Empty optional fields are accepted', async () => {
    const res = await authFetch(token, `${BASE}/auth/profile`, {
      method: 'PUT',
      body: JSON.stringify({ telephone: '', adresse: '' })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user).toBeDefined();
  });

  test('3. Attempt to modify role is silently dropped (no allowed fields → 400)', async () => {
    const res = await authFetch(token, `${BASE}/auth/profile`, {
      method: 'PUT',
      body: JSON.stringify({ role: 'ADMIN' })
    });
    expect(res.status).toBe(400);
  });

  test('4. Attempt to modify token_version is silently dropped (no allowed fields → 400)', async () => {
    const res = await authFetch(token, `${BASE}/auth/profile`, {
      method: 'PUT',
      body: JSON.stringify({ token_version: 999 })
    });
    expect(res.status).toBe(400);
  });

  test('5. Attempt to modify password through profile endpoint is dropped', async () => {
    const res = await authFetch(token, `${BASE}/auth/profile`, {
      method: 'PUT',
      body: JSON.stringify({ password: 'hacked123' })
    });
    expect(res.status).toBe(400);
  });

  test('6. Role value remains unchanged after profile update', async () => {
    const meRes = await authFetch(token, `${BASE}/auth/me`);
    const meData = await meRes.json();
    expect(meData.user.role).toBe('STAGIAIRE');
  });

  test('7. Sensitive fields are not returned', async () => {
    const res = await authFetch(token, `${BASE}/auth/profile`, {
      method: 'PUT',
      body: JSON.stringify({ nom: 'Trabelsi' })
    });
    const data = await res.json();
    expect(data.user.mot_de_passe).toBeUndefined();
    expect(data.user.token_version).toBeUndefined();
    expect(data.user.reset_token).toBeUndefined();
    expect(data.user.email_verification_token).toBeUndefined();
  });

  test('8. Unauthenticated request returns 401', async () => {
    const res = await fetch(`${BASE}/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: 'Test' })
    });
    expect(res.status).toBe(401);
  });

  test('9. Validation error for invalid field length', async () => {
    const res = await authFetch(token, `${BASE}/auth/profile`, {
      method: 'PUT',
      body: JSON.stringify({ nom: 'A'.repeat(101) })
    });
    expect(res.status).toBe(400);
  });

  test('10. No allowed fields to update returns 400', async () => {
    const res = await authFetch(token, `${BASE}/auth/profile`, {
      method: 'PUT',
      body: JSON.stringify({})
    });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/auth/change-password — Change Password', () => {
  const testPassword = 'TestPass123';

  test('11. Incorrect current password is rejected', async () => {
    const { data } = await loginStagiaire();
    const res = await authFetch(data.token, `${BASE}/auth/change-password`, {
      method: 'PUT',
      body: JSON.stringify({
        current_password: 'WrongPassword1',
        new_password: 'AnotherPass12',
        confirm_password: 'AnotherPass12'
      })
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toContain('incorrect');
  });

  test('12. Invalid new password (too short) is rejected', async () => {
    const { data } = await loginStagiaire();
    const res = await authFetch(data.token, `${BASE}/auth/change-password`, {
      method: 'PUT',
      body: JSON.stringify({
        current_password: originalPassword,
        new_password: 'weak',
        confirm_password: 'weak'
      })
    });
    expect(res.status).toBe(400);
  });

  test('13. Password confirmation mismatch is rejected', async () => {
    const { data } = await loginStagiaire();
    const res = await authFetch(data.token, `${BASE}/auth/change-password`, {
      method: 'PUT',
      body: JSON.stringify({
        current_password: originalPassword,
        new_password: 'NewPass123',
        confirm_password: 'DifferentPass1'
      })
    });
    expect(res.status).toBe(400);
  });

  test('14. Sensitive password values never appear in response', async () => {
    const { data } = await loginStagiaire();
    const res = await authFetch(data.token, `${BASE}/auth/change-password`, {
      method: 'PUT',
      body: JSON.stringify({
        current_password: 'anything',
        new_password: 'Anything1x',
        confirm_password: 'Anything1x'
      })
    });
    const text = await res.text();
    expect(text).not.toContain('mot_de_passe');
    expect(text).not.toContain('password_hash');
  });

  test('15. Unauthenticated request returns 401', async () => {
    const res = await fetch(`${BASE}/auth/change-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_password: 'x',
        new_password: 'Xxxxx1x',
        confirm_password: 'Xxxxx1x'
      })
    });
    expect(res.status).toBe(401);
  });

  test('16. Successful password change', async () => {
    const { data } = await loginStagiaire();
    const res = await authFetch(data.token, `${BASE}/auth/change-password`, {
      method: 'PUT',
      body: JSON.stringify({
        current_password: originalPassword,
        new_password: testPassword,
        confirm_password: testPassword
      })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain('succès');
  });

  test('17. New password works after login', async () => {
    const { status, data } = await loginStagiaire('fatma.trabelsi@steg.tn', testPassword);
    expect(status).toBe(200);
    expect(data.token).toBeDefined();
  });

  test('18. Old password no longer works', async () => {
    const { status } = await loginStagiaire('fatma.trabelsi@steg.tn', originalPassword);
    expect(status).toBe(401);
  });

  test('19. Old JWT is rejected because token_version changed', async () => {
    const { data } = await loginStagiaire('fatma.trabelsi@steg.tn', testPassword);
    const token = data.token;
    const restorePassword = 'Stagiaire123';
    const changeRes = await authFetch(token, `${BASE}/auth/change-password`, {
      method: 'PUT',
      body: JSON.stringify({
        current_password: testPassword,
        new_password: restorePassword,
        confirm_password: restorePassword
      })
    });
    expect(changeRes.status).toBe(200);
    const meRes = await authFetch(token, `${BASE}/auth/me`);
    expect(meRes.status).toBe(401);
  });

  test('20. Fresh login with restored password works', async () => {
    const { status, data } = await loginStagiaire('fatma.trabelsi@steg.tn', 'Stagiaire123');
    expect(status).toBe(200);
    expect(data.token).toBeDefined();
  });
});
