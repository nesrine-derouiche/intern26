import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from 'src/app/core/data/auth.service';
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

    const req = httpMock.expectOne('http://localhost:3000/api/taches/1/subtasks');
    expect(req.request.method).toBe('GET');
    req.flush({ subtasks: [], aggregate: { total: 0, progress: null, empty: true } });

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

  it('should load subtasks with aggregate when opening detail', () => {
    component.openDetail({ id: '1', titre: 'T' });

    const req = httpMock.expectOne('http://localhost:3000/api/taches/1/subtasks');
    expect(req.request.method).toBe('GET');
    req.flush({
      subtasks: [{ id: 's1', tache_id: '1', titre: 'S1', statut: 'TODO' }],
      aggregate: { total: 1, todo: 1, in_progress: 0, done: 0, progress: 0, empty: false }
    });

    expect(component.subtasks().length).toBe(1);
    expect(component.subtaskAggregate()?.progress).toBe(0);
    expect(component.subtasksLoading()).toBe(false);
  });

  it('should surface subtask loading errors', () => {
    component.openDetail({ id: '1', titre: 'T' });

    const req = httpMock.expectOne('http://localhost:3000/api/taches/1/subtasks');
    req.flush({ success: false, message: 'Erreur.' }, { status: 500, statusText: 'Server Error' });

    expect(component.subtasksLoading()).toBe(false);
    expect(component.subtaskError()).toBe('Erreur.');
  });

  it('should open add subtask modal with defaults', () => {
    component.openAddSubtask();
    expect(component.showSubtaskModal()).toBeTruthy();
    expect(component.editingSubtaskId).toBeNull();
    expect(component.subtaskForm.statut).toBe('TODO');
  });

  it('should open edit subtask modal with data', () => {
    component.openEditSubtask({ id: 's1', tache_id: '1', titre: 'S1', description: 'D', statut: 'DONE' });
    expect(component.showSubtaskModal()).toBeTruthy();
    expect(component.editingSubtaskId).toBe('s1');
    expect(component.subtaskForm.titre).toBe('S1');
    expect(component.subtaskForm.statut).toBe('DONE');
  });

  it('should reject empty subtask titre without calling the API', () => {
    component.selectedTask.set({ id: '1' });
    component.subtaskForm = { titre: '   ', description: '', statut: 'TODO' };
    component.saveSubtask();
    expect(component.subtaskError()).toContain('titre');
    httpMock.expectNone('http://localhost:3000/api/taches/1/subtasks');
  });

  it('should create a subtask via POST then reload the list', () => {
    component.selectedTask.set({ id: '1' });
    component.subtaskForm = { titre: 'Nouvelle', description: '', statut: 'TODO' };
    component.saveSubtask();

    const post = httpMock.expectOne('http://localhost:3000/api/taches/1/subtasks');
    expect(post.request.method).toBe('POST');
    expect(post.request.body.titre).toBe('Nouvelle');
    post.flush({ message: 'Sous-tâche créée.', subtask: { id: 's9' } });

    const reload = httpMock.expectOne('http://localhost:3000/api/taches/1/subtasks');
    expect(reload.request.method).toBe('GET');
    reload.flush({ subtasks: [], aggregate: { total: 0, progress: null, empty: true } });
    expect(component.showSubtaskModal()).toBe(false);
  });

  it('should update a subtask via PUT then reload the list', () => {
    component.selectedTask.set({ id: '1' });
    component.editingSubtaskId = 's1';
    component.subtaskForm = { titre: 'Renommée', description: '', statut: 'IN_PROGRESS' };
    component.saveSubtask();

    const put = httpMock.expectOne('http://localhost:3000/api/subtasks/s1');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body.titre).toBe('Renommée');
    put.flush({ message: 'OK', subtask: { id: 's1' } });

    const reload = httpMock.expectOne('http://localhost:3000/api/taches/1/subtasks');
    reload.flush({ subtasks: [], aggregate: { total: 0, progress: null, empty: true } });
  });

  it('should update a subtask status via PATCH then reload the list', () => {
    component.selectedTask.set({ id: '1' });
    component.updateSubtaskStatus('s1', 'DONE');

    const patch = httpMock.expectOne('http://localhost:3000/api/subtasks/s1/status');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body.statut).toBe('DONE');
    patch.flush({ message: 'OK', subtask: { id: 's1', statut: 'DONE' } });

    const reload = httpMock.expectOne('http://localhost:3000/api/taches/1/subtasks');
    reload.flush({ subtasks: [], aggregate: { total: 0, progress: null, empty: true } });
  });

  it('should delete a subtask after confirmation then reload the list', () => {
    const globalScope = globalThis as unknown as {
      confirm?: (message?: string) => boolean;
    };
    const originalConfirm = globalScope.confirm;
    globalScope.confirm = () => true;
    component.selectedTask.set({ id: '1' });
    component.deleteSubtask('s1');

    const del = httpMock.expectOne('http://localhost:3000/api/subtasks/s1');
    expect(del.request.method).toBe('DELETE');
    del.flush({ message: 'Sous-tâche supprimée.' });

    const reload = httpMock.expectOne('http://localhost:3000/api/taches/1/subtasks');
    reload.flush({ subtasks: [], aggregate: { total: 0, progress: null, empty: true } });
    globalScope.confirm = originalConfirm;
  });

  it('should restrict management to the ENCADRANT role', () => {
    const authService = TestBed.inject(AuthService);
    authService.saveUser({ id: 'e1', role: 'ENCADRANT', nom: 'Ben', prenom: 'Ali', email: 'e@steg.tn' });
    expect(component.isEncadrant).toBe(true);

    authService.saveUser({ id: 'a1', role: 'ADMIN', nom: 'A', prenom: 'B', email: 'a@steg.tn' });
    expect(component.isEncadrant).toBe(false);

    authService.saveUser({ id: 'r1', role: 'RH', nom: 'R', prenom: 'H', email: 'r@steg.tn' });
    expect(component.isEncadrant).toBe(false);
  });

  it('should return correct subtask status badges and labels', () => {
    expect(component.getSubtaskStatusBadge('DONE')).toContain('success');
    expect(component.getSubtaskStatusBadge('IN_PROGRESS')).toContain('primary');
    expect(component.getSubtaskStatusBadge('TODO')).toContain('secondary');
    expect(component.getSubtaskStatusLabel('DONE')).toBe('Terminée');
    expect(component.getSubtaskStatusLabel('IN_PROGRESS')).toBe('En cours');
    expect(component.getSubtaskStatusLabel('TODO')).toBe('À faire');
  });
});
