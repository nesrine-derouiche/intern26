import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PlanningComponent, EVENT_TYPES } from './planning.component';
import { PlanningEvent, PlanningResponse } from 'src/app/core/data/planning.service';
import { NavigationItems } from 'src/app/theme/layout/admin/navigation/navigation';

const API = 'http://localhost:3000/api';
const PLANNING_URL = `${API}/planning?page=1&limit=10`;
const STAGES_URL = `${API}/stages`;
const url = (query: string) => `${API}/planning?${query}`;

interface StageRow {
  id: string;
  stagiaire_id?: string;
  stagiaire_nom?: string;
  stagiaire_prenom?: string;
  departement_nom?: string;
}

const event = (over: Partial<PlanningEvent> = {}): PlanningEvent => ({
  id: 'reunion-1',
  type: 'REUNION',
  title: 'Suivi hebdomadaire',
  date: '2026-07-22',
  time: '10:00',
  status: null,
  resource_id: 'r1',
  metadata: { stage_id: 'st1' },
  ...over
});

const planning = (over: Partial<PlanningResponse> = {}): PlanningResponse => ({
  stage_id: null,
  periode: { date_debut: '2026-05-01', date_fin: '2026-12-31' },
  stages: [{ id: 'st1', stagiaire_id: 'u1', encadrant_id: 'e1', date_debut: '2026-05-01', date_fin: '2026-12-31', statut: 'EN_COURS', horaire: null }],
  horaire: null,
  evenements: [event()],
  reunions: [{ id: 'r1' }],
  taches: [],
  pointages: [],
  pagination: { page: 1, limit: 10, total: 1, pages: 1 },
  ...over
});

const stage = (over: Partial<StageRow> = {}): StageRow => ({
  id: 'st1',
  stagiaire_id: 'u1',
  stagiaire_nom: 'Trabelsi',
  stagiaire_prenom: 'Fatma',
  departement_nom: 'Informatique',
  ...over
});

function setRole(role: string) {
  localStorage.setItem('current_user', JSON.stringify({ id: 'u1', nom: 'Test', prenom: 'User', email: 'user@steg.tn', role }));
}

describe('PlanningComponent', () => {
  let component: PlanningComponent;
  let httpMock: HttpTestingController;

  function create() {
    const f = TestBed.createComponent(PlanningComponent);
    component = f.componentInstance;
    return f;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function flushInit(res: any = { planning: planning() }, stages: any = [stage()]) {
    httpMock.expectOne(PLANNING_URL).flush(res);
    httpMock.expectOne(STAGES_URL).flush(stages);
  }

  /** ngOnInit + flush des deux requêtes + rendu. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function render(res: any = { planning: planning() }, stages: any = [stage()]) {
    const f = create();
    f.detectChanges();
    flushInit(res, stages);
    f.detectChanges();
    return f;
  }

  beforeEach(async () => {
    setRole('ADMIN');
    await TestBed.configureTestingModule({
      imports: [PlanningComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock?.verify();
    TestBed.resetTestingModule();
    localStorage.removeItem('current_user');
  });

  it('should create', () => {
    create();
    expect(component).toBeTruthy();
  });

  it('should load the planning and the stages on init', () => {
    create();
    component.ngOnInit();
    flushInit({ planning: planning({ pagination: { page: 1, limit: 10, total: 45, pages: 5 } }) });

    expect(component.events().length).toBe(1);
    expect(component.total()).toBe(45);
    expect(component.pages()).toBe(5);
    expect(component.stages().length).toBe(1);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('');
  });

  it('should be loading while the planning request is pending', () => {
    create();
    component.ngOnInit();
    expect(component.loading()).toBe(true);
    flushInit();
    expect(component.loading()).toBe(false);
  });

  it('should display the empty state when the API returns no event', () => {
    const f = render({
      planning: { evenements: [], reunions: [], taches: [], pointages: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } }
    });

    expect(component.events()).toEqual([]);
    expect(component.total()).toBe(0);
    expect((f.nativeElement as HTMLElement).textContent).toContain('Aucun événement trouvé');
  });

  it('should expose the backend error message when loading fails', () => {
    create();
    component.ngOnInit();
    httpMock.expectOne(PLANNING_URL).flush({ success: false, message: 'Accès refusé.' }, { status: 403, statusText: 'Forbidden' });
    httpMock.expectOne(STAGES_URL).flush([stage()]);

    expect(component.error()).toContain('Accès refusé.');
    expect(component.events()).toEqual([]);
    expect(component.loading()).toBe(false);
  });

  it('should apply the period filters on search', () => {
    create();
    component.ngOnInit();
    flushInit();

    component.fDateDebut.set('2026-05-01');
    component.fDateFin.set('2026-12-31');
    component.applyFilters();

    const req = httpMock.expectOne(url('date_debut=2026-05-01&date_fin=2026-12-31&page=1&limit=10'));
    expect(req.request.method).toBe('GET');
    req.flush({ planning: planning() });

    expect(component.applied().date_debut).toBe('2026-05-01');
    expect(component.applied().date_fin).toBe('2026-12-31');
  });

  it('should send the selected stage as stage_id', () => {
    create();
    component.ngOnInit();
    flushInit();

    component.fStageId.set('st9');
    component.applyFilters();

    const req = httpMock.expectOne(url('stage_id=st9&page=1&limit=10'));
    req.flush({ planning: planning() });
    expect(component.applied().stage_id).toBe('st9');
  });

  it('should map a stagiaire selection to its stage_id', () => {
    create();
    component.ngOnInit();
    flushInit({ planning: planning() }, [stage({ id: 'stA', stagiaire_id: 'uA' }), stage({ id: 'stB', stagiaire_id: 'uB' })]);

    component.fStagiaireId.set('uB');
    component.applyFilters();

    const req = httpMock.expectOne(url('stage_id=stB&page=1&limit=10'));
    req.flush({ planning: planning() });
    expect(component.applied().stage_id).toBe('stB');
  });

  it('should narrow the stage options to the selected stagiaire', () => {
    create();
    component.ngOnInit();
    flushInit({ planning: planning() }, [stage({ id: 'stA', stagiaire_id: 'uA' }), stage({ id: 'stB', stagiaire_id: 'uB' })]);

    expect(component.stageOptions().length).toBe(2);
    component.onStagiaireChange('uA');
    expect(component.stageOptions().length).toBe(1);
    expect(component.stageOptions()[0].id).toBe('stA');
  });

  it('should reset the filters and reload without parameters', () => {
    create();
    component.ngOnInit();
    flushInit();

    component.fDateDebut.set('2026-06-01');
    component.fStageId.set('st1');
    component.fType.set('REUNION');
    component.applyFilters();
    httpMock.expectOne(url('date_debut=2026-06-01&stage_id=st1&page=1&limit=500')).flush({ planning: planning() });

    component.resetFilters();
    httpMock.expectOne(PLANNING_URL).flush({ planning: planning() });

    expect(component.fDateDebut()).toBe('');
    expect(component.fStageId()).toBe('');
    expect(component.fType()).toBe('TOUS');
    expect(component.applied()).toEqual({});
    expect(component.page()).toBe(1);
  });

  it('should reject an inverted date range without calling the API', () => {
    create();
    component.ngOnInit();
    flushInit();

    component.fDateDebut.set('2026-12-01');
    component.fDateFin.set('2026-01-01');
    component.applyFilters();

    expect(component.error()).toContain('antérieure');
    expect(component.applied()).toEqual({});
    expect(httpMock.match(url('date_debut=2026-12-01&date_fin=2026-01-01&page=1&limit=10')).length).toBe(0);
  });

  it('should load the next page', () => {
    create();
    component.ngOnInit();
    flushInit({ planning: planning({ pagination: { page: 1, limit: 10, total: 45, pages: 5 } }) });

    component.goToPage(2);
    const req = httpMock.expectOne(url('page=2&limit=10'));
    req.flush({ planning: planning({ pagination: { page: 2, limit: 10, total: 45, pages: 5 } }) });

    expect(component.page()).toBe(2);
  });

  it('should ignore a page change outside the loaded pages', () => {
    create();
    component.ngOnInit();
    flushInit();

    component.goToPage(9);
    expect(component.page()).toBe(1);
    expect(httpMock.match(url('page=9&limit=10')).length).toBe(0);
  });

  it('should recognise the six event types with their exact labels', () => {
    create();
    component.ngOnInit();
    flushInit();

    expect(EVENT_TYPES.length).toBe(6);
    expect(component.typeLabel('STAGE_START')).toBe('Début du stage');
    expect(component.typeLabel('STAGE_END')).toBe('Fin du stage');
    expect(component.typeLabel('REUNION')).toBe('Réunion');
    expect(component.typeLabel('TASK_DEADLINE')).toBe('Échéance de tâche');
    expect(component.typeLabel('POINTAGE_ENTREE')).toBe('Pointage — entrée');
    expect(component.typeLabel('POINTAGE_SORTIE')).toBe('Pointage — sortie');
    for (const type of EVENT_TYPES) {
      expect(component.typeBadge(type)).not.toBe('badge bg-secondary');
    }
  });

  it('should keep an unknown event type instead of using a wrong fallback', () => {
    create();
    component.ngOnInit();
    flushInit();

    expect(component.typeLabel('AUTRE_TYPE')).toBe('AUTRE_TYPE');
    expect(component.typeBadge('AUTRE_TYPE')).toBe('badge bg-secondary');
  });

  it('should display réunions', () => {
    const f = render({ planning: planning({ evenements: [event({ id: 'reunion-1', type: 'REUNION', title: 'Comite projet Alpha' })], reunions: [{ id: 'r1' }] }) });

    const text = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Comite projet Alpha');
    expect(component.typeLabel(component.events()[0].type)).toBe('Réunion');
    expect(component.statReunions()).toBe(1);
  });

  it('should display tâches', () => {
    const f = render({
      planning: planning({
        evenements: [event({ id: 'tache-1', type: 'TASK_DEADLINE', title: 'Rapport de fin de stage', date: '2026-09-30', time: null, status: 'EN_COURS' })],
        taches: [{ id: 't1' }]
      })
    });

    const text = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Rapport de fin de stage');
    expect(component.typeLabel('TASK_DEADLINE')).toBe('Échéance de tâche');
    expect(component.statTaches()).toBe(1);
  });

  it('should display pointage entrée', () => {
    const f = render({
      planning: planning({
        evenements: [event({ id: 'pointage-entree-1', type: 'POINTAGE_ENTREE', title: 'Pointage — entrée', time: '09:20', status: 'RETARD' })],
        pointages: [{ id: 'p1' }]
      })
    });

    const text = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Pointage — entrée');
    expect(component.events()[0].type).toBe('POINTAGE_ENTREE');
    expect(component.formatTime(component.events()[0].time)).toBe('09:20');
    expect(component.statusLabel('RETARD')).toBe('Retard');
    expect(component.statPointages()).toBe(1);
  });

  it('should display pointage sortie', () => {
    const f = render({
      planning: planning({ evenements: [event({ id: 'pointage-sortie-1', type: 'POINTAGE_SORTIE', title: 'Pointage — sortie', time: '17:05', status: 'PRESENT' })] })
    });

    const text = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Pointage — sortie');
    expect(component.typeBadge('POINTAGE_SORTIE')).toBe('badge bg-danger');
    expect(component.formatTime(component.events()[0].time)).toBe('17:05');
  });

  it('should display the stage start', () => {
    const f = render({
      planning: planning({ evenements: [event({ id: 'stage-start-1', type: 'STAGE_START', title: 'Début du stage', date: '2026-05-01', time: null })] })
    });

    const text = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Début du stage');
    expect(component.formatDate(component.events()[0].date)).toBe('01/05/2026');
    expect(component.typeBadge('STAGE_START')).toBe('badge bg-primary');
  });

  it('should display the stage end', () => {
    const f = render({
      planning: planning({ evenements: [event({ id: 'stage-end-1', type: 'STAGE_END', title: 'Fin du stage', date: '2026-12-31', time: null })] })
    });

    const text = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Fin du stage');
    expect(component.formatDate(component.events()[0].date)).toBe('31/12/2026');
    expect(component.typeBadge('STAGE_END')).toBe('badge bg-dark');
  });

  it('should filter the events by type on the client side', () => {
    create();
    component.ngOnInit();
    flushInit();

    component.fType.set('REUNION');
    component.applyFilters();

    const req = httpMock.expectOne(url('page=1&limit=500'));
    req.flush({
      planning: planning({
        evenements: [
          event({ id: 'reunion-1', type: 'REUNION' }),
          event({ id: 'tache-1', type: 'TASK_DEADLINE', title: 'Echeance' }),
          event({ id: 'reunion-2', type: 'REUNION', title: 'Autre reunion' })
        ],
        pagination: { page: 1, limit: 500, total: 3, pages: 1 }
      })
    });

    expect(component.events().length).toBe(2);
    expect(component.events().every((e) => e.type === 'REUNION')).toBe(true);
    expect(component.total()).toBe(2);
    expect(component.truncated()).toBe(false);
  });

  it('should warn when the period exceeds 500 events under a type filter', () => {
    create();
    component.ngOnInit();
    flushInit();

    component.fType.set('POINTAGE_ENTREE');
    component.applyFilters();
    httpMock
      .expectOne(url('page=1&limit=500'))
      .flush({ planning: planning({ pagination: { page: 1, limit: 500, total: 720, pages: 2 } }) });

    expect(component.truncated()).toBe(true);
  });

  it('should format a date-only value without shifting the day', () => {
    create();
    component.ngOnInit();
    flushInit();

    expect(component.formatDate('2026-01-01')).toBe('01/01/2026');
    expect(component.formatDate('2026-12-31')).toBe('31/12/2026');
    expect(component.formatDate('')).toBe('—');
    expect(component.formatDate(null)).toBe('—');
  });

  it('should format the time and show a dash when absent', () => {
    create();
    component.ngOnInit();
    flushInit();

    expect(component.formatTime('10:00')).toBe('10:00');
    expect(component.formatTime('09:20:00')).toBe('09:20');
    expect(component.formatTime(null)).toBe('—');
    expect(component.formatTime('')).toBe('—');
  });

  it('should compute the statistics from the response', () => {
    create();
    component.ngOnInit();
    flushInit({
      planning: planning({
        evenements: [event()],
        reunions: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }],
        taches: [{ id: 't1' }, { id: 't2' }],
        pointages: [{ id: 'p1' }],
        pagination: { page: 1, limit: 10, total: 42, pages: 5 }
      })
    });

    expect(component.statEvenements()).toBe(42);
    expect(component.statReunions()).toBe(3);
    expect(component.statTaches()).toBe(2);
    expect(component.statPointages()).toBe(1);
    expect(component.periode()?.date_debut).toBe('2026-05-01');
  });

  it('should give the ADMIN role access to every stage', () => {
    setRole('ADMIN');
    create();

    expect(component.isBlocked).toBe(false);
    expect(component.scopeLabel).toBe('Tous les stages');
  });

  it('should give the RH role access to every stage', () => {
    setRole('RH');
    create();

    expect(component.isBlocked).toBe(false);
    expect(component.scopeLabel).toBe('Tous les stages');
  });

  it('should restrict the ENCADRANT role to its own stages', () => {
    setRole('ENCADRANT');
    create();

    expect(component.isBlocked).toBe(false);
    expect(component.scopeLabel).toBe('Mes stages');
  });

  it('should restrict the CHEF_DEPARTEMENT role to its department', () => {
    setRole('CHEF_DEPARTEMENT');
    create();

    expect(component.isBlocked).toBe(false);
    expect(component.scopeLabel).toBe('Mon département');
  });

  it('should block a STAGIAIRE without calling the API', () => {
    setRole('STAGIAIRE');
    const f = create();
    f.detectChanges();

    expect(component.isBlocked).toBe(true);
    component.ngOnInit();
    expect(httpMock.match(PLANNING_URL).length).toBe(0);
    expect(httpMock.match(STAGES_URL).length).toBe(0);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).toContain('Accès refusé');
  });

  it('should reload the planning and confirm on refresh', () => {
    create();
    component.ngOnInit();
    flushInit();

    component.refresh();
    const req = httpMock.expectOne(PLANNING_URL);
    req.flush({ planning: planning() });

    expect(component.success()).toBe('Planning actualisé.');
    expect(component.loading()).toBe(false);
  });

  it('should tolerate a malformed response', () => {
    create();
    component.ngOnInit();
    flushInit({ planning: { evenements: null, stages: 'oops', reunions: undefined, pagination: null } });

    expect(component.events()).toEqual([]);
    expect(component.total()).toBe(0);
    expect(component.statEvenements()).toBe(0);
    expect(component.error()).toBe('');
    expect(component.loading()).toBe(false);
  });

  it('should open and close the detail modal', () => {
    const f = render();

    component.openDetail(component.events()[0]);
    f.detectChanges();
    let text = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain("Détail de l'événement");
    expect(component.detail()?.id).toBe('reunion-1');

    component.closeDetail();
    f.detectChanges();
    text = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain("Détail de l'événement");
  });
});

describe('Navigation — Planning', () => {
  it('exposes the Planning entry to backoffice roles only', () => {
    const item = NavigationItems.flatMap((i) => i.children ?? []).find((i) => i.id === 'planning');

    expect(item).toBeTruthy();
    expect(item?.url).toBe('/planning');
    expect(item?.type).toBe('item');
    expect(item?.roles).toEqual(['ADMIN', 'RH', 'ENCADRANT', 'CHEF_DEPARTEMENT']);
    expect(item?.roles).not.toContain('STAGIAIRE');
  });
});
