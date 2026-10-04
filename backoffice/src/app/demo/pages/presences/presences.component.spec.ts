import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PresencesComponent } from './presences.component';
import { Pointage, PointagePage } from 'src/app/core/data/pointage.service';

const API = 'http://localhost:3000/api';
const LIST_URL = `${API}/pointages?page=1&limit=10`;
const TOTAL_URL = `${API}/pointages?page=1&limit=1`;
const countUrl = (statut: string) => `${API}/pointages?page=1&limit=1&statut=${statut}`;
const STAGES_URL = `${API}/stages`;

interface StageRow {
  id: string;
  stagiaire_id?: string;
  stagiaire_nom?: string;
  stagiaire_prenom?: string;
  encadrant_nom?: string;
  encadrant_prenom?: string;
  departement_nom?: string;
}

const pageResult = (data: Pointage[] = [], total = data.length, pages = 1, page = 1): PointagePage => ({
  data,
  total,
  page,
  pages
});

const pointage = (over: Partial<Pointage> = {}): Pointage => ({
  id: 'p1',
  stage_id: 'st1',
  date_pointage: '2026-09-15',
  heure_entree: '2026-09-15T09:20:00.000Z',
  heure_sortie: '2026-09-15T17:05:00.000Z',
  duree_minutes: 465,
  retard_minutes: 20,
  statut: 'RETARD',
  commentaire: null,
  stagiaire_nom: 'Trabelsi',
  stagiaire_prenom: 'Fatma',
  encadrant_nom: 'Said',
  encadrant_prenom: 'Mohamed',
  departement_nom: 'IT',
  ...over
});

const stage = (over: Partial<StageRow> = {}): StageRow => ({
  id: 'st1',
  stagiaire_id: 'u1',
  stagiaire_nom: 'Trabelsi',
  stagiaire_prenom: 'Fatma',
  encadrant_nom: 'Said',
  encadrant_prenom: 'Mohamed',
  departement_nom: 'IT',
  ...over
});

function setRole(role: string) {
  localStorage.setItem('current_user', JSON.stringify({ id: 'u1', nom: 'Test', prenom: 'User', email: 'user@steg.tn', role }));
}

describe('PresencesComponent', () => {
  let component: PresencesComponent;
  let httpMock: HttpTestingController;

  function create() {
    const fixture = TestBed.createComponent(PresencesComponent);
    component = fixture.componentInstance;
    return component;
  }

  /** Flush toutes les requêtes déclenchées par ngOnInit. */
  function flushInit(list: PointagePage = pageResult([pointage()], 45, 5, 1), stages: StageRow[] = [stage()]) {
    httpMock.expectOne(LIST_URL).flush(list);
    httpMock.expectOne(TOTAL_URL).flush(pageResult([], 12));
    httpMock.expectOne(countUrl('PRESENT')).flush(pageResult([], 8));
    httpMock.expectOne(countUrl('RETARD')).flush(pageResult([], 3));
    httpMock.expectOne(countUrl('ABSENT')).flush(pageResult([], 1));
    httpMock.expectOne(STAGES_URL).flush(stages);
  }

  beforeEach(async () => {
    setRole('ADMIN');
    await TestBed.configureTestingModule({
      imports: [PresencesComponent],
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

  it('should load pointages, global counts and stages on init', () => {
    create();
    component.ngOnInit();
    flushInit(pageResult([pointage()], 45, 5, 1), [stage()]);

    expect(component.pointages().length).toBe(1);
    expect(component.total()).toBe(45);
    expect(component.pages()).toBe(5);
    expect(component.globalTotal()).toBe(12);
    expect(component.globalPresents()).toBe(8);
    expect(component.globalRetards()).toBe(3);
    expect(component.globalAbsents()).toBe(1);
    expect(component.stages().length).toBe(1);
    expect(component.loading()).toBe(false);
  });

  it('should be loading while the list request is pending', () => {
    create();
    component.ngOnInit();
    expect(component.loading()).toBe(true);
    flushInit();
    expect(component.loading()).toBe(false);
  });

  it('should expose the backend error message when loading fails', () => {
    create();
    component.ngOnInit();
    httpMock.expectOne(LIST_URL).flush({ message: 'Accès refusé.' }, { status: 403, statusText: 'Forbidden' });
    httpMock.expectOne(TOTAL_URL).flush(pageResult([], 12));
    httpMock.expectOne(countUrl('PRESENT')).flush(pageResult([], 8));
    httpMock.expectOne(countUrl('RETARD')).flush(pageResult([], 3));
    httpMock.expectOne(countUrl('ABSENT')).flush(pageResult([], 1));
    httpMock.expectOne(STAGES_URL).flush([]);

    expect(component.error()).toContain('Accès refusé.');
    expect(component.pointages().length).toBe(0);
    expect(component.loading()).toBe(false);
  });

  it('should fallback to a friendly message when the backend sends none', () => {
    create();
    component.ngOnInit();
    httpMock.expectOne(LIST_URL).flush('boom', { status: 500, statusText: 'Server Error' });
    httpMock.expectOne(TOTAL_URL).flush(pageResult([], 12));
    httpMock.expectOne(countUrl('PRESENT')).flush(pageResult([], 8));
    httpMock.expectOne(countUrl('RETARD')).flush(pageResult([], 3));
    httpMock.expectOne(countUrl('ABSENT')).flush(pageResult([], 1));
    httpMock.expectOne(STAGES_URL).flush([]);

    expect(component.error()).toContain('chargement');
    expect(component.pointages().length).toBe(0);
  });

  it('should keep an empty list when the API returns no data', () => {
    create();
    component.ngOnInit();
    flushInit(pageResult([], 0, 0, 1));

    expect(component.pointages().length).toBe(0);
    expect(component.total()).toBe(0);
  });

  it('should send period, stage and statut filters on search', () => {
    create();
    component.ngOnInit();
    flushInit();

    component.fDateDebut.set('2026-09-01');
    component.fDateFin.set('2026-09-30');
    component.fStageId.set('st1');
    component.fStatut.set('PRESENT');
    component.applyFilters();

    const req = httpMock.expectOne(
      `${LIST_URL}&date_debut=2026-09-01&date_fin=2026-09-30&stage_id=st1&statut=PRESENT`
    );
    expect(req.request.method).toBe('GET');
    req.flush(pageResult([], 0, 0, 1));

    expect(component.applied().statut).toBe('PRESENT');
    expect(component.page()).toBe(1);
  });

  it('should force statut RETARD when "retards uniquement" is checked', () => {
    create();
    component.ngOnInit();
    flushInit();

    component.fRetardsOnly.set(true);
    component.fStatut.set('PRESENT');
    component.applyFilters();

    const req = httpMock.expectOne(`${LIST_URL}&statut=RETARD`);
    req.flush(pageResult([], 0, 0, 1));

    expect(component.applied().statut).toBe('RETARD');
  });

  it('should not search when the period is inverted', () => {
    create();
    component.ngOnInit();
    flushInit();

    component.fDateDebut.set('2026-09-30');
    component.fDateFin.set('2026-09-01');
    component.applyFilters();

    expect(component.error()).toContain('antérieure');
    expect(httpMock.match(LIST_URL).length).toBe(0);
  });

  it('should reset filters and reload the first page', () => {
    create();
    component.ngOnInit();
    flushInit();

    component.fDateDebut.set('2026-09-01');
    component.fStageId.set('st1');
    component.fRetardsOnly.set(true);
    component.resetFilters();

    const req = httpMock.expectOne(LIST_URL);
    req.flush(pageResult([pointage()], 45, 5, 1));

    expect(component.fDateDebut()).toBe('');
    expect(component.fStageId()).toBe('');
    expect(component.fRetardsOnly()).toBe(false);
    expect(component.applied()).toEqual({});
    expect(component.error()).toBe('');
  });

  it('should load the requested page on pagination', () => {
    create();
    component.ngOnInit();
    flushInit(pageResult([pointage()], 45, 5, 1));

    component.goToPage(2);
    const req = httpMock.expectOne(`${API}/pointages?page=2&limit=10`);
    req.flush(pageResult([pointage({ id: 'p2' })], 45, 5, 2));

    expect(component.page()).toBe(2);
    expect(component.pointages()[0].id).toBe('p2');
  });

  it('should ignore out-of-range page navigation', () => {
    create();
    component.ngOnInit();
    flushInit(pageResult([pointage()], 45, 5, 1));

    component.goToPage(99);
    component.goToPage(0);
    expect(httpMock.match((req) => req.url.includes('page=99')).length).toBe(0);
    expect(component.page()).toBe(1);
  });

  it('should request the retards endpoint when switching view', () => {
    create();
    component.ngOnInit();
    flushInit();

    component.setView('retards');
    const req = httpMock.expectOne(`${API}/pointages/retards?page=1&limit=10`);
    req.flush(pageResult([pointage()], 3, 1, 1));

    expect(component.view()).toBe('retards');
    expect(component.total()).toBe(3);
  });

  it('should not reload when the current view is selected again', () => {
    create();
    component.ngOnInit();
    flushInit();

    component.setView('presences');
    expect(httpMock.match(LIST_URL).length).toBe(0);
    expect(component.view()).toBe('presences');
  });

  it('should open the correction modal prefilled', () => {
    create();
    component.openCorrection(pointage());

    expect(component.showCorrectModal()).toBe(true);
    expect(component.selected()?.id).toBe('p1');
    expect(component.correction.statut).toBe('RETARD');
    expect(component.correction.retard_minutes).toBe(20);
    expect(component.correction.heure_entree).not.toBe('');
    expect(component.correction.commentaire).toBe('');
  });

  it('should not open the correction modal without permission', () => {
    setRole('ENCADRANT');
    create();

    expect(component.canCorrect).toBe(false);
    expect(component.canManageHoraires).toBe(true);
    component.openCorrection(pointage());
    expect(component.showCorrectModal()).toBe(false);
  });

  it('should allow an RH to open the correction modal', () => {
    setRole('RH');
    create();

    expect(component.canCorrect).toBe(true);
    component.openCorrection(pointage());
    expect(component.showCorrectModal()).toBe(true);
  });

  it('should validate that the exit time is after the entry time', () => {
    create();
    component.openCorrection(pointage());
    component.correction.heure_entree = '2026-09-15T17:00';
    component.correction.heure_sortie = '2026-09-15T09:00';

    expect(component.validateCorrection()).toContain('sortie');
  });

  it('should validate a non-negative integer delay', () => {
    create();
    component.openCorrection(pointage());
    component.correction.retard_minutes = -5;
    expect(component.validateCorrection()).toContain('retard');

    component.correction.retard_minutes = 1.5;
    expect(component.validateCorrection()).toContain('retard');
  });

  it('should validate the comment length', () => {
    create();
    component.openCorrection(pointage());
    component.correction.commentaire = 'x'.repeat(501);
    expect(component.validateCorrection()).toContain('500');
  });

  it('should save the correction, close the modal and show a success message', () => {
    create();
    component.ngOnInit();
    flushInit();

    component.openCorrection(pointage());
    component.correction.statut = 'PRESENT';
    component.correction.retard_minutes = 0;
    component.correction.commentaire = 'correction encadrant';
    component.saveCorrection();

    const put = httpMock.expectOne(`${API}/pointages/p1/corriger`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body.statut).toBe('PRESENT');
    expect(put.request.body.retard_minutes).toBe(0);
    expect(put.request.body.commentaire).toBe('correction encadrant');
    put.flush({ pointage: { id: 'p1' }, message: 'Pointage corrigé.' });

    httpMock.expectOne(LIST_URL).flush(pageResult([pointage()], 45, 5, 1));
    httpMock.expectOne(TOTAL_URL).flush(pageResult([], 12));
    httpMock.expectOne(countUrl('PRESENT')).flush(pageResult([], 8));
    httpMock.expectOne(countUrl('RETARD')).flush(pageResult([], 3));
    httpMock.expectOne(countUrl('ABSENT')).flush(pageResult([], 1));

    expect(component.showCorrectModal()).toBe(false);
    expect(component.selected()).toBeNull();
    expect(component.success()).toContain('corrigée');
    expect(component.savingCorrection()).toBe(false);
  });

  it('should keep the correction modal open when the backend rejects it', () => {
    create();
    component.openCorrection(pointage());
    component.saveCorrection();

    const put = httpMock.expectOne(`${API}/pointages/p1/corriger`);
    put.flush({ message: 'Pointage introuvable.' }, { status: 404, statusText: 'Not Found' });

    expect(component.showCorrectModal()).toBe(true);
    expect(component.correctionError()).toContain('introuvable');
    expect(component.savingCorrection()).toBe(false);
    expect(component.success()).toBe('');
  });

  it('should load horaire and stats when a stage is selected', () => {
    create();
    component.onDetailStageChange('st1');
    expect(component.detailLoading()).toBe(true);

    httpMock
      .expectOne(`${API}/pointages/horaires/st1`)
      .flush({ id: 'h1', stage_id: 'st1', heure_debut: '09:00', heure_fin: '17:00', duree_pause_minutes: 60 });
    httpMock
      .expectOne(`${API}/pointages/stats/st1`)
      .flush({ total_jours: '10', presents: '7', retards: '2', absents: '1', total_minutes: '2400', moyenne_minutes: '240', total_retard_minutes: '45' });

    expect(component.detailLoading()).toBe(false);
    expect(component.horaire()?.heure_debut).toBe('09:00');
    expect(component.stats()?.presents).toBe(7);
    expect(component.stats()?.total_minutes).toBe(2400);
    expect(component.detailError()).toBe('');
  });

  it('should expose an error when stats cannot be loaded', () => {
    create();
    component.onDetailStageChange('st1');

    httpMock
      .expectOne(`${API}/pointages/horaires/st1`)
      .flush({ heure_debut: '09:00', heure_fin: '17:00', duree_pause_minutes: 60 });
    httpMock
      .expectOne(`${API}/pointages/stats/st1`)
      .flush({ message: 'Stage introuvable.' }, { status: 404, statusText: 'Not Found' });

    expect(component.detailError()).toContain('introuvable');
    expect(component.detailLoading()).toBe(false);
  });

  it('should not call the API when no stage is selected for the detail', () => {
    create();
    component.onDetailStageChange('');
    expect(httpMock.match((req) => req.url.includes('pointages/horaires')).length).toBe(0);
    expect(httpMock.match((req) => req.url.includes('pointages/stats')).length).toBe(0);
    expect(component.detailStageId()).toBe('');
  });

  it('should update the horaire, refresh the detail and show a success message', () => {
    create();
    component.onDetailStageChange('st1');
    httpMock.expectOne(`${API}/pointages/horaires/st1`).flush({ heure_debut: '09:00', heure_fin: '17:00', duree_pause_minutes: 60 });
    httpMock.expectOne(`${API}/pointages/stats/st1`).flush({ total_jours: '1', presents: '1', retards: '0', absents: '0', total_minutes: '480', moyenne_minutes: '480', total_retard_minutes: '0' });

    component.openHoraireEdit();
    expect(component.showHoraireModal()).toBe(true);
    expect(component.horaireForm.heure_debut).toBe('09:00');

    component.horaireForm = { heure_debut: '08:30', heure_fin: '16:30', duree_pause_minutes: 45 };
    component.saveHoraire();

    const put = httpMock.expectOne(`${API}/pointages/horaires/st1`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ heure_debut: '08:30', heure_fin: '16:30', duree_pause_minutes: 45 });
    put.flush({ horaire: { stage_id: 'st1', heure_debut: '08:30', heure_fin: '16:30', duree_pause_minutes: 45 }, message: 'Horaires mis à jour.' });

    httpMock.expectOne(`${API}/pointages/horaires/st1`).flush({ heure_debut: '08:30', heure_fin: '16:30', duree_pause_minutes: 45 });
    httpMock.expectOne(`${API}/pointages/stats/st1`).flush({ total_jours: '1', presents: '1', retards: '0', absents: '0', total_minutes: '480', moyenne_minutes: '480', total_retard_minutes: '0' });

    expect(component.showHoraireModal()).toBe(false);
    expect(component.horaire()?.heure_debut).toBe('08:30');
    expect(component.success()).toContain('Horaires');
    expect(component.savingHoraire()).toBe(false);
  });

  it('should validate the horaire before saving', () => {
    create();
    component.detailStageId.set('st1');
    component.horaireForm = { heure_debut: '17:00', heure_fin: '09:00', duree_pause_minutes: 60 };
    component.saveHoraire();

    expect(component.horaireError()).toContain('fin');
    expect(component.showHoraireModal()).toBe(false);
    expect(httpMock.match((req) => req.url.includes('pointages/horaires')).length).toBe(0);
  });

  it('should validate the pause duration', () => {
    create();
    component.detailStageId.set('st1');
    component.horaireForm = { heure_debut: '09:00', heure_fin: '17:00', duree_pause_minutes: 999 };
    component.saveHoraire();

    expect(component.horaireError()).toContain('pause');
    expect(httpMock.match((req) => req.url.includes('pointages/horaires')).length).toBe(0);
  });

  it('should format dates, durations and delays for display', () => {
    create();
    expect(component.formatDatePointage('2026-09-15')).toBe('15/09/2026');
    expect(component.formatDatePointage('')).toBe('—');
    const iso = '2026-09-21T23:00:00.000Z';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    expect(component.formatDatePointage(iso)).toBe(`${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`);
    expect(component.formatDuree(465)).toBe('7h 45');
    expect(component.formatDuree(120)).toBe('2h');
    expect(component.formatDuree(null)).toBe('—');
    expect(component.formatRetard(0)).toBe('—');
    expect(component.formatRetard(25)).toBe('+25 min');
    expect(component.formatHeure(null)).toBe('—');
    expect(component.formatMinutes(90)).toBe('1h 30');
  });

  it('should derive the expected time from the recorded delay', () => {
    create();
    const p = pointage({ heure_entree: '2026-09-15T09:20:00.000Z', retard_minutes: 20 });
    const expected = new Date(new Date(p.heure_entree!).getTime() - 20 * 60000);
    const pad = (n: number) => String(n).padStart(2, '0');

    expect(component.heurePrevue(p)).toBe(`${pad(expected.getHours())}:${pad(expected.getMinutes())}`);
    expect(component.heurePrevue(pointage({ heure_entree: null }))).toBe('—');
  });

  it('should map statut to badge classes and labels', () => {
    create();
    expect(component.statutBadge('PRESENT')).toContain('success');
    expect(component.statutBadge('RETARD')).toContain('warning');
    expect(component.statutBadge('ABSENT')).toContain('danger');
    expect(component.statutLabel('PRESENT')).toBe('Présent');
    expect(component.statutLabel('ABSENT')).toBe('Absent');
    expect(component.initials(pointage())).toBe('FT');
    expect(component.stageLabel(pointage())).toBe('IT');
  });

  it('should expose stagiaire filter options without duplicates', () => {
    create();
    component.ngOnInit();
    flushInit(pageResult([pointage()], 45, 5, 1), [
      stage(),
      stage({ id: 'st2', stagiaire_id: 'u1' }),
      stage({ id: 'st3', stagiaire_id: 'u2', stagiaire_nom: 'Bouchnak', stagiaire_prenom: 'Mohamed' })
    ]);

    expect(component.stagiaireOptions().length).toBe(2);
    expect(component.stagiaireOptions()[0].stageId).toBe('st1');
    expect(component.stagiaireOptions()[1].label).toContain('Bouchnak');
  });
});
