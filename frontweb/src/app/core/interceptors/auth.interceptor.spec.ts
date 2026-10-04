import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { TokenStorage } from '../services/token-storage.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let storageMock: {
    getToken: ReturnType<typeof vi.fn>;
    setToken: ReturnType<typeof vi.fn>;
    getUser: ReturnType<typeof vi.fn>;
    setUser: ReturnType<typeof vi.fn>;
    clearToken: ReturnType<typeof vi.fn>;
    clearUser: ReturnType<typeof vi.fn>;
    clearAll: ReturnType<typeof vi.fn>;
  };
  let navigateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    storageMock = {
      getToken: vi.fn(() => null),
      setToken: vi.fn(),
      getUser: vi.fn(() => null),
      setUser: vi.fn(),
      clearToken: vi.fn(),
      clearUser: vi.fn(),
      clearAll: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: TokenStorage, useValue: storageMock },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('attache le jeton Bearer aux requêtes quand une session existe', () => {
    storageMock.getToken.mockReturnValue('token-123');
    http.get('/api/private').subscribe(() => undefined);
    const req = httpMock.expectOne('/api/private');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-123');
    req.flush({ ok: true });
  });

  it('n’ajoute pas d’en-tête Authorization sans jeton', () => {
    http.get('/api/public').subscribe(() => undefined);
    const req = httpMock.expectOne('/api/public');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ ok: true });
  });

  it('sur 401 avec session : purge le stockage et les signaux, puis redirige vers la connexion', () => {
    storageMock.getToken.mockReturnValue('token-expire');
    storageMock.getUser.mockReturnValue({
      id: 'u-1',
      nom: 'X',
      prenom: 'Y',
      email: 'x@steg.tn',
      role: 'CANDIDAT',
    });
    const authService = TestBed.inject(AuthService);
    expect(authService.isAuthenticated()).toBe(true);

    http.get('/api/private').subscribe({ error: () => undefined });
    const req = httpMock.expectOne('/api/private');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-expire');
    req.flush(
      { message: 'Votre session a expiré. Veuillez vous reconnecter.' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(storageMock.clearAll).toHaveBeenCalled();
    expect(authService.isAuthenticated()).toBe(false);
    expect(authService.user()).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith(['/connexion'], {
      queryParams: { session: 'expiree' },
    });
  });

  it('sur 401 sans jeton (ex. identifiants incorrects) : aucune redirection', () => {
    http
      .post('/api/auth/login', {})
      .subscribe({ error: () => undefined });
    const req = httpMock.expectOne('/api/auth/login');
    req.flush(
      { message: 'Email ou mot de passe incorrect.' },
      { status: 401, statusText: 'Unauthorized' },
    );
    expect(storageMock.clearAll).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('laisse passer les erreurs non-401 sans vider la session', () => {
    storageMock.getToken.mockReturnValue('token-valide');
    http.get('/api/private').subscribe({ error: () => undefined });
    const req = httpMock.expectOne('/api/private');
    req.flush(
      { message: 'Interdit' },
      { status: 403, statusText: 'Forbidden' },
    );
    expect(storageMock.clearAll).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
