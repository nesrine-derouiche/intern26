import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { EvaluationsComponent } from './evaluations.component';

describe('EvaluationsComponent', () => {
  let component: EvaluationsComponent;
  let httpMock: HttpTestingController;

  const mockEvaluations = [
    { id: '1', stagiaire_nom: 'Ali', stagiaire_prenom: 'Ben', encadrant_nom: 'Said', encadrant_prenom: 'Mohamed', note_finale: 16.5, date_evaluation: '2025-06-01', commentaire: 'Excellent travail' },
    { id: '2', stagiaire_nom: 'Karim', stagiaire_prenom: 'Trabelsi', encadrant_nom: 'Nadia', encadrant_prenom: 'Ben Ali', note_finale: 12.0, date_evaluation: '2025-07-15', commentaire: 'Bon résultat' }
  ];

  function flushLoadAll() {
    const evalsReq = httpMock.expectOne('http://localhost:3000/api/evaluations');
    evalsReq.flush([]);
    const stagesReq = httpMock.expectOne('http://localhost:3000/api/stages');
    stagesReq.flush([]);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EvaluationsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    const fixture = TestBed.createComponent(EvaluationsComponent);
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

  it('should load evaluations and stages on init', () => {
    component.ngOnInit();

    const evalsReq = httpMock.expectOne('http://localhost:3000/api/evaluations');
    const stagesReq = httpMock.expectOne('http://localhost:3000/api/stages');

    evalsReq.flush(mockEvaluations);
    stagesReq.flush([{ id: 's1', stagiaire_nom: 'Ali', stagiaire_prenom: 'Ben', departement_nom: 'IT' }]);

    expect(component.evaluations().length).toBe(2);
    expect(component.stages().length).toBe(1);
  });

  it('should filter by search term (stagiaire name)', () => {
    component.evaluations.set(mockEvaluations);
    component.searchTerm.set('Ali');
    expect(component.filtered().length).toBe(1);
  });

  it('should filter by search term (prenom)', () => {
    component.evaluations.set(mockEvaluations);
    component.searchTerm.set('Karim');
    expect(component.filtered().length).toBe(1);
    expect(component.filtered()[0].stagiaire_nom).toBe('Karim');
  });

  it('should show all when search is empty', () => {
    component.evaluations.set(mockEvaluations);
    component.searchTerm.set('');
    expect(component.filtered().length).toBe(2);
  });

  it('should open add modal with default form', () => {
    component.openAdd();
    expect(component.showModal()).toBeTruthy();
    expect(component.form.stage_id).toBe('');
    expect(component.form.technique).toBe(5);
    expect(component.form.communication).toBe(5);
    expect(component.form.autonomie).toBe(5);
    expect(component.form.ponctualite).toBe(5);
    expect(component.form.qualite).toBe(5);
  });

  it('should close modal', () => {
    component.showModal.set(true);
    component.closeModal();
    expect(component.showModal()).toBeFalsy();
  });

  it('should show error when saving without stage_id', () => {
    component.form.stage_id = '';
    component.save();
    expect(component.error()).toContain('stage');
  });

  it('should send POST when creating evaluation', () => {
    component.form = { stage_id: 's1', technique: 15, communication: 14, autonomie: 16, ponctualite: 18, qualite: 17, commentaire: 'Bien' };
    component.save();

    const req = httpMock.expectOne('http://localhost:3000/api/evaluations');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.stage_id).toBe('s1');
    req.flush({ message: 'Évaluation créée.' });
    flushLoadAll();
  });

  it('should calculate note correctly', () => {
    component.form = { technique: 16, communication: 14, autonomie: 18, ponctualite: 12, qualite: 20, commentaire: '' };
    const note = component.calcNote();
    expect(note).toBe(16);
  });

  it('should handle decimal notes correctly', () => {
    component.form = { technique: 15, communication: 13, autonomie: 17, ponctualite: 11, qualite: 19, commentaire: '' };
    const note = component.calcNote();
    expect(note).toBe(15);
  });

  it('should return correct note badges', () => {
    expect(component.getNoteBadge(18)).toContain('success');
    expect(component.getNoteBadge(15)).toContain('success');
    expect(component.getNoteBadge(12)).toContain('warning');
    expect(component.getNoteBadge(10)).toContain('warning');
    expect(component.getNoteBadge(8)).toContain('danger');
    expect(component.getNoteBadge(5)).toContain('danger');
  });

  it('should delete evaluation after confirm', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.delete('1');
    const req = httpMock.expectOne('http://localhost:3000/api/evaluations/1');
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'OK' });
    flushLoadAll();
  });

  it('should not delete when confirm is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    component.delete('1');
    const reqs = httpMock.match('http://localhost:3000/api/evaluations/1');
    expect(reqs.length).toBe(0);
  });
});
