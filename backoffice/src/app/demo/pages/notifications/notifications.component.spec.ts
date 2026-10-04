import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { NotificationsComponent } from './notifications.component';
import { AuthService } from 'src/app/core/data/auth.service';
import { NotificationItem } from 'src/app/core/data/notification.service';

describe('NotificationsComponent', () => {
  let component: NotificationsComponent;
  let authService: AuthService;
  let httpMock: HttpTestingController;

  const item = (overrides: Partial<NotificationItem>): NotificationItem => ({
    id: 'n1',
    utilisateur_id: 'u1',
    titre: 'Candidature présélectionnée',
    message: 'Vous avez une candidature',
    type: 'CANDIDATURE',
    lue: false,
    date: new Date().toISOString(),
    lien: '/candidatures/1',
    ...overrides
  });

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [NotificationsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();

    const fixture = TestBed.createComponent(NotificationsComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    localStorage.clear();
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  function flushInit() {
    const unread = httpMock.expectOne('http://localhost:3000/api/notifications/unread');
    unread.flush({ total: 1 });
    const stats = httpMock.expectOne('http://localhost:3000/api/notifications?page=1&limit=1');
    stats.flush({ data: [], total: 3, page: 1, pages: 1 });
    const list = httpMock.expectOne('http://localhost:3000/api/notifications?page=1&limit=10');
    list.flush({
      data: [item({ id: 'n1', lue: false }), item({ id: 'n2', lue: true, type: 'TACHE' })],
      total: 3,
      page: 1,
      pages: 2
    });
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load notifications, unread count and stats on init', () => {
    authService.saveToken('test-token');
    component.ngOnInit();

    flushInit();

    expect(component.notifications().length).toBe(2);
    expect(component.unread()).toBe(1);
    expect(component.read()).toBe(2);
    expect(component.total()).toBe(3);
    expect(component.pages()).toBe(2);
  });

  it('should filter by category and reset to page 1', () => {
    component.setFilter('TACHE');
    httpMock.expectOne('http://localhost:3000/api/notifications?page=1&limit=10&type=TACHE').flush({
      data: [item({ id: 'n1', type: 'TACHE' })],
      total: 1,
      page: 1,
      pages: 1
    });
    expect(component.activeFilter()).toBe('TACHE');

    component.setFilter(null);
    httpMock.expectOne('http://localhost:3000/api/notifications?page=1&limit=10').flush({
      data: [],
      total: 0,
      page: 1,
      pages: 1
    });
    expect(component.activeFilter()).toBeNull();
  });

  it('should not reload when the same filter is applied', () => {
    component.setFilter('TACHE');
    httpMock.expectOne('http://localhost:3000/api/notifications?page=1&limit=10&type=TACHE').flush({
      data: [],
      total: 0,
      page: 1,
      pages: 1
    });
    component.setFilter('TACHE');
    expect(component.activeFilter()).toBe('TACHE');
  });

  it('should go to the requested page', () => {
    component.page.set(1);
    component.pages.set(3);
    component.goToPage(2);
    httpMock.expectOne('http://localhost:3000/api/notifications?page=2&limit=10').flush({
      data: [item({})],
      total: 3,
      page: 2,
      pages: 3
    });
    expect(component.page()).toBe(2);
  });

  it('should ignore out-of-range page requests', () => {
    component.page.set(1);
    component.pages.set(2);
    component.goToPage(3);
    expect(component.page()).toBe(1);
  });

  it('should mark a notification as read and update unread counts', () => {
    component.notifications.set([item({ id: 'n1', lue: false })]);
    component.unread.set(2);
    component.total.set(4);

    component.markAsRead(component.notifications()[0]);

    httpMock.expectOne('http://localhost:3000/api/notifications/n1/lire').flush({ message: 'Notification marquée comme lue.' });

    expect(component.notifications()[0].lue).toBe(true);
    expect(component.unread()).toBe(1);
  });

  it('should not call API for an already-read notification', () => {
    component.notifications.set([item({ id: 'n1', lue: true })]);
    component.markAsRead(component.notifications()[0]);
    expect(component.notifications()[0].lue).toBe(true);
  });

  it('should mark all notifications as read', () => {
    component.notifications.set([item({ id: 'n1', lue: false }), item({ id: 'n2', lue: true })]);
    component.unread.set(1);
    component.total.set(2);

    component.markAllAsRead();

    httpMock.expectOne('http://localhost:3000/api/notifications/lire-tout').flush({ message: 'Toutes les notifications ont été marquées comme lues.' });

    expect(component.notifications().every((n) => n.lue)).toBe(true);
    expect(component.unread()).toBe(0);
    expect(component.read()).toBe(2);
  });

  it('should delete a notification and update counts', () => {
    component.notifications.set([item({ id: 'n1', lue: false }), item({ id: 'n2', lue: true })]);
    component.total.set(2);
    component.unread.set(1);

    component.remove(component.notifications()[0]);

    httpMock.expectOne('http://localhost:3000/api/notifications/n1').flush({ message: 'Notification supprimée.' });

    expect(component.notifications().map((n) => n.id)).toEqual(['n2']);
    expect(component.total()).toBe(1);
    expect(component.unread()).toBe(0);
  });

  it('should show an error when loading fails', () => {
    component.load();

    httpMock.expectOne('http://localhost:3000/api/notifications?page=1&limit=10').flush(
      { message: 'Erreur interne' },
      { status: 500, statusText: 'Internal Server Error' }
    );

    expect(component.loading()).toBe(false);
    expect(component.error()).toContain('Erreur interne');
  });

  it('should navigate to the notification link', () => {
    const routerSpy = { navigateByUrl: vi.fn() };
    (component as any).router = routerSpy;
    component.notifications.set([item({ id: 'n1', lien: '/candidatures/9' })]);
    component.markAsRead = () => undefined;

    component.openNotification(component.notifications()[0]);

    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/candidatures/9');
  });

  it('should not navigate when no internal link is present', () => {
    const routerSpy = { navigateByUrl: vi.fn() };
    (component as any).router = routerSpy;
    component.markAsRead = () => undefined;

    component.openNotification(item({ id: 'n1', lien: undefined }));
    component.openNotification(item({ id: 'n2', lien: 'https://externe.com' }));

    expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
  });

  it('should map unknown type to default bell icon', () => {
    expect(component.iconFor('INCONNU')).toBe('ti-bell');
    expect(component.iconFor('CANDIDATURE')).toBe('ti-user-check');
  });

  it('should build icon color class from type', () => {
    expect(component.iconClass('REUNION')).toBe('notif-icon-reunion');
  });
});
