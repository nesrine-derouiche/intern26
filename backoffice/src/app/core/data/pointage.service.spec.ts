import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Horaire, Pointage, PointageStats, PointageService } from './pointage.service';

const API = 'http://localhost:3000/api';

describe('PointageService', () => {
  let service: PointageService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(PointageService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getAll should request /pointages with pagination and filters', () => {
    service.getAll({ page: 2, limit: 20, stage_id: 'st1', statut: 'RETARD', date_debut: '2026-09-01', date_fin: '2026-09-30' }).subscribe();

    const req = httpMock.expectOne(
      `${API}/pointages?page=2&limit=20&stage_id=st1&statut=RETARD&date_debut=2026-09-01&date_fin=2026-09-30`
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], total: 0, page: 2, pages: 0 });
  });

  it('getAll should skip empty parameters', () => {
    service.getAll({ page: 1, limit: 10, stage_id: '', statut: undefined }).subscribe();

    const req = httpMock.expectOne(`${API}/pointages?page=1&limit=10`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], total: 0, page: 1, pages: 0 });
  });

  it('getByStage should request /pointages/stage/:id', () => {
    service.getByStage('st1', { page: 1, limit: 10, statut: 'ABSENT' }).subscribe();

    const req = httpMock.expectOne(`${API}/pointages/stage/st1?page=1&limit=10&statut=ABSENT`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], total: 0, page: 1, pages: 0 });
  });

  it('getRetards should request /pointages/retards with period', () => {
    service.getRetards({ page: 1, limit: 10, date_debut: '2026-09-01', date_fin: '2026-09-30' }).subscribe();

    const req = httpMock.expectOne(`${API}/pointages/retards?page=1&limit=10&date_debut=2026-09-01&date_fin=2026-09-30`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], total: 0, page: 1, pages: 0 });
  });

  it('getStats should request /pointages/stats/:id and normalize string numbers', () => {
    let result!: PointageStats;
    service.getStats('st1').subscribe((s) => (result = s));

    const req = httpMock.expectOne(`${API}/pointages/stats/st1`);
    expect(req.request.method).toBe('GET');
    req.flush({
      total_jours: '10',
      presents: '7',
      retards: '2',
      absents: '1',
      total_minutes: '2400',
      moyenne_minutes: '240',
      total_retard_minutes: '45'
    });

    expect(result.total_jours).toBe(10);
    expect(result.presents).toBe(7);
    expect(result.retards).toBe(2);
    expect(result.absents).toBe(1);
    expect(result.total_minutes).toBe(2400);
    expect(result.moyenne_minutes).toBe(240);
    expect(result.total_retard_minutes).toBe(45);
  });

  it('getHoraires should request /pointages/horaires/:id', () => {
    let result!: Horaire;
    service.getHoraires('st1').subscribe((h) => (result = h));

    const req = httpMock.expectOne(`${API}/pointages/horaires/st1`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'h1', stage_id: 'st1', heure_debut: '09:00', heure_fin: '17:00', duree_pause_minutes: 60 });

    expect(result.heure_debut).toBe('09:00');
    expect(result.duree_pause_minutes).toBe(60);
  });

  it('getHoraires should normalize PG time values (HH:MM:SS) to HH:MM', () => {
    let result!: Horaire;
    service.getHoraires('st1').subscribe((h) => (result = h));

    const req = httpMock.expectOne(`${API}/pointages/horaires/st1`);
    req.flush({ id: 'h1', stage_id: 'st1', heure_debut: '09:00:00', heure_fin: '17:00:00', duree_pause_minutes: 60 });

    expect(result.heure_debut).toBe('09:00');
    expect(result.heure_fin).toBe('17:00');
  });

  it('update should PUT /pointages/:id/corriger with the correction payload', () => {
    let result!: { pointage: Pointage; message: string };
    service
      .update('p1', { heure_entree: '2026-09-15T09:00:00.000Z', statut: 'PRESENT', retard_minutes: 0, commentaire: 'corrigé' })
      .subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${API}/pointages/p1/corriger`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      heure_entree: '2026-09-15T09:00:00.000Z',
      statut: 'PRESENT',
      retard_minutes: 0,
      commentaire: 'corrigé'
    });
    req.flush({ pointage: { id: 'p1' }, message: 'Pointage corrigé.' });

    expect(result.message).toBe('Pointage corrigé.');
  });

  it('updateHoraire should PUT /pointages/horaires/:id with the horaire payload', () => {
    let result!: { horaire: Horaire; message: string };
    service.updateHoraire('st1', { heure_debut: '08:30', heure_fin: '16:30', duree_pause_minutes: 45 }).subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${API}/pointages/horaires/st1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ heure_debut: '08:30', heure_fin: '16:30', duree_pause_minutes: 45 });
    req.flush({ horaire: { stage_id: 'st1', heure_debut: '08:30' }, message: 'Horaires mis à jour.' });

    expect(result.message).toBe('Horaires mis à jour.');
  });
});
