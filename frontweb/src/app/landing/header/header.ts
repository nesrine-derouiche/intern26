import { Component, HostListener, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Icon } from '../../shared/components/icon/icon';

@Component({
  selector: 'app-landing-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, Icon],
  templateUrl: './header.html',
  styles: [`
    :host {
      position: sticky;
      top: 0;
      z-index: 50;
      display: block;
    }

    .header {
      transition:
        background-color 0.25s ease,
        box-shadow 0.25s ease,
        backdrop-filter 0.25s ease;
      border-bottom: 1px solid transparent;
    }

    .header.is-scrolled {
      background: rgba(255, 255, 255, 0.86);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom-color: var(--color-border);
      box-shadow: 0 4px 20px rgba(17, 24, 39, 0.06);
    }

    .header__inner {
      height: var(--nav-height);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
    }

    .brand__logo {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: var(--bg-gradient);
      color: #fff;
      display: grid;
      place-items: center;
      box-shadow: 0 6px 16px rgba(0, 102, 204, 0.35);
      flex-shrink: 0;
    }

    .brand__logo app-icon {
      font-size: 22px;
    }

    .brand__name {
      font-size: 17px;
      font-weight: 800;
      letter-spacing: -0.01em;
      color: var(--color-text);
      line-height: 1.2;
    }

    .brand__tag {
      font-size: 11.5px;
      font-weight: 600;
      color: var(--color-text-tertiary);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .nav {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .nav__link {
      font-size: 14.5px;
      font-weight: 600;
      color: var(--color-text-secondary);
      padding: 9px 14px;
      border-radius: 10px;
      transition: color 0.18s ease, background-color 0.18s ease;
    }

    .nav__link:hover {
      color: var(--color-primary);
      background: var(--color-primary-tint);
    }

    .nav__link.is-active {
      color: var(--color-primary);
      background: var(--color-primary-tint);
    }

    .header__actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn--sm {
      padding: 11px 18px;
      font-size: 14px;
      border-radius: 12px;
    }

    .btn--outline.btn--sm {
      background: transparent;
      border-color: var(--color-border);
    }

    .btn--outline.btn--sm:hover {
      border-color: var(--color-primary);
    }

    .nav__toggle {
      display: none;
      width: 44px;
      height: 44px;
      border-radius: 12px;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text);
      align-items: center;
      justify-content: center;
      font-size: 22px;
    }

    .mobile-menu {
      display: none;
    }

    @media (max-width: 900px) {
      .nav {
        display: none;
      }

      .header__actions .btn {
        display: none;
      }

      .nav__toggle {
        display: inline-flex;
      }

      .mobile-menu {
        display: grid;
        gap: 4px;
        padding: 12px 24px 20px;
        background: rgba(255, 255, 255, 0.96);
        backdrop-filter: blur(16px);
        border-bottom: 1px solid var(--color-border);
      }

      .mobile-menu__link {
        font-size: 16px;
        font-weight: 600;
        color: var(--color-text);
        padding: 13px 12px;
        border-radius: 10px;
      }

      .mobile-menu__link:hover {
        background: var(--color-surface-tone);
        color: var(--color-primary);
      }

      .mobile-menu__btn {
        margin-top: 8px;
      }
    }
  `],
})
export class Header {
  protected readonly scrolled = signal(false);
  protected readonly menuOpen = signal(false);

  private readonly auth = inject(AuthService);

  protected readonly isAuthenticated = this.auth.isAuthenticated;
  protected readonly user = this.auth.user;
  protected readonly fullName = this.auth.fullName;

  protected logout(): void {
    this.menuOpen.set(false);
    this.auth.logout();
  }

  @HostListener('window:scroll')
  protected onScroll(): void {
    this.scrolled.set(window.scrollY > 16);
  }
}
