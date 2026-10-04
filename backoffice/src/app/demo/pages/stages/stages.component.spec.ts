import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { StagesComponent } from './stages.component';

describe('StagesComponent', () => {
  let component: StagesComponent;
  let httpMock: HttpTestingController;

  const mockStages = [
    { id: '1', stagiaire_nom: 'Ali', stagiaire_prenom: 'Ben', departement_nom: 'IT', encadrant_nom: 'Said', encadrant_prenom: 'Mohamed', offre_titre: 'Stage Dev', date_debut: '2025-01-01', date_fin: '2025-06-30', statut: 'EN_COURS', nb_projets: '2' },
    { id: '2', stagiaire_nom: 'Karim', stagiaire_prenom: 'Trabelsi', departement_nom: 'RH', encadrant_nom: 'Nadia', encadrant_prenom: 'Ben Ali', offre_titre: 'Stage RH', date_debut: '2025-03-01', date_fin: '2025-08-31', statut: 'TERMINE', nb_projets: '1' },
    { id: '3', stagiaire_nom: 'Sami', stagiaire_prenom: 'Bouazizi', departement_nom: 'IT', encadrant_nom: 'Said', encadrant_prenom: 'Mohamed', offre_titre: 'Stage Web', date_debut: '2025-06-01', date_fin: '2025-12-31', statut: 'EN_ATTENTE', nb_projets: '0' }
  ];

  function flushDetailRequests(stageId: string) {
    const projetsReq = httpMock.expectOne('http://localhost:3000/api/projets');
    projetsReq.flush([]);
    const docsReq = httpMock.expectOne(`http://localhost:3000/api/stages/${stageId}/documents`);
    docsReq.flush([]);
    const reunionsReq = httpMock.expectOne('http://localhost:3000/api/reunions');
    reunionsReq.flush([]);
    const evalsReq = httpMock.expectOne('http://localhost:3000/api/evaluations');
    evalsReq.flush([]);
  }

  function flushStageDetailWithDocs(stageId: string, docs: any[]) {
    const projetsReq = httpMock.expectOne('http://localhost:3000/api/projets');
    projetsReq.flush([]);
    const docsReq = httpMock.expectOne(`http://localhost:3000/api/stages/${stageId}/documents`);
    docsReq.flush(docs);
    const reunionsReq = httpMock.expectOne('http://localhost:3000/api/reunions');
    reunionsReq.flush([]);
    const evalsReq = httpMock.expectOne('http://localhost:3000/api/evaluations');
    evalsReq.flush([]);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StagesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    const fixture = TestBed.createComponent(StagesComponent);
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

  it('should load stages on init', () => {
    component.ngOnInit();
    const req = httpMock.expectOne('http://localhost:3000/api/stages');
    req.flush(mockStages);
    expect(component.stages().length).toBe(3);
  });

  it('should filter stages by search term', () => {
    component.stages.set(mockStages);
    component.searchTerm.set('Ali');
    expect(component.filtered().length).toBe(1);
  });

  it('should filter stages by status', () => {
    component.stages.set(mockStages);
    component.filterStatus.set('EN_COURS');
    expect(component.filtered().length).toBe(1);
    expect(component.filtered()[0].statut).toBe('EN_COURS');
  });

  it('should combine search and status filters', () => {
    component.stages.set(mockStages);
    component.searchTerm.set('IT');
    component.filterStatus.set('TERMINE');
    expect(component.filtered().length).toBe(0);
  });

  it('should compute stats correctly', () => {
    component.stages.set(mockStages);
    expect(component.stats.total).toBe(3);
    expect(component.stats.en_cours).toBe(1);
    expect(component.stats.termine).toBe(1);
    expect(component.stats.en_attente).toBe(1);
  });

  it('should return correct status badge', () => {
    expect(component.getStatusBadge('TERMINE')).toContain('success');
    expect(component.getStatusBadge('EN_COURS')).toContain('primary');
    expect(component.getStatusBadge('SUSPENDU')).toContain('warning');
    expect(component.getStatusBadge('EN_ATTENTE')).toContain('secondary');
  });

  it('should return correct status labels', () => {
    expect(component.getStatusLabel('TERMINE')).toBe('Terminé');
    expect(component.getStatusLabel('EN_COURS')).toBe('En cours');
    expect(component.getStatusLabel('SUSPENDU')).toBe('Suspendu');
    expect(component.getStatusLabel('EN_ATTENTE')).toBe('En attente');
  });

  it('should calculate progress for completed stage', () => {
    expect(component.getProgress({ statut: 'TERMINE' })).toBe(100);
  });

  it('should calculate progress for pending stage', () => {
    expect(component.getProgress({ statut: 'EN_ATTENTE' })).toBe(0);
  });

  it('should calculate progress for suspended stage', () => {
    expect(component.getProgress({ statut: 'SUSPENDU' })).toBe(35);
  });

  it('should open detail panel and flush requests', () => {
    const stage = { ...mockStages[0] };
    component.openDetail(stage);
    expect(component.showDetail()).toBeTruthy();
    expect(component.selectedStage()).toEqual(stage);
    expect(component.activeTab()).toBe('info');
    flushDetailRequests('1');
  });

  it('should close detail clears data', () => {
    component.showDetail.set(true);
    component.selectedStage.set(mockStages[0]);
    component.stageTaches.set([{ id: 't1' }]);
    component.stageDocs.set([{ id: 'd1' }]);
    component.stageReunions.set([{ id: 'r1' }]);
    component.stageEvaluations.set([{ id: 'e1' }]);

    component.closeDetail();
    expect(component.showDetail()).toBeFalsy();
    expect(component.selectedStage()).toBeNull();
    expect(component.stageTaches().length).toBe(0);
    expect(component.stageDocs().length).toBe(0);
    expect(component.stageReunions().length).toBe(0);
    expect(component.stageEvaluations().length).toBe(0);
  });

  it('should switch tabs', () => {
    component.activeTab.set('info');
    component.activeTab.set('taches');
    expect(component.activeTab()).toBe('taches');
  });

  it('should load stage documents on detail open', () => {
    const stage = { ...mockStages[0] };
    component.openDetail(stage);

    flushStageDetailWithDocs('1', [{ id: 'd1', nom: 'CV.pdf', type: 'CV' }]);

    expect(component.stageDocs().length).toBe(1);
    expect(component.stageDocs()[0].nom).toBe('CV.pdf');
  });

  it('should load stage reunions filtered by stage_id', () => {
    const stage = { ...mockStages[0] };
    component.openDetail(stage);

    const projetsReq = httpMock.expectOne('http://localhost:3000/api/projets');
    projetsReq.flush([]);

    const docsReq = httpMock.expectOne('http://localhost:3000/api/stages/1/documents');
    docsReq.flush([]);

    const reunionsReq = httpMock.expectOne('http://localhost:3000/api/reunions');
    reunionsReq.flush([
      { id: 'r1', stage_id: '1', sujet: 'Point hebdo' },
      { id: 'r2', stage_id: '2', sujet: 'Autre réunion' }
    ]);

    const evalsReq = httpMock.expectOne('http://localhost:3000/api/evaluations');
    evalsReq.flush([]);

    expect(component.stageReunions().length).toBe(1);
    expect(component.stageReunions()[0].sujet).toBe('Point hebdo');
  });

  it('should update stage status', () => {
    component.updateStatus('1', 'TERMINE');
    const req = httpMock.expectOne('http://localhost:3000/api/stages/1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.statut).toBe('TERMINE');
    req.flush({ message: 'OK' });
    const stagesReq = httpMock.expectOne('http://localhost:3000/api/stages');
    stagesReq.flush([]);
  });

  it('should return correct document type icons', () => {
    expect(component.getDocTypeIcon('CV')).toContain('id');
    expect(component.getDocTypeIcon('CONVENTION')).toContain('file-text');
    expect(component.getDocTypeIcon('RAPPORT')).toContain('notebook');
  });

  it('should return correct task status badges', () => {
    expect(component.getTaskStatusBadge('TERMINEE')).toContain('success');
    expect(component.getTaskStatusBadge('EN_COURS')).toContain('primary');
    expect(component.getTaskStatusBadge('BLOQUEE')).toContain('danger');
    expect(component.getTaskStatusBadge('A_FAIRE')).toContain('secondary');
  });
});
