import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { CandidatureDetailsComponent } from './candidature-details.component';
import { AuthService } from 'src/app/core/data/auth.service';

describe('CandidatureDetailsComponent', () => {
  let component: CandidatureDetailsComponent;
  let httpMock: HttpTestingController;
  let authService: AuthService;

  const mockDetails = {
    id: '1',
    nom: 'Sassi',
    prenom: 'Marwa',
    email: 'candidat@steg.tn',
    telephone: '+216 20 111 111',
    universite: 'ISET Rades',
    specialite: 'Genie Logiciel',
    niveau: 'Master',
    offre_titre: 'Stage Dev',
    departement_nom: 'IT',
    date_candidature: '2026-08-09',
    statut: 'EN_ATTENTE',
    cvUrl: '/candidatures/1/cv',
    cv: { originalName: 'marwa-cv.pdf' }
  };

  const mockDocuments = {
    documents_onboarding: {
      candidature_id: '1',
      required_types: ['CV', 'CIN', 'DEMANDE_STAGE', 'LETTRE_AFFECTATION'],
      documents: [
        { id: 'd1', type: 'CV', statut: 'EN_ATTENTE', nom: 'cv.pdf', date_depot: '2026-09-10', from_application: false, rejected_reason: null, verification_status: 'REVIEW_REQUIRED' },
        { id: 'd2', type: 'CIN', statut: 'REJETE', nom: 'cin.pdf', date_depot: '2026-09-10', from_application: false, rejected_reason: 'Illisible', verification_status: 'REJECTED' },
        { id: 'd3', type: 'DEMANDE_STAGE', statut: 'VALIDE', nom: 'demande.pdf', date_depot: '2026-09-11', from_application: false, rejected_reason: null, verification_status: 'VALID' },
        { id: 'd4', type: 'LETTRE_AFFECTATION', statut: 'MANQUANT', nom: null, date_depot: null, from_application: false, rejected_reason: null, verification_status: null }
      ],
      submitted: 3,
      total: 4
    }
  };

  const mockReadinessComplete = {
    candidature_id: '1',
    ready: true,
    reasons: [],
    documents: [
      { id: 'd1', type: 'CV', status: 'VALID', nom: 'cv.pdf', date_depot: '2026-09-10', verification_status: 'VALID', rejected_reason: null },
      { id: 'd2', type: 'CIN', status: 'VALID', nom: 'cin.pdf', date_depot: '2026-09-10', verification_status: 'VALID', rejected_reason: null },
      { id: 'd3', type: 'DEMANDE_STAGE', status: 'VALID', nom: 'demande.pdf', date_depot: '2026-09-11', verification_status: 'VALID', rejected_reason: null },
      { id: 'd4', type: 'LETTRE_AFFECTATION', status: 'VALID', nom: 'lettre.pdf', date_depot: '2026-09-11', verification_status: 'VALID', rejected_reason: null }
    ],
    missingDocuments: [],
    invalidDocuments: []
  };

  const mockReadinessIncomplete = {
    candidature_id: '1',
    ready: false,
    reasons: ['DOCUMENTS_INCOMPLETE', 'DOCUMENTS_INVALID'],
    documents: [
      { id: 'd1', type: 'CV', status: 'REVIEW_REQUIRED', nom: 'cv.pdf', date_depot: '2026-09-10', verification_status: 'REVIEW_REQUIRED', rejected_reason: null },
      { id: 'd2', type: 'CIN', status: 'REJECTED', nom: 'cin.pdf', date_depot: '2026-09-10', verification_status: 'REJECTED', rejected_reason: 'Illisible' },
      { id: 'd3', type: 'DEMANDE_STAGE', status: 'VALID', nom: 'demande.pdf', date_depot: '2026-09-11', verification_status: 'VALID', rejected_reason: null },
      { type: 'LETTRE_AFFECTATION', status: 'MANQUANT' }
    ],
    missingDocuments: ['LETTRE_AFFECTATION'],
    invalidDocuments: ['CV', 'CIN']
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CandidatureDetailsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '1' } } } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(CandidatureDetailsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
    authService.saveUser({ id: 'rh-1', role: 'RH', nom: 'Bouazizi', prenom: 'Salma', email: 'salma.bouazizi@steg.tn' });
  });

  afterEach(() => {
    try {
      const pendingReadiness = httpMock.match(
        (req) => req.url.includes('/internship-readiness')
      );
      for (const req of pendingReadiness) {
        req.flush(mockReadinessComplete);
      }
      httpMock?.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load details on init', () => {
    component.ngOnInit();
    const req = httpMock.expectOne('http://localhost:3000/api/candidatures/1');
    req.flush(mockDetails);
    httpMock.expectOne('http://localhost:3000/api/candidatures/1/internship-readiness').flush(mockReadinessComplete);
    expect(component.details()).toEqual(mockDetails);
    expect(component.loading()).toBe(false);
    expect(component.notFound()).toBe(false);
  });

  it('should show notFound on 404', () => {
    component.ngOnInit();
    const req = httpMock.expectOne('http://localhost:3000/api/candidatures/1');
    req.flush({}, { status: 404, statusText: 'Not Found' });
    expect(component.notFound()).toBe(true);
  });

  it('should allow decision for RH on EN_ATTENTE', () => {
    component.details.set(mockDetails);
    expect(component.canDecide()).toBe(true);
  });

  it('should not allow decision for non-decider role', () => {
    authService.saveUser({ id: 's-1', role: 'STAGIAIRE', nom: 'X', prenom: 'Y', email: 'x@steg.tn' });
    component.details.set(mockDetails);
    expect(component.canDecide()).toBe(false);
  });

  it('should not allow decision once candidature is processed', () => {
    component.details.set({ ...mockDetails, statut: 'EN_ENTRETIEN_IA' });
    expect(component.canDecide()).toBe(false);
  });

  it('should preselect for interview after confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.details.set(mockDetails);
    component.preselectForInterview();
    const req = httpMock.expectOne('http://localhost:3000/api/candidatures/1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ statut: 'RH_ACCEPTED' });
    req.flush({ message: 'Candidature acceptée pour l’entretien IA.' });

    const reload = httpMock.expectOne('http://localhost:3000/api/candidatures/1');
    expect(reload.request.method).toBe('GET');
    reload.flush({ ...mockDetails, statut: 'RH_ACCEPTED' });
    expect(component.details().statut).toBe('RH_ACCEPTED');
    expect(component.success()).toContain('entretien IA');
  });

  it('should not preselect when confirmation is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    component.details.set(mockDetails);
    component.preselectForInterview();
    const reqs = httpMock.match('http://localhost:3000/api/candidatures/1');
    expect(reqs.length).toBe(0);
    expect(component.success()).toBe('');
  });

  it('should refuse a candidature', () => {
    component.details.set(mockDetails);
    component.refuse();
    const req = httpMock.expectOne('http://localhost:3000/api/candidatures/1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ statut: 'REFUSEE' });
    req.flush({ message: 'Candidature refusée.' });

    const reload = httpMock.expectOne('http://localhost:3000/api/candidatures/1');
    reload.flush({ ...mockDetails, statut: 'REFUSEE' });
    expect(component.details().statut).toBe('REFUSEE');
  });

  it('should download the CV as blob', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    component.details.set(mockDetails);
    component.downloadCv();
    const req = httpMock.expectOne('http://localhost:3000/api/candidatures/1/cv');
    expect(req.request.method).toBe('GET');
    req.flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('should not download CV when absent', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    component.details.set({ ...mockDetails, cvUrl: null, cv: null });
    component.downloadCv();
    const reqs = httpMock.match('http://localhost:3000/api/candidatures/1/cv');
    expect(reqs.length).toBe(0);
    expect(clickSpy).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('should map statut to badge and label', () => {
    expect(component.getStatutBadge('EN_ENTRETIEN_IA')).toContain('info');
    expect(component.getStatutLabel('EN_ENTRETIEN_IA')).toBe('En entretien IA');
    expect(component.getStatutBadge('RH_ACCEPTED')).toContain('info');
    expect(component.getStatutLabel('RH_ACCEPTED')).toBe('Acceptée pour entretien IA');
    expect(component.getStatutBadge('AI_INTERVIEW_PASSED')).toContain('success');
    expect(component.getStatutLabel('AI_INTERVIEW_PASSED')).toBe('Entretien IA réussi');
    expect(component.getStatutBadge('AI_INTERVIEW_FAILED')).toContain('danger');
    expect(component.getStatutLabel('AI_INTERVIEW_FAILED')).toBe('Entretien IA échoué');
    expect(component.getStatutLabel('ACCEPTEE')).toBe('Acceptée');
    expect(component.getStatutBadge('EN_ENTRETIEN_HUMAIN')).toContain('primary');
    expect(component.getStatutLabel('EN_ENTRETIEN_HUMAIN')).toBe('Entretien humain planifié');
  });

  it('should allow scheduling only for AI_INTERVIEW_PASSED deciders', () => {
    component.details.set({ ...mockDetails, statut: 'AI_INTERVIEW_PASSED' });
    expect(component.canSchedule()).toBe(true);
    component.details.set({ ...mockDetails, statut: 'EN_ATTENTE' });
    expect(component.canSchedule()).toBe(false);
  });

  it('should detect an active planned interview', () => {
    component.details.set({ ...mockDetails, statut: 'EN_ENTRETIEN_HUMAIN', human_interview: { statut: 'PLANIFIE' } });
    expect(component.hasActiveInterview()).toBe(true);
    component.details.set({ ...mockDetails, statut: 'AI_INTERVIEW_PASSED', human_interview: { statut: 'ANNULE' } });
    expect(component.hasActiveInterview()).toBe(false);
  });

  it('should schedule a human interview via POST', () => {
    component.details.set({ ...mockDetails, statut: 'AI_INTERVIEW_PASSED' });
    component.openSchedule();
    component.scheduleForm = {
      date: '2026-09-10',
      heure: '10:30',
      duree: 45,
      interviewer: 'Salma Bouazizi',
      interviewer_email: 'salma.bouazizi@steg.tn',
      lien_visio: 'https://teams.microsoft.com/x'
    };
    component.submitSchedule();

    const req = httpMock.expectOne('http://localhost:3000/api/candidatures/1/entretien-humain');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      date: '2026-09-10',
      heure: '10:30',
      duree: 45,
      interviewer: 'Salma Bouazizi',
      interviewer_email: 'salma.bouazizi@steg.tn',
      lien_visio: 'https://teams.microsoft.com/x'
    });
    req.flush({ id: 'hi-1' });

    const reload = httpMock.expectOne('http://localhost:3000/api/candidatures/1');
    reload.flush({ ...mockDetails, statut: 'EN_ENTRETIEN_HUMAIN' });
    expect(component.showScheduleModal()).toBe(false);
    expect(component.success()).toContain('Entretien humain planifié');
  });

  it('should reject an invalid meeting URL without calling the API', () => {
    component.details.set({ ...mockDetails, statut: 'AI_INTERVIEW_PASSED' });
    component.openSchedule();
    component.scheduleForm = {
      date: '2026-09-10',
      heure: '10:30',
      duree: 45,
      interviewer: 'Salma Bouazizi',
      interviewer_email: 'salma.bouazizi@steg.tn',
      lien_visio: 'pas-une-url'
    };
    component.submitSchedule();

    const reqs = httpMock.match('http://localhost:3000/api/candidatures/1/entretien-humain');
    expect(reqs.length).toBe(0);
    expect(component.error()).toContain('URL');
  });

  it('should reject a past date without calling the API', () => {
    component.details.set({ ...mockDetails, statut: 'AI_INTERVIEW_PASSED' });
    component.openSchedule();
    component.scheduleForm = {
      date: '2020-01-01',
      heure: '10:30',
      duree: 45,
      interviewer: 'Salma Bouazizi',
      interviewer_email: 'salma.bouazizi@steg.tn',
      lien_visio: 'https://teams.microsoft.com/x'
    };
    component.submitSchedule();

    const reqs = httpMock.match('http://localhost:3000/api/candidatures/1/entretien-humain');
    expect(reqs.length).toBe(0);
    expect(component.error()).toContain('futur');
  });

  it('should update a scheduled interview via PUT', () => {
    component.details.set({
      ...mockDetails,
      statut: 'EN_ENTRETIEN_HUMAIN',
      human_interview: {
        date: '2026-09-10',
        heure: '10:30:00',
        duree: 45,
        interviewer: 'Salma Bouazizi',
        interviewer_email: 'salma.bouazizi@steg.tn',
        lien_visio: 'https://teams.microsoft.com/x',
        statut: 'PLANIFIE'
      }
    });
    component.openEdit();
    expect(component.editMode()).toBe(true);
    expect(component.scheduleForm.heure).toBe('10:30');
    component.scheduleForm.heure = '14:00';
    component.submitSchedule();

    const req = httpMock.expectOne('http://localhost:3000/api/candidatures/1/entretien-humain');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.heure).toBe('14:00');
    req.flush({ id: 'hi-1' });

    const reload = httpMock.expectOne('http://localhost:3000/api/candidatures/1');
    reload.flush({ ...mockDetails, statut: 'EN_ENTRETIEN_HUMAIN' });
    expect(component.success()).toContain('modifié');
  });

  it('should open the cancel confirmation dialog without calling DELETE', () => {
    component.details.set({
      ...mockDetails,
      statut: 'EN_ENTRETIEN_HUMAIN',
      human_interview: { date: '2026-09-10', statut: 'PLANIFIE' }
    });
    component.cancelInterview();

    expect(component.showCancelModal()).toBe(true);
    httpMock.expectNone('http://localhost:3000/api/candidatures/1/entretien-humain');
  });

  it('should cancel a scheduled interview via DELETE when the dialog is confirmed', () => {
    component.details.set({
      ...mockDetails,
      statut: 'EN_ENTRETIEN_HUMAIN',
      human_interview: { date: '2026-09-10', statut: 'PLANIFIE' }
    });
    component.cancelInterview();
    expect(component.showCancelModal()).toBe(true);

    component.confirmCancelInterview();
    expect(component.showCancelModal()).toBe(false);

    const req = httpMock.expectOne('http://localhost:3000/api/candidatures/1/entretien-humain');
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'Entretien humain annulé.' });

    const reload = httpMock.expectOne('http://localhost:3000/api/candidatures/1');
    reload.flush({ ...mockDetails, statut: 'AI_INTERVIEW_PASSED' });
    expect(component.success()).toContain('annulé');
  });

  it('should keep the interview when the dialog is dismissed', () => {
    component.details.set({
      ...mockDetails,
      statut: 'EN_ENTRETIEN_HUMAIN',
      human_interview: { date: '2026-09-10', statut: 'PLANIFIE' }
    });
    component.cancelInterview();
    expect(component.showCancelModal()).toBe(true);

    component.keepInterview();
    expect(component.showCancelModal()).toBe(false);
    httpMock.expectNone('http://localhost:3000/api/candidatures/1/entretien-humain');
  });

  it('should format time HH:MM:SS to HH:MM', () => {
    expect(component.formatTime('10:30:00')).toBe('10:30');
    expect(component.formatTime('10:30')).toBe('10:30');
    expect(component.formatTime('')).toBe('');
  });

  it('should map HUMAN_INTERVIEW_COMPLETED to badge and label', () => {
    expect(component.getStatutBadge('HUMAN_INTERVIEW_COMPLETED')).toContain('success');
    expect(component.getStatutLabel('HUMAN_INTERVIEW_COMPLETED')).toBe('Entretien humain complété');
  });

  it('should allow completion when the interview is planned and passed', () => {
    const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    component.details.set({
      ...mockDetails,
      statut: 'EN_ENTRETIEN_HUMAIN',
      human_interview: { date: past, heure: '10:00', statut: 'PLANIFIE' }
    });
    expect(component.canCompleteInterview()).toBe(true);
  });

  it('should not allow completion while the interview is still in the future', () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    component.details.set({
      ...mockDetails,
      statut: 'EN_ENTRETIEN_HUMAIN',
      human_interview: { date: future, heure: '10:00', statut: 'PLANIFIE' }
    });
    expect(component.canCompleteInterview()).toBe(false);
  });

  it('should not allow completion for a non-decider role', () => {
    authService.saveUser({ id: 's-1', role: 'STAGIAIRE', nom: 'X', prenom: 'Y', email: 'x@steg.tn' });
    const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    component.details.set({
      ...mockDetails,
      statut: 'EN_ENTRETIEN_HUMAIN',
      human_interview: { date: past, heure: '10:00', statut: 'PLANIFIE' }
    });
    expect(component.canCompleteInterview()).toBe(false);
  });

  it('should detect a completed interview', () => {
    component.details.set({
      ...mockDetails,
      statut: 'HUMAN_INTERVIEW_COMPLETED',
      human_interview: { date: '2026-09-10', statut: 'HUMAN_INTERVIEW_COMPLETED', completed_at: '2026-09-10T11:00:00.000Z' }
    });
    expect(component.isInterviewCompleted()).toBe(true);
    component.details.set({ ...mockDetails, statut: 'EN_ENTRETIEN_HUMAIN', human_interview: { statut: 'PLANIFIE' } });
    expect(component.isInterviewCompleted()).toBe(false);
  });

  it('should complete a human interview via POST on confirmation', () => {
    component.details.set({
      ...mockDetails,
      statut: 'EN_ENTRETIEN_HUMAIN',
      human_interview: { date: '2026-09-10', statut: 'PLANIFIE' }
    });
    component.openComplete();
    expect(component.showCompleteModal()).toBe(true);

    component.confirmCompleteInterview();
    expect(component.showCompleteModal()).toBe(false);

    const req = httpMock.expectOne('http://localhost:3000/api/candidatures/1/entretien-humain/completion');
    expect(req.request.method).toBe('POST');
    req.flush({
      message: 'Entretien humain complété.',
      statut: 'HUMAN_INTERVIEW_COMPLETED',
      completed_at: '2026-09-10T11:00:00.000Z'
    });

    const reload = httpMock.expectOne('http://localhost:3000/api/candidatures/1');
    reload.flush({
      ...mockDetails,
      statut: 'HUMAN_INTERVIEW_COMPLETED',
      human_interview: { date: '2026-09-10', statut: 'HUMAN_INTERVIEW_COMPLETED' }
    });
    expect(component.success()).toContain('Human interview completed');
    expect(component.details().statut).toBe('HUMAN_INTERVIEW_COMPLETED');
  });

  it('should keep the interview when the completion dialog is dismissed', () => {
    component.details.set({
      ...mockDetails,
      statut: 'EN_ENTRETIEN_HUMAIN',
      human_interview: { date: '2026-09-10', statut: 'PLANIFIE' }
    });
    component.openComplete();
    expect(component.showCompleteModal()).toBe(true);

    component.keepComplete();
    expect(component.showCompleteModal()).toBe(false);
    httpMock.expectNone('http://localhost:3000/api/candidatures/1/entretien-humain/completion');
  });

  it('should allow the final decision for RH once the interview is completed', () => {
    component.details.set({
      ...mockDetails,
      statut: 'HUMAN_INTERVIEW_COMPLETED',
      human_interview: { date: '2026-09-10', statut: 'HUMAN_INTERVIEW_COMPLETED' }
    });
    expect(component.canDecideHumanInterview()).toBe(true);
    expect(component.hasDecision()).toBe(false);
  });

  it('should not allow the final decision once a decision was already recorded', () => {
    component.details.set({
      ...mockDetails,
      statut: 'HUMAN_INTERVIEW_ACCEPTED',
      decision: 'ACCEPTED',
      decided_at: '2026-09-10T12:00:00.000Z',
      human_interview: { date: '2026-09-10', statut: 'HUMAN_INTERVIEW_COMPLETED' }
    });
    expect(component.hasDecision()).toBe(true);
    expect(component.canDecideHumanInterview()).toBe(false);
  });

  it('should not allow the final decision before the interview is completed', () => {
    component.details.set({ ...mockDetails, statut: 'EN_ENTRETIEN_HUMAIN', human_interview: { statut: 'PLANIFIE' } });
    expect(component.canDecideHumanInterview()).toBe(false);
  });

  it('should not allow the final decision for a non-decider role', () => {
    authService.saveUser({ id: 's-1', role: 'STAGIAIRE', nom: 'X', prenom: 'Y', email: 'x@steg.tn' });
    component.details.set({
      ...mockDetails,
      statut: 'HUMAN_INTERVIEW_COMPLETED',
      human_interview: { date: '2026-09-10', statut: 'HUMAN_INTERVIEW_COMPLETED' }
    });
    expect(component.canDecideHumanInterview()).toBe(false);
  });

  it('should accept the candidate via the decision endpoint on confirmation', () => {
    component.details.set({
      ...mockDetails,
      statut: 'HUMAN_INTERVIEW_COMPLETED',
      human_interview: { date: '2026-09-10', statut: 'HUMAN_INTERVIEW_COMPLETED' }
    });
    component.openDecision('ACCEPTED');
    expect(component.showDecisionModal()).toBe(true);
    expect(component.pendingDecision()).toBe('ACCEPTED');

    component.confirmHumanDecision();
    expect(component.showDecisionModal()).toBe(false);

    const req = httpMock.expectOne('http://localhost:3000/api/candidatures/1/entretien-humain/decision');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ decision: 'ACCEPTED' });
    req.flush({
      id: '1',
      statut: 'HUMAN_INTERVIEW_ACCEPTED',
      decision: 'ACCEPTED',
      decided_by: 'rh-1',
      decided_at: '2026-09-10T12:00:00.000Z'
    });

    const reload = httpMock.expectOne('http://localhost:3000/api/candidatures/1');
    reload.flush({
      ...mockDetails,
      statut: 'HUMAN_INTERVIEW_ACCEPTED',
      decision: 'ACCEPTED',
      human_interview: { date: '2026-09-10', statut: 'HUMAN_INTERVIEW_COMPLETED' }
    });
    expect(component.success()).toContain('accepté');
    expect(component.details().statut).toBe('HUMAN_INTERVIEW_ACCEPTED');
  });

  it('should reject the candidate via the decision endpoint on confirmation', () => {
    component.details.set({
      ...mockDetails,
      statut: 'HUMAN_INTERVIEW_COMPLETED',
      human_interview: { date: '2026-09-10', statut: 'HUMAN_INTERVIEW_COMPLETED' }
    });
    component.openDecision('REJECTED');
    expect(component.pendingDecision()).toBe('REJECTED');

    component.confirmHumanDecision();

    const req = httpMock.expectOne('http://localhost:3000/api/candidatures/1/entretien-humain/decision');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ decision: 'REJECTED' });
    req.flush({
      id: '1',
      statut: 'HUMAN_INTERVIEW_REJECTED',
      decision: 'REJECTED',
      decided_by: 'rh-1',
      decided_at: '2026-09-10T12:00:00.000Z'
    });

    const reload = httpMock.expectOne('http://localhost:3000/api/candidatures/1');
    reload.flush({
      ...mockDetails,
      statut: 'HUMAN_INTERVIEW_REJECTED',
      decision: 'REJECTED',
      human_interview: { date: '2026-09-10', statut: 'HUMAN_INTERVIEW_COMPLETED' }
    });
    expect(component.success()).toContain('refusé');
    expect(component.details().statut).toBe('HUMAN_INTERVIEW_REJECTED');
  });

  it('should not call the decision endpoint when the modal is dismissed', () => {
    component.details.set({
      ...mockDetails,
      statut: 'HUMAN_INTERVIEW_COMPLETED',
      human_interview: { date: '2026-09-10', statut: 'HUMAN_INTERVIEW_COMPLETED' }
    });
    component.openDecision('ACCEPTED');
    expect(component.showDecisionModal()).toBe(true);

    component.keepDecision();
    expect(component.showDecisionModal()).toBe(false);
    expect(component.pendingDecision()).toBeNull();
    httpMock.expectNone('http://localhost:3000/api/candidatures/1/entretien-humain/decision');
  });

  it('should not call the decision endpoint without a pending decision', () => {
    component.details.set({
      ...mockDetails,
      statut: 'HUMAN_INTERVIEW_COMPLETED',
      human_interview: { date: '2026-09-10', statut: 'HUMAN_INTERVIEW_COMPLETED' }
    });
    component.confirmHumanDecision();
    httpMock.expectNone('http://localhost:3000/api/candidatures/1/entretien-humain/decision');
  });

  it('should map the new decision statuses to badge and label', () => {
    expect(component.getStatutBadge('HUMAN_INTERVIEW_ACCEPTED')).toContain('success');
    expect(component.getStatutLabel('HUMAN_INTERVIEW_ACCEPTED')).toBe('Candidat accepté après entretien humain');
    expect(component.getStatutBadge('HUMAN_INTERVIEW_REJECTED')).toContain('danger');
    expect(component.getStatutLabel('HUMAN_INTERVIEW_REJECTED')).toBe('Candidat refusé après entretien humain');
    expect(component.decisionLabel('ACCEPTED')).toBe('Accepté');
    expect(component.decisionLabel('REJECTED')).toBe('Refusé');
  });

  it('should detect whether the candidate has submitted stage preferences', () => {
    component.details.set({ ...mockDetails, statut: 'HUMAN_INTERVIEW_ACCEPTED', internship_details_submitted_at: null });
    expect(component.hasStagePreferences()).toBe(false);

    component.details.set({
      ...mockDetails,
      statut: 'HUMAN_INTERVIEW_ACCEPTED',
      internship_start_date: '2026-10-05',
      internship_duration_months: 2,
      internship_details_submitted_at: '2026-09-21T09:30:00.000Z'
    });
    expect(component.hasStagePreferences()).toBe(true);
  });

  it('should format the internship duration in months (singular/plural)', () => {
    expect(component.formatDuration(1)).toBe('1 mois');
    expect(component.formatDuration(2)).toBe('2 mois');
    expect(component.formatDuration(6)).toBe('6 mois');
  });

  it('should allow validating the period only when submitted and not yet validated', () => {
    component.details.set({
      ...mockDetails,
      statut: 'HUMAN_INTERVIEW_ACCEPTED',
      internship_start_date: '2026-10-05',
      internship_duration_months: 2,
      internship_details_submitted_at: '2026-09-21T09:30:00.000Z'
    });
    expect(component.canValidateStagePeriod()).toBe(true);

    component.details.set({
      ...mockDetails,
      statut: 'HUMAN_INTERVIEW_ACCEPTED',
      internship_start_date: '2026-10-05',
      internship_duration_months: 2,
      internship_details_submitted_at: '2026-09-21T09:30:00.000Z',
      internship_period_validated_at: '2026-09-25T10:00:00.000Z'
    });
    expect(component.canValidateStagePeriod()).toBe(false);

    component.details.set({
      ...mockDetails,
      statut: 'HUMAN_INTERVIEW_ACCEPTED',
      internship_details_submitted_at: null
    });
    expect(component.canValidateStagePeriod()).toBe(false);
  });

  it('should detect a validated stage period', () => {
    component.details.set({ ...mockDetails, internship_period_validated_at: null });
    expect(component.isStagePeriodValidated()).toBe(false);

    component.details.set({ ...mockDetails, internship_period_validated_at: '2026-09-25T10:00:00.000Z' });
    expect(component.isStagePeriodValidated()).toBe(true);
  });

  it('should validate the stage period via POST when confirmed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.details.set({
      ...mockDetails,
      statut: 'HUMAN_INTERVIEW_ACCEPTED',
      internship_start_date: '2026-10-05',
      internship_duration_months: 2,
      internship_details_submitted_at: '2026-09-21T09:30:00.000Z'
    });
    component.validateStagePeriod();

    const req = httpMock.expectOne('http://localhost:3000/api/candidatures/1/stage-preferences/validate');
    expect(req.request.method).toBe('POST');
    req.flush({ internship_period_validated_at: '2026-09-25T10:00:00.000Z' });

    const reload = httpMock.expectOne('http://localhost:3000/api/candidatures/1');
    reload.flush({ ...mockDetails, internship_period_validated_at: '2026-09-25T10:00:00.000Z' });
    expect(component.success()).toContain('La période de stage a été validée.');
    expect(component.isStagePeriodValidated()).toBe(true);
  });

  it('should not call the validation endpoint when confirmation is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    component.details.set({
      ...mockDetails,
      statut: 'HUMAN_INTERVIEW_ACCEPTED',
      internship_start_date: '2026-10-05',
      internship_duration_months: 2,
      internship_details_submitted_at: '2026-09-21T09:30:00.000Z'
    });
    component.validateStagePeriod();
    httpMock.expectNone('http://localhost:3000/api/candidatures/1/stage-preferences/validate');
  });

  it('should request a stage period modification via POST when confirmed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.details.set({
      ...mockDetails,
      statut: 'HUMAN_INTERVIEW_ACCEPTED',
      internship_start_date: '2026-10-05',
      internship_duration_months: 2,
      internship_details_submitted_at: '2026-09-21T09:30:00.000Z'
    });
    component.requestStagePeriodModification();

    const req = httpMock.expectOne('http://localhost:3000/api/candidatures/1/stage-preferences/request-modification');
    expect(req.request.method).toBe('POST');
    req.flush({ internship_modification_requested_at: '2026-09-23T14:00:00.000Z' });

    const reload = httpMock.expectOne('http://localhost:3000/api/candidatures/1');
    reload.flush({ ...mockDetails, internship_modification_requested_at: '2026-09-23T14:00:00.000Z' });
    expect(component.success()).toContain('modification de la période de stage');
  });

  it('should map the period audit decisions to labels and badges', () => {
    expect(component.decisionLabel('VALIDATED')).toBe('Période validée');
    expect(component.decisionLabel('MODIFICATION_REQUESTED')).toBe('Modification demandée');
    expect(component.decisionBadgeClass('VALIDATED')).toContain('info');
    expect(component.decisionBadgeClass('MODIFICATION_REQUESTED')).toContain('warning');
    expect(component.decisionBadgeClass('ACCEPTED')).toContain('success');
    expect(component.decisionBadgeClass('REJECTED')).toContain('danger');
  });

  it('should map the mobile access states to labels and badges', () => {
    component.details.set({
      ...mockDetails,
      internship_period_validated_at: '2026-09-25T10:00:00.000Z',
      internship_start_date: '2099-10-05',
      mobile_access: { prepared_at: '2026-09-25T10:00:00.000Z', email_state: 'PENDING', email_planned_for: '2099-10-04' }
    });
    expect(component.mobileAccessStateLabel()).toBe('Compte en préparation');
    expect(component.mobileAccessBadgeClass()).toContain('warning');

    component.details.set({
      ...mockDetails,
      internship_start_date: '2020-10-05',
      mobile_access: { prepared_at: '2026-09-25T10:00:00.000Z', email_state: 'PENDING', email_planned_for: '2020-10-04' }
    });
    expect(component.mobileAccessStateLabel()).toBe('Email d\'accès programmé');
    expect(component.mobileAccessBadgeClass()).toContain('info');

    component.details.set({
      ...mockDetails,
      mobile_access: { prepared_at: '2026-09-25T10:00:00.000Z', email_state: 'SENT', email_sent_at: '2026-10-04T08:00:00.000Z', email_planned_for: '2020-10-04' }
    });
    expect(component.mobileAccessStateLabel()).toBe('Email d\'accès envoyé');
    expect(component.mobileAccessBadgeClass()).toContain('success');

    component.details.set({
      ...mockDetails,
      mobile_access: { prepared_at: '2026-09-25T10:00:00.000Z', email_state: 'ERROR', email_error: 'SMTP down', email_planned_for: '2020-10-04' }
    });
    expect(component.mobileAccessStateLabel()).toBe('Erreur d\'envoi — nouvelle tentative prévue');
    expect(component.mobileAccessBadgeClass()).toContain('danger');
  });

  it('should expose the planned email date (DD/MM/YYYY) and the sent timestamp', () => {
    component.details.set({
      ...mockDetails,
      internship_start_date: '2026-08-15',
      mobile_access: { prepared_at: '2026-07-01T10:00:00.000Z', email_state: 'PENDING', email_planned_for: '2026-08-14', email_sent_at: null }
    });
    expect(component.mobileAccessPlannedDate()).toBe('14/08/2026');
    expect(component.mobileAccessSentAt()).toBeNull();
    expect(component.isMobileEmailDue()).toBe(true);

    component.details.set({
      ...mockDetails,
      mobile_access: { prepared_at: '2026-07-01T10:00:00.000Z', email_state: 'SENT', email_planned_for: '2026-08-14', email_sent_at: '2026-08-14T08:00:00.000Z' }
    });
    expect(component.mobileAccessSentAt()).toBe('2026-08-14T08:00:00.000Z');
  });

  it('should treat a future planned email date as not yet due', () => {
    component.details.set({
      ...mockDetails,
      internship_start_date: '2099-10-05',
      mobile_access: { prepared_at: '2026-09-25T10:00:00.000Z', email_state: 'PENDING', email_planned_for: '2099-10-04' }
    });
    expect(component.isMobileEmailDue()).toBe(false);
  });

  it('should handle missing mobile access data gracefully', () => {
    component.details.set({ ...mockDetails });
    expect(component.mobileAccess()).toBeNull();
    expect(component.mobileAccessStateLabel()).toBe('—');
    expect(component.mobileAccessPlannedDate()).toBe('—');
    expect(component.mobileAccessSentAt()).toBeNull();
    expect(component.isMobileEmailDue()).toBe(false);
  });

  it('should map document statuses to labels and badges', () => {
    component.details.set({ ...mockDetails, ...mockDocuments });
    const [cv, cin, demande, lettre] = component.onboardingDocuments();
    expect(component.documentStatus(cv)).toBe('REVIEW_REQUIRED');
    expect(component.documentStatusLabel(cv)).toBe('Nécessite une vérification');
    expect(component.documentBadgeClass(cv)).toContain('warning');
    expect(component.documentStatus(cin)).toBe('REJETE');
    expect(component.documentStatusLabel(cin)).toBe('Document rejeté');
    expect(component.documentBadgeClass(cin)).toContain('danger');
    expect(component.documentStatus(demande)).toBe('VALIDE');
    expect(component.documentStatusLabel(demande)).toBe('Document validé');
    expect(component.documentBadgeClass(demande)).toContain('success');
    expect(component.documentStatus(lettre)).toBe('MANQUANT');
    expect(component.documentStatusLabel(lettre)).toBe('Document manquant');
  });

  it('should expose the onboarding documents and the progress label', () => {
    component.details.set({ ...mockDetails, ...mockDocuments });
    expect(component.onboardingDocuments().length).toBe(4);
    expect(component.onboardingProgressLabel()).toBe('3 / 4 documents déposés');
  });

  it('should allow the RH to review only documents awaiting manual verification', () => {
    component.details.set({ ...mockDetails, ...mockDocuments });
    const [cv, cin, demande, lettre] = component.onboardingDocuments();
    expect(component.canReviewDocument(cv)).toBe(true);
    expect(component.canReviewDocument(cin)).toBe(false);
    expect(component.canReviewDocument(demande)).toBe(false);
    expect(component.canReviewDocument(lettre)).toBe(false);
  });

  it('should not allow a non-decider role to review documents', () => {
    authService.saveUser({ id: 's-1', role: 'STAGIAIRE', nom: 'X', prenom: 'Y', email: 'x@steg.tn' });
    component.details.set({ ...mockDetails, ...mockDocuments });
    expect(component.canReviewDocument(component.onboardingDocuments()[0])).toBe(false);
  });

  it('should validate a document via PATCH when confirmed', () => {
    component.details.set({ ...mockDetails, ...mockDocuments });
    const doc = component.onboardingDocuments()[0];
    component.openDocumentDecision(doc, 'VALID');
    expect(component.showDocumentModal()).toBe(true);
    expect(component.documentDecision()).toBe('VALID');

    component.confirmDocumentDecision();
    expect(component.showDocumentModal()).toBe(false);

    const req = httpMock.expectOne('http://localhost:3000/api/candidatures/1/documents/d1/verification');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'VALID' });
    req.flush({ document: { id: 'd1', verification_status: 'VALID' }, message: 'Le document CV a été validé.' });

    const reload = httpMock.expectOne('http://localhost:3000/api/candidatures/1');
    reload.flush({ ...mockDetails, ...mockDocuments });
    expect(component.success()).toContain('a été validé');
  });

  it('should reject a document via PATCH with the reason when confirmed', () => {
    component.details.set({ ...mockDetails, ...mockDocuments });
    const doc = component.onboardingDocuments()[0];
    component.openDocumentDecision(doc, 'REJECTED');
    component.documentRejectedReason.set('CIN illisible');
    component.confirmDocumentDecision();

    const req = httpMock.expectOne('http://localhost:3000/api/candidatures/1/documents/d1/verification');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'REJECTED', rejected_reason: 'CIN illisible' });
    req.flush({ document: { id: 'd1', verification_status: 'REJECTED' }, message: 'Le document CV a été rejeté.' });

    const reload = httpMock.expectOne('http://localhost:3000/api/candidatures/1');
    reload.flush({ ...mockDetails, ...mockDocuments });
    expect(component.success()).toContain('a été rejeté');
  });

  it('should not call PATCH for a rejection without a reason', () => {
    component.details.set({ ...mockDetails, ...mockDocuments });
    const doc = component.onboardingDocuments()[0];
    component.openDocumentDecision(doc, 'REJECTED');
    component.confirmDocumentDecision();
    expect(component.error()).toContain('motif');
    expect(component.showDocumentModal()).toBe(true);
    httpMock.expectNone('http://localhost:3000/api/candidatures/1/documents/d1/verification');
  });

  it('should keep the modal open when the document decision dialog is dismissed', () => {
    component.details.set({ ...mockDetails, ...mockDocuments });
    const doc = component.onboardingDocuments()[0];
    component.openDocumentDecision(doc, 'VALID');
    expect(component.showDocumentModal()).toBe(true);
    component.keepDocumentDecision();
    expect(component.showDocumentModal()).toBe(false);
    expect(component.pendingDocument()).toBeNull();
    expect(component.documentDecision()).toBeNull();
    httpMock.expectNone('http://localhost:3000/api/candidatures/1/documents/d1/verification');
  });

  it('should download an onboarding document as blob', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    component.details.set({ ...mockDetails, ...mockDocuments });
    const doc = component.onboardingDocuments()[0];
    component.downloadOnboardingDocument(doc);
    const req = httpMock.expectOne('http://localhost:3000/api/candidatures/1/documents/d1/download');
    expect(req.request.method).toBe('GET');
    req.flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('should display "Dossier complet" when every required element is validated', () => {
    component.details.set({
      ...mockDetails,
      ...mockDocuments,
      statut: 'HUMAN_INTERVIEW_ACCEPTED',
      internship_period_validated_at: '2026-09-12T10:00:00Z'
    });
    component.readiness.set(mockReadinessComplete);

    expect(component.dossierReady()).toBe(true);
    expect(component.dossierVerdictLabel()).toBe('Dossier complet');
    expect(component.dossierVerdictBadgeClass()).toBe('badge bg-success');
    expect(component.dossierPendingItems()).toEqual([]);
    const items = component.dossierItems();
    expect(items).toHaveLength(6);
    for (const item of items) {
      expect(item.state).toBe('VALID');
    }
  });

  it('should display "Dossier incomplet" with the missing and invalid elements', () => {
    component.details.set({ ...mockDetails, ...mockDocuments, statut: 'HUMAN_INTERVIEW_ACCEPTED' });
    component.readiness.set(mockReadinessIncomplete);

    expect(component.dossierReady()).toBe(false);
    expect(component.dossierVerdictLabel()).toBe('Dossier incomplet');
    expect(component.dossierVerdictBadgeClass()).toBe('badge bg-danger');
    expect(component.dossierPendingItems()).toEqual([
      'Lettre d’affectation',
      'CV',
      'Carte d’identité (CIN)'
    ]);
  });

  it('should mark a missing document as "Manquant" in the dossier checklist', () => {
    component.details.set({ ...mockDetails, statut: 'HUMAN_INTERVIEW_ACCEPTED' });
    component.readiness.set(mockReadinessIncomplete);

    const lettre = component.dossierItems().find((i) => i.label === 'Lettre d’affectation');
    expect(lettre.state).toBe('MANQUANT');
    expect(component.dossierStateLabel(lettre.state)).toBe('Manquant');
  });

  it('should mark a rejected document as "Rejeté" in the dossier checklist', () => {
    component.details.set({ ...mockDetails, statut: 'HUMAN_INTERVIEW_ACCEPTED' });
    component.readiness.set(mockReadinessIncomplete);

    const cin = component.dossierItems().find((i) => i.label === 'Carte d’identité (CIN)');
    expect(cin.state).toBe('REJECTED');
    expect(component.dossierStateLabel(cin.state)).toBe('Rejeté');
    expect(cin.badgeClass).toBe('badge bg-danger');
  });

  it('should fetch the dossier readiness from the backend after loading details', () => {
    component.ngOnInit();
    httpMock.expectOne('http://localhost:3000/api/candidatures/1').flush(mockDetails);
    const req = httpMock.expectOne('http://localhost:3000/api/candidatures/1/internship-readiness');
    expect(req.request.method).toBe('GET');
    req.flush(mockReadinessComplete);
    expect(component.readinessLoading()).toBe(false);
    expect(component.readiness()?.ready).toBe(true);
  });

  const readyDetails = {
    ...mockDetails,
    statut: 'HUMAN_INTERVIEW_ACCEPTED',
    internship_start_date: '2026-10-05',
    internship_duration_months: 2,
    internship_details_submitted_at: '2026-09-21T09:30:00.000Z',
    internship_period_validated_at: '2026-09-25T10:00:00.000Z'
  };

  const mockStageCreated = {
    stage_id: 'st-1',
    stagiaire_id: 'sg-1',
    date_debut: '2026-10-05',
    date_fin: '2026-12-05',
    statut: 'EN_COURS',
    offre_titre: 'Stage Dev',
    departement_nom: 'IT',
    encadrant: { id: 'e-1', nom: 'Bensalah', prenom: 'Ahmed' }
  };

  it('should allow creating the trainee only when the dossier is complete and the period is validated', () => {
    component.details.set(readyDetails);
    component.readiness.set(mockReadinessComplete);
    expect(component.canConvertToTrainee()).toBe(true);

    component.details.set({ ...readyDetails, internship_period_validated_at: null });
    expect(component.canConvertToTrainee()).toBe(false);
  });

  it('should open the conversion confirmation modal without calling the API', () => {
    component.details.set(readyDetails);
    component.readiness.set(mockReadinessComplete);
    component.openConvertModal();
    expect(component.showConvertModal()).toBe(true);

    component.keepConvert();
    expect(component.showConvertModal()).toBe(false);
    httpMock.expectNone('http://localhost:3000/api/candidatures/1/convert-to-trainee');
  });

  it('should confirm the trainee creation via POST and show the success card', () => {
    component.details.set(readyDetails);
    component.readiness.set(mockReadinessComplete);
    component.openConvertModal();
    component.confirmConvert();
    expect(component.showConvertModal()).toBe(false);

    const req = httpMock.expectOne('http://localhost:3000/api/candidatures/1/convert-to-trainee');
    expect(req.request.method).toBe('POST');
    req.flush({
      candidature_id: '1',
      statut: 'STAGIAIRE_CREATED',
      already_converted: false,
      stagiaire_id: 'sg-1',
      stage_id: 'st-1',
      stagiaire: { id: 'sg-1', nom: 'Sassi', prenom: 'Marwa', email: 'candidat@steg.tn' },
      stage: { ...mockStageCreated }
    });

    const reload = httpMock.expectOne('http://localhost:3000/api/candidatures/1');
    reload.flush({ ...mockDetails, statut: 'STAGIAIRE_CREATED', stage_created: mockStageCreated });
    expect(component.success()).toContain('stagiaire');
    expect(component.isConverted()).toBe(true);
    expect(component.stageCreated()).toBe(true);
    expect(component.dossierReady()).toBe(true);
  });

  it('should not allow conversion when the dossier is incomplete', () => {
    component.details.set(readyDetails);
    component.readiness.set(mockReadinessIncomplete);
    expect(component.dossierReady()).toBe(false);
    expect(component.canConvertToTrainee()).toBe(false);
  });

  it('should not allow conversion for a non-decider role', () => {
    authService.saveUser({ id: 's-1', role: 'STAGIAIRE', nom: 'X', prenom: 'Y', email: 'x@steg.tn' });
    component.details.set(readyDetails);
    component.readiness.set(mockReadinessComplete);
    expect(component.canConvertToTrainee()).toBe(false);
  });

  it('should treat an already-converted candidature (STAGIAIRE_CREATED) as complete and not reconvertible', () => {
    component.details.set({ ...mockDetails, statut: 'STAGIAIRE_CREATED', stage_created: mockStageCreated });
    expect(component.isConverted()).toBe(true);
    expect(component.stageCreated()).toBe(true);
    expect(component.dossierReady()).toBe(true);
    expect(component.dossierPendingItems()).toEqual([]);
    expect(component.canConvertToTrainee()).toBe(false);
    expect(component.getStatutLabel('STAGIAIRE_CREATED')).toBe('Stagiaire créé');
    expect(component.getStatutBadge('STAGIAIRE_CREATED')).toContain('primary');
    expect(component.decisionLabel('CONVERTED')).toBe('Converti en stagiaire');
    expect(component.decisionBadgeClass('CONVERTED')).toContain('success');
  });

  it('should surface the backend error when the trainee creation fails', () => {
    component.details.set(readyDetails);
    component.readiness.set(mockReadinessComplete);
    component.openConvertModal();
    component.confirmConvert();

    const req = httpMock.expectOne('http://localhost:3000/api/candidatures/1/convert-to-trainee');
    req.flush(
      { message: 'Impossible de créer le stagiaire : des documents du dossier sont invalides.' },
      { status: 500, statusText: 'Internal Server Error' }
    );
    expect(component.error()).toContain('Impossible de créer le stagiaire');
    expect(component.busy()).toBe(false);
    expect(component.stageCreated()).toBe(false);
  });
});
