import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { NgbDropdown } from '@ng-bootstrap/ng-bootstrap';
import { SHARED_IMPORTS } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/data/auth.service';
import { NotificationService, NotificationItem, NOTIFICATION_CATEGORIES } from 'src/app/core/data/notification.service';
import { RelativeTimePipe } from 'src/app/core/pipes/relative-time.pipe';

const PAGE_SIZE = 6;

@Component({
  selector: 'app-nav-right',
  imports: [...SHARED_IMPORTS, RouterModule, RelativeTimePipe],
  templateUrl: './nav-right.component.html',
  styleUrl: './nav-right.component.scss'
})
export class NavRightComponent implements OnInit {
  authService = inject(AuthService);
  private router = inject(Router);
  private notificationService = inject(NotificationService);

  readonly CATEGORIES = NOTIFICATION_CATEGORIES;

  notifications = signal<NotificationItem[]>([]);
  unreadCount = signal(0);
  total = signal(0);
  page = signal(1);
  pages = signal(1);
  loading = signal(false);
  busy = signal(false);
  activeFilter = signal<string | null>(null);

  notifDropdown = viewChild('notifDropdown', { read: NgbDropdown });

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.refresh();
    }
  }

  onDropdownOpen(opened: boolean): void {
    if (opened && this.authService.isAuthenticated()) {
      this.refresh();
    }
  }

  refresh(): void {
    this.loadUnreadCount();
    this.loadNotifications(true);
  }

  loadNotifications(reset: boolean): void {
    if (reset) {
      this.page.set(1);
      this.notifications.set([]);
    }
    this.loading.set(true);
    this.notificationService
      .getAll({ page: this.page(), limit: PAGE_SIZE, type: this.activeFilter() })
      .subscribe({
        next: (res) => {
          this.total.set(res.total);
          this.pages.set(res.pages);
          this.notifications.set(reset ? res.data : [...this.notifications(), ...res.data]);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });
  }

  loadUnreadCount(): void {
    this.notificationService.getUnreadCount().subscribe({
      next: (res) => this.unreadCount.set(res.total),
      error: () => undefined
    });
  }

  setFilter(category: string | null): void {
    if (this.activeFilter() === category) return;
    this.activeFilter.set(category);
    this.loadNotifications(true);
  }

  loadMore(): void {
    this.page.update((p) => p + 1);
    this.loadNotifications(false);
  }

  markAsRead(n: NotificationItem): void {
    if (n.lue) return;
    this.notificationService.markAsRead(n.id).subscribe({
      next: () => {
        this.notifications.update((list) => list.map((x) => (x.id === n.id ? { ...x, lue: true } : x)));
        this.unreadCount.update((c) => Math.max(0, c - 1));
      },
      error: () => undefined
    });
  }

  openNotification(n: NotificationItem): void {
    this.markAsRead(n);
    if (n.lien && n.lien.startsWith('/')) {
      this.router.navigateByUrl(n.lien);
    }
    this.closeDropdown();
  }

  closeDropdown(): void {
    this.notifDropdown()?.close();
  }

  markAllAsRead(): void {
    if (this.unreadCount() === 0 || this.busy()) return;
    this.busy.set(true);
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.notifications.update((list) => list.map((x) => ({ ...x, lue: true })));
        this.unreadCount.set(0);
        this.busy.set(false);
      },
      error: () => this.busy.set(false)
    });
  }

  remove(n: NotificationItem): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.notificationService.delete(n.id).subscribe({
      next: () => {
        this.notifications.update((list) => list.filter((x) => x.id !== n.id));
        this.total.update((t) => Math.max(0, t - 1));
        if (!n.lue) this.unreadCount.update((c) => Math.max(0, c - 1));
        this.busy.set(false);
      },
      error: () => this.busy.set(false)
    });
  }

  iconFor(type: string): string {
    return NOTIFICATION_CATEGORIES.find((c) => c.value === type)?.icon ?? 'ti-bell';
  }

  iconClass(type: string): string {
    const value = (type || '').toLowerCase();
    return `notif-icon-${value}`;
  }

  getRoleLabel(): string {
    const role = this.authService.currentUser()?.role;
    switch (role) {
      case 'ADMIN': return 'Administrateur';
      case 'ENCADRANT': return 'Encadrant';
      case 'STAGIAIRE': return 'Stagiaire';
      case 'CHEF_DEPARTEMENT': return 'Chef de Département';
      case 'RH': return 'Ressources Humaines';
      default: return 'Utilisateur';
    }
  }

  logout() {
    this.notifications.set([]);
    this.unreadCount.set(0);
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
