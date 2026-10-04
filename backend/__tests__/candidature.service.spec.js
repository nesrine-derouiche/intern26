jest.mock('../config/db', () => ({ withTransaction: jest.fn() }));

jest.mock('../repositories/candidature.repository', () => ({
  findAll: jest.fn(),
  findByIdWithOffer: jest.fn(),
  findAiInterviewById: jest.fn(),
  findDetailsById: jest.fn(),
  findByStagiaireAndOffre: jest.fn(),
  findByCandidatAndOffre: jest.fn(),
  updateStatut: jest.fn(),
  updateStagiaire: jest.fn(),
  refuseOtherCandidatures: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
  findOfferIdsByCandidat: jest.fn(),
  decide: jest.fn(),
  insertDecisionAudit: jest.fn(),
  findDecisionsByCandidature: jest.fn()
}));

jest.mock('../repositories/candidature-document.repository', () => ({
  findByCandidatureId: jest.fn(),
  findByCandidatureIds: jest.fn(),
  findByCandidatureIdAndType: jest.fn(),
  upsert: jest.fn()
}));

jest.mock('../repositories/ai-interview.repository', () => ({
  findByCandidatureId: jest.fn(),
  findByToken: jest.fn(),
  create: jest.fn(),
  setStatus: jest.fn(),
  createQuestions: jest.fn(),
  getQuestions: jest.fn(),
  getAnswers: jest.fn(),
  upsertAnswer: jest.fn(),
  saveEvaluation: jest.fn(),
  countAnswers: jest.fn()
}));

jest.mock('../repositories/human-interview.repository', () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByCandidatureId: jest.fn(),
  update: jest.fn(),
  setStatus: jest.fn(),
  markCompleted: jest.fn()
}));

jest.mock('../repositories/cv_analyse.repository', () => ({
  create: jest.fn(),
  findByCandidat: jest.fn(),
  clearByCandidat: jest.fn(),
  updateResult: jest.fn()
}));

jest.mock('../repositories/encadrant.repository', () => ({
  findAvailableByDepartment: jest.fn(),
  findAnyAvailable: jest.fn()
}));

jest.mock('../repositories/offre.repository', () => ({
  findById: jest.fn(),
  findPublicById: jest.fn(),
  decrementPlaces: jest.fn()
}));

jest.mock('../repositories/stage.repository', () => ({
  createWithProject: jest.fn()
}));

jest.mock('../repositories/stagiaire.repository', () => ({
  existsById: jest.fn(),
  findById: jest.fn()
}));

jest.mock('../repositories/candidat.repository', () => ({
  existsById: jest.fn(),
  getProfile: jest.fn(),
  createStagiaire: jest.fn()
}));

jest.mock('../services/notification.service', () => ({
  notifyBestEffort: jest.fn(),
  notifyRoleBestEffort: jest.fn()
}));

jest.mock('../services/internship-conversion.service', () => ({
  internshipConversionService: {
    convertCandidatureToStagiaire: jest.fn()
  }
}));

jest.mock('../services/email.service', () => ({
  sendCandidatureReceivedEmail: jest.fn(),
  sendApplicationRejectedEmail: jest.fn(),
  sendInternshipAcceptedEmail: jest.fn(),
  sendRhPreselectionEmail: jest.fn(),
  sendRhPreselectedEmail: jest.fn(),
  sendAiInterviewPassedEmail: jest.fn(),
  sendAiInterviewFailedEmail: jest.fn(),
  sendHumanInterviewInvitationEmail: jest.fn(),
  sendDocumentsRequestEmail: jest.fn(),
  frontendUrl: jest.fn(() => 'http://localhost:4200')
}));

const candidatureService = require('../services/candidature.service');
const candidatureRepository = require('../repositories/candidature.repository');
const aiInterviewRepository = require('../repositories/ai-interview.repository');
const humanInterviewRepository = require('../repositories/human-interview.repository');
const candidatRepository = require('../repositories/candidat.repository');
const stagiaireRepository = require('../repositories/stagiaire.repository');
const offreRepository = require('../repositories/offre.repository');
const emailService = require('../services/email.service');
const notificationService = require('../services/notification.service');
const stageRepository = require('../repositories/stage.repository');
const db = require('../config/db');
const logger = require('../utils/logger');
const { internshipConversionService } = require('../services/internship-conversion.service');

const OFFRE = { id: 'offre-1', statut: 'OUVERTE', nombre_places: 2 };

describe('CandidatureService.createCandidature — email de confirmation', () => {
  let loggerErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    offreRepository.findById.mockResolvedValue(OFFRE);
    candidatureRepository.findByCandidatAndOffre.mockResolvedValue(null);
    candidatureRepository.findByStagiaireAndOffre.mockResolvedValue(null);
    emailService.sendCandidatureReceivedEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  test('candidat : crée la candidature EN_ATTENTE puis envoie l’email de confirmation', async () => {
    const created = {
      id: 'cand-1',
      stagiaire_id: null,
      candidat_id: 'candidat-1',
      offre_id: 'offre-1',
      statut: 'EN_ATTENTE'
    };
    candidatRepository.existsById.mockResolvedValue({ id: 'candidat-1' });
    candidatureRepository.create.mockResolvedValue(created);
    candidatureRepository.findByIdWithOffer.mockResolvedValue({
      id: 'cand-1',
      offre_titre: 'Développeur Angular - Application interne'
    });
    candidatRepository.getProfile.mockResolvedValue({
      id: 'candidat-1',
      nom: 'Sassi',
      prenom: 'Marwa',
      email: 'candidat@steg.tn'
    });

    const result = await candidatureService.createCandidature(
      { offre_id: 'offre-1' },
      { role: 'CANDIDAT', id: 'candidat-1' }
    );

    expect(result).toEqual(created);
    expect(result.statut).toBe('EN_ATTENTE');
    expect(candidatureRepository.create).toHaveBeenCalledWith(null, 'offre-1', 'candidat-1');
    expect(emailService.sendCandidatureReceivedEmail).toHaveBeenCalledWith('candidat@steg.tn', {
      nom: 'Marwa Sassi',
      titreOffre: 'Développeur Angular - Application interne'
    });
    expect(notificationService.notifyRoleBestEffort).toHaveBeenCalledWith(
      'RH',
      'Nouvelle candidature',
      "Marwa Sassi a postulé à l'offre Développeur Angular - Application interne",
      'CANDIDATURE',
      '/candidatures/cand-1'
    );
  });

  test('stagiaire : la candidature est créée et l’email part vers le stagiaire', async () => {
    const created = {
      id: 'cand-2',
      stagiaire_id: 'stag-1',
      candidat_id: null,
      offre_id: 'offre-1',
      statut: 'EN_ATTENTE'
    };
    stagiaireRepository.existsById.mockResolvedValue({ id: 'stag-1' });
    candidatureRepository.create.mockResolvedValue(created);
    candidatureRepository.findByIdWithOffer.mockResolvedValue({
      id: 'cand-2',
      offre_titre: 'Technicien Réseau'
    });
    stagiaireRepository.findById.mockResolvedValue({
      id: 'stag-1',
      nom: 'Trabelsi',
      prenom: 'Fatma',
      email: 'fatma.trabelsi@steg.tn'
    });

    const result = await candidatureService.createCandidature(
      { stagiaire_id: 'stag-1', offre_id: 'offre-1' },
      { role: 'ADMIN', id: 'admin-1' }
    );

    expect(result.statut).toBe('EN_ATTENTE');
    expect(candidatureRepository.create).toHaveBeenCalledWith('stag-1', 'offre-1');
    expect(emailService.sendCandidatureReceivedEmail).toHaveBeenCalledWith('fatma.trabelsi@steg.tn', {
      nom: 'Fatma Trabelsi',
      titreOffre: 'Technicien Réseau'
    });
    expect(notificationService.notifyRoleBestEffort).toHaveBeenCalledWith(
      'RH',
      'Nouvelle candidature',
      "Fatma Trabelsi a postulé à l'offre Technicien Réseau",
      'CANDIDATURE',
      '/candidatures/cand-2'
    );
  });

  test('l’échec d’envoi de l’email ne bloque pas la création et est journalisé', async () => {
    const created = {
      id: 'cand-3',
      stagiaire_id: null,
      candidat_id: 'candidat-1',
      offre_id: 'offre-1',
      statut: 'EN_ATTENTE'
    };
    candidatRepository.existsById.mockResolvedValue({ id: 'candidat-1' });
    candidatureRepository.create.mockResolvedValue(created);
    candidatureRepository.findByIdWithOffer.mockResolvedValue({
      id: 'cand-3',
      offre_titre: 'Développeur Angular - Application interne'
    });
    candidatRepository.getProfile.mockResolvedValue({
      id: 'candidat-1',
      nom: 'Sassi',
      prenom: 'Marwa',
      email: 'candidat@steg.tn'
    });
    emailService.sendCandidatureReceivedEmail.mockRejectedValue(new Error('SMTP indisponible'));

    const result = await candidatureService.createCandidature(
      { offre_id: 'offre-1' },
      { role: 'CANDIDAT', id: 'candidat-1' }
    );

    expect(candidatureRepository.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual(created);
    expect(emailService.sendCandidatureReceivedEmail).toHaveBeenCalledTimes(1);
    expect(notificationService.notifyRoleBestEffort).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('email de confirmation'),
      'SMTP indisponible'
    );
  });

  test('l’absence de profil destinataire ne fait pas échouer la création', async () => {
    const created = {
      id: 'cand-4',
      stagiaire_id: null,
      candidat_id: 'candidat-1',
      offre_id: 'offre-1',
      statut: 'EN_ATTENTE'
    };
    candidatRepository.existsById.mockResolvedValue({ id: 'candidat-1' });
    candidatureRepository.create.mockResolvedValue(created);
    candidatureRepository.findByIdWithOffer.mockResolvedValue({
      id: 'cand-4',
      offre_titre: 'Développeur Angular - Application interne'
    });
    candidatRepository.getProfile.mockResolvedValue(null);

    const result = await candidatureService.createCandidature(
      { offre_id: 'offre-1' },
      { role: 'CANDIDAT', id: 'candidat-1' }
    );

    expect(result).toEqual(created);
    expect(emailService.sendCandidatureReceivedEmail).not.toHaveBeenCalled();
    expect(notificationService.notifyRoleBestEffort).not.toHaveBeenCalled();
  });
});

describe('CandidatureService.getMyAppliedOffers — offres déjà postulées', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('retourne les offres auxquelles le candidat a déjà postulé', async () => {
    candidatureRepository.findOfferIdsByCandidat.mockResolvedValue(['offre-1', 'offre-2']);

    const result = await candidatureService.getMyAppliedOffers({ id: 'candidat-1', role: 'CANDIDAT' });

    expect(candidatureRepository.findOfferIdsByCandidat).toHaveBeenCalledWith('candidat-1');
    expect(result).toEqual({ offre_ids: ['offre-1', 'offre-2'] });
  });

  test('retourne une liste vide pour un rôle autre que CANDIDAT', async () => {
    const result = await candidatureService.getMyAppliedOffers({ id: 'stag-1', role: 'STAGIAIRE' });

    expect(candidatureRepository.findOfferIdsByCandidat).not.toHaveBeenCalled();
    expect(result).toEqual({ offre_ids: [] });
  });
});

describe('CandidatureService — présélection pour entretien IA', () => {
  const CANDIDATURE = {
    id: 'cand-9',
    stagiaire_id: null,
    candidat_id: 'candidat-1',
    offre_id: 'offre-1',
    statut: 'EN_ATTENTE',
    offre_titre: 'Développeur Angular - Application interne'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    candidatureRepository.findByIdWithOffer.mockResolvedValue(CANDIDATURE);
    candidatureRepository.updateStatut.mockResolvedValue(undefined);
    candidatRepository.getProfile.mockResolvedValue({
      id: 'candidat-1',
      nom: 'Sassi',
      prenom: 'Marwa',
      email: 'candidat@steg.tn'
    });
    emailService.sendRhPreselectionEmail.mockResolvedValue(undefined);
  });

  test('RH : passe au statut EN_ENTRETIEN_IA, prévient le candidat, sans créer de stage', async () => {
    const result = await candidatureService.updateCandidatureStatut('cand-9', 'EN_ENTRETIEN_IA', 'RH');

    expect(result.message).toContain('présélectionnée');
    expect(candidatureRepository.updateStatut).toHaveBeenCalledWith('cand-9', 'EN_ENTRETIEN_IA');
    expect(stageRepository.createWithProject).not.toHaveBeenCalled();
    expect(notificationService.notifyBestEffort).toHaveBeenCalledWith(
      'candidat-1',
      'Candidature présélectionnée',
      expect.stringContaining('entretien IA'),
      'CANDIDATURE'
    );
    expect(emailService.sendRhPreselectionEmail).toHaveBeenCalledWith('candidat@steg.tn', {
      nom: 'Marwa Sassi',
      titreOffre: 'Développeur Angular - Application interne'
    });
  });

  test('un rôle non RH/ADMIN ne peut pas présélectionner une candidature', async () => {
    await expect(
      candidatureService.updateCandidatureStatut('cand-9', 'EN_ENTRETIEN_IA', 'STAGIAIRE')
    ).rejects.toThrow('Seul un RH ou un Administrateur');
    expect(candidatureRepository.updateStatut).not.toHaveBeenCalled();
  });

  test('une candidature déjà traitée ne peut pas être présélectionnée', async () => {
    candidatureRepository.findByIdWithOffer.mockResolvedValue({ ...CANDIDATURE, statut: 'REFUSEE' });

    await expect(
      candidatureService.updateCandidatureStatut('cand-9', 'EN_ENTRETIEN_IA', 'RH')
    ).rejects.toThrow('déjà été traitée');
    expect(candidatureRepository.updateStatut).not.toHaveBeenCalled();
  });
});

describe('CandidatureService — acceptation RH pour entretien IA (RH_ACCEPTED)', () => {
  const CANDIDATURE = {
    id: 'cand-9',
    stagiaire_id: null,
    candidat_id: 'candidat-1',
    offre_id: 'offre-1',
    statut: 'EN_ATTENTE',
    offre_titre: 'Développeur Angular - Application interne'
  };

  let loggerErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    candidatureRepository.findByIdWithOffer.mockResolvedValue(CANDIDATURE);
    candidatureRepository.updateStatut.mockResolvedValue(undefined);
    aiInterviewRepository.findByCandidatureId.mockResolvedValue(null);
    aiInterviewRepository.create.mockImplementation(async (_id, token) => ({ id: 'session-1', token }));
    candidatRepository.getProfile.mockResolvedValue({
      id: 'candidat-1',
      nom: 'Sassi',
      prenom: 'Marwa',
      email: 'candidat@steg.tn'
    });
    emailService.sendRhPreselectedEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  test('RH : passe au statut RH_ACCEPTED, crée une session sécurisée et notifie avec lien token', async () => {
    const result = await candidatureService.updateCandidatureStatut('cand-9', 'RH_ACCEPTED', 'RH');

    expect(result.message).toContain('acceptée pour l\'entretien IA');
    expect(candidatureRepository.updateStatut).toHaveBeenCalledWith('cand-9', 'RH_ACCEPTED');
    expect(aiInterviewRepository.findByCandidatureId).toHaveBeenCalledWith('cand-9');
    expect(aiInterviewRepository.create).toHaveBeenCalledWith('cand-9', expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(stageRepository.createWithProject).not.toHaveBeenCalled();

    const token = aiInterviewRepository.create.mock.calls[0][1];
    expect(notificationService.notifyBestEffort).toHaveBeenCalledWith(
      'candidat-1',
      'Candidature présélectionnée',
      expect.stringContaining('entretien IA'),
      'CANDIDATURE',
      `/entretien-ia/${token}`
    );
    expect(emailService.sendRhPreselectedEmail).toHaveBeenCalledWith('candidat@steg.tn', {
      nom: 'Marwa Sassi',
      titreOffre: 'Développeur Angular - Application interne',
      lienEntretien: `http://localhost:4200/entretien-ia/${token}`
    });
  });

  test('le lien de l’entretien IA est basé sur le token (jamais sur l’id interne)', async () => {
    await candidatureService.updateCandidatureStatut('cand-9', 'RH_ACCEPTED', 'RH');

    const token = aiInterviewRepository.create.mock.calls[0][1];
    const payload = emailService.sendRhPreselectedEmail.mock.calls[0][1];
    expect(payload.lienEntretien).toBe(`http://localhost:4200/entretien-ia/${token}`);
    expect(payload.lienEntretien).toMatch(/\/entretien-ia\/[a-f0-9]{64}$/);
    expect(payload.lienEntretien).not.toContain('cand-9');
    expect(emailService.frontendUrl).toHaveBeenCalled();
  });

  test('l’échec d’envoi de l’email ne révoque pas le statut RH_ACCEPTED', async () => {
    emailService.sendRhPreselectedEmail.mockRejectedValue(new Error('SMTP indisponible'));

    const result = await candidatureService.updateCandidatureStatut('cand-9', 'RH_ACCEPTED', 'RH');

    expect(candidatureRepository.updateStatut).toHaveBeenCalledWith('cand-9', 'RH_ACCEPTED');
    expect(result.message).toContain('acceptée pour l\'entretien IA');
    const token = aiInterviewRepository.create.mock.calls[0][1];
    expect(notificationService.notifyBestEffort).toHaveBeenCalledWith(
      'candidat-1',
      'Candidature présélectionnée',
      expect.stringContaining('entretien IA'),
      'CANDIDATURE',
      `/entretien-ia/${token}`
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('email de candidature'),
      'SMTP indisponible'
    );
  });

  test('un rôle non RH/ADMIN ne peut pas accepter pour entretien IA', async () => {
    await expect(
      candidatureService.updateCandidatureStatut('cand-9', 'RH_ACCEPTED', 'STAGIAIRE')
    ).rejects.toThrow('Seul un RH ou un Administrateur');
    expect(candidatureRepository.updateStatut).not.toHaveBeenCalled();
  });

  test('une candidature déjà traitée ne peut pas être acceptée pour entretien IA', async () => {
    candidatureRepository.findByIdWithOffer.mockResolvedValue({ ...CANDIDATURE, statut: 'REFUSEE' });

    await expect(
      candidatureService.updateCandidatureStatut('cand-9', 'RH_ACCEPTED', 'RH')
    ).rejects.toThrow('déjà été traitée');
    expect(candidatureRepository.updateStatut).not.toHaveBeenCalled();
  });
});

describe('CandidatureService.getCandidatureDetails — examen RH', () => {
  const DETAILS = {
    id: 'cand-10',
    stagiaire_id: null,
    candidat_id: 'candidat-1',
    offre_id: 'offre-1',
    date_candidature: '2026-08-09T10:00:00.000Z',
    statut: 'EN_ATTENTE',
    offre_titre: 'Développeur Angular - Application interne',
    departement_nom: 'Informatique',
    candidat_nom: 'Sassi',
    candidat_prenom: 'Marwa',
    candidat_email: 'candidat@steg.tn',
    candidat_telephone: '+216 20 111 111',
    stagiaire_nom: null,
    stagiaire_prenom: null,
    stagiaire_email: null,
    stagiaire_telephone: null,
    universite: 'ISET Rades',
    specialite: 'Genie Logiciel',
    niveau: 'Master',
    cv_path: '/var/opt/uploads/cv.pdf',
    cv_original_name: 'marwa-cv.pdf',
    cv_size: 2048,
    cv_uploaded_at: '2026-08-01T09:00:00.000Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    candidatureRepository.findDetailsById.mockResolvedValue(DETAILS);
    aiInterviewRepository.findByCandidatureId.mockResolvedValue(null);
    humanInterviewRepository.findByCandidatureId.mockResolvedValue(null);
    candidatureRepository.findDecisionsByCandidature.mockResolvedValue([]);
  });

  test('retourne les informations du candidat et de l’offre avec un lien CV', async () => {
    const result = await candidatureService.getCandidatureDetails('cand-10');

    expect(result.nom).toBe('Sassi');
    expect(result.prenom).toBe('Marwa');
    expect(result.email).toBe('candidat@steg.tn');
    expect(result.telephone).toBe('+216 20 111 111');
    expect(result.specialite).toBe('Genie Logiciel');
    expect(result.universite).toBe('ISET Rades');
    expect(result.offre_titre).toBe('Développeur Angular - Application interne');
    expect(result.statut).toBe('EN_ATTENTE');
    expect(result.cv).toEqual({
      filename: 'cv.pdf',
      originalName: 'marwa-cv.pdf',
      size: 2048,
      uploadedAt: '2026-08-01T09:00:00.000Z'
    });
    expect(result.cvUrl).toBe('/candidatures/cand-10/cv');
    expect(result.ai_interview).toBeNull();
    expect(result.human_interview).toBeNull();
  });

  test('enrichit les détails avec la session d’entretien IA et l’entretien humain', async () => {
    aiInterviewRepository.findByCandidatureId.mockResolvedValue({
      statut: 'TERMINE',
      evaluation_status: 'EVALUEE',
      evaluation: { score: 82, recommendation: 'FAVORABLE' },
      started_at: '2026-08-06T10:00:00.000Z',
      completed_at: '2026-08-06T10:30:00.000Z'
    });
    humanInterviewRepository.findByCandidatureId.mockResolvedValue({
      date: '2026-08-20',
      heure: '10:30:00',
      duree: 45,
      interviewer: 'Salma Bouazizi',
      interviewer_email: 'salma.bouazizi@steg.tn',
      lien_visio: 'https://meet.example.com/x',
      statut: 'PLANIFIE'
    });

    const result = await candidatureService.getCandidatureDetails('cand-10');

    expect(result.ai_interview).toEqual(expect.objectContaining({
      statut: 'TERMINE',
      evaluation_status: 'EVALUEE',
      evaluation: { score: 82, recommendation: 'FAVORABLE' },
      started_at: '2026-08-06T10:00:00.000Z',
      completed_at: '2026-08-06T10:30:00.000Z'
    }));
    expect(result.ai_interview.integrity.status).toBe('TERMINE');
    expect(result.ai_interview.integrity.events_count).toBe(0);
    expect(result.human_interview).toEqual({
      date: '2026-08-20',
      heure: '10:30:00',
      duree: 45,
      interviewer: 'Salma Bouazizi',
      interviewer_email: 'salma.bouazizi@steg.tn',
      lien_visio: 'https://meet.example.com/x',
      statut: 'PLANIFIE',
      completed_at: null,
      completed_by: null
    });
  });

  test('cvUrl est null quand le candidat n’a pas déposé de CV', async () => {
    candidatureRepository.findDetailsById.mockResolvedValue({ ...DETAILS, cv_path: null, cv_original_name: null });

    const result = await candidatureService.getCandidatureDetails('cand-10');
    expect(result.cv).toBeNull();
    expect(result.cvUrl).toBeNull();
  });

  test('expose la décision finale et son historique', async () => {
    candidatureRepository.findDetailsById.mockResolvedValue({
      ...DETAILS,
      statut: 'HUMAN_INTERVIEW_ACCEPTED',
      decision: 'ACCEPTED',
      decided_by: 'rh-1',
      decided_at: '2026-09-10T12:00:00.000Z'
    });
    candidatureRepository.findDecisionsByCandidature.mockResolvedValue([
      {
        id: 'audit-1',
        decision: 'ACCEPTED',
        action: null,
        decided_by: 'rh-1',
        decided_at: '2026-09-10T12:00:00.000Z',
        previous_status: 'HUMAN_INTERVIEW_COMPLETED',
        new_status: 'HUMAN_INTERVIEW_ACCEPTED',
        internship_start_date: null,
        internship_duration_months: null,
        decided_by_nom: 'Bouazizi',
        decided_by_prenom: 'Salma'
      }
    ]);

    const result = await candidatureService.getCandidatureDetails('cand-10');
    expect(result.decision).toBe('ACCEPTED');
    expect(result.decided_by).toBe('rh-1');
    expect(result.decided_at).toBe('2026-09-10T12:00:00.000Z');
    expect(result.decision_history).toEqual([
      {
        id: 'audit-1',
        decision: 'ACCEPTED',
        action: null,
        document_id: null,
        decided_by: 'rh-1',
        decided_at: '2026-09-10T12:00:00.000Z',
        previous_status: 'HUMAN_INTERVIEW_COMPLETED',
        new_status: 'HUMAN_INTERVIEW_ACCEPTED',
        internship_start_date: null,
        internship_duration_months: null,
        decided_by_name: 'Salma Bouazizi'
      }
    ]);
  });

  test('lève 404 quand la candidature n’existe pas', async () => {
    candidatureRepository.findDetailsById.mockResolvedValue(null);

    await expect(candidatureService.getCandidatureDetails('inconnu')).rejects.toThrow('introuvable');
  });

  test('CANDIDAT propriétaire accède à sa candidature', async () => {
    const candidat = { id: 'candidat-1', role: 'CANDIDAT' };
    const result = await candidatureService.getCandidatureDetails('cand-10', candidat);
    expect(result.id).toBe('cand-10');
    expect(result.candidat_id).toBe('candidat-1');
  });

  test('CANDIDAT ne peut pas consulter la candidature d\'un autre (403)', async () => {
    const intrus = { id: 'candidat-99', role: 'CANDIDAT' };
    await expect(candidatureService.getCandidatureDetails('cand-10', intrus))
      .rejects.toThrow('cette candidature ne vous appartient pas');
  });

  test('RH peut consulter n\'importe quelle candidature', async () => {
    const rh = { id: 'rh-1', role: 'RH' };
    const result = await candidatureService.getCandidatureDetails('cand-10', rh);
    expect(result.id).toBe('cand-10');
  });

  test('ADMIN peut consulter n\'importe quelle candidature', async () => {
    const admin = { id: 'admin-1', role: 'ADMIN' };
    const result = await candidatureService.getCandidatureDetails('cand-10', admin);
    expect(result.id).toBe('cand-10');
  });

  test('sans currentUser (appel interne) le contrôle est ignoré', async () => {
    const result = await candidatureService.getCandidatureDetails('cand-10');
    expect(result.id).toBe('cand-10');
  });

  test('getCandidatureCvFile renvoie le fichier du CV du candidat', async () => {
    const fs = require('fs');
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    try {
      const { filePath, filename } = await candidatureService.getCandidatureCvFile('cand-10');
      expect(filePath).toBe('/var/opt/uploads/cv.pdf');
      expect(filename).toBe('marwa-cv.pdf');
    } finally {
      existsSpy.mockRestore();
    }
  });

  test('getCandidatureCvFile lève 404 sans CV', async () => {
    candidatureRepository.findDetailsById.mockResolvedValue({ ...DETAILS, cv_path: null });

    await expect(candidatureService.getCandidatureCvFile('cand-10')).rejects.toThrow('CV introuvable');
  });

  test('getCandidatureCvFile refuse l\'accès à un candidat étranger (403)', async () => {
    const intrus = { id: 'candidat-99', role: 'CANDIDAT' };
    const fs = require('fs');
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    try {
      await expect(candidatureService.getCandidatureCvFile('cand-10', intrus))
        .rejects.toThrow('cette candidature ne vous appartient pas');
    } finally {
      existsSpy.mockRestore();
    }
  });
});

describe('CandidatureService.getAiInterview — entretien IA (portail candidat)', () => {
  const AI_ROW = {
    id: 'cand-20',
    candidat_id: 'candidat-9',
    statut: 'RH_ACCEPTED',
    date_candidature: '2026-08-05T10:00:00.000Z',
    offre_id: 'offre-3',
    offre_titre: 'Ingénieur Réseaux',
    departement_nom: 'Réseaux',
    candidat_nom: 'Sassi',
    candidat_prenom: 'Marwa'
  };
  const USER = { id: 'candidat-9', role: 'CANDIDAT' };

  beforeEach(() => {
    jest.clearAllMocks();
    candidatureRepository.findAiInterviewById.mockResolvedValue(AI_ROW);
  });

  test('renvoie l’entretien IA au candidat propriétaire', async () => {
    const result = await candidatureService.getAiInterview('cand-20', USER);
    expect(result.id).toBe('cand-20');
    expect(result.statut).toBe('RH_ACCEPTED');
    expect(result.candidat).toEqual({ prenom: 'Marwa', nom: 'Sassi' });
    expect(result.offre).toEqual({ id: 'offre-3', titre: 'Ingénieur Réseaux', departement_nom: 'Réseaux' });
  });

  test('lève 404 quand l’entretien n’existe pas', async () => {
    candidatureRepository.findAiInterviewById.mockResolvedValue(null);
    await expect(candidatureService.getAiInterview('inconnu', USER)).rejects.toThrow('Entretien IA introuvable');
    await expect(candidatureService.getAiInterview('inconnu', USER)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('lève 404 quand la candidature n’est pas en attente d’entretien IA', async () => {
    candidatureRepository.findAiInterviewById.mockResolvedValue({ ...AI_ROW, statut: 'EN_ATTENTE' });
    await expect(candidatureService.getAiInterview('cand-20', USER)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('lève 403 quand le candidat connecté n’est pas l’auteur', async () => {
    await expect(
      candidatureService.getAiInterview('cand-20', { id: 'autre-candidat', role: 'CANDIDAT' })
    ).rejects.toThrow('Accès refusé');
    await expect(
      candidatureService.getAiInterview('cand-20', { id: 'autre-candidat', role: 'CANDIDAT' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test('lève 403 quand la candidature n’a pas de candidat portail', async () => {
    candidatureRepository.findAiInterviewById.mockResolvedValue({ ...AI_ROW, candidat_id: null });
    await expect(candidatureService.getAiInterview('cand-20', USER)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('CandidatureService.submitAiInterviewResult — résultat d’entretien IA', () => {
  const RH = { id: 'rh-1', role: 'RH' };
  const ADMIN = { id: 'admin-1', role: 'ADMIN' };
  const CAND = { id: 'cand-1', role: 'CANDIDAT' };
  let loggerErrorSpy;

  const ROW = {
    id: 'cand-30',
    stagiaire_id: null,
    candidat_id: 'candidat-9',
    offre_id: 'offre-3',
    date_candidature: '2026-08-05T10:00:00.000Z',
    statut: 'RH_ACCEPTED',
    offre_titre: 'Ingénieur Réseaux',
    departement_id: 'dep-1',
    duree: 12
  };

  beforeEach(() => {
    jest.clearAllMocks();
    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    candidatureRepository.findByIdWithOffer.mockResolvedValue(ROW);
    candidatRepository.getProfile.mockResolvedValue({
      id: 'candidat-9',
      nom: 'Sassi',
      prenom: 'Marwa',
      email: 'candidat@steg.tn'
    });
    emailService.sendAiInterviewPassedEmail.mockResolvedValue(undefined);
    emailService.sendAiInterviewFailedEmail.mockResolvedValue(undefined);
    notificationService.notifyBestEffort.mockResolvedValue(undefined);
    notificationService.notifyRoleBestEffort.mockResolvedValue(undefined);
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  test('PASSED : statut AI_INTERVIEW_PASSED, notification RH et candidat, email, aucun stage', async () => {
    const result = await candidatureService.submitAiInterviewResult('cand-30', { score: 82, status: 'PASSED' }, RH);

    expect(result).toEqual({ id: 'cand-30', statut: 'AI_INTERVIEW_PASSED', score: 82 });
    expect(candidatureRepository.updateStatut).toHaveBeenCalledWith('cand-30', 'AI_INTERVIEW_PASSED');

    expect(notificationService.notifyRoleBestEffort).toHaveBeenCalledWith(
      'RH',
      'Entretien IA réussi',
      expect.stringContaining('Marwa Sassi'),
      'CANDIDATURE',
      '/candidatures/cand-30'
    );

    expect(notificationService.notifyBestEffort).toHaveBeenCalledWith(
      'candidat-9',
      'Entretien IA réussi',
      expect.stringContaining('éligible pour un entretien humain'),
      'CANDIDATURE',
      '/mon-profil'
    );

    expect(emailService.sendAiInterviewPassedEmail).toHaveBeenCalledWith('candidat@steg.tn', {
      nom: 'Marwa Sassi',
      titreOffre: 'Ingénieur Réseaux',
      score: 82
    });

    expect(stageRepository.createWithProject).not.toHaveBeenCalled();
    expect(candidatureRepository.create).not.toHaveBeenCalled();
  });

  test('FAILED : statut AI_INTERVIEW_FAILED, notification et email de rejet, aucun stage', async () => {
    const result = await candidatureService.submitAiInterviewResult('cand-30', { score: 31, status: 'FAILED' }, RH);

    expect(result).toEqual({ id: 'cand-30', statut: 'AI_INTERVIEW_FAILED', score: 31 });
    expect(candidatureRepository.updateStatut).toHaveBeenCalledWith('cand-30', 'AI_INTERVIEW_FAILED');

    expect(notificationService.notifyBestEffort).toHaveBeenCalledWith(
      'candidat-9',
      'Entretien IA non réussi',
      expect.stringContaining('n\'a pas abouti à une sélection'),
      'CANDIDATURE'
    );
    expect(emailService.sendAiInterviewFailedEmail).toHaveBeenCalledWith('candidat@steg.tn', {
      nom: 'Marwa Sassi',
      titreOffre: 'Ingénieur Réseaux'
    });

    expect(notificationService.notifyRoleBestEffort).not.toHaveBeenCalled();
    expect(stageRepository.createWithProject).not.toHaveBeenCalled();
  });

  test('un échec d’envoi d’email ne fait pas échouer la décision ni le statut', async () => {
    emailService.sendAiInterviewPassedEmail.mockRejectedValue(new Error('SMTP down'));
    const result = await candidatureService.submitAiInterviewResult('cand-30', { score: 90, status: 'PASSED' }, RH);
    expect(result.statut).toBe('AI_INTERVIEW_PASSED');
    expect(candidatureRepository.updateStatut).toHaveBeenCalledWith('cand-30', 'AI_INTERVIEW_PASSED');
  });

  test('lève 404 si la candidature n’existe pas', async () => {
    candidatureRepository.findByIdWithOffer.mockResolvedValue(null);
    await expect(
      candidatureService.submitAiInterviewResult('inconnu', { score: 80, status: 'PASSED' }, RH)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('lève 400 si la candidature n’est pas en attente d’un résultat (RH_ACCEPTED)', async () => {
    candidatureRepository.findByIdWithOffer.mockResolvedValue({ ...ROW, statut: 'EN_ENTRETIEN_IA' });
    await expect(
      candidatureService.submitAiInterviewResult('cand-30', { score: 80, status: 'PASSED' }, RH)
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(candidatureRepository.updateStatut).not.toHaveBeenCalled();
  });

  test('lève 400 si le statut du résultat est invalide', async () => {
    await expect(
      candidatureService.submitAiInterviewResult('cand-30', { score: 80, status: 'MAYBE' }, RH)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('lève 400 si le score est hors bornes ou non numérique', async () => {
    await expect(
      candidatureService.submitAiInterviewResult('cand-30', { score: 120, status: 'PASSED' }, RH)
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      candidatureService.submitAiInterviewResult('cand-30', { score: 'abc', status: 'PASSED' }, RH)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('lève 403 si l’appelant n’est ni RH ni ADMIN', async () => {
    await expect(
      candidatureService.submitAiInterviewResult('cand-30', { score: 80, status: 'PASSED' }, CAND)
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(candidatureRepository.updateStatut).not.toHaveBeenCalled();
  });

  test('ADMIN peut déclencher le résultat', async () => {
    const result = await candidatureService.submitAiInterviewResult('cand-30', { score: 88, status: 'PASSED' }, ADMIN);
    expect(result.statut).toBe('AI_INTERVIEW_PASSED');
  });
});

describe('CandidatureService.applyAiInterviewResult — fin d’entretien (sans rôle)', () => {
  const ROW = {
    id: 'cand-40',
    stagiaire_id: null,
    candidat_id: 'candidat-9',
    offre_id: 'offre-3',
    date_candidature: '2026-08-05T10:00:00.000Z',
    statut: 'RH_ACCEPTED',
    offre_titre: 'Ingénieur Réseaux',
    departement_id: 'dep-1',
    duree: 12
  };

  beforeEach(() => {
    jest.clearAllMocks();
    candidatureRepository.findByIdWithOffer.mockResolvedValue(ROW);
    candidatRepository.getProfile.mockResolvedValue({
      id: 'candidat-9',
      nom: 'Sassi',
      prenom: 'Marwa',
      email: 'candidat@steg.tn'
    });
    emailService.sendAiInterviewPassedEmail.mockResolvedValue(undefined);
    emailService.sendAiInterviewFailedEmail.mockResolvedValue(undefined);
  });

  test('PASSED : applique la décision sans exigence de rôle', async () => {
    const result = await candidatureService.applyAiInterviewResult('cand-40', { score: 80, status: 'PASSED' });

    expect(result).toEqual({ id: 'cand-40', statut: 'AI_INTERVIEW_PASSED', score: 80 });
    expect(candidatureRepository.updateStatut).toHaveBeenCalledWith('cand-40', 'AI_INTERVIEW_PASSED');
    expect(stageRepository.createWithProject).not.toHaveBeenCalled();
  });

  test('FAILED : applique la décision sans exigence de rôle', async () => {
    const result = await candidatureService.applyAiInterviewResult('cand-40', { score: 25, status: 'FAILED' });

    expect(result).toEqual({ id: 'cand-40', statut: 'AI_INTERVIEW_FAILED', score: 25 });
    expect(candidatureRepository.updateStatut).toHaveBeenCalledWith('cand-40', 'AI_INTERVIEW_FAILED');
  });

  test('lève 404 si la candidature n’existe pas', async () => {
    candidatureRepository.findByIdWithOffer.mockResolvedValue(null);
    await expect(
      candidatureService.applyAiInterviewResult('inconnu', { score: 80, status: 'PASSED' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('lève 400 si la candidature n’est plus en attente (RH_ACCEPTED)', async () => {
    candidatureRepository.findByIdWithOffer.mockResolvedValue({ ...ROW, statut: 'EN_ENTRETIEN_IA' });
    await expect(
      candidatureService.applyAiInterviewResult('cand-40', { score: 80, status: 'PASSED' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('CandidatureService.scheduleHumanInterview — planification RH', () => {
  const RH = { id: 'rh-1', role: 'RH' };
  const ROW = {
    id: 'cand-50',
    stagiaire_id: null,
    candidat_id: 'candidat-9',
    offre_id: 'offre-3',
    statut: 'AI_INTERVIEW_PASSED',
    offre_titre: 'Ingénieur Réseaux'
  };
  const VALID = {
    date: '2027-08-25',
    heure: '10:30',
    duree: 45,
    interviewer: 'Salma Bouazizi',
    interviewer_email: 'salma.bouazizi@steg.tn',
    lien_visio: 'https://teams.microsoft.com/l/meetup-join/abc'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    candidatureRepository.findByIdWithOffer.mockResolvedValue(ROW);
    candidatureRepository.updateStatut.mockResolvedValue(undefined);
    humanInterviewRepository.findByCandidatureId.mockResolvedValue(null);
    humanInterviewRepository.create.mockResolvedValue({
      id: 'hi-1',
      candidature_id: 'cand-50',
      date: '2027-08-25',
      heure: '10:30',
      duree: 45,
      interviewer: 'Salma Bouazizi',
      interviewer_email: 'salma.bouazizi@steg.tn',
      lien_visio: VALID.lien_visio,
      statut: 'PLANIFIE',
      created_at: '2026-08-11T10:00:00.000Z',
      updated_at: '2026-08-11T10:00:00.000Z'
    });
    humanInterviewRepository.update.mockResolvedValue({ id: 'hi-1' });
    db.withTransaction.mockImplementation(async (cb) => cb({ query: jest.fn() }));
    candidatRepository.getProfile.mockResolvedValue({
      id: 'candidat-9',
      nom: 'Sassi',
      prenom: 'Marwa',
      email: 'candidat@steg.tn'
    });
    emailService.sendHumanInterviewInvitationEmail.mockResolvedValue(undefined);
  });

  test('planifie l’entretien humain, passe la candidature en EN_ENTRETIEN_HUMAIN et notifie', async () => {
    const result = await candidatureService.scheduleHumanInterview('cand-50', VALID, 'RH');

    expect(result.message).toContain('Entretien humain planifié');
    expect(result.interview).toMatchObject({ id: 'hi-1', date: '2027-08-25', heure: '10:30' });
    expect(candidatureRepository.updateStatut).toHaveBeenCalledWith('cand-50', 'EN_ENTRETIEN_HUMAIN', expect.anything());
    expect(humanInterviewRepository.create).toHaveBeenCalledWith(
      { candidatureId: 'cand-50', ...VALID },
      expect.anything()
    );
    expect(notificationService.notifyBestEffort).toHaveBeenCalledWith(
      'candidat-9',
      'Entretien humain planifié',
      expect.stringContaining('Salma Bouazizi'),
      'CANDIDATURE'
    );
    expect(emailService.sendHumanInterviewInvitationEmail).toHaveBeenCalledWith('candidat@steg.tn', {
      nom: 'Marwa Sassi',
      titreOffre: 'Ingénieur Réseaux',
      date: expect.stringContaining('2027'),
      heure: '10:30',
      interviewer: 'Salma Bouazizi',
      lienVisio: VALID.lien_visio
    });
  });

  test('lève 403 pour un rôle non RH', async () => {
    await expect(
      candidatureService.scheduleHumanInterview('cand-50', VALID, 'STAGIAIRE')
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(humanInterviewRepository.create).not.toHaveBeenCalled();
  });

  test('lève 400 si la candidature n’a pas réussi l’entretien IA', async () => {
    candidatureRepository.findByIdWithOffer.mockResolvedValue({ ...ROW, statut: 'AI_INTERVIEW_FAILED' });
    await expect(
      candidatureService.scheduleHumanInterview('cand-50', VALID, 'RH')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('lève 400 si un entretien humain actif est déjà planifié', async () => {
    humanInterviewRepository.findByCandidatureId.mockResolvedValue({ id: 'hi-0', statut: 'PLANIFIE' });
    await expect(
      candidatureService.scheduleHumanInterview('cand-50', VALID, 'RH')
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(humanInterviewRepository.create).not.toHaveBeenCalled();
  });

  test('lève 400 si la date est manquante', async () => {
    await expect(
      candidatureService.scheduleHumanInterview('cand-50', { ...VALID, date: '' }, 'RH')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('lève 400 si la durée est manquante ou invalide', async () => {
    await expect(
      candidatureService.scheduleHumanInterview('cand-50', { ...VALID, duree: undefined }, 'RH')
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      candidatureService.scheduleHumanInterview('cand-50', { ...VALID, duree: -5 }, 'RH')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('lève 400 si l’email de l’intervieweur est manquant ou invalide', async () => {
    await expect(
      candidatureService.scheduleHumanInterview('cand-50', { ...VALID, interviewer_email: '' }, 'RH')
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      candidatureService.scheduleHumanInterview('cand-50', { ...VALID, interviewer_email: 'pas-un-email' }, 'RH')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('lève 400 si le lien de visioconférence est manquant ou invalide', async () => {
    await expect(
      candidatureService.scheduleHumanInterview('cand-50', { ...VALID, lien_visio: '' }, 'RH')
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      candidatureService.scheduleHumanInterview('cand-50', { ...VALID, lien_visio: 'not-a-url' }, 'RH')
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      candidatureService.scheduleHumanInterview('cand-50', { ...VALID, lien_visio: 'ftp://x.example.com' }, 'RH')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('lève 400 si la date est passée', async () => {
    await expect(
      candidatureService.scheduleHumanInterview('cand-50', { ...VALID, date: '2020-01-01' }, 'RH')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('lève 400 si l’heure de début est invalide', async () => {
    await expect(
      candidatureService.scheduleHumanInterview('cand-50', { ...VALID, heure: '25:99' }, 'RH')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('réactive l’entretien annulé (mise à jour) au lieu de créer une nouvelle ligne', async () => {
    humanInterviewRepository.findByCandidatureId.mockResolvedValue({ id: 'hi-0', statut: 'ANNULE' });
    const result = await candidatureService.scheduleHumanInterview('cand-50', VALID, 'RH');

    expect(result.message).toContain('Entretien humain planifié');
    expect(humanInterviewRepository.update).toHaveBeenCalledWith('hi-0', VALID, expect.anything());
    expect(humanInterviewRepository.create).not.toHaveBeenCalled();
    expect(candidatureRepository.updateStatut).toHaveBeenCalledWith('cand-50', 'EN_ENTRETIEN_HUMAIN', expect.anything());
  });
});

describe('CandidatureService.updateHumanInterview — modification RH', () => {
  const RH = { id: 'rh-1', role: 'RH' };
  const ROW = {
    id: 'cand-51',
    stagiaire_id: null,
    candidat_id: 'candidat-9',
    offre_id: 'offre-3',
    statut: 'EN_ENTRETIEN_HUMAIN',
    offre_titre: 'Ingénieur Réseaux'
  };
  const VALID = {
    date: '2026-09-01',
    heure: '14:00',
    duree: 60,
    interviewer: 'Amin Ben Ali',
    interviewer_email: 'amin.benali@steg.tn',
    lien_visio: 'https://meet.google.com/xyz'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    candidatureRepository.findByIdWithOffer.mockResolvedValue(ROW);
    humanInterviewRepository.findByCandidatureId.mockResolvedValue({ id: 'hi-5', statut: 'PLANIFIE' });
    humanInterviewRepository.update.mockResolvedValue({ id: 'hi-5', ...VALID, statut: 'PLANIFIE' });
  });

  test('RH met à jour l’entretien humain planifié', async () => {
    const result = await candidatureService.updateHumanInterview('cand-51', VALID, 'RH');
    expect(result.message).toContain('Entretien humain modifié');
    expect(result.interview).toMatchObject({ id: 'hi-5', ...VALID });
    expect(humanInterviewRepository.update).toHaveBeenCalledWith('hi-5', VALID);
  });

  test('lève 403 pour un rôle non RH', async () => {
    await expect(
      candidatureService.updateHumanInterview('cand-51', VALID, 'STAGIAIRE')
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test('lève 400 si la candidature n’est pas en entretien humain', async () => {
    candidatureRepository.findByIdWithOffer.mockResolvedValue({ ...ROW, statut: 'AI_INTERVIEW_PASSED' });
    await expect(
      candidatureService.updateHumanInterview('cand-51', VALID, 'RH')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('lève 400 si aucun entretien planifié (annulé ou terminé)', async () => {
    humanInterviewRepository.findByCandidatureId.mockResolvedValue({ id: 'hi-5', statut: 'ANNULE' });
    await expect(
      candidatureService.updateHumanInterview('cand-51', VALID, 'RH')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('lève 400 si le lien de visioconférence est invalide', async () => {
    await expect(
      candidatureService.updateHumanInterview('cand-51', { ...VALID, lien_visio: 'pas-une-url' }, 'RH')
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('CandidatureService.cancelHumanInterview — annulation RH', () => {
  const ROW = {
    id: 'cand-52',
    stagiaire_id: null,
    candidat_id: 'candidat-9',
    offre_id: 'offre-3',
    statut: 'EN_ENTRETIEN_HUMAIN',
    offre_titre: 'Ingénieur Réseaux'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    candidatureRepository.findByIdWithOffer.mockResolvedValue(ROW);
    humanInterviewRepository.findByCandidatureId.mockResolvedValue({ id: 'hi-7', statut: 'PLANIFIE' });
    humanInterviewRepository.setStatus.mockResolvedValue(undefined);
    candidatureRepository.updateStatut.mockResolvedValue(undefined);
    db.withTransaction.mockImplementation(async (cb) => cb({ query: jest.fn() }));
  });

  test('RH annule l’entretien : statut ANNULE et candidature redevient AI_INTERVIEW_PASSED', async () => {
    const result = await candidatureService.cancelHumanInterview('cand-52', 'RH');
    expect(result.message).toContain('Entretien humain annulé');
    expect(candidatureRepository.updateStatut).toHaveBeenCalledWith('cand-52', 'AI_INTERVIEW_PASSED', expect.anything());
    expect(humanInterviewRepository.setStatus).toHaveBeenCalledWith('hi-7', 'ANNULE', expect.anything());
  });

  test('lève 403 pour un rôle non RH', async () => {
    await expect(
      candidatureService.cancelHumanInterview('cand-52', 'CANDIDAT')
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test('lève 400 si la candidature n’est pas en entretien humain', async () => {
    candidatureRepository.findByIdWithOffer.mockResolvedValue({ ...ROW, statut: 'AI_INTERVIEW_PASSED' });
    await expect(
      candidatureService.cancelHumanInterview('cand-52', 'RH')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('lève 400 si aucun entretien planifié à annuler', async () => {
    humanInterviewRepository.findByCandidatureId.mockResolvedValue({ id: 'hi-7', statut: 'TERMINE' });
    await expect(
      candidatureService.cancelHumanInterview('cand-52', 'RH')
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('CandidatureService.completeHumanInterview — achèvement RH', () => {
  const RH = { id: 'rh-1', role: 'RH' };
  const CANDIDAT = { id: 'candidat-9', role: 'CANDIDAT' };
  const ROW = {
    id: 'cand-53',
    stagiaire_id: null,
    candidat_id: 'candidat-9',
    offre_id: 'offre-3',
    statut: 'EN_ENTRETIEN_HUMAIN',
    offre_titre: 'Ingénieur Réseaux'
  };
  const INTERVIEW = {
    id: 'hi-8',
    candidature_id: 'cand-53',
    date: '2026-09-10',
    heure: '10:30',
    duree: 45,
    interviewer: 'Salma Bouazizi',
    interviewer_email: 'salma.bouazizi@steg.tn',
    lien_visio: 'https://meet.example.com/x',
    statut: 'HUMAN_INTERVIEW_COMPLETED',
    completed_at: '2026-09-10T11:00:00.000Z',
    completed_by: 'rh-1',
    created_at: '2026-08-11T10:00:00.000Z',
    updated_at: '2026-09-10T11:00:00.000Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    candidatureRepository.findByIdWithOffer.mockResolvedValue(ROW);
    humanInterviewRepository.findByCandidatureId.mockResolvedValue({ id: 'hi-8', statut: 'PLANIFIE' });
    humanInterviewRepository.markCompleted.mockResolvedValue(INTERVIEW);
    candidatureRepository.updateStatut.mockResolvedValue(undefined);
    db.withTransaction.mockImplementation(async (cb) => cb({ query: jest.fn() }));
  });

  test('RH complète l’entretien : statuts HUMAN_INTERVIEW_COMPLETED, trace completed_at/completed_by', async () => {
    const result = await candidatureService.completeHumanInterview('cand-53', RH);

    expect(result.message).toContain('complété');
    expect(result.interview).toMatchObject({
      candidature_id: 'cand-53',
      statut: 'HUMAN_INTERVIEW_COMPLETED',
      completed_at: '2026-09-10T11:00:00.000Z',
      completed_by: 'rh-1'
    });
    expect(candidatureRepository.updateStatut).toHaveBeenCalledWith('cand-53', 'HUMAN_INTERVIEW_COMPLETED', expect.anything());
    expect(humanInterviewRepository.markCompleted).toHaveBeenCalledWith('hi-8', 'rh-1', expect.anything());
    expect(stageRepository.createWithProject).not.toHaveBeenCalled();
  });

  test('lève 403 pour un rôle non RH', async () => {
    await expect(
      candidatureService.completeHumanInterview('cand-53', CANDIDAT)
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(humanInterviewRepository.markCompleted).not.toHaveBeenCalled();
    expect(candidatureRepository.updateStatut).not.toHaveBeenCalled();
  });

  test('lève 400 si la candidature n’est pas dans le workflow RH', async () => {
    candidatureRepository.findByIdWithOffer.mockResolvedValue({ ...ROW, statut: 'AI_INTERVIEW_PASSED' });
    await expect(
      candidatureService.completeHumanInterview('cand-53', RH)
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(humanInterviewRepository.markCompleted).not.toHaveBeenCalled();
  });

  test('lève 400 si l’entretien est annulé', async () => {
    humanInterviewRepository.findByCandidatureId.mockResolvedValue({ id: 'hi-8', statut: 'ANNULE' });
    await expect(
      candidatureService.completeHumanInterview('cand-53', RH)
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(humanInterviewRepository.markCompleted).not.toHaveBeenCalled();
  });

  test('lève 400 si l’entretien est déjà complété', async () => {
    humanInterviewRepository.findByCandidatureId.mockResolvedValue({
      id: 'hi-8',
      statut: 'HUMAN_INTERVIEW_COMPLETED'
    });
    await expect(
      candidatureService.completeHumanInterview('cand-53', RH)
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(humanInterviewRepository.markCompleted).not.toHaveBeenCalled();
  });

  test('lève 404 si la candidature n’existe pas', async () => {
    candidatureRepository.findByIdWithOffer.mockResolvedValue(null);
    await expect(
      candidatureService.completeHumanInterview('inconnu', RH)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('CandidatureService.getCandidateHumanInterview — lecture candidat', () => {
  const CANDIDAT = { id: 'candidat-9', role: 'CANDIDAT' };
  const ROW = {
    id: 'cand-70',
    stagiaire_id: null,
    candidat_id: 'candidat-9',
    offre_id: 'offre-3',
    date_candidature: '2026-08-01',
    statut: 'EN_ENTRETIEN_HUMAIN'
  };
  const INTERVIEW = {
    id: 'hi-9',
    candidature_id: 'cand-70',
    date: '2026-08-25',
    heure: '10:30',
    duree: 45,
    interviewer: 'Salma Bouazizi',
    interviewer_email: 'salma.bouazizi@steg.tn',
    lien_visio: 'https://teams.microsoft.com/l/meetup-join/abc',
    statut: 'PLANIFIE',
    created_at: '2026-08-11T10:00:00.000Z',
    updated_at: '2026-08-11T10:00:00.000Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    candidatureRepository.findByIdWithOffer.mockResolvedValue(ROW);
  });

  test('retourne l’entretien planifié au candidat propriétaire (format normalisé)', async () => {
    humanInterviewRepository.findByCandidatureId.mockResolvedValue(INTERVIEW);
    const result = await candidatureService.getCandidateHumanInterview('cand-70', CANDIDAT);
    expect(result.interview).toEqual({
      id: 'hi-9',
      candidature_id: 'cand-70',
      date: '2026-08-25',
      heure: '10:30',
      duree: 45,
      interviewer: 'Salma Bouazizi',
      interviewer_email: 'salma.bouazizi@steg.tn',
      lien_visio: 'https://teams.microsoft.com/l/meetup-join/abc',
      statut: 'PLANIFIE',
      completed_at: null,
      completed_by: null,
      created_at: '2026-08-11T10:00:00.000Z',
      updated_at: '2026-08-11T10:00:00.000Z'
    });
  });

  test('retourne interview null si rien n’est planifié (aucun faux rendez-vous)', async () => {
    humanInterviewRepository.findByCandidatureId.mockResolvedValue(null);
    const result = await candidatureService.getCandidateHumanInterview('cand-70', CANDIDAT);
    expect(result).toEqual({ interview: null });
  });

  test('retourne aussi le statut ANNULE pour afficher « Interview cancelled »', async () => {
    humanInterviewRepository.findByCandidatureId.mockResolvedValue({ ...INTERVIEW, statut: 'ANNULE' });
    const result = await candidatureService.getCandidateHumanInterview('cand-70', CANDIDAT);
    expect(result.interview.statut).toBe('ANNULE');
  });

  test('lève 403 si le candidat n’est pas le propriétaire de la candidature', async () => {
    humanInterviewRepository.findByCandidatureId.mockResolvedValue(INTERVIEW);
    await expect(
      candidatureService.getCandidateHumanInterview('cand-70', { id: 'candidat-autre', role: 'CANDIDAT' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test('lève 403 si la candidature n’a pas de candidat associé', async () => {
    humanInterviewRepository.findByCandidatureId.mockResolvedValue(INTERVIEW);
    await expect(
      candidatureService.getCandidateHumanInterview('cand-70', { id: 'stag-1', role: 'STAGIAIRE' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test('lève 404 si la candidature n’existe pas', async () => {
    candidatureRepository.findByIdWithOffer.mockResolvedValue(null);
    await expect(
      candidatureService.getCandidateHumanInterview('inconnu', CANDIDAT)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('CandidatureService.recordHumanInterviewDecision — décision finale RH', () => {
  const RH_USER = { id: 'rh-1', role: 'RH' };
  const ROW = {
    id: 'cand-60',
    stagiaire_id: null,
    candidat_id: 'candidat-9',
    offre_id: 'offre-3',
    departement_id: 'dep-1',
    statut: 'EN_ENTRETIEN_HUMAIN',
    offre_titre: 'Ingénieur Réseaux',
    duree: 12
  };
  const COMPLETED_ROW = { ...ROW, statut: 'HUMAN_INTERVIEW_COMPLETED' };

  beforeEach(() => {
    jest.resetAllMocks();
    candidatureRepository.findByIdWithOffer
      .mockResolvedValueOnce(ROW)
      .mockResolvedValueOnce(ROW)
      .mockResolvedValueOnce(COMPLETED_ROW);
    humanInterviewRepository.findByCandidatureId
      .mockResolvedValueOnce({ id: 'hi-1', statut: 'PLANIFIE' })
      .mockResolvedValueOnce({ id: 'hi-1', statut: 'HUMAN_INTERVIEW_COMPLETED' });
    humanInterviewRepository.setStatus.mockResolvedValue(undefined);
    humanInterviewRepository.markCompleted.mockResolvedValue({ id: 'hi-1', statut: 'TERMINE' });
    candidatureRepository.updateStatut.mockResolvedValue(undefined);
    candidatureRepository.updateStagiaire.mockResolvedValue(undefined);
    candidatureRepository.refuseOtherCandidatures.mockResolvedValue(undefined);
    candidatureRepository.decide.mockResolvedValue(undefined);
    candidatureRepository.insertDecisionAudit.mockResolvedValue(undefined);
    offreRepository.findPublicById.mockResolvedValue({
      id: 'offre-3',
      encadrant_id: 'enc-1',
      documents_demandes: null
    });
    offreRepository.findById.mockResolvedValue({ statut: 'OUVERTE', nombre_places: 2 });
    offreRepository.decrementPlaces.mockResolvedValue(undefined);
    stageRepository.createWithProject.mockResolvedValue('stage-1');
    candidatRepository.getProfile.mockResolvedValue({
      id: 'candidat-9',
      nom: 'Sassi',
      prenom: 'Marwa',
      email: 'candidat@steg.tn'
    });
    candidatRepository.createStagiaire.mockResolvedValue(undefined);
    db.withTransaction.mockImplementation(async (cb) => cb({ query: jest.fn() }));
    emailService.sendInternshipAcceptedEmail.mockResolvedValue(undefined);
    emailService.sendApplicationRejectedEmail.mockResolvedValue(undefined);
    emailService.sendDocumentsRequestEmail.mockResolvedValue(undefined);
    notificationService.notifyBestEffort.mockResolvedValue(undefined);
    internshipConversionService.convertCandidatureToStagiaire.mockResolvedValue(undefined);
  });

  test("REJECTED : complete l'entretien, enregistre la decision et notifie", async () => {
    const result = await candidatureService.recordHumanInterviewDecision('cand-60', { decision: 'REJECTED' }, RH_USER);

    expect(result).toMatchObject({ statut: 'HUMAN_INTERVIEW_REJECTED', decision: 'REJECTED' });
    expect(candidatureRepository.updateStatut).toHaveBeenCalledWith('cand-60', 'HUMAN_INTERVIEW_COMPLETED', expect.anything());
    expect(humanInterviewRepository.markCompleted).toHaveBeenCalledWith('hi-1', 'rh-1', expect.anything());
    expect(candidatureRepository.decide).toHaveBeenCalled();
    expect(candidatureRepository.insertDecisionAudit).toHaveBeenCalled();
    expect(emailService.sendApplicationRejectedEmail).toHaveBeenCalled();
    expect(internshipConversionService.convertCandidatureToStagiaire).not.toHaveBeenCalled();
  });

  test("ACCEPTED : complete l'entretien, accepte et convertit en stagiaire", async () => {
    const result = await candidatureService.recordHumanInterviewDecision('cand-60', { decision: 'ACCEPTED' }, RH_USER);

    expect(result).toMatchObject({ statut: 'ACCEPTEE' });
    expect(candidatureRepository.updateStatut).toHaveBeenCalledWith('cand-60', 'HUMAN_INTERVIEW_COMPLETED', expect.anything());
    expect(candidatureRepository.updateStatut).toHaveBeenCalledWith('cand-60', 'HUMAN_INTERVIEW_ACCEPTED', expect.anything());
    expect(humanInterviewRepository.markCompleted).toHaveBeenCalledWith('hi-1', 'rh-1', expect.anything());
    expect(candidatureRepository.decide).toHaveBeenCalled();
    expect(candidatureRepository.insertDecisionAudit).toHaveBeenCalled();
    expect(internshipConversionService.convertCandidatureToStagiaire).toHaveBeenCalledWith('cand-60', RH_USER);
    expect(emailService.sendApplicationRejectedEmail).not.toHaveBeenCalled();
  });

  test(' leve 403 pour un role non RH', async () => {
    await expect(
      candidatureService.recordHumanInterviewDecision('cand-60', { decision: 'ACCEPTED' }, { id: 'cand-1', role: 'CANDIDAT' })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(internshipConversionService.convertCandidatureToStagiaire).not.toHaveBeenCalled();
  });

  test(' leve 400 si la candidature nest pas en entretien humain', async () => {
    candidatureRepository.findByIdWithOffer.mockReset();
    candidatureRepository.findByIdWithOffer.mockResolvedValue({ ...ROW, statut: 'AI_INTERVIEW_PASSED' });
    await expect(
      candidatureService.recordHumanInterviewDecision('cand-60', { decision: 'ACCEPTED' }, RH_USER)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test(' leve 400 si la decision est invalide', async () => {
    await expect(
      candidatureService.recordHumanInterviewDecision('cand-60', { decision: 'MAYBE' }, RH_USER)
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('CandidatureService.decideHumanInterview — décision finale après entretien humain complété', () => {
  const ROW = {
    id: 'cand-61',
    stagiaire_id: null,
    candidat_id: 'candidat-10',
    offre_id: 'offre-3',
    statut: 'HUMAN_INTERVIEW_COMPLETED',
    offre_titre: 'Ingénieur Réseaux',
    duree: 12
  };

  beforeEach(() => {
    jest.resetAllMocks();
    candidatureRepository.findByIdWithOffer.mockResolvedValue(ROW);
    humanInterviewRepository.findByCandidatureId.mockResolvedValue({ id: 'hi-2', statut: 'HUMAN_INTERVIEW_COMPLETED' });
    candidatureRepository.updateStatut.mockResolvedValue(undefined);
    candidatureRepository.decide.mockResolvedValue({
      id: ROW.id,
      statut: 'HUMAN_INTERVIEW_ACCEPTED',
      decision: 'ACCEPTED',
      decided_by: 'rh-1',
      decided_at: '2026-09-10T12:00:00.000Z'
    });
    candidatureRepository.insertDecisionAudit.mockResolvedValue({ id: 'audit-1' });
    db.withTransaction.mockImplementation(async (cb) => cb({ query: jest.fn() }));
    candidatRepository.getProfile.mockResolvedValue({
      id: 'candidat-10',
      nom: 'Sassi',
      prenom: 'Marwa',
      email: 'candidat@steg.tn'
    });
    emailService.sendApplicationRejectedEmail.mockResolvedValue(undefined);
    notificationService.notifyBestEffort.mockResolvedValue(undefined);
  });

  test('ACCEPTED : passe en HUMAN_INTERVIEW_ACCEPTED, trace la décision et audite sans créer de stagiaire', async () => {
    const result = await candidatureService.decideHumanInterview('cand-61', { decision: 'ACCEPTED' }, { id: 'rh-1', role: 'RH' });

    expect(result).toMatchObject({
      id: 'cand-61',
      statut: 'HUMAN_INTERVIEW_ACCEPTED',
      decision: 'ACCEPTED',
      decided_by: 'rh-1',
      message: 'Candidate accepted after human interview.'
    });
    expect(candidatureRepository.updateStatut).toHaveBeenCalledWith('cand-61', 'HUMAN_INTERVIEW_ACCEPTED', expect.anything());
    expect(candidatureRepository.decide).toHaveBeenCalledWith(
      'cand-61',
      { statut: 'HUMAN_INTERVIEW_ACCEPTED', decision: 'ACCEPTED', decidedBy: 'rh-1' },
      expect.anything()
    );
    expect(candidatureRepository.insertDecisionAudit).toHaveBeenCalledWith(
      'cand-61',
      { decision: 'ACCEPTED', decidedBy: 'rh-1', previousStatus: 'HUMAN_INTERVIEW_COMPLETED', newStatus: 'HUMAN_INTERVIEW_ACCEPTED' },
      expect.anything()
    );
    // Aucune création de stagiaire ni de stage, aucun email d'acceptation.
    expect(candidatRepository.createStagiaire).not.toHaveBeenCalled();
    expect(stageRepository.createWithProject).not.toHaveBeenCalled();
    expect(emailService.sendInternshipAcceptedEmail).not.toHaveBeenCalled();
    expect(emailService.sendApplicationRejectedEmail).not.toHaveBeenCalled();
  });

  test('REJECTED : passe en HUMAN_INTERVIEW_REJECTED, envoie l’email de refus existant et audite', async () => {
    candidatureRepository.decide.mockResolvedValue({
      id: ROW.id,
      statut: 'HUMAN_INTERVIEW_REJECTED',
      decision: 'REJECTED',
      decided_by: 'rh-1',
      decided_at: '2026-09-10T12:00:00.000Z'
    });

    const result = await candidatureService.decideHumanInterview('cand-61', { decision: 'REJECTED' }, { id: 'rh-1', role: 'RH' });

    expect(result).toMatchObject({
      statut: 'HUMAN_INTERVIEW_REJECTED',
      decision: 'REJECTED',
      decided_by: 'rh-1'
    });
    expect(candidatureRepository.updateStatut).toHaveBeenCalledWith('cand-61', 'HUMAN_INTERVIEW_REJECTED', expect.anything());
    expect(candidatureRepository.insertDecisionAudit).toHaveBeenCalledWith(
      'cand-61',
      expect.objectContaining({ decision: 'REJECTED', previousStatus: 'HUMAN_INTERVIEW_COMPLETED', newStatus: 'HUMAN_INTERVIEW_REJECTED' }),
      expect.anything()
    );
    expect(emailService.sendApplicationRejectedEmail).toHaveBeenCalledWith(
      'candidat@steg.tn',
      expect.objectContaining({ nom: 'Marwa Sassi', titreOffre: 'Ingénieur Réseaux' })
    );
    expect(notificationService.notifyBestEffort).toHaveBeenCalledWith(
      'candidat-10',
      'Candidature non retenue',
      expect.stringContaining('not selected after the human interview'),
      'CANDIDATURE'
    );
    expect(candidatRepository.createStagiaire).not.toHaveBeenCalled();
    expect(stageRepository.createWithProject).not.toHaveBeenCalled();
  });

  test('lève 403 pour un rôle non RH', async () => {
    await expect(
      candidatureService.decideHumanInterview('cand-61', { decision: 'ACCEPTED' }, { id: 'cand-1', role: 'CANDIDAT' })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(candidatureRepository.updateStatut).not.toHaveBeenCalled();
  });

  test('lève 400 si la décision est invalide', async () => {
    await expect(
      candidatureService.decideHumanInterview('cand-61', { decision: 'MAYBE' }, { id: 'rh-1', role: 'RH' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('lève 400 avant complétion de l’entretien humain', async () => {
    candidatureRepository.findByIdWithOffer.mockResolvedValue({ ...ROW, statut: 'EN_ENTRETIEN_HUMAIN' });
    await expect(
      candidatureService.decideHumanInterview('cand-61', { decision: 'ACCEPTED' }, { id: 'rh-1', role: 'RH' })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(candidatureRepository.updateStatut).not.toHaveBeenCalled();
  });

  test('lève 400 pour un entretien humain pas encore complété', async () => {
    humanInterviewRepository.findByCandidatureId.mockResolvedValue({ id: 'hi-2', statut: 'PLANIFIE' });
    await expect(
      candidatureService.decideHumanInterview('cand-61', { decision: 'ACCEPTED' }, { id: 'rh-1', role: 'RH' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('lève 400 pour un entretien humain annulé', async () => {
    humanInterviewRepository.findByCandidatureId.mockResolvedValue({ id: 'hi-2', statut: 'ANNULE' });
    await expect(
      candidatureService.decideHumanInterview('cand-61', { decision: 'ACCEPTED' }, { id: 'rh-1', role: 'RH' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('lève 400 pour une candidature déjà décidée', async () => {
    candidatureRepository.findByIdWithOffer.mockResolvedValue({ ...ROW, statut: 'HUMAN_INTERVIEW_ACCEPTED' });
    await expect(
      candidatureService.decideHumanInterview('cand-61', { decision: 'ACCEPTED' }, { id: 'rh-1', role: 'RH' })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(candidatureRepository.updateStatut).not.toHaveBeenCalled();
  });

  test('lève 404 pour une candidature inexistante', async () => {
    candidatureRepository.findByIdWithOffer.mockResolvedValue(null);
    await expect(
      candidatureService.decideHumanInterview('inconnu', { decision: 'ACCEPTED' }, { id: 'rh-1', role: 'RH' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
