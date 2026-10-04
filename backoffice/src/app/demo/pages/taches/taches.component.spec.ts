import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TachesComponent } from './taches.component';

describe('TachesComponent', () => {
  let component: TachesComponent;
  let httpMock: HttpTestingController;

  function flushInitRequests() {
    const tachesReq = httpMock.expectOne('http://localhost:3000/api/taches');
    const projetsReq = httpMock.expectOne('http://localhost:3000/api/projets');
    const stagiairesReq = httpMock.expectOne('http://localhost:3000/api/stagiaires');
    tachesReq.flush([]);
    projetsReq.flush([]);
    stagiairesReq.flush([]);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TachesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    const fixture = TestBed.createComponent(TachesComponent);
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

  it('should load taches, projets, and stagiaires on init', () => {
    component.ngOnInit();

    const tachesReq = httpMock.expectOne('http://localhost:3000/api/taches');
    const projetsReq = httpMock.expectOne('http://localhost:3000/api/projets');
    const stagiairesReq = httpMock.expectOne('http://localhost:3000/api/stagiaires');

    tachesReq.flush([
      { id: '1', titre: 'Tâche 1', statut: 'A_FAIRE', priorite: 'MOYENNE', executant_nom: 'Ben', executant_prenom: 'Ali', projet_titre: 'Projet A' },
      { id: '2', titre: 'Tâche 2', statut: 'TERMINEE', priorite: 'HAUTE', executant_nom: 'Said', executant_prenom: 'Mohamed', projet_titre: 'Projet B' }
    ]);
    projetsReq.flush([{ id: 'p1', titre: 'Projet A' }]);
    stagiairesReq.flush([{ id: 's1', nom: 'Ben', prenom: 'Ali' }]);

    expect(component.taches().length).toBe(2);
    expect(component.projets().length).toBe(1);
    expect(component.stagiaires().length).toBe(1);
  });

  it('should filter by search term', () => {
    component.taches.set([
      { id: '1', titre: 'Développer API', statut: 'EN_COURS', priorite: 'HAUTE', executant_nom: 'Ali' },
      { id: '2', titre: 'Tests unitaires', statut: 'A_FAIRE', priorite: 'MOYENNE', executant_nom: 'Said' }
    ]);

    component.searchTerm.set('API');
    expect(component.filtered().length).toBe(1);
    expect(component.filtered()[0].titre).toBe('Développer API');
  });

  it('should filter by status', () => {
    component.taches.set([
      { id: '1', titre: 'T1', statut: 'A_FAIRE', priorite: 'BASSE', executant_nom: 'X' },
      { id: '2', titre: 'T2', statut: 'EN_COURS', priorite: 'BASSE', executant_nom: 'Y' },
      { id: '3', titre: 'T3', statut: 'TERMINEE', priorite: 'BASSE', executant_nom: 'Z' }
    ]);

    component.filterStatus.set('EN_COURS');
    expect(component.filtered().length).toBe(1);
    expect(component.filtered()[0].statut).toBe('EN_COURS');
  });

  it('should filter by priority', () => {
    component.taches.set([
      { id: '1', titre: 'T1', statut: 'A_FAIRE', priorite: 'BASSE', executant_nom: 'X' },
      { id: '2', titre: 'T2', statut: 'A_FAIRE', priorite: 'HAUTE', executant_nom: 'Y' }
    ]);

    component.filterPriorite.set('HAUTE');
    expect(component.filtered().length).toBe(1);
    expect(component.filtered()[0].priorite).toBe('HAUTE');
  });

  it('should combine search and status filters', () => {
    component.taches.set([
      { id: '1', titre: 'Développer', statut: 'A_FAIRE', priorite: 'BASSE', executant_nom: 'Ali' },
      { id: '2', titre: 'Développer', statut: 'EN_COURS', priorite: 'BASSE', executant_nom: 'Said' },
      { id: '3', titre: 'Tester', statut: 'A_FAIRE', priorite: 'BASSE', executant_nom: 'Ali' }
    ]);

    component.searchTerm.set('Développer');
    component.filterStatus.set('A_FAIRE');
    expect(component.filtered().length).toBe(1);
    expect(component.filtered()[0].titre).toBe('Développer');
    expect(component.filtered()[0].statut).toBe('A_FAIRE');
  });

  it('should compute stats correctly', () => {
    component.taches.set([
      { id: '1', statut: 'A_FAIRE' },
      { id: '2', statut: 'A_FAIRE' },
      { id: '3', statut: 'EN_COURS' },
      { id: '4', statut: 'TERMINEE' },
      { id: '5', statut: 'TERMINEE' },
      { id: '6', statut: 'TERMINEE' },
      { id: '7', statut: 'BLOQUEE' }
    ]);

    expect(component.stats.total).toBe(7);
    expect(component.stats.a_faire).toBe(2);
    expect(component.stats.en_cours).toBe(1);
    expect(component.stats.terminee).toBe(3);
    expect(component.stats.bloquee).toBe(1);
  });

  it('should open add modal with default form', () => {
    component.openAdd();
    expect(component.showModal()).toBeTruthy();
    expect(component.editMode()).toBeFalsy();
    expect(component.form.titre).toBe('');
    expect(component.form.priorite).toBe('MOYENNE');
  });

  it('should open edit modal with task data', () => {
    const task = { id: '1', titre: 'Test', description: 'Desc', projet_id: 'p1', executant_id: 's1', priorite: 'HAUTE', date_debut: '2025-01-01', date_fin: '2025-02-01' };
    component.openEdit(task);
    expect(component.showModal()).toBeTruthy();
    expect(component.editMode()).toBeTruthy();
    expect(component.form.titre).toBe('Test');
    expect(component.editingId).toBe('1');
  });

  it('should open and close detail panel', () => {
    const task = { id: '1', titre: 'Test Task' };
    component.openDetail(task);
    expect(component.showDetail()).toBeTruthy();
    expect(component.selectedTask()).toEqual(task);

    component.closeDetail();
    expect(component.showDetail()).toBeFalsy();
    expect(component.selectedTask()).toBeNull();
  });

  it('should show error when saving with empty required fields', () => {
    component.form = { projet_id: '', executant_id: '', titre: '', description: '', priorite: 'MOYENNE', date_debut: '', date_fin: '' };
    component.save();
    expect(component.error()).toContain('requis');
  });

  it('should send POST when creating a new task', () => {
    component.form = { projet_id: 'p1', executant_id: 's1', titre: 'New Task', description: '', priorite: 'MOYENNE', date_debut: '', date_fin: '' };
    component.editMode.set(false);

    component.save();

    const req = httpMock.expectOne('http://localhost:3000/api/taches');
    expect(req.request.method).toBe('POST');
    req.flush({ message: 'Tâche créée.' });
    flushInitRequests();
  });

  it('should send PUT when editing a task', () => {
    component.form = { projet_id: 'p1', executant_id: 's1', titre: 'Updated', description: '', priorite: 'HAUTE', date_debut: '', date_fin: '' };
    component.editMode.set(true);
    component.editingId = '1';

    component.save();

    const req = httpMock.expectOne('http://localhost:3000/api/taches/1');
    expect(req.request.method).toBe('PUT');
    req.flush({ message: 'Tâche mise à jour.' });
    flushInitRequests();
  });

  it('should send PUT to update status', () => {
    component.updateStatus('1', 'EN_COURS');
    const req = httpMock.expectOne('http://localhost:3000/api/taches/1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.statut).toBe('EN_COURS');
    req.flush({ message: 'OK' });
    flushInitRequests();
  });

  it('should return correct priority badge class', () => {
    expect(component.getPriorityBadge('HAUTE')).toContain('danger');
    expect(component.getPriorityBadge('URGENTE')).toContain('danger');
    expect(component.getPriorityBadge('MOYENNE')).toContain('warning');
    expect(component.getPriorityBadge('BASSE')).toContain('info');
  });

  it('should return correct status badge class', () => {
    expect(component.getStatusBadge('TERMINEE')).toContain('success');
    expect(component.getStatusBadge('EN_COURS')).toContain('primary');
    expect(component.getStatusBadge('BLOQUEE')).toContain('danger');
    expect(component.getStatusBadge('A_FAIRE')).toContain('secondary');
  });

  it('should return correct status labels', () => {
    expect(component.getStatusLabel('TERMINEE')).toBe('Terminée');
    expect(component.getStatusLabel('EN_COURS')).toBe('En cours');
    expect(component.getStatusLabel('BLOQUEE')).toBe('Bloquée');
    expect(component.getStatusLabel('A_FAIRE')).toBe('À faire');
  });

  it('should calculate progress width for completed task', () => {
    const task = { statut: 'TERMINEE', progress: 0 };
    expect(component.getProgressWidth(task)).toBe(100);
  });

  it('should calculate progress width for in-progress task with custom progress', () => {
    const task = { statut: 'EN_COURS', progress: 65 };
    expect(component.getProgressWidth(task)).toBe(65);
  });

  it('should calculate progress width for todo task', () => {
    const task = { statut: 'A_FAIRE', progress: null };
    expect(component.getProgressWidth(task)).toBe(5);
  });

  it('should return correct timeline items', () => {
    const task = {
      id: '1',
      titre: 'Test',
      statut: 'EN_COURS',
      created_at: '2025-01-15T10:00:00Z',
      date_debut: '2025-01-20',
      date_fin: '2025-02-28'
    };
    const timeline = component.getTimeline(task);
    expect(timeline.length).toBe(3);
    expect(timeline[0].label).toBe('Tâche créée');
    expect(timeline[1].label).toBe('Date de début');
    expect(timeline[2].label).toBe('Échéance');
  });
});
