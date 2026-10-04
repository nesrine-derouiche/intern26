const emailService = require('../services/email.service');

describe('EmailService — API publique (mode test, aucun envoi réel)', () => {
  let sendSpy;
  let loggerSpy;

  beforeEach(() => {
    sendSpy = jest.spyOn(emailService, 'sendEmail').mockResolvedValue(null);
    loggerSpy = jest.spyOn(require('../utils/logger'), 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    sendSpy.mockRestore();
    loggerSpy.mockRestore();
  });

  test('sendCandidatureReceivedEmail : sujet et gabarit attendus', async () => {
    await emailService.sendCandidatureReceivedEmail('candidat@steg.tn', {
      nom: 'Marwa Sassi',
      titreOffre: 'Développeur Angular - Application interne'
    });

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const payload = sendSpy.mock.calls[0][0];
    expect(payload.to).toBe('candidat@steg.tn');
    expect(payload.subject).toBe('Votre candidature a bien été reçue');
    expect(payload.text).toContain('Bonjour Marwa Sassi,');
    expect(payload.text).toContain('Votre candidature pour l\'offre :');
    expect(payload.text).toContain('Développeur Angular - Application interne');
    expect(payload.text).toContain('a bien été enregistrée.');
    expect(payload.text).toContain('En attente de validation par le service RH.');
    expect(payload.html).toContain('Bonjour Marwa Sassi,');
    expect(payload.html).toContain('Développeur Angular - Application interne');
  });

  test('sendApplicationRejectedEmail : informe du refus', async () => {
    await emailService.sendApplicationRejectedEmail('candidat@steg.tn', {
      nom: 'Marwa Sassi',
      titreOffre: 'Développeur Angular'
    });

    const payload = sendSpy.mock.calls[0][0];
    expect(payload.subject).toBe('Votre candidature n\'a pas été retenue');
    expect(payload.text).toContain('n\'a pas été retenue.');
    expect(payload.html).toContain('Votre candidature n\'a pas été retenue');
  });

  test('sendRhPreselectionEmail : annonce la présélection', async () => {
    await emailService.sendRhPreselectionEmail('candidat@steg.tn', {
      nom: 'Marwa Sassi',
      titreOffre: 'Développeur Angular'
    });

    const payload = sendSpy.mock.calls[0][0];
    expect(payload.subject).toContain('présélectionné');
    expect(payload.html).toContain('présélectionné');
  });

  test('sendRhPreselectedEmail : sujet exact, lien d’entretien IA dynamique et gabarit attendu', async () => {
    await emailService.sendRhPreselectedEmail('candidat@steg.tn', {
      nom: 'Marwa Sassi',
      titreOffre: 'Développeur Angular',
      lienEntretien: 'http://localhost:4200/entretien-ia/cand-9'
    });

    const payload = sendSpy.mock.calls[0][0];
    expect(payload.to).toBe('candidat@steg.tn');
    expect(payload.subject).toBe('Votre candidature a été présélectionnée');
    expect(payload.text).toContain('Bonjour Marwa Sassi,');
    expect(payload.text).toContain('Nous avons le plaisir de vous informer que votre candidature pour l\'offre :');
    expect(payload.text).toContain('Développeur Angular');
    expect(payload.text).toContain('a été présélectionnée.');
    expect(payload.text).toContain('La prochaine étape est un entretien IA.');
    expect(payload.text).toContain('http://localhost:4200/entretien-ia/cand-9');
    expect(payload.text).toContain('Après validation de cet entretien, votre candidature sera examinée pour un entretien humain.');
    expect(payload.text).toContain('Cordialement,');
    expect(payload.text).toContain('STEG Internship Platform');
    expect(payload.html).toContain('http://localhost:4200/entretien-ia/cand-9');
    expect(payload.html).toContain('Commencer l\'entretien IA');
  });

  test('sendInterviewInvitationEmail : date et lieu sont interpolés', async () => {
    await emailService.sendInterviewInvitationEmail('candidat@steg.tn', {
      nom: 'Marwa Sassi',
      titreOffre: 'Développeur Angular',
      date: '15/09/2026 à 10h00',
      lieu: 'Siège STEG, Tunis'
    });

    const payload = sendSpy.mock.calls[0][0];
    expect(payload.subject).toBe('Invitation à un entretien');
    expect(payload.text).toContain('Date : 15/09/2026 à 10h00');
    expect(payload.text).toContain('Lieu : Siège STEG, Tunis');
    expect(payload.html).toContain('15/09/2026 à 10h00');
  });

  test('sendInterviewInvitationEmail : blocs conditionnels omis si absents', async () => {
    await emailService.sendInterviewInvitationEmail('candidat@steg.tn', {
      nom: 'Marwa Sassi',
      titreOffre: 'Développeur Angular',
      date: '15/09/2026 à 10h00'
    });

    const payload = sendSpy.mock.calls[0][0];
    expect(payload.text).not.toContain('Lieu :');
    expect(payload.text).not.toContain('Lien de visioconférence');
    expect(payload.html).not.toContain('Lien de visioconférence');
  });

  test('sendInternshipAcceptedEmail : annonce l’acceptation avec la date de début', async () => {
    await emailService.sendInternshipAcceptedEmail('stagiaire@steg.tn', {
      nom: 'Fatma Trabelsi',
      titreOffre: 'Technicien Réseau',
      dateDebut: '01/10/2026'
    });

    const payload = sendSpy.mock.calls[0][0];
    expect(payload.subject).toBe('Félicitations ! Votre candidature a été acceptée');
    expect(payload.text).toContain('a été acceptée.');
    expect(payload.text).toContain('débutera le 01/10/2026');
    expect(payload.html).toContain('01/10/2026');
  });

  test('sendWelcomeEmail : message de bienvenue personnalisé', async () => {
    await emailService.sendWelcomeEmail('candidat@steg.tn', {
      prenom: 'Marwa',
      nom: 'Sassi'
    });

    const payload = sendSpy.mock.calls[0][0];
    expect(payload.subject).toBe('Bienvenue sur STEG Internship');
    expect(payload.text).toContain('Bonjour Marwa Sassi,');
    expect(payload.html).toContain('Bienvenue, Marwa !');
  });

  test('les valeurs utilisateur sont échappées dans le HTML', async () => {
    await emailService.sendCandidatureReceivedEmail('candidat@steg.tn', {
      nom: 'Marwa <script>alert(1)</script>',
      titreOffre: 'Dev <b>& "X"</b>'
    });

    const payload = sendSpy.mock.calls[0][0];
    expect(payload.html).toContain('Marwa &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(payload.html).not.toContain('<script>alert(1)</script>');
    expect(payload.html).toContain('&lt;b&gt;&amp; &quot;X&quot;&lt;/b&gt;');
  });

  test('sendVerificationEmail : retourne le lien et envoie le bon sujet', async () => {
    const link = await emailService.sendVerificationEmail('candidat@steg.tn', 'tok-123');

    expect(link).toContain('/verification-email?token=tok-123');
    const payload = sendSpy.mock.calls[0][0];
    expect(payload.subject).toBe('Vérification de votre compte STEG Internship');
    expect(payload.text).toContain('/verification-email?token=tok-123');
  });

  test('sendPasswordResetEmail : retourne le lien et envoie le bon sujet', async () => {
    const link = await emailService.sendPasswordResetEmail('candidat@steg.tn', 'tok-456');

    expect(link).toContain('/reinitialiser-mot-de-passe?token=tok-456');
    const payload = sendSpy.mock.calls[0][0];
    expect(payload.subject).toBe('Réinitialisation de votre mot de passe STEG Internship');
  });

  test('sendHumanInterviewReminderEmail : sujet et contenu du rappel du jour J', async () => {
    await emailService.sendHumanInterviewReminderEmail('candidat@steg.tn', {
      nom: 'Marwa',
      titreOffre: 'Développeur Angular - Application interne',
      date: '20/09/2026',
      heure: '10:00',
      duree: '45 minutes',
      interviewer: 'Salma Bouazizi',
      lienVisio: 'https://meet.steg.tn/rappel'
    });

    const payload = sendSpy.mock.calls[0][0];
    expect(payload.to).toBe('candidat@steg.tn');
    expect(payload.subject).toBe('Reminder — Your STEG human interview is today');
    expect(payload.text).toContain('Hello Marwa,');
    expect(payload.text).toContain('scheduled for today');
    expect(payload.text).toContain('Développeur Angular - Application interne');
    expect(payload.text).toContain('Date: 20/09/2026');
    expect(payload.text).toContain('Time: 10:00');
    expect(payload.text).toContain('Duration: 45 minutes');
    expect(payload.text).toContain('Interviewer:');
    expect(payload.text).toContain('Salma Bouazizi');
    expect(payload.text).toContain('Join the interview:');
    expect(payload.text).toContain('https://meet.steg.tn/rappel');
    expect(payload.text).toContain('Best regards,');
    expect(payload.html).toContain('Your human interview is today');
    expect(payload.html).toContain('Hello Marwa,');
  });

  test('sendMobileAccessEmail : identifiant, mot de passe, date, instructions, sécurité', async () => {
    await emailService.sendMobileAccessEmail('candidat@steg.tn', {
      nom: 'Marwa Sassi',
      dateDebut: '16/08/2026',
      username: 'candidat@steg.tn',
      password: 'Ab1!xYz9kLmNop',
      downloadUrl: 'https://play.google.com/store/apps/details?id=steg.tn.app'
    });

    const payload = sendSpy.mock.calls[0][0];
    expect(payload.to).toBe('candidat@steg.tn');
    expect(payload.subject).toBe('Votre accès à l\'application STEG Internship');
    expect(payload.text).toContain('Bonjour Marwa Sassi,');
    expect(payload.text).toContain('Votre stage débutera le 16/08/2026.');
    expect(payload.text).toContain('Identifiant :');
    expect(payload.text).toContain('candidat@steg.tn');
    expect(payload.text).toContain('Mot de passe temporaire :');
    expect(payload.text).toContain('Ab1!xYz9kLmNop');
    expect(payload.text).toContain('Télécharger l\'application :');
    expect(payload.text).toContain('https://play.google.com/store/apps/details?id=steg.tn.app');
    expect(payload.text).toContain('Instructions :');
    expect(payload.text).toContain('1. Téléchargez l\'application.');
    expect(payload.text).toContain('4. Suivez les étapes demandées dans l\'application.');
    expect(payload.text).toContain('ne partagez jamais vos identifiants.');
    expect(payload.html).toContain('Ab1!xYz9kLmNop');
    expect(payload.html).toContain('Télécharger l\'application');
    expect(payload.html).toContain('https://play.google.com/store/apps/details?id=steg.tn.app');
  });

  test('sendMobileAccessEmail : section de téléchargement omise sans lien configuré', async () => {
    await emailService.sendMobileAccessEmail('candidat@steg.tn', {
      nom: 'Marwa Sassi',
      dateDebut: '16/08/2026',
      username: 'candidat@steg.tn',
      password: 'Ab1!xYz9kLmNop',
      downloadUrl: ''
    });

    const payload = sendSpy.mock.calls[0][0];
    expect(payload.text).not.toContain('Télécharger l\'application');
    expect(payload.html).not.toContain('Télécharger l\'application');
  });
});

describe('EmailService — mode test réel (NODE_ENV=test, transporteur désactivé)', () => {
  let loggerWarnSpy;
  let loggerInfoSpy;

  beforeEach(() => {
    loggerWarnSpy = jest.spyOn(require('../utils/logger'), 'warn').mockImplementation(() => {});
    loggerInfoSpy = jest.spyOn(require('../utils/logger'), 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    loggerWarnSpy.mockRestore();
    loggerInfoSpy.mockRestore();
  });

  test('sendEmail journalise sans tenter d’envoi ni lever d’erreur', async () => {
    const result = await emailService.sendEmail({
      to: 'candidat@steg.tn',
      subject: 'Sujet test',
      html: '<p>Bonjour</p>',
      text: 'Bonjour'
    });

    expect(result).toBeNull();
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('(test) À : candidat@steg.tn — Sujet test')
    );
  });

  test('sendEmail (sensitive) ne journalise JAMAIS le contenu (mot de passe)', async () => {
    const password = 'Ab1!xYz9kLmNop';
    await emailService.sendEmail(
      { to: 'candidat@steg.tn', subject: 'Accès mobile', text: `Mot de passe : ${password}` },
      3,
      { sensitive: true }
    );

    expect(loggerInfoSpy).not.toHaveBeenCalledWith(
      expect.stringContaining(password)
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('(test) À : candidat@steg.tn — Accès mobile')
    );
  });

  test('sendEmail ignore un destinataire manquant', async () => {
    const result = await emailService.sendEmail({ subject: 'Sujet', text: 'Contenu' });

    expect(result).toBeNull();
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Destinataire manquant')
    );
  });

  test('verifyTransporter ne lève pas en mode test', async () => {
    const ok = await emailService.verifyTransporter();
    expect(ok).toBe(false);
  });
});
