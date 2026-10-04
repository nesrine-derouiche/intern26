const logger = require('../utils/logger');
const candidatureRepository = require('../repositories/candidature.repository');
const authRepository = require('../repositories/auth.repository');
const emailService = require('./email.service');
const mobileCredentials = require('./mobile-credentials.service');

/**
 * Envoi automatique de l'email d'accès à l'application mobile (J-1 du stage).
 *
 * Déclenché après validation RH de la période de stage, pour les candidats
 * acceptés (HUMAN_INTERVIEW_ACCEPTED) ou convertis en stagiaires
 * (STAGIAIRE_CREATED). Aucun compte n'est créé ici : le candidat possède
 * déjà son compte `utilisateur` — seul son mot de passe est remplacé par un
 * mot de passe temporaire sécurisé, et ce UNIQUEMENT au moment de l'envoi
 * (son mot de passe habituel continue de fonctionner jusqu'à J-1).
 *
 * Aucun planificateur (cron) n'existant dans le backend, cette tâche utilise
 * une simple boucle `setInterval` démarrée au lancement du serveur :
 *  - elle s'exécute immédiatement au démarrage puis toutes les
 *    `MOBILE_ACCESS_JOB_INTERVAL_MIN` minutes (60 par défaut) ;
 *  - elle sélectionne les candidatures validées ou converties dont la date de
 *    début est passée de J-1 (ou est déjà atteinte) et dont l'email n'a pas
 *    été envoyé ;
 *  - le mot de passe temporaire est persisté CHIFFRÉ (AES-256-GCM) entre les
 *    passages : un échec d'envoi est retenté avec le MÊME mot de passe, et le
 *    hash bcrypt n'est posé qu'une seule fois (pas de changement à chaque essai) ;
 *  - un envoi réussi est marqué atomiquement (`mobile_access_email_sent_at`)
 *    et purge la version chiffrée du mot de passe.
 *
 * Désactivable via `MOBILE_ACCESS_JOB_ENABLED=false` (utile en dev pour ne pas
 * envoyer de vrais emails pendant les tests d'intégration).
 */
class MobileAccessEmailJob {
  constructor() {
    this._timer = null;
    this._running = false;
  }

  /**
   * Un passage : prépare et envoie l'email D-1 pour chaque candidature arrivée
   * à échéance. `asOf` (optionnel, YYYY-MM-DD) permet aux tests de simuler une
   * autre date que le jour réel. Retourne un résumé de l'exécution.
   */
  async run(asOf = null) {
    const date = asOf || this._tunisToday();
    const rows = await candidatureRepository.findCandidatesDueForMobileEmail(date);

    let sent = 0;
    for (const row of rows) {
      if (await this._sendAccess(row)) sent += 1;
    }

    return { date, total: rows.length, sent };
  }

  /**
   * Envoie l'email d'accès d'un candidat et marque la ligne comme servie en cas
   * de succès. Ne marque JAMAIS sur échec (le prochain passage réessaiera avec
   * le même mot de passe temporaire).
   */
  async _sendAccess(row) {
    try {
      if (!row.email || !row.utilisateur_id) {
        logger.warn(`[MOBILE-ACCESS] Candidature ${row.candidature_id} sans utilisateur/email : ignorée.`);
        return false;
      }

      const password = await this._ensurePassword(row);

      const ok = await emailService.sendMobileAccessEmail(row.email, {
        nom: [row.prenom, row.nom].filter(Boolean).join(' ') || 'candidat',
        dateDebut: this._formatDate(row.internship_start_date),
        username: row.email,
        password,
        downloadUrl: process.env.MOBILE_APP_DOWNLOAD_URL || ''
      });

      if (!ok) {
        await candidatureRepository.markMobileEmailError(
          row.candidature_id,
          'Échec de l\'envoi de l\'email d\'accès à l\'application mobile.'
        );
        logger.error(
          `[MOBILE-ACCESS] Échec de l'envoi pour la candidature ${row.candidature_id} : non marqué envoyé, nouvel essai au prochain passage.`
        );
        return false;
      }

      const marked = await candidatureRepository.markMobileEmailSent(row.candidature_id);
      if (!marked) return false;

      logger.info(`[MOBILE-ACCESS] Email d'accès envoyé à ${row.email} (candidature ${row.candidature_id}).`);
      return true;
    } catch (err) {
      await candidatureRepository.markMobileEmailError(
        row.candidature_id,
        `Erreur technique : ${String(err.message || 'inconnue').slice(0, 200)}`
      );
      logger.error(`[MOBILE-ACCESS] Erreur lors de l'envoi pour la candidature ${row.candidature_id} :`, err.message);
      return false;
    }
  }

  /**
   * Garantit un mot de passe temporaire STABLE pour une candidature : réutilise
   * la version chiffrée persistée si elle existe, sinon en génère un nouveau,
   * remplace le hash bcrypt du compte (une seule fois) et persiste la version
   * chiffrée pour les prochains essais.
   */
  async _ensurePassword(row) {
    if (row.mobile_access_credentials_encrypted) {
      return mobileCredentials.decryptSecret(row.mobile_access_credentials_encrypted);
    }

    const password = mobileCredentials.generateTemporaryPassword();
    const hash = await mobileCredentials.hashPassword(password);
    await authRepository.changePassword(row.utilisateur_id, hash);
    await candidatureRepository.setMobileCredentials(
      row.candidature_id,
      mobileCredentials.encryptSecret(password)
    );
    return password;
  }

  /**
   * Démarre la boucle périodique (une exécution immédiate puis toutes les
   * `MOBILE_ACCESS_JOB_INTERVAL_MIN` minutes). Sans effet si déjà démarré, en
   * mode test (Jest) ou si explicitement désactivé par
   * `MOBILE_ACCESS_JOB_ENABLED=false`.
   */
  start() {
    if (this._timer) return;

    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      logger.warn('[MOBILE-ACCESS] Tâche périodique désactivée en mode test.');
      return;
    }
    if (process.env.MOBILE_ACCESS_JOB_ENABLED === 'false') {
      logger.warn('[MOBILE-ACCESS] Tâche périodique désactivée (MOBILE_ACCESS_JOB_ENABLED=false).');
      return;
    }

    const intervalMs = (Number(process.env.MOBILE_ACCESS_JOB_INTERVAL_MIN) || 60) * 60 * 1000;

    const tick = async () => {
      if (this._running) return;
      this._running = true;
      try {
        const summary = await this.run();
        logger.info(
          `[MOBILE-ACCESS] Exécution terminée : ${summary.sent}/${summary.total} email(s) d'accès envoyé(s) au ${summary.date}.`
        );
      } catch (err) {
        logger.error('[MOBILE-ACCESS] Échec de l\'exécution :', err.message);
      } finally {
        this._running = false;
      }
    };

    tick();
    this._timer = setInterval(tick, intervalMs);
    if (this._timer.unref) this._timer.unref();
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  /** Date du jour (YYYY-MM-DD) dans le fuseau Africa/Tunis, jamais celui du serveur. */
  _tunisToday() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }));
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  /** Date (Date JS ou YYYY-MM-DD) → DD/MM/YYYY pour l'affichage dans l'email. */
  _formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    }
    return String(value);
  }
}

module.exports = new MobileAccessEmailJob();
