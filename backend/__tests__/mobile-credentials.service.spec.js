require('dotenv').config();
const mobileCredentials = require('../services/mobile-credentials.service');

describe('MobileCredentialsService — mot de passe temporaire et chiffrement', () => {
  test('mot de passe généré : longueur minimale et une classe de chaque (maj, min, chiffre, symbole)', () => {
    for (let i = 0; i < 50; i += 1) {
      const password = mobileCredentials.generateTemporaryPassword();
      expect(password.length).toBeGreaterThanOrEqual(8);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[^A-Za-z0-9]/);
    }
  });

  test('mot de passe généré : jamais identique deux fois (imprévisible)', () => {
    const seen = new Set();
    for (let i = 0; i < 50; i += 1) {
      seen.add(mobileCredentials.generateTemporaryPassword());
    }
    expect(seen.size).toBe(50);
  });

  test('mot de passe généré : ne contient jamais le nom, l\'email ou une date', () => {
    const context = ['marwa', 'marwa.sassi@steg.tn', '1990', '01/01/1990'];
    for (let i = 0; i < 50; i += 1) {
      const password = mobileCredentials.generateTemporaryPassword();
      for (const token of context) {
        expect(password.toLowerCase()).not.toContain(token);
      }
    }
  });

  test('hash bcrypt : stockable, vérifiable, jamais en clair', async () => {
    const password = mobileCredentials.generateTemporaryPassword();
    const hash = await mobileCredentials.hashPassword(password);
    expect(hash).not.toBe(password);
    expect(hash.startsWith('$2')).toBe(true);
    const bcrypt = require('bcrypt');
    expect(await bcrypt.compare(password, hash)).toBe(true);
  });

  test('chiffrement : round-trip AES-256-GCM restitue le secret', () => {
    const secret = mobileCredentials.generateTemporaryPassword();
    const encrypted = mobileCredentials.encryptSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(mobileCredentials.decryptSecret(encrypted)).toBe(secret);
  });

  test('chiffrement : deux chiffrements du même secret donnent des payloads différents (IV aléatoire)', () => {
    const secret = 'Temp!1234xYz';
    const a = mobileCredentials.encryptSecret(secret);
    const b = mobileCredentials.encryptSecret(secret);
    expect(a).not.toBe(b);
  });

  test('déchiffrement : payload invalide ou altéré → exception (tag AES invalide)', () => {
    const secret = 'Temp!1234xYz';
    const encrypted = mobileCredentials.encryptSecret(secret);
    expect(() => mobileCredentials.decryptSecret('pas-un-payload')).toThrow();
    const corrupted = encrypted.replace(encrypted.slice(0, 8), 'AAAAAAAA');
    expect(() => mobileCredentials.decryptSecret(corrupted)).toThrow();
  });
});
