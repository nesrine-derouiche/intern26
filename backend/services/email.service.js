const logger = require('../utils/logger');
const emailConfig = require('../config/email');
const templates = require('./email-templates');

/**
 * Service d'envoi d'emails.
 *
 * - Les identifiants SMTP proviennent exclusivement des variables
 *   d'environnement MAIL_* (voir `backend/config/email.js`).
 * - Le transporteur est créé une seule fois au démarrage.
 * - En mode test (Jest) ou sans configuration SMTP, aucun appel réseau :
 *   le contenu est simplement journalisé.
 * - Un échec d'envoi est toujours capté et journalisé : il ne fait jamais
 *   échouer la logique métier appelante.
 */
class EmailService {
  frontendUrl() {
    return process.env.FRONTEND_URL || 'http://localhost:4200';
  }

  /**
   * Envoi générique d'un email.
   * Ne lève jamais : retourne `null` en cas d'échec ou de mode non réel.
   * Les échecs transitoires (SMTP lent/instable) sont réessayés
   * jusqu'à `maxAttempts` fois avant d'abandonner.
   *
   * `options.sensitive` (opt-in) masque le contenu (texte + HTML) de la
   * journalisation : indispensable pour les emails contenant des identifiants
   * (mot de passe temporaire) qui ne doivent JAMAIS apparaître en clair dans
   * les journaux.
   */
  async sendEmail({ to, subject, html, text }, maxAttempts = 3, options = {}) {
    if (!to) {
      logger.warn('[EMAIL] Destinataire manquant : envoi ignoré.');
      return null;
    }

    if (emailConfig.isTest || !emailConfig.isConfigured || !emailConfig.transporter) {
      const mode = emailConfig.isTest ? 'test' : 'non configuré (MAIL_*)';
      logger.info(`[EMAIL] (${mode}) À : ${to} — ${subject}`);
      if (text && !options.sensitive) logger.info(`[EMAIL] (${mode}) Contenu : ${text}`);
      if (html && !options.sensitive) logger.debug(`[EMAIL] (${mode}) HTML : ${html}`);
      return null;
    }

    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const info = await emailConfig.transporter.sendMail({ from: emailConfig.from, to, subject, html, text });
        logger.info(`[EMAIL] Envoyé à : ${to} — ${subject} (messageId: ${info.messageId})`);
        return info;
      } catch (err) {
        lastError = err;
        logger.error(
          `Échec de l'envoi de l'email (tentative ${attempt}/${maxAttempts}) :`,
          err.message
        );
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
    return null;
  }

  /**
   * Vérifie la connexion au serveur SMTP (appelée au démarrage du serveur).
   * Ne lève jamais.
   */
  async verifyTransporter() {
    if (emailConfig.isTest || !emailConfig.isConfigured || !emailConfig.transporter) {
      logger.warn(
        `[EMAIL] SMTP non configuré${emailConfig.isTest ? ' (mode test)' : ''} : les emails sont journalisés sans envoi réel.`
      );
      return false;
    }

    try {
      await emailConfig.transporter.verify();
      logger.info('[EMAIL] Transporteur SMTP vérifié avec succès.');
      return true;
    } catch (err) {
      logger.error('Échec de la vérification du transporteur SMTP :', err.message);
      return false;
    }
  }

  async sendVerificationEmail(to, token) {
    const lien = `${this.frontendUrl()}/verification-email?token=${encodeURIComponent(token)}`;
    await this.sendEmail({ to, ...templates.verification({ lien }) });
    return lien;
  }

  async sendPasswordResetEmail(to, token) {
    const lien = `${this.frontendUrl()}/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`;
    await this.sendEmail({ to, ...templates.passwordReset({ lien }) });
    return lien;
  }

  /** Email de confirmation après dépôt d'une candidature. */
  async sendCandidatureReceivedEmail(to, { nom, titreOffre }) {
    await this.sendEmail({ to, ...templates.applicationReceived({ nom, titreOffre }) });
  }

  /** Email informant le candidat du refus de sa candidature. */
  async sendApplicationRejectedEmail(to, { nom, titreOffre }) {
    await this.sendEmail({ to, ...templates.applicationRejected({ nom, titreOffre }) });
  }

  /** Email informant le candidat de sa présélection par le service RH. */
  async sendRhPreselectionEmail(to, { nom, titreOffre }) {
    await this.sendEmail({ to, ...templates.rhPreselection({ nom, titreOffre }) });
  }

  /**
   * Email annonçant au candidat que sa candidature a été acceptée pour
   * l'entretien IA, avec le lien dynamique pour commencer cet entretien.
   */
  async sendRhPreselectedEmail(to, { nom, titreOffre, lienEntretien }) {
    await this.sendEmail({ to, ...templates.rhPreselected({ nom, titreOffre, lienEntretien }) });
  }

  /** Email annonçant la réussite de l'entretien IA (éligible à un entretien humain). */
  async sendAiInterviewPassedEmail(to, { nom, titreOffre, score }) {
    await this.sendEmail({ to, ...templates.aiInterviewPassed({ nom, titreOffre, score }) });
  }

  /** Email informant le candidat de l'échec de son entretien IA. */
  async sendAiInterviewFailedEmail(to, { nom, titreOffre }) {
    await this.sendEmail({ to, ...templates.aiInterviewFailed({ nom, titreOffre }) });
  }

  /** Email d'invitation à un entretien. */
  async sendInterviewInvitationEmail(to, { nom, titreOffre, date, lieu, lienVisio }) {
    await this.sendEmail({
      to,
      ...templates.interviewInvitation({ nom, titreOffre, date, lieu, lienVisio })
    });
  }

  /** Email annonçant l'acceptation de la candidature (stage obtenu). */
  async sendInternshipAcceptedEmail(to, { nom, titreOffre, dateDebut }) {
    await this.sendEmail({ to, ...templates.internshipAccepted({ nom, titreOffre, dateDebut }) });
  }

  /** Email d'invitation à l'entretien humain planifié par le RH. */
  async sendHumanInterviewInvitationEmail(to, { nom, titreOffre, date, heure, interviewer, lienVisio }) {
    await this.sendEmail({
      to,
      ...templates.humanInterviewInvitation({ nom, titreOffre, date, heure, interviewer, lienVisio })
    });
  }

  /** Email de demande des documents requis après acceptation du stage. */
  async sendDocumentsRequestEmail(to, { nom, titreOffre, dateDebut, documents }) {
    await this.sendEmail({ to, ...templates.documentsRequest({ nom, titreOffre, dateDebut, documents }) });
  }

  /**
   * Email de rappel du jour J de l'entretien humain (déclenché automatiquement
   * par `services/human-interview-reminder.job.js`).
   *
   * Retourne `true` si l'envoi a réussi (réellement, ou en mode simulé quand le
   * SMTP n'est pas configuré / en mode test), `false` sinon. Le job ne marque
   * le rappel comme envoyé qu'en cas de succès afin de pouvoir réessayer plus
   * tard après un échec transitoire.
   */
  async sendHumanInterviewReminderEmail(to, { nom, titreOffre, date, heure, duree, interviewer, lienVisio }) {
    const result = await this.sendEmail({
      to,
      ...templates.humanInterviewReminder({ nom, titreOffre, date, heure, duree, interviewer, lienVisio })
    });
    if (emailConfig.isTest || !emailConfig.isConfigured) return true;
    return Boolean(result);
  }

  /** Email de bienvenue à la création d'un compte. */
  async sendWelcomeEmail(to, { prenom, nom }) {
    await this.sendEmail({ to, ...templates.welcome({ prenom, nom, lien: this.frontendUrl() }) });
  }

  /**
   * Email D-1 avec l'accès à l'application mobile (identifiant + mot de passe
   * temporaire). Déclenché par `services/mobile-access-email.job.js`.
   *
   * Retourne `true` si l'envoi a réussi (réellement, ou en mode simulé quand le
   * SMTP n'est pas configuré / en mode test), `false` sinon. Le job ne marque
   * l'email comme envoyé qu'en cas de succès afin de pouvoir réessayer plus
   * tard après un échec transitoire.
   *
   * Sécurité : le contenu (mot de passe) est marqué `sensitive` et n'est donc
   * JAMAIS journalisé en clair. Le lien de téléchargement vient de
   * `MOBILE_APP_DOWNLOAD_URL` (optionnel) : sans variable, la section
   * « Télécharger l'application » est omise de l'email.
   */
  async sendMobileAccessEmail(to, { nom, dateDebut, username, password, downloadUrl }) {
    const result = await this.sendEmail(
      { to, ...templates.mobileAccess({ nom, dateDebut, username, password, downloadUrl }) },
      3,
      { sensitive: true }
    );
    if (emailConfig.isTest || !emailConfig.isConfigured) return true;
    return Boolean(result);
  }
}

module.exports = new EmailService();
