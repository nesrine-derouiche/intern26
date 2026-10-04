import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { vi } from 'vitest';
import { NavRightComponent } from './nav-right.component';
import { AuthService } from 'src/app/core/data/auth.service';
import { NotificationItem } from 'src/app/core/data/notification.service';

describe('NavRightComponent', () => {
  let component: NavRightComponent;
  let fixture: any;
  let authService: AuthService;
  let httpMock: HttpTestingController;

  const item = (overrides: Partial<NotificationItem>): NotificationItem => ({
    id: 'n1',
    utilisateur_id: 'u1',
    titre: 'Nouvelle tâche',
    message: 'Vous avez une tâche',
    type: 'TACHE',
    lue: false,
    date: new Date().toISOString(),
    ...overrides
  });

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [NavRightComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([{ path: 'login', component: {} as any }])]
    }).compileComponents();

    fixture = TestBed.createComponent(NavRightComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    localStorage.clear();
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should return default role label when no user', () => {
    authService.currentUser.set(null);
    expect(component.getRoleLabel()).toBe('Utilisateur');
  });

  it('should return Administrateur for ADMIN role', () => {
    authService.currentUser.set({ id: '1', nom: 'Admin', prenom: 'Super', email: 'admin@steg.tn', role: 'ADMIN' });
    expect(component.getRoleLabel()).toBe('Administrateur');
  });

  it('should return Encadrant for ENCADRANT role', () => {
    authService.currentUser.set({ id: '2', nom: 'Said', prenom: 'Mohamed', email: 'enc@steg.tn', role: 'ENCADRANT' });
    expect(component.getRoleLabel()).toBe('Encadrant');
  });

  it('should return Stagiaire for STAGIAIRE role', () => {
    authService.currentUser.set({ id: '3', nom: 'Ali', prenom: 'Ben', email: 'stag@steg.tn', role: 'STAGIAIRE' });
    expect(component.getRoleLabel()).toBe('Stagiaire');
  });

  it('should return Ressources Humaines for RH role', () => {
    authService.currentUser.set({ id: '4', nom: 'Nadia', prenom: 'Ben Ali', email: 'rh@steg.tn', role: 'RH' });
    expect(component.getRoleLabel()).toBe('Ressources Humaines');
  });

  it('should return Chef de Département for CHEF_DEPARTEMENT role', () => {
    authService.currentUser.set({ id: '5', nom: 'Chef', prenom: 'Dept', email: 'chef@steg.tn', role: 'CHEF_DEPARTEMENT' });
    expect(component.getRoleLabel()).toBe('Chef de Département');
  });

  it('should logout and clear user state', () => {
    authService.saveToken('test-token');
    authService.saveUser({ id: '1', nom: 'Test', prenom: 'User', email: 'test@steg.tn', role: 'ADMIN' });

    expect(authService.isAuthenticated()).toBeTruthy();
    expect(authService.currentUser()).toBeTruthy();

    component.logout();

    expect(authService.isAuthenticated()).toBeFalsy();
    expect(authService.currentUser()).toBeNull();
    expect(component.notifications()).toEqual([]);
    expect(component.unreadCount()).toBe(0);
  });

  it('should load notifications and unread count on init', () => {
    authService.saveToken('test-token');
    component.ngOnInit();

    const unreadReq = httpMock.expectOne('http://localhost:3000/api/notifications/unread');
    unreadReq.flush({ total: 1 });
    const listReq = httpMock.expectOne('http://localhost:3000/api/notifications?page=1&limit=6');
    listReq.flush({ data: [item({ id: 'n1', lue: false }), item({ id: 'n2', lue: true })], total: 2, page: 1, pages: 1 });

    expect(component.notifications().length).toBe(2);
    expect(component.unreadCount()).toBe(1);
    expect(component.total()).toBe(2);
  });

  it('should reload when dropdown opens while authenticated', () => {
    authService.saveToken('test-token');
    component.onDropdownOpen(true);

    httpMock.expectOne('http://localhost:3000/api/notifications/unread').flush({ total: 1 });
    httpMock.expectOne('http://localhost:3000/api/notifications?page=1&limit=6').flush({
      data: [item({})],
      total: 1,
      page: 1,
      pages: 1
    });

    expect(component.notifications().length).toBe(1);
  });

  it('should not load when dropdown closes', () => {
    authService.saveToken('test-token');
    component.onDropdownOpen(false);
    expect(component.notifications().length).toBe(0);
  });

  it('should filter by category', () => {
    component.setFilter('TACHE');

    const listReq = httpMock.expectOne('http://localhost:3000/api/notifications?page=1&limit=6&type=TACHE');
    listReq.flush({ data: [item({ id: 'n1', type: 'TACHE' })], total: 1, page: 1, pages: 1 });

    expect(component.activeFilter()).toBe('TACHE');
    expect(component.notifications().every((n) => n.type === 'TACHE')).toBe(true);
  });

  it('should reset filter to show all', () => {
    component.setFilter('TACHE');
    httpMock.expectOne('http://localhost:3000/api/notifications?page=1&limit=6&type=TACHE').flush({
      data: [],
      total: 0,
      page: 1,
      pages: 1
    });

    component.setFilter(null);
    httpMock.expectOne('http://localhost:3000/api/notifications?page=1&limit=6').flush({
      data: [item({})],
      total: 1,
      page: 1,
      pages: 1
    });

    expect(component.activeFilter()).toBeNull();
  });

  it('should mark a notification as read and decrement unread count', () => {
    component.notifications.set([item({ id: 'n1', lue: false })]);
    component.unreadCount.set(2);

    component.markAsRead(component.notifications()[0]);

    httpMock.expectOne('http://localhost:3000/api/notifications/n1/lire').flush({ message: 'Notification marquée comme lue.' });

    expect(component.notifications()[0].lue).toBe(true);
    expect(component.unreadCount()).toBe(1);
  });

  it('should not call API for an already-read notification', () => {
    component.notifications.set([item({ id: 'n1', lue: true })]);
    component.unreadCount.set(0);

    component.markAsRead(component.notifications()[0]);

    expect(component.notifications()[0].lue).toBe(true);
  });

  it('should mark all notifications as read', () => {
    component.notifications.set([item({ id: 'n1', lue: false }), item({ id: 'n2', lue: true })]);
    component.unreadCount.set(1);

    component.markAllAsRead();

    httpMock.expectOne('http://localhost:3000/api/notifications/lire-tout').flush({ message: 'Toutes les notifications ont été marquées comme lues.' });

    expect(component.notifications().every((n) => n.lue)).toBe(true);
    expect(component.unreadCount()).toBe(0);
  });

  it('should delete a notification and update counts', () => {
    component.notifications.set([item({ id: 'n1', lue: false }), item({ id: 'n2', lue: true })]);
    component.total.set(2);
    component.unreadCount.set(1);

    component.remove(component.notifications()[0]);

    httpMock.expectOne('http://localhost:3000/api/notifications/n1').flush({ message: 'Notification supprimée.' });

    expect(component.notifications().map((n) => n.id)).toEqual(['n2']);
    expect(component.total()).toBe(1);
    expect(component.unreadCount()).toBe(0);
  });

  it('should load the next page and append items', () => {
    authService.saveToken('test-token');
    component.ngOnInit();

    httpMock.expectOne('http://localhost:3000/api/notifications/unread').flush({ total: 1 });
    httpMock.expectOne('http://localhost:3000/api/notifications?page=1&limit=6').flush({
      data: [item({ id: 'n1' })],
      total: 3,
      page: 1,
      pages: 2
    });

    component.loadMore();

    httpMock.expectOne('http://localhost:3000/api/notifications?page=2&limit=6').flush({
      data: [item({ id: 'n2' }), item({ id: 'n3' })],
      total: 3,
      page: 2,
      pages: 2
    });

    expect(component.page()).toBe(2);
    expect(component.notifications().map((n) => n.id)).toEqual(['n1', 'n2', 'n3']);
  });

  it('should map unknown type to default bell icon', () => {
    expect(component.iconFor('INCONNU')).toBe('ti-bell');
    expect(component.iconFor('TACHE')).toBe('ti-checklist');
  });

  it('should build icon color class from type', () => {
    expect(component.iconClass('REUNION')).toBe('notif-icon-reunion');
  });

  it('should navigate to the internal link when opening a notification', () => {
    const routerSpy = { navigateByUrl: vi.fn() };
    (component as any).router = routerSpy;
    component.markAsRead = () => undefined;

    component.openNotification(item({ id: 'n1', lien: '/candidatures/9' }));

    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/candidatures/9');
  });

  it('should not navigate when the notification has no internal link', () => {
    const routerSpy = { navigateByUrl: vi.fn() };
    (component as any).router = routerSpy;
    component.markAsRead = () => undefined;

    component.openNotification(item({ id: 'n1', lien: undefined }));
    component.openNotification(item({ id: 'n2', lien: 'https://externe.com' }));

    expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
  });

  it('should close the dropdown when closing programmatically', () => {
    fixture.detectChanges();
    const dropdown = component.notifDropdown();
    if (dropdown) {
      const closeSpy = vi.spyOn(dropdown, 'close');
      component.closeDropdown();
      expect(closeSpy).toHaveBeenCalled();
    } else {
      expect(() => component.closeDropdown()).not.toThrow();
    }
  });
});

describe('Notifications API Integration', () => {
  let httpMock: HttpTestingController;
  let http: HttpClient;

  const API = 'http://localhost:3000/api';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    httpMock = TestBed.inject(HttpTestingController);
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('should fetch paginated notifications list', () => {
    const mockPage = {
      data: [
        { id: 'n1', titre: 'Nouvelle tâche', message: 'Vous avez une tâche', type: 'TACHE', lue: false, date: '2025-06-01' },
        { id: 'n2', titre: 'Réunion planifiée', message: 'Réunion demain', type: 'REUNION', lue: true, date: '2025-05-28' }
      ],
      total: 2,
      page: 1,
      pages: 1
    };

    http.get<any>(`${API}/notifications`, { params: { page: '1', limit: '10' } }).subscribe((data: any) => {
      expect(data.data.length).toBe(2);
      expect(data.total).toBe(2);
      expect(data.data[0].titre).toBe('Nouvelle tâche');
      expect(data.data[0].lue).toBeFalsy();
      expect(data.data[1].lue).toBeTruthy();
    });

    const req = httpMock.expectOne(`${API}/notifications?page=1&limit=10`);
    expect(req.request.method).toBe('GET');
    req.flush(mockPage);
  });

  it('should fetch unread count', () => {
    http.get<any>(`${API}/notifications/unread`).subscribe((data: any) => {
      expect(typeof data.total).toBe('number');
      expect(data.total).toBe(3);
    });

    const req = httpMock.expectOne(`${API}/notifications/unread`);
    expect(req.request.method).toBe('GET');
    req.flush({ total: 3 });
  });

  it('should mark notification as read', () => {
    http.put<any>(`${API}/notifications/n1/lire`, {}).subscribe((res: any) => {
      expect(res.message).toContain('lue');
    });

    const req = httpMock.expectOne(`${API}/notifications/n1/lire`);
    expect(req.request.method).toBe('PUT');
    req.flush({ message: 'Notification marquée comme lue.' });
  });

  it('should mark all notifications as read', () => {
    http.put<any>(`${API}/notifications/lire-tout`, {}).subscribe((res: any) => {
      expect(res.message).toContain('lues');
    });

    const req = httpMock.expectOne(`${API}/notifications/lire-tout`);
    expect(req.request.method).toBe('PUT');
    req.flush({ message: 'Toutes les notifications ont été marquées comme lues.' });
  });

  it('should delete a notification', () => {
    http.delete<any>(`${API}/notifications/n1`).subscribe((res: any) => {
      expect(res.message).toContain('supprimée');
    });

    const req = httpMock.expectOne(`${API}/notifications/n1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'Notification supprimée.' });
  });
});
