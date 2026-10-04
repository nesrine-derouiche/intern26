import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PlanningEvent, PlanningResponse, PlanningService } from './planning.service';

const API = 'http://localhost:3000/api';
const PLANNING_URL = `${API}/planning`;

const event = (over: Partial<PlanningEvent> = {}): PlanningEvent => ({
  id: 'reunion-118359eb',
  type: 'REUNION',
  title: 'Point d’avancement',
  date: '2026-07-22',
  time: '10:00',
  status: null,
  resource_id: '118359eb-30ed-4692-9b19-ef672ec037eb',
  metadata: { stage_id: 'st1', salle: 'Salle A' },
  ...over
});

const planning = (over: Partial<PlanningResponse> = {}): PlanningResponse => ({
  stage_id: null,
  periode: { date_debut: '2026-05-01', date_fin: '2026-12-31' },
  stages: [{ id: 'st1', stagiaire_id: 'u1', encadrant_id: 'e1', date_debut: '2026-05-01', date_fin: '2026-12-31', statut: 'EN_COURS', horaire: null }],
  horaire: null,
  evenements: [event()],
  reunions: [{ id: 'r1' }],
  taches: [{ id: 't1' }],
  pointages: [{ id: 'p1' }],
  pagination: { page: 1, limit: 10, total: 1, pages: 1 },
  ...over
});

describe('PlanningService', () => {
  let service: PlanningService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(PlanningService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('get should request GET /planning without parameters by default', () => {
    service.get().subscribe();

    const req = httpMock.expectOne(PLANNING_URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().length).toBe(0);
    req.flush({ planning: planning() });
  });

  it('get should send date, stage and pagination parameters', () => {
    service
      .get({ date_debut: '2026-05-01', date_fin: '2026-12-31', stage_id: 'st1', page: 2, limit: 25 })
      .subscribe();

    const req = httpMock.expectOne(
      `${PLANNING_URL}?date_debut=2026-05-01&date_fin=2026-12-31&stage_id=st1&page=2&limit=25`
    );
    expect(req.request.method).toBe('GET');
    req.flush({ planning: planning() });
  });

  it('get should skip empty parameters', () => {
    service.get({ stage_id: '', date_debut: undefined, page: 1, limit: 10 }).subscribe();

    const req = httpMock.expectOne(`${PLANNING_URL}?page=1&limit=10`);
    req.flush({ planning: planning() });
    expect(req.request.params.has('stage_id')).toBe(false);
  });

  it('get should unwrap the { planning } envelope', () => {
    let result!: PlanningResponse;
    service.get().subscribe((res) => (result = res));

    const req = httpMock.expectOne(PLANNING_URL);
    req.flush({ planning: planning() });

    expect(result.evenements.length).toBe(1);
    expect(result.evenements[0].type).toBe('REUNION');
    expect(result.pagination.total).toBe(1);
    expect(result.periode?.date_debut).toBe('2026-05-01');
    expect(result.reunions.length).toBe(1);
    expect(result.taches.length).toBe(1);
    expect(result.pointages.length).toBe(1);
    expect(result.stages.length).toBe(1);
  });

  it('get should keep every event type returned by the API', () => {
    const types = ['STAGE_START', 'STAGE_END', 'REUNION', 'TASK_DEADLINE', 'POINTAGE_ENTREE', 'POINTAGE_SORTIE'];
    let result!: PlanningResponse;
    service.get().subscribe((res) => (result = res));

    const req = httpMock.expectOne(PLANNING_URL);
    req.flush({ planning: planning({ evenements: types.map((type, i) => event({ id: `e${i}`, type })), pagination: { page: 1, limit: 10, total: 6, pages: 1 } }) });

    expect(result.evenements.map((e) => e.type)).toEqual(types);
  });

  it('get should return an empty response when the API sends an empty planning', () => {
    let result!: PlanningResponse;
    service.get().subscribe((res) => (result = res));

    const req = httpMock.expectOne(PLANNING_URL);
    req.flush({ planning: { evenements: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } } });

    expect(result.evenements).toEqual([]);
    expect(result.stages).toEqual([]);
    expect(result.reunions).toEqual([]);
    expect(result.taches).toEqual([]);
    expect(result.pointages).toEqual([]);
    expect(result.periode).toBeNull();
    expect(result.pagination.total).toBe(0);
  });

  it('get should tolerate a malformed response without crashing', () => {
    let result!: PlanningResponse;
    service.get().subscribe((res) => (result = res));

    const req = httpMock.expectOne(PLANNING_URL);
    req.flush({ planning: { evenements: null, stages: 'oops', reunions: undefined, pagination: null } });

    expect(result.evenements).toEqual([]);
    expect(result.stages).toEqual([]);
    expect(result.reunions).toEqual([]);
    expect(result.pagination).toEqual({ page: 1, limit: 100, total: 0, pages: 0 });
  });

  it('get should normalize string pagination values coming from the API', () => {
    let result!: PlanningResponse;
    service.get().subscribe((res) => (result = res));

    const req = httpMock.expectOne(PLANNING_URL);
    req.flush({ planning: planning({ pagination: { page: '3', limit: '10', total: '42', pages: '5' } as never }) });

    expect(result.pagination).toEqual({ page: 3, limit: 10, total: 42, pages: 5 });
  });

  it('get should expose the pagination used by the page', () => {
    let result!: PlanningResponse;
    service.get({ page: 4, limit: 10 }).subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${PLANNING_URL}?page=4&limit=10`);
    req.flush({ planning: planning({ pagination: { page: 4, limit: 10, total: 95, pages: 10 } }) });

    expect(result.pagination.page).toBe(4);
    expect(result.pagination.pages).toBe(10);
    expect(result.pagination.total).toBe(95);
  });

  it('get should propagate HTTP errors', () => {
    let status = 0;
    let message = '';
    service.get().subscribe({
      error: (err) => {
        status = err.status;
        message = err?.error?.message ?? '';
      }
    });

    const req = httpMock.expectOne(PLANNING_URL);
    req.flush({ success: false, message: 'Accès refusé.' }, { status: 403, statusText: 'Forbidden' });

    expect(status).toBe(403);
    expect(message).toBe('Accès refusé.');
  });
});
