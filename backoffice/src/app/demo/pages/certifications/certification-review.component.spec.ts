import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { CertificationState } from 'src/app/core/data/certification.service';
import { CertificationReviewComponent } from './certification-review.component';

describe('CertificationReviewComponent', () => {
  let component: CertificationReviewComponent;
  let httpMock: HttpTestingController;

  const mockState: CertificationState = {
    certification: {
      id: 'c1',
      stage_id: 'stage-1',
      statut: 'SUBMITTED',
      reviewer_id: null,
      reason: null,
      document_concerne: null,
      submitted_at: '2026-10-01T10:00:00Z',
      decided_at: null,
      has_attestation: false
    },
    statut: 'SUBMITTED',
    documents: {
      JOURNAL: {
        id: 'd1',
        kind: 'JOURNAL',
        version: 1,
        nom: 'journal.pdf',
        taille: 1024,
        created_at: '2026-10-01T09:00:00Z'
      },
      RAPPORT: {
        id: 'd2',
        kind: 'RAPPORT',
        version: 1,
        nom: 'rapport.pdf',
        taille: 2048,
        created_at: '2026-10-01T09:30:00Z'
      }
    },
    versions: [],
    decisions: []
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CertificationReviewComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'stage-1' } } }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(CertificationReviewComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock?.verify();
    TestBed.resetTestingModule();
  });

  function flushState(state: CertificationState = mockState) {
    const req = httpMock.expectOne(
      'http://localhost:3000/api/stages/stage-1/certification'
    );
    expect(req.request.method).toBe('GET');
    req.flush(state);
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load the dossier state on init', () => {
    component.ngOnInit();
    flushState();

    expect(component.stageId).toBe('stage-1');
    expect(component.state()?.statut).toBe('SUBMITTED');
    expect(component.state()?.documents.JOURNAL?.nom).toBe('journal.pdf');
    expect(component.loading()).toBe(false);
  });

  it('should validate after confirmation', () => {
    const globalScope = globalThis as unknown as {
      confirm?: (message?: string) => boolean;
    };
    const originalConfirm = globalScope.confirm;
    globalScope.confirm = () => true;

    component.ngOnInit();
    flushState();
    component.validate();

    const req = httpMock.expectOne(
      'http://localhost:3000/api/stages/stage-1/certification/valider'
    );
    expect(req.request.method).toBe('POST');
    req.flush({ message: 'Dossier validé.' });

    const reload = httpMock.expectOne(
      'http://localhost:3000/api/stages/stage-1/certification'
    );
    reload.flush({ ...mockState, statut: 'VALIDATED' });
    expect(component.state()?.statut).toBe('VALIDATED');

    globalScope.confirm = originalConfirm;
  });

  it('should refuse the confirm dialog without calling the API', () => {
    const globalScope = globalThis as unknown as {
      confirm?: (message?: string) => boolean;
    };
    const originalConfirm = globalScope.confirm;
    globalScope.confirm = () => false;

    component.ngOnInit();
    flushState();
    component.validate();

    httpMock.expectNone(
      'http://localhost:3000/api/stages/stage-1/certification/valider'
    );

    globalScope.confirm = originalConfirm;
  });

  it('should require a reason to deny', () => {
    component.ngOnInit();
    flushState();
    component.openDeny();
    component.reason.set('   ');
    component.confirmDeny();

    expect(component.actionError()).toContain('motif');
    httpMock.expectNone(
      'http://localhost:3000/api/stages/stage-1/certification/refuser'
    );
    expect(component.showDenyDialog()).toBe(true);
  });

  it('should deny with a reason then reload', () => {
    component.ngOnInit();
    flushState();
    component.openDeny();
    component.reason.set('Rapport illisible.');
    component.confirmDeny();

    const req = httpMock.expectOne(
      'http://localhost:3000/api/stages/stage-1/certification/refuser'
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body.reason).toBe('Rapport illisible.');
    req.flush({ message: 'Dossier refusé.' });

    const reload = httpMock.expectOne(
      'http://localhost:3000/api/stages/stage-1/certification'
    );
    reload.flush({ ...mockState, statut: 'DENIED' });
    expect(component.showDenyDialog()).toBe(false);
  });

  it('should request a correction with reason and document', () => {
    component.ngOnInit();
    flushState();
    component.openRedo();
    component.reason.set('Reprendre la conclusion.');
    component.documentConcerne.set('RAPPORT');
    component.confirmRedo();

    const req = httpMock.expectOne(
      'http://localhost:3000/api/stages/stage-1/certification/corriger'
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body.reason).toBe('Reprendre la conclusion.');
    expect(req.request.body.document_concerne).toBe('RAPPORT');
    req.flush({ message: 'Reprise demandée.' });

    const reload = httpMock.expectOne(
      'http://localhost:3000/api/stages/stage-1/certification'
    );
    reload.flush({ ...mockState, statut: 'REDO_REQUESTED' });
  });

  it('should generate the attestation after validation then reload', () => {
    const globalScope = globalThis as unknown as {
      confirm?: (message?: string) => boolean;
    };
    const originalConfirm = globalScope.confirm;
    globalScope.confirm = () => true;

    component.ngOnInit();
    flushState({ ...mockState, statut: 'VALIDATED' });
    component.generateAttestation();

    const req = httpMock.expectOne(
      'http://localhost:3000/api/stages/stage-1/certification/attestation'
    );
    expect(req.request.method).toBe('POST');
    req.flush({
      message: 'Attestation générée.',
      attestation: { nom: 'attestation_stage_x.pdf', taille: 1234 }
    });

    const reload = httpMock.expectOne(
      'http://localhost:3000/api/stages/stage-1/certification'
    );
    reload.flush({ ...mockState, statut: 'CERTIFICATE_GENERATED' });

    globalScope.confirm = originalConfirm;
  });

  it('should surface generation failures', () => {
    const globalScope = globalThis as unknown as {
      confirm?: (message?: string) => boolean;
    };
    const originalConfirm = globalScope.confirm;
    globalScope.confirm = () => true;

    component.ngOnInit();
    flushState({ ...mockState, statut: 'VALIDATED' });
    component.generateAttestation();

    const req = httpMock.expectOne(
      'http://localhost:3000/api/stages/stage-1/certification/attestation'
    );
    req.flush(
      { success: false, message: 'Génération impossible.' },
      { status: 422, statusText: 'Unprocessable' }
    );
    expect(component.actionError()).toBe('Génération impossible.');
    expect(component.actionLoading()).toBe(false);

    globalScope.confirm = originalConfirm;
  });

  it('should map statuses to labels and badges', () => {
    expect(component.getStatusLabel('CERTIFICATE_GENERATED')).toBe('Attestation générée');
    expect(component.getStatusLabel('REDO_REQUESTED')).toBe('Reprise demandée');
    expect(component.getStatusBadge('CERTIFICATE_GENERATED')).toContain('success');
    expect(component.getStatusBadge('DENIED')).toContain('danger');
  });
});
