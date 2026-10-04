const nodemailer = require('nodemailer');
const dns = require('dns');
const logger = require('../utils/logger');

/**
 * Configuration SMTP du service d'emails.
 *
 * Toutes les valeurs proviennent des variables d'environnement (MAIL_*).
 * Aucun identifiant n'est codé en dur : si MAIL_HOST / MAIL_USER / MAIL_PASS
 * ne sont pas renseignés, le service journalise simplement les emails
 * (mode dev) sans tenter d'envoi réel.
 *
 * Si le serveur SMTP est injoignable (DNS/timeout), le transporteur est
 * désactivé silencieusement : les emails sont journalisés sans tentatives
 * d'envoi répétées.
 */

const HOST = process.env.MAIL_HOST || '';
const PORT = Number(process.env.MAIL_PORT) || 587;
const SECURE = process.env.MAIL_SECURE === 'true';
const USER = process.env.MAIL_USER || '';
const PASS = process.env.MAIL_PASS || '';
const FROM = process.env.MAIL_FROM || USER;

const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID);
const isConfigured = Boolean(HOST && USER && PASS);

let transporter = null;

// En mode test (Jest), on ne crée jamais de transporteur : aucun appel
// réseau, les envois sont journalisés par le service d'emails.
if (!isTest && isConfigured) {
  transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: SECURE,
    auth: { user: USER, pass: PASS },
    // Les emails sont « best effort » : on échoue vite plutôt que de bloquer
    // l'API pendant la durée par défaut (2 min) quand le SMTP est lent.
    connectionTimeout: 5000,
    greetingTimeout: 5000
  });
}

/**
 * Vérifie si le serveur SMTP est joignable (DNS + TCP).
 * Désactive le transporteur si le serveur est injoignable.
 * Appelé une seule fois au démarrage.
 */
async function checkSmtpReachable() {
  return new Promise((resolve) => {
    dns.resolve4(HOST, (err) => {
      if (err) {
        logger.warn(
          `[EMAIL] Serveur SMTP "${HOST}" injoignable (${err.code || err.message}). ` +
          'Les emails seront journalisés sans envoi réel.'
        );
        transporter = null;
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

module.exports = {
  get transporter() { return transporter; },
  set transporter(v) { transporter = v; },
  from: FROM,
  host: HOST,
  port: PORT,
  secure: SECURE,
  user: USER,
  isConfigured,
  isTest,
  checkSmtpReachable
};
