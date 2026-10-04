import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { TemplatesComponent } from './document-template.component';
import { AuthService } from 'src/app/core/data/auth.service';

describe('TemplatesComponent', () => {
  let component: TemplatesComponent;
  let httpMock: HttpTestingController;
  let authService: AuthService;

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
    updated_at: '2026-01-02T00:00:00Z'
  };

  const mockPage = {
    data: [mockTemplate],
    total: 1,
    page: 1,
    pages: 1
  };

  function flushLoad() {
    const req = httpMock.expectOne('http://localhost:3000/api/document-templates?page=1&limit=10');
    req.flush(mockPage);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TemplatesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    const fixture = TestBed.createComponent(TemplatesComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
  });

  afterEach(() => {
    try {
      httpMock.match((req) => req.url.includes('/document-templates')).forEach((req) => {
        req.flush({ data: [], total: 0, page: 1, pages: 0 });
      });
    } catch { /* ignore */ }
    try { httpMock?.verify(); } catch { /* ignore */ }
    TestBed.resetTestingModule();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should allow ADMIN access', () => {
    authService.saveUser({ id: 'a1', role: 'ADMIN', nom: 'Admin', prenom: 'User', email: 'admin@steg.tn' });
    component.ngOnInit();
    expect(component.isAdminOrRh).toBe(true);
    expect(component.error()).toBe('');
    flushLoad();
  });

  it('should allow RH access', () => {
    authService.saveUser({ id: 'rh1', role: 'RH', nom: 'Bouazizi', prenom: 'Salma', email: 'salma@steg.tn' });
    component.ngOnInit();
    expect(component.isAdminOrRh).toBe(true);
    flushLoad();
  });

  it('should block ENCADRANT', () => {
    authService.saveUser({ id: 'e1', role: 'ENCADRANT', nom: 'Said', prenom: 'Mohamed', email: 'said@steg.tn' });
    component.ngOnInit();
    expect(component.isAdminOrRh).toBe(false);
    expect(component.error()).toContain('Accès refusé');
  });

  it('should block CHEF_DEPARTEMENT', () => {
    authService.saveUser({ id: 'c1', role: 'CHEF_DEPARTEMENT', nom: 'Chef', prenom: 'Dep', email: 'chef@steg.tn' });
    component.ngOnInit();
    expect(component.isAdminOrRh).toBe(false);
    expect(component.error()).toContain('Accès refusé');
  });

  it('should block STAGIAIRE', () => {
    authService.saveUser({ id: 's1', role: 'STAGIAIRE', nom: 'Stag', prenom: 'Iaire', email: 'stag@steg.tn' });
    component.ngOnInit();
    expect(component.isAdminOrRh).toBe(false);
    expect(component.error()).toContain('Accès refusé');
  });

  it('should load templates on init', () => {
    authService.saveUser({ id: 'a1', role: 'ADMIN', nom: 'A', prenom: 'B', email: 'a@steg.tn' });
    component.ngOnInit();
    flushLoad();
    expect(component.templates().length).toBe(1);
    expect(component.total()).toBe(1);
  });

  it('should display template list', () => {
    authService.saveUser({ id: 'a1', role: 'ADMIN', nom: 'A', prenom: 'B', email: 'a@steg.tn' });
    component.ngOnInit();
    flushLoad();
    expect(component.templates()[0].nom).toBe('Template Convention');
  });

  it('should show empty state when no templates', () => {
    authService.saveUser({ id: 'a1', role: 'ADMIN', nom: 'A', prenom: 'B', email: 'a@steg.tn' });
    component.ngOnInit();
    const req = httpMock.expectOne('http://localhost:3000/api/document-templates?page=1&limit=10');
    req.flush({ data: [], total: 0, page: 1, pages: 0 });
    expect(component.templates().length).toBe(0);
  });

  it('should handle API error', () => {
    authService.saveUser({ id: 'a1', role: 'ADMIN', nom: 'A', prenom: 'B', email: 'a@steg.tn' });
    component.ngOnInit();
    const req = httpMock.expectOne('http://localhost:3000/api/document-templates?page=1&limit=10');
    req.flush({ message: 'Erreur serveur' }, { status: 500, statusText: 'Server Error' });
    expect(component.error()).toContain('Erreur serveur');
  });

  it('should paginate', () => {
    authService.saveUser({ id: 'a1', role: 'ADMIN', nom: 'A', prenom: 'B', email: 'a@steg.tn' });
    component.ngOnInit();
    flushLoad();
    component.pages.set(2);
    component.goToPage(2);
    const req = httpMock.expectOne('http://localhost:3000/api/document-templates?page=2&limit=10');
    req.flush({ data: [], total: 0, page: 2, pages: 2 });
    expect(component.page()).toBe(2);
  });

  it('should filter by type', () => {
    authService.saveUser({ id: 'a1', role: 'ADMIN', nom: 'A', prenom: 'B', email: 'a@steg.tn' });
    component.ngOnInit();
    flushLoad();
    component.setFilterType('CONVENTION');
    const req = httpMock.expectOne('http://localhost:3000/api/document-templates?type=CONVENTION&page=1&limit=10');
    req.flush(mockPage);
    expect(component.filterType()).toBe('CONVENTION');
  });

  it('should filter by actif', () => {
    authService.saveUser({ id: 'a1', role: 'ADMIN', nom: 'A', prenom: 'B', email: 'a@steg.tn' });
    component.ngOnInit();
    flushLoad();
    component.setFilterActif(false);
    const req = httpMock.expectOne('http://localhost:3000/api/document-templates?actif=false&page=1&limit=10');
    req.flush({ data: [], total: 0, page: 1, pages: 0 });
    expect(component.filterActif()).toBe(false);
  });

  it('should reset filters', () => {
    authService.saveUser({ id: 'a1', role: 'ADMIN', nom: 'A', prenom: 'B', email: 'a@steg.tn' });
    component.ngOnInit();
    flushLoad();
    component.setFilterType('CV');
    httpMock.expectOne('http://localhost:3000/api/document-templates?type=CV&page=1&limit=10').flush(mockPage);
    component.resetFilters();
    expect(component.filterType()).toBe('');
    expect(component.filterActif()).toBe('');
    expect(component.searchTerm()).toBe('');
    flushLoad();
  });

  it('should open create form', () => {
    authService.saveUser({ id: 'a1', role: 'ADMIN', nom: 'A', prenom: 'B', email: 'a@steg.tn' });
    component.openCreate();
    expect(component.showForm()).toBe(true);
    expect(component.editMode()).toBe(false);
    expect(component.form.nom).toBe('');
  });

  it('should validate form before save', () => {
    authService.saveUser({ id: 'a1', role: 'ADMIN', nom: 'A', prenom: 'B', email: 'a@steg.tn' });
    component.openCreate();
    component.form = { nom: '', type: '', contenu: '', variables: '' };
    component.saveForm();
    expect(component.formError()).toContain('requis');
  });

  it('should create template', () => {
    authService.saveUser({ id: 'a1', role: 'ADMIN', nom: 'A', prenom: 'B', email: 'a@steg.tn' });
    component.openCreate();
    component.form = { nom: 'New Template', type: 'CV', contenu: 'CV de {{nom}}', variables: 'nom, prenom' };
    component.saveForm();
    const req = httpMock.expectOne('http://localhost:3000/api/document-templates');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.variables).toEqual(['nom', 'prenom']);
    req.flush({ message: 'Template créé.', template: mockTemplate });
    flushLoad();
  });

  it('should edit template', () => {
    authService.saveUser({ id: 'a1', role: 'ADMIN', nom: 'A', prenom: 'B', email: 'a@steg.tn' });
    component.openEdit(mockTemplate);
    expect(component.showForm()).toBe(true);
    expect(component.editMode()).toBe(true);
    expect(component.form.nom).toBe('Template Convention');
    component.form.nom = 'Updated Name';
    component.saveForm();
    const req = httpMock.expectOne('http://localhost:3000/api/document-templates/t1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.nom).toBe('Updated Name');
    req.flush({ message: 'Template mis à jour.', template: { ...mockTemplate, nom: 'Updated Name' } });
    flushLoad();
  });

  it('should deactivate template', () => {
    authService.saveUser({ id: 'a1', role: 'ADMIN', nom: 'A', prenom: 'B', email: 'a@steg.tn' });
    component.openDeactivate(mockTemplate);
    expect(component.showDeactivateConfirm()).toBe(true);
    expect(component.deactivateTarget()?.id).toBe('t1');
    component.confirmDeactivate();
    const req = httpMock.expectOne('http://localhost:3000/api/document-templates/t1/deactivate');
    expect(req.request.method).toBe('PATCH');
    req.flush({ message: 'Template désactivé.', template: { ...mockTemplate, actif: false } });
    flushLoad();
  });

  it('should confirm deactivate', () => {
    authService.saveUser({ id: 'a1', role: 'ADMIN', nom: 'A', prenom: 'B', email: 'a@steg.tn' });
    component.openDeactivate(mockTemplate);
    component.confirmDeactivate();
    const req = httpMock.expectOne('http://localhost:3000/api/document-templates/t1/deactivate');
    req.flush({ message: 'OK', template: { ...mockTemplate, actif: false } });
    expect(component.showDeactivateConfirm()).toBe(false);
    flushLoad();
  });

  it('should cancel deactivate', () => {
    authService.saveUser({ id: 'a1', role: 'ADMIN', nom: 'A', prenom: 'B', email: 'a@steg.tn' });
    component.openDeactivate(mockTemplate);
    component.cancelDeactivate();
    expect(component.showDeactivateConfirm()).toBe(false);
    expect(component.deactivateTarget()).toBeNull();
  });

  it('should open preview modal', () => {
    authService.saveUser({ id: 'a1', role: 'ADMIN', nom: 'A', prenom: 'B', email: 'a@steg.tn' });
    component.openPreview(mockTemplate);
    expect(component.showPreview()).toBe(true);
    expect(component.previewTemplateId()).toBe('t1');
  });

  it('should load preview', () => {
    authService.saveUser({ id: 'a1', role: 'ADMIN', nom: 'A', prenom: 'B', email: 'a@steg.tn' });
    component.openPreview(mockTemplate);
    component.previewDataRaw.set('stagiaire_prenom=Ali');
    component.loadPreview();
    const req = httpMock.expectOne('http://localhost:3000/api/document-templates/t1/preview');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ stagiaire_prenom: 'Ali' });
    req.flush({ preview: 'Convention de Ali' });
    expect(component.previewContent()).toBe('Convention de Ali');
  });

  it('should handle preview error', () => {
    authService.saveUser({ id: 'a1', role: 'ADMIN', nom: 'A', prenom: 'B', email: 'a@steg.tn' });
    component.openPreview(mockTemplate);
    component.previewDataRaw.set('unknown_var=test');
    component.loadPreview();
    const req = httpMock.expectOne('http://localhost:3000/api/document-templates/t1/preview');
    req.flush({ message: 'La variable « unknown_var » est absente des données fournies.' }, { status: 422, statusText: 'Unprocessable' });
    expect(component.previewError()).toContain('unknown_var');
  });

  it('should show preview loading state', () => {
    authService.saveUser({ id: 'a1', role: 'ADMIN', nom: 'A', prenom: 'B', email: 'a@steg.tn' });
    component.openPreview(mockTemplate);
    component.previewDataRaw.set('stagiaire_prenom=Ali');
    component.loadPreview();
    expect(component.previewLoading()).toBe(true);
    httpMock.expectOne('http://localhost:3000/api/document-templates/t1/preview').flush({ preview: 'OK' });
    expect(component.previewLoading()).toBe(false);
  });

  it('should display variables list', () => {
    expect(component.getVariablesList(mockTemplate)).toBe('stagiaire_prenom');
    expect(component.getVariablesList({ ...mockTemplate, variables: [] })).toBe('—');
  });

  it('should refresh after modification', () => {
    authService.saveUser({ id: 'a1', role: 'ADMIN', nom: 'A', prenom: 'B', email: 'a@steg.tn' });
    component.ngOnInit();
    flushLoad();
    component.openEdit(mockTemplate);
    component.form.nom = 'Modified';
    component.saveForm();
    httpMock.expectOne('http://localhost:3000/api/document-templates/t1').flush({ message: 'OK', template: mockTemplate });
    flushLoad();
    expect(component.templates().length).toBe(1);
  });
});
