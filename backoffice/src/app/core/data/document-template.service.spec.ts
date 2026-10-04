import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TemplateService } from './document-template.service';

describe('TemplateService', () => {
  let service: TemplateService;
  let httpMock: HttpTestingController;

  const mockTemplate: any = {
    id: 't1',
    nom: 'Template Convention',
    type: 'CONVENTION',
    contenu: 'Convention de {{stagiaire_prenom}}',
    variables: ['stagiaire_prenom'],
    actif: true,
    version: 1,
    created_by: 'u1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  };

  const mockPage = {
    data: [mockTemplate],
    total: 1,
    page: 1,
    pages: 1
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TemplateService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(TemplateService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should list templates', () => {
    service.listTemplates().subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.total).toBe(1);
    });
    const req = httpMock.expectOne('http://localhost:3000/api/document-templates');
    expect(req.request.method).toBe('GET');
    req.flush(mockPage);
  });

  it('should list templates with type filter', () => {
    service.listTemplates({ type: 'CONVENTION' }).subscribe();
    const req = httpMock.expectOne('http://localhost:3000/api/document-templates?type=CONVENTION');
    expect(req.request.params.get('type')).toBe('CONVENTION');
    req.flush(mockPage);
  });

  it('should list templates with actif filter', () => {
    service.listTemplates({ actif: true }).subscribe();
    const req = httpMock.expectOne('http://localhost:3000/api/document-templates?actif=true');
    expect(req.request.params.get('actif')).toBe('true');
    req.flush(mockPage);
  });

  it('should list templates with pagination', () => {
    service.listTemplates({ page: 2, limit: 10 }).subscribe();
    const req = httpMock.expectOne('http://localhost:3000/api/document-templates?page=2&limit=10');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('10');
    req.flush(mockPage);
  });

  it('should get template by id', () => {
    service.getTemplate('t1').subscribe((res) => {
      expect(res.id).toBe('t1');
      expect(res.nom).toBe('Template Convention');
    });
    const req = httpMock.expectOne('http://localhost:3000/api/document-templates/t1');
    expect(req.request.method).toBe('GET');
    req.flush(mockTemplate);
  });

  it('should create template', () => {
    const payload = { nom: 'New', type: 'CV', contenu: 'CV de {{nom}}', variables: ['nom'] };
    service.createTemplate(payload).subscribe((res) => {
      expect(res.message).toBe('Template créé.');
      expect(res.template.id).toBe('t1');
    });
    const req = httpMock.expectOne('http://localhost:3000/api/document-templates');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ message: 'Template créé.', template: mockTemplate });
  });

  it('should update template', () => {
    const payload = { nom: 'Updated', contenu: 'New content', variables: ['nom'] };
    service.updateTemplate('t1', payload).subscribe((res) => {
      expect(res.message).toBe('Template mis à jour.');
    });
    const req = httpMock.expectOne('http://localhost:3000/api/document-templates/t1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush({ message: 'Template mis à jour.', template: mockTemplate });
  });

  it('should deactivate template', () => {
    service.deactivateTemplate('t1').subscribe((res) => {
      expect(res.message).toBe('Template désactivé.');
      expect(res.template.actif).toBe(false);
    });
    const req = httpMock.expectOne('http://localhost:3000/api/document-templates/t1/deactivate');
    expect(req.request.method).toBe('PATCH');
    req.flush({ message: 'Template désactivé.', template: { ...mockTemplate, actif: false } });
  });

  it('should preview template', () => {
    service.previewTemplate('t1', { stagiaire_prenom: 'Ali' }).subscribe((res) => {
      expect(res.preview).toBe('Convention de Ali');
    });
    const req = httpMock.expectOne('http://localhost:3000/api/document-templates/t1/preview');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ stagiaire_prenom: 'Ali' });
    req.flush({ preview: 'Convention de Ali' });
  });

  it('should handle HTTP errors', () => {
    service.getTemplate('nonexistent').subscribe({
      error: (err) => {
        expect(err.status).toBe(404);
      }
    });
    const req = httpMock.expectOne('http://localhost:3000/api/document-templates/nonexistent');
    req.flush({ message: 'Template introuvable.' }, { status: 404, statusText: 'Not Found' });
  });
});
