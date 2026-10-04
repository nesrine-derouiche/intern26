import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SHARED_IMPORTS } from 'src/app/theme/shared/shared.module';
import { NotificationService, NotificationItem, NOTIFICATION_CATEGORIES } from 'src/app/core/data/notification.service';
import { RelativeTimePipe } from 'src/app/core/pipes/relative-time.pipe';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-notifications',
  imports: [...SHARED_IMPORTS, RelativeTimePipe],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss'
})
export class NotificationsComponent implements OnInit {
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  readonly CATEGORIES = NOTIFICATION_CATEGORIES;

  notifications = signal<NotificationItem[]>([]);
  total = signal(0);
  unread = signal(0);
  read = signal(0);
  page = signal(1);
  pages = signal(1);
  loading = signal(false);
  busy = signal(false);
  activeFilter = signal<string | null>(null);
  error = signal('');

  ngOnInit(): void {
    this.loadStats();
    this.load();
  }

  loadStats(): void {
    this.notificationService.getUnreadCount().subscribe({
      next: (res) => {
        this.unread.set(res.total);
        this.read.set(Math.max(0, this.total() - res.total));
      },
      error: () => undefined
    });
    this.notificationService.getAll({ page: 1, limit: 1 }).subscribe({
      next: (res) => {
        this.total.set(res.total);
        this.read.set(Math.max(0, res.total - this.unread()));
      },
      error: () => undefined
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.notificationService
      .getAll({ page: this.page(), limit: PAGE_SIZE, type: this.activeFilter() })
      .subscribe({
        next: (res) => {
          this.total.set(res.total);
          this.pages.set(res.pages);
          this.notifications.set(res.data);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err.error?.message || 'Erreur lors du chargement des notifications.');
        }
      });
  }

  setFilter(category: string | null): void {
    if (this.activeFilter() === category) return;
    this.activeFilter.set(category);
    this.page.set(1);
    this.load();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.pages() || p === this.page()) return;
    this.page.set(p);
    this.load();
  }

  markAsRead(n: NotificationItem): void {
    if (n.lue) return;
    this.notificationService.markAsRead(n.id).subscribe({
      next: () => {
        this.notifications.update((list) => list.map((x) => (x.id === n.id ? { ...x, lue: true } : x)));
        this.unread.update((c) => Math.max(0, c - 1));
        this.read.update((c) => Math.max(0, this.total() - this.unread()));
      },
      error: () => undefined
    });
  }

  markAllAsRead(): void {
    if (this.unread() === 0 || this.busy()) return;
    this.busy.set(true);
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.notifications.update((list) => list.map((x) => ({ ...x, lue: true })));
        this.unread.set(0);
        this.read.set(this.total());
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
        if (!n.lue) this.unread.update((c) => Math.max(0, c - 1));
        this.read.set(Math.max(0, this.total() - this.unread()));
        this.busy.set(false);
      },
      error: () => this.busy.set(false)
    });
  }

  openNotification(n: NotificationItem): void {
    this.markAsRead(n);
    if (n.lien && n.lien.startsWith('/')) {
      this.router.navigateByUrl(n.lien);
    }
  }

  iconFor(type: string): string {
    return NOTIFICATION_CATEGORIES.find((c) => c.value === type)?.icon ?? 'ti-bell';
  }

  iconClass(type: string): string {
    const value = (type || '').toLowerCase();
    return `notif-icon-${value}`;
  }
}
