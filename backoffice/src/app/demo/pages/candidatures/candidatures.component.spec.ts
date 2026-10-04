import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { CandidaturesComponent } from './candidatures.component';

describe('CandidaturesComponent', () => {
  let component: CandidaturesComponent;
  let httpMock: HttpTestingController;

  const mockCandidatures = [
    { id: '1', stagiaire_nom: 'Ali', stagiaire_prenom: 'Ben', offre_titre: 'Stage Dev', departement_nom: 'IT', statut: 'EN_ATTENTE', date_candidature: '2025-01-10' },
    { id: '2', stagiaire_nom: 'Karim', stagiaire_prenom: 'Trabelsi', offre_titre: 'Stage RH', departement_nom: 'RH', statut: 'ACCEPTEE', date_candidature: '2025-02-15' },
    { id: '3', stagiaire_nom: 'Sami', stagiaire_prenom: 'Bouazizi', offre_titre: 'Stage Dev', departement_nom: 'IT', statut: 'REFUSEE', date_candidature: '2025-03-01' }
  ];

  function flushLoadAll() {
    const candReq = httpMock.expectOne('http://localhost:3000/api/candidatures');
    candReq.flush([]);
    const offresReq = httpMock.expectOne('http://localhost:3000/api/offres');
    offresReq.flush([]);
    const stagiairesReq = httpMock.expectOne('http://localhost:3000/api/stagiaires');
    stagiairesReq.flush([]);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CandidaturesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    const fixture = TestBed.createComponent(CandidaturesComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock?.verify();
    TestBed.resetTestingModule();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load candidatures, offres, and stagiaires on init', () => {
    component.ngOnInit();

    const candReq = httpMock.expectOne('http://localhost:3000/api/candidatures');
    const offresReq = httpMock.expectOne('http://localhost:3000/api/offres');
    const stagiairesReq = httpMock.expectOne('http://localhost:3000/api/stagiaires');

    candReq.flush(mockCandidatures);
    offresReq.flush([{ id: 'o1', titre: 'Stage Dev' }]);
    stagiairesReq.flush([{ id: 's1', nom: 'Ali', prenom: 'Ben' }]);

    expect(component.candidatures().length).toBe(3);
    expect(component.offres().length).toBe(1);
    expect(component.stagiaires().length).toBe(1);
  });

  it('should filter by search term (stagiaire name)', () => {
    component.candidatures.set(mockCandidatures);
    component.searchTerm.set('Ali');
    expect(component.filtered().length).toBe(1);
    expect(component.filtered()[0].stagiaire_nom).toBe('Ali');
  });

  it('should filter by search term (offre titre)', () => {
    component.candidatures.set(mockCandidatures);
    component.searchTerm.set('RH');
    expect(component.filtered().length).toBe(1);
    expect(component.filtered()[0].offre_titre).toBe('Stage RH');
  });

  it('should filter by status', () => {
    component.candidatures.set(mockCandidatures);
    component.filterStatus.set('EN_ATTENTE');
    expect(component.filtered().length).toBe(1);
    expect(component.filtered()[0].statut).toBe('EN_ATTENTE');
  });

  it('should show all when filter is tous', () => {
    component.candidatures.set(mockCandidatures);
    component.filterStatus.set('tous');
    expect(component.filtered().length).toBe(3);
  });

  it('should combine search and status filters', () => {
    component.candidatures.set(mockCandidatures);
    component.searchTerm.set('Stage Dev');
    component.filterStatus.set('REFUSEE');
    expect(component.filtered().length).toBe(1);
    expect(component.filtered()[0].statut).toBe('REFUSEE');
  });

  it('should open add modal', () => {
    component.openAdd();
    expect(component.showModal()).toBeTruthy();
    expect(component.form.stagiaire_id).toBe('');
    expect(component.form.offre_id).toBe('');
  });

  it('should close modal', () => {
    component.showModal.set(true);
    component.closeModal();
    expect(component.showModal()).toBeFalsy();
  });

  it('should show error when saving with empty fields', () => {
    component.form = { stagiaire_id: '', offre_id: '' };
    component.save();
    expect(component.error()).toContain('sélectionner');
  });

  it('should send POST when creating candidature', () => {
    component.form = { stagiaire_id: 's1', offre_id: 'o1' };
    component.save();

    const req = httpMock.expectOne('http://localhost:3000/api/candidatures');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.stagiaire_id).toBe('s1');
    req.flush({ message: 'Candidature créée.' });
    flushLoadAll();
  });

  it('should update statut', () => {
    component.updateStatut('1', 'ACCEPTEE');
    const req = httpMock.expectOne('http://localhost:3000/api/candidatures/1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.statut).toBe('ACCEPTEE');
    req.flush({ message: 'OK' });
    flushLoadAll();
  });

  it('should return correct statut badges', () => {
    expect(component.getStatutBadge('ACCEPTEE')).toContain('success');
    expect(component.getStatutBadge('REFUSEE')).toContain('danger');
    expect(component.getStatutBadge('AI_INTERVIEW_PASSED')).toContain('success');
    expect(component.getStatutBadge('AI_INTERVIEW_FAILED')).toContain('danger');
    expect(component.getStatutBadge('EN_ATTENTE')).toContain('warning');
  });

  it('should return correct statut labels', () => {
    expect(component.getStatutLabel('ACCEPTEE')).toBe('Acceptée');
    expect(component.getStatutLabel('REFUSEE')).toBe('Refusée');
    expect(component.getStatutLabel('EN_ATTENTE')).toBe('En attente');
    expect(component.getStatutLabel('RH_ACCEPTED')).toBe('Acceptée pour entretien IA');
    expect(component.getStatutLabel('AI_INTERVIEW_PASSED')).toBe('Entretien IA réussi');
    expect(component.getStatutLabel('AI_INTERVIEW_FAILED')).toBe('Entretien IA échoué');
  });

  it('should accept for AI interview after confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.acceptForAiInterview('1');
    const req = httpMock.expectOne('http://localhost:3000/api/candidatures/1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.statut).toBe('RH_ACCEPTED');
    req.flush({ message: 'Candidature acceptée pour l’entretien IA.' });
    flushLoadAll();
  });

  it('should not accept for AI interview when confirmation is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    component.acceptForAiInterview('1');
    const reqs = httpMock.match('http://localhost:3000/api/candidatures/1');
    expect(reqs.length).toBe(0);
  });

  it('should delete candidature after confirm', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.delete('1');
    const req = httpMock.expectOne('http://localhost:3000/api/candidatures/1');
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'OK' });
    flushLoadAll();
  });

  it('should not delete when confirm is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    component.delete('1');
    const reqs = httpMock.match('http://localhost:3000/api/candidatures/1');
    expect(reqs.length).toBe(0);
  });
});
