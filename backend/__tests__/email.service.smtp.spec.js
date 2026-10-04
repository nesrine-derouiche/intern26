jest.mock('../config/email', () => ({
  transporter: {
    sendMail: jest.fn(),
    verify: jest.fn()
  },
  from: '"STEG Internship" <test@steg.tn>',
  host: 'smtp.test.tn',
  port: 587,
  secure: false,
  user: 'test@steg.tn',
  isConfigured: true,
  isTest: false,
  checkSmtpReachable: jest.fn().mockResolvedValue(true)
}));

const emailService = require('../services/email.service');
const emailConfig = require('../config/email');
const logger = require('../utils/logger');

describe('EmailService — envoi réel via le transporteur SMTP (config simulée)', () => {
  let loggerInfoSpy;
  let loggerErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    loggerInfoSpy.mockRestore();
    loggerErrorSpy.mockRestore();
  });

  test('sendEmail transmet les bons paramètres au transporteur', async () => {
    emailConfig.transporter.sendMail.mockResolvedValue({ messageId: 'msg-123' });

    const result = await emailService.sendEmail({
      to: 'candidat@steg.tn',
      subject: 'Votre candidature a bien été reçue',
      html: '<p>Bonjour</p>',
      text: 'Bonjour'
    });

    expect(emailConfig.transporter.sendMail).toHaveBeenCalledWith({
      from: '"STEG Internship" <test@steg.tn>',
      to: 'candidat@steg.tn',
      subject: 'Votre candidature a bien été reçue',
      html: '<p>Bonjour</p>',
      text: 'Bonjour'
    });
    expect(result.messageId).toBe('msg-123');
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('Envoyé à : candidat@steg.tn')
    );
  });

  test('un échec d’envoi est capté et journalisé sans lever', async () => {
    emailConfig.transporter.sendMail.mockRejectedValue(new Error('SMTP indisponible'));

    const result = await emailService.sendEmail({
      to: 'candidat@steg.tn',
      subject: 'Sujet',
      text: 'Contenu'
    });

    expect(result).toBeNull();
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Échec de l\'envoi de l\'email'),
      'SMTP indisponible'
    );
  });

  test('verifyTransporter valide la connexion avec succès', async () => {
    emailConfig.transporter.verify.mockResolvedValue(true);

    const ok = await emailService.verifyTransporter();
    expect(ok).toBe(true);
    expect(emailConfig.transporter.verify).toHaveBeenCalledTimes(1);
  });

  test('verifyTransporter capte un échec de connexion sans lever', async () => {
    emailConfig.transporter.verify.mockRejectedValue(new Error('Connexion refusée'));

    const ok = await emailService.verifyTransporter();
    expect(ok).toBe(false);
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('vérification du transporteur SMTP'),
      'Connexion refusée'
    );
  });
});
