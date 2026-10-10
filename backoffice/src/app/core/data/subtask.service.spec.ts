import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { SubtaskService, Subtask } from './subtask.service';

describe('SubtaskService', () => {
  let service: SubtaskService;
  let httpMock: HttpTestingController;

  const mockSubtask: Subtask = {
    id: 's1',
    tache_id: 't1',
    titre: 'Rédiger',
    description: 'Premier jet',
    statut: 'TODO',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  };

  const mockAggregate = {
    total: 2,
    todo: 1,
    in_progress: 1,
    done: 0,
    progress: 25,
    empty: false
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(SubtaskService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should list subtasks of a task with the aggregate', () => {
    service.listByTask('t1').subscribe((res) => {
      expect(res.subtasks.length).toBe(2);
      expect(res.aggregate.progress).toBe(25);
      expect(res.aggregate.empty).toBe(false);
    });

    const req = httpMock.expectOne('http://localhost:3000/api/taches/t1/subtasks');
    expect(req.request.method).toBe('GET');
    req.flush({ subtasks: [mockSubtask, { ...mockSubtask, id: 's2', statut: 'IN_PROGRESS' }], aggregate: mockAggregate });
  });

  it('should fetch the authoritative progress', () => {
    service.getProgress('t1').subscribe((res) => {
      expect(res.tache_id).toBe('t1');
      expect(res.aggregate.progress).toBe(100);
    });

    const req = httpMock.expectOne('http://localhost:3000/api/taches/t1/progress');
    expect(req.request.method).toBe('GET');
    req.flush({ tache_id: 't1', aggregate: { ...mockAggregate, progress: 100, done: 2 } });
  });

  it('should create a subtask', () => {
    service.create('t1', { titre: 'Relire', description: 'Relecture' }).subscribe((res) => {
      expect(res.subtask.titre).toBe('Relire');
    });

    const req = httpMock.expectOne('http://localhost:3000/api/taches/t1/subtasks');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.titre).toBe('Relire');
    req.flush({ message: 'Sous-tâche créée.', subtask: { ...mockSubtask, titre: 'Relire' } });
  });

  it('should update a subtask', () => {
    service.update('s1', { titre: 'Rédiger v2', statut: 'IN_PROGRESS' }).subscribe((res) => {
      expect(res.subtask.statut).toBe('IN_PROGRESS');
    });

    const req = httpMock.expectOne('http://localhost:3000/api/subtasks/s1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.statut).toBe('IN_PROGRESS');
    req.flush({ message: 'Sous-tâche mise à jour.', subtask: { ...mockSubtask, statut: 'IN_PROGRESS' } });
  });

  it('should update a subtask status', () => {
    service.updateStatus('s1', 'DONE').subscribe((res) => {
      expect(res.subtask.statut).toBe('DONE');
    });

    const req = httpMock.expectOne('http://localhost:3000/api/subtasks/s1/status');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.statut).toBe('DONE');
    req.flush({ message: 'Statut mis à jour.', subtask: { ...mockSubtask, statut: 'DONE' } });
  });

  it('should delete a subtask', () => {
    service.remove('s1').subscribe((res) => {
      expect(res.message).toBe('Sous-tâche supprimée.');
    });

    const req = httpMock.expectOne('http://localhost:3000/api/subtasks/s1');
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'Sous-tâche supprimée.' });
  });

  it('should surface a 401 error', () => {
    service.listByTask('t1').subscribe({
      next: () => { throw new Error('should have failed'); },
      error: (err) => {
        expect(err.status).toBe(401);
      }
    });

    const req = httpMock.expectOne('http://localhost:3000/api/taches/t1/subtasks');
    req.flush({ success: false, message: 'Token requis.' }, { status: 401, statusText: 'Unauthorized' });
  });

  it('should surface a 403 error', () => {
    service.create('t1', { titre: 'X' }).subscribe({
      next: () => { throw new Error('should have failed'); },
      error: (err) => {
        expect(err.status).toBe(403);
      }
    });

    const req = httpMock.expectOne('http://localhost:3000/api/taches/t1/subtasks');
    req.flush({ success: false, message: 'Accès refusé.' }, { status: 403, statusText: 'Forbidden' });
  });
});
