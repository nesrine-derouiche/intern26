jest.mock('../repositories/notification.repository', () => ({
  create: jest.fn()
}));

jest.mock('../repositories/utilisateur.repository', () => ({
  findIdsByRole: jest.fn()
}));

jest.mock('../services/push.service', () => ({
  sendToUser: jest.fn(() => Promise.resolve())
}));

const notificationService = require('../services/notification.service');
const notificationRepository = require('../repositories/notification.repository');
const utilisateurRepository = require('../repositories/utilisateur.repository');
const pushService = require('../services/push.service');
const logger = require('../utils/logger');

describe('NotificationService.notifyRoleBestEffort', () => {
  let loggerErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  test('notifie chaque utilisateur du rôle sans doublon', async () => {
    utilisateurRepository.findIdsByRole.mockResolvedValue(['rh-1', 'rh-2', 'rh-1', 'rh-3']);

    await notificationService.notifyRoleBestEffort('RH', 'Nouvelle candidature', 'Marwa a postulé', 'CANDIDATURE');

    expect(notificationRepository.create).toHaveBeenCalledTimes(3);
    expect(notificationRepository.create).toHaveBeenCalledWith('rh-1', 'Nouvelle candidature', 'Marwa a postulé', 'CANDIDATURE', null);
    expect(notificationRepository.create).toHaveBeenCalledWith('rh-2', 'Nouvelle candidature', 'Marwa a postulé', 'CANDIDATURE', null);
    expect(notificationRepository.create).toHaveBeenCalledWith('rh-3', 'Nouvelle candidature', 'Marwa a postulé', 'CANDIDATURE', null);
  });

  test('propage le lien vers la ressource concernée', async () => {
    utilisateurRepository.findIdsByRole.mockResolvedValue(['rh-1']);

    await notificationService.notifyRoleBestEffort(
      'RH',
      'Nouvelle candidature',
      'Marwa a postulé',
      'CANDIDATURE',
      '/candidatures/cand-42'
    );

    expect(notificationRepository.create).toHaveBeenCalledWith(
      'rh-1',
      'Nouvelle candidature',
      'Marwa a postulé',
      'CANDIDATURE',
      '/candidatures/cand-42'
    );
    expect(pushService.sendToUser).toHaveBeenCalledWith('rh-1', {
      title: 'Nouvelle candidature',
      body: 'Marwa a postulé',
      data: { type: 'CANDIDATURE', lien: '/candidatures/cand-42' }
    });
  });

  test('aucune notification quand aucun utilisateur du rôle n’existe', async () => {
    utilisateurRepository.findIdsByRole.mockResolvedValue([]);

    await notificationService.notifyRoleBestEffort('RH', 'titre', 'message', 'CANDIDATURE');

    expect(notificationRepository.create).not.toHaveBeenCalled();
  });

  test('un échec de lecture des utilisateurs est journalisé sans lever d’exception', async () => {
    utilisateurRepository.findIdsByRole.mockRejectedValue(new Error('connexion perdue'));

    await expect(notificationService.notifyRoleBestEffort('RH', 'titre', 'message', 'CANDIDATURE')).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('notification par rôle'), expect.any(Error));
  });

  test('un id manquant dans la liste est ignoré', async () => {
    utilisateurRepository.findIdsByRole.mockResolvedValue(['rh-1', null, '']);

    await notificationService.notifyRoleBestEffort('RH', 'titre', 'message', 'CANDIDATURE');

    expect(notificationRepository.create).toHaveBeenCalledTimes(1);
    expect(notificationRepository.create).toHaveBeenCalledWith('rh-1', 'titre', 'message', 'CANDIDATURE', null);
  });

  test('le push est déclenché une fois par utilisateur notifié', async () => {
    utilisateurRepository.findIdsByRole.mockResolvedValue(['rh-1', 'rh-2']);

    await notificationService.notifyRoleBestEffort('RH', 'Nouvelle candidature', 'message', 'CANDIDATURE');

    expect(pushService.sendToUser).toHaveBeenCalledTimes(2);
    expect(pushService.sendToUser).toHaveBeenCalledWith('rh-1', {
      title: 'Nouvelle candidature',
      body: 'message',
      data: { type: 'CANDIDATURE', lien: null }
    });
  });
});
