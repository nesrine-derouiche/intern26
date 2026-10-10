import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { CertificationRow, CertificationService } from './certification.service';

describe('CertificationService', () => {
  let service: CertificationService;
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
    rapport: { present: true, version: 1 }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(CertificationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should list certifications with filters and pagination', () => {
    service
      .listCertifications({ search: 'trabelsi', statut: 'SUBMITTED', page: 1, limit: 10 })
      .subscribe((res) => {
        expect(res.data.length).toBe(1);
        expect(res.total).toBe(1);
      });

    const req = httpMock.expectOne(
      (r) =>
        r.url === 'http://localhost:3000/api/certifications' &&
        r.params.get('search') === 'trabelsi' &&
        r.params.get('statut') === 'SUBMITTED' &&
        r.params.get('page') === '1'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: [mockRow], total: 1, page: 1, pages: 1 });
  });

  it('should fetch the certification state of a stage', () => {
    service.getState('stage-1').subscribe((state) => {
      expect(state.statut).toBe('SUBMITTED');
    });

    const req = httpMock.expectOne(
      'http://localhost:3000/api/stages/stage-1/certification'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ statut: 'SUBMITTED', documents: {}, versions: [], decisions: [] });
  });

  it('should download a document as blob', () => {
    service.downloadDocument('stage-1', 'doc-1').subscribe((blob) => {
      expect(blob).toBeTruthy();
    });

    const req = httpMock.expectOne(
      'http://localhost:3000/api/stages/stage-1/certification/documents/doc-1/download'
    );
    expect(req.request.method).toBe('GET');
    req.flush(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
  });

  it('should validate a dossier', () => {
    service.validate('stage-1').subscribe((res) => {
      expect(res.message).toBe('Dossier validé.');
    });

    const req = httpMock.expectOne(
      'http://localhost:3000/api/stages/stage-1/certification/valider'
    );
    expect(req.request.method).toBe('POST');
    req.flush({ message: 'Dossier validé.' });
  });

  it('should deny with a reason', () => {
    service.deny('stage-1', 'Rapport illisible.').subscribe((res) => {
      expect(res.message).toBe('Dossier refusé.');
    });

    const req = httpMock.expectOne(
      'http://localhost:3000/api/stages/stage-1/certification/refuser'
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body.reason).toBe('Rapport illisible.');
    req.flush({ message: 'Dossier refusé.' });
  });

  it('should request a correction with reason and document', () => {
    service.requestRedo('stage-1', 'Reprendre.', 'RAPPORT').subscribe();
    const req = httpMock.expectOne(
      'http://localhost:3000/api/stages/stage-1/certification/corriger'
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body.reason).toBe('Reprendre.');
    expect(req.request.body.document_concerne).toBe('RAPPORT');
    req.flush({ message: 'Reprise demandée.' });
  });

  it('should generate the attestation', () => {
    service.generateAttestation('stage-1').subscribe((res) => {
      expect(res.attestation.nom).toContain('attestation');
    });

    const req = httpMock.expectOne(
      'http://localhost:3000/api/stages/stage-1/certification/attestation'
    );
    expect(req.request.method).toBe('POST');
    req.flush({ message: 'Attestation générée.', attestation: { nom: 'attestation_stage_x.pdf', taille: 1234 } });
  });

  it('should download the generated attestation as blob', () => {
    service.downloadAttestation('stage-1').subscribe((blob) => {
      expect(blob).toBeTruthy();
    });

    const req = httpMock.expectOne(
      'http://localhost:3000/api/stages/stage-1/certification/attestation'
    );
    expect(req.request.method).toBe('GET');
    req.flush(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
  });

  it('should surface a 401 error', () => {
    service.listCertifications().subscribe({
      next: () => {
        throw new Error('should have failed');
      },
      error: (err) => {
        expect(err.status).toBe(401);
      }
    });

    const req = httpMock.expectOne('http://localhost:3000/api/certifications');
    req.flush({ success: false, message: 'Token requis.' }, { status: 401, statusText: 'Unauthorized' });
  });

  it('should surface a 403 error', () => {
    service.validate('stage-1').subscribe({
      next: () => {
        throw new Error('should have failed');
      },
      error: (err) => {
        expect(err.status).toBe(403);
      }
    });

    const req = httpMock.expectOne(
      'http://localhost:3000/api/stages/stage-1/certification/valider'
    );
    req.flush({ success: false, message: 'Accès refusé.' }, { status: 403, statusText: 'Forbidden' });
  });
});
