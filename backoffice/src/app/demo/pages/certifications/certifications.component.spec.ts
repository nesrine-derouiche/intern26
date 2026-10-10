import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from 'src/app/core/data/auth.service';
import { CertificationRow } from 'src/app/core/data/certification.service';
import { CertificationsComponent } from './certifications.component';

describe('CertificationsComponent', () => {
  let component: CertificationsComponent;
  let httpMock: HttpTestingController;

  const mockRow: CertificationRow = {
    stage_id: 'stage-1',
    stagiaire_nom: 'Trabelsi',
    stagiaire_prenom: 'Fatma',
    departement_nom: 'Informatique',
    date_debut: '2026-09-01',
    date_fin: '2027-01-31',
    statut: 'SUBMITTED',
    submitted_at: '2026-10-01T10:00:00Z',
    reason: null,
    document_concerne: null,
    has_attestation: false,
    journal: { present: true, version: 1 },
    rapport: { present: false, version: null }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CertificationsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    const fixture = TestBed.createComponent(CertificationsComponent);
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

  it('should load certifications on init', () => {
    component.ngOnInit();

    const req = httpMock.expectOne(
      (r) => r.url === 'http://localhost:3000/api/certifications'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: [mockRow], total: 1, page: 1, pages: 1 });

    expect(component.rows().length).toBe(1);
    expect(component.total()).toBe(1);
    expect(component.loading()).toBe(false);
  });

  it('should send search and statut filters', () => {
    component.ngOnInit();
    httpMock
      .expectOne((r) => r.url === 'http://localhost:3000/api/certifications')
      .flush({ data: [], total: 0, page: 1, pages: 1 });

    component.onSearch('fatma');
    const req = httpMock.expectOne(
      (r) =>
        r.url === 'http://localhost:3000/api/certifications' &&
        r.params.get('search') === 'fatma'
    );
    req.flush({ data: [], total: 0, page: 1, pages: 1 });
    expect(component.page()).toBe(1);
  });

  it('should paginate without reloading out of bounds', () => {
    component.pages.set(3);
    component.page.set(1);
    component.goToPage(2);

    const req = httpMock.expectOne(
      (r) =>
        r.url === 'http://localhost:3000/api/certifications' &&
        r.params.get('page') === '2'
    );
    req.flush({ data: [], total: 30, page: 2, pages: 3 });
    expect(component.page()).toBe(2);

    component.goToPage(99);
    httpMock.expectNone(
      (r) =>
        r.url === 'http://localhost:3000/api/certifications' &&
        r.params.get('page') === '99'
    );
  });

  it('should surface API failures', () => {
    component.ngOnInit();

    const req = httpMock.expectOne(
      (r) => r.url === 'http://localhost:3000/api/certifications'
    );
    req.flush({ success: false, message: 'Erreur.' }, { status: 500, statusText: 'Error' });

    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('Erreur.');
  });

  it('should map certification statuses to labels and badges', () => {
    expect(component.getStatusLabel('VALIDATED')).toBe('Validé');
    expect(component.getStatusLabel('CERTIFICATE_GENERATED')).toBe('Attestation générée');
    expect(component.getStatusLabel('SUBMITTED')).toBe('Soumis');
    expect(component.getStatusLabel('REDO_REQUESTED')).toBe('Reprise demandée');
    expect(component.getStatusLabel('DENIED')).toBe('Refusé');
    expect(component.getStatusLabel('NOT_SUBMITTED')).toBe('Non soumis');
    expect(component.getStatusBadge('VALIDATED')).toContain('success');
    expect(component.getStatusBadge('DENIED')).toContain('danger');
  });

  it('should restrict management entry to the ENCADRANT role', () => {
    const authService = TestBed.inject(AuthService);
    authService.saveUser({ id: 'e1', role: 'ENCADRANT', nom: 'Ben', prenom: 'Ali', email: 'e@steg.tn' });
    expect(component.isEncadrant).toBe(true);

    authService.saveUser({ id: 'a1', role: 'ADMIN', nom: 'A', prenom: 'B', email: 'a@steg.tn' });
    expect(component.isEncadrant).toBe(false);
  });
});
