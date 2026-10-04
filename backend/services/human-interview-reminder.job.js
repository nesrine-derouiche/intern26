const logger = require('../utils/logger');
const humanInterviewRepository = require('../repositories/human-interview.repository');
const emailService = require('./email.service');

/**
 * Rappel automatique de l'entretien humain le jour même (fuseau Africa/Tunis).
 *
 * Aucun planificateur (cron) n'existant dans le backend, cette tâche utilise
 * une simple boucle `setInterval` démarrée au lancement du serveur :
 *  - elle s'exécute immédiatement au démarrage puis toutes les
 *    `REMINDER_INTERVAL_MIN` minutes (5 par défaut) ;
 *  - elle ne sélectionne que les entretiens `PLANIFIE` à la date du jour dont
 *    le rappel n'a pas encore été envoyé ;
 *  - un envoi échoué n'est pas marqué « envoyé » : il sera retenté au prochain
 *    passage (aucun rappel en double n'est jamais émis grâce au flag).
 *
 * Désactivable via `REMINDER_JOB_ENABLED=false` (utile en dev pour ne pas
 * envoyer de vrais emails pendant les tests d'intégration).
 */
class HumanInterviewReminderJob {
  constructor() {
    this._timer = null;
    this._running = false;
  }

  /**
   * Un passage : envoie le rappel pour chaque entretien planifié aujourd'hui
   * dont le rappel n'a pas encore été émis. Retourne un résumé de l'exécution.
   */
  async run() {
    const date = this._tunisToday();
    const interviews = await humanInterviewRepository.findScheduledForDate(date);

    let sent = 0;
    for (const interview of interviews) {
      if (await this._sendReminder(interview)) sent += 1;
    }

    return { date, total: interviews.length, sent };
  }

  /**
   * Envoie le rappel d'un entretien et marque la ligne comme notifiée en cas
   * de succès. Ne marque JAMAIS sur échec (le prochain passage réessaiera).
   */
  async _sendReminder(interview) {
    try {
      if (!interview.candidat_email) {
        logger.warn(`[REMINDER] Entretien ${interview.interview_id} sans email candidat : rappel ignoré.`);
        return false;
      }

      const ok = await emailService.sendHumanInterviewReminderEmail(interview.candidat_email, {
        nom: interview.candidat_prenom || interview.candidat_nom || 'candidat',
        titreOffre: interview.offre_titre,
        date: this._formatDate(interview.date),
        heure: this._normalizeTime(interview.heure),
        duree: `${Number(interview.duree) || 0} minutes`,
        interviewer: interview.interviewer,
        lienVisio: interview.lien_visio
      });

      if (!ok) {
        logger.error(`[REMINDER] Échec de l'envoi du rappel pour l'entretien ${interview.interview_id} : non marqué, nouvel essai au prochain passage.`);
        return false;
      }

      await humanInterviewRepository.markReminderSent(interview.interview_id);
      logger.info(`[REMINDER] Rappel envoyé à ${interview.candidat_email} (entretien ${interview.interview_id}).`);
      return true;
    } catch (err) {
      logger.error(`[REMINDER] Erreur lors du rappel de l'entretien ${interview.interview_id} :`, err.message);
      return false;
    }
  }

  /**
   * Démarre la boucle périodique (une exécution immédiate puis toutes les
   * `REMINDER_INTERVAL_MIN` minutes). Sans effet si déjà démarré, en mode test
   * (Jest) ou si explicitement désactivé par `REMINDER_JOB_ENABLED=false`.
   */
  start() {
    if (this._timer) return;

    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      logger.warn('[REMINDER] Tâche périodique désactivée en mode test.');
      return;
    }
    if (process.env.REMINDER_JOB_ENABLED === 'false') {
      logger.warn('[REMINDER] Tâche périodique désactivée (REMINDER_JOB_ENABLED=false).');
      return;
    }

    const intervalMs = (Number(process.env.REMINDER_INTERVAL_MIN) || 5) * 60 * 1000;

    const tick = async () => {
      if (this._running) return;
      this._running = true;
      try {
        const summary = await this.run();
        logger.info(`[REMINDER] Exécution terminée : ${summary.sent}/${summary.total} rappel(s) envoyé(s) pour le ${summary.date}.`);
      } catch (err) {
        logger.error('[REMINDER] Échec de l\'exécution :', err.message);
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

  /** Heure HH:MM:SS (colonne TIME) → HH:MM. */
  _normalizeTime(value) {
    const s = String(value || '');
    return /^\d{2}:\d{2}:\d{2}$/.test(s) ? s.slice(0, 5) : s;
  }
}

module.exports = new HumanInterviewReminderJob();
