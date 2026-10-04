import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LandingService } from '../../core/services/landing.service';
import { Icon } from '../../shared/components/icon/icon';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { SectionHeader } from '../../shared/components/section-header/section-header';

@Component({
  selector: 'app-domains',
  standalone: true,
  imports: [RouterLink, Icon, RevealDirective, SectionHeader],
  templateUrl: './domains.html',
  styles: [`
    .domains {
      padding-block: 96px;
      background: var(--color-surface);
    }

    .domains__grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }

    .domain-card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 30px 28px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      background: var(--color-surface);
      transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
    }

    .domain-card:hover {
      transform: translateY(-6px);
      box-shadow: var(--shadow-hover);
      border-color: rgba(0, 102, 204, 0.35);
    }

    .domain-card__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .domain-card__icon {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      font-size: 26px;
    }

    .domain-card__count {
      font-size: 13px;
      font-weight: 700;
      color: var(--color-text-secondary);
      background: var(--color-surface-tone);
      border-radius: var(--radius-pill);
      padding: 7px 13px;
    }

    .domain-card__title {
      font-size: 19px;
      font-weight: 800;
      letter-spacing: -0.01em;
    }

    .domain-card__text {
      font-size: 14.5px;
      line-height: 1.6;
      color: var(--color-text-secondary);
    }

    .domain-card__link {
      margin-top: auto;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 700;
      color: var(--color-primary);
    }

    .domain-card__link app-icon {
      font-size: 16px;
      transition: transform 0.18s ease;
    }

    .domain-card:hover .domain-card__link app-icon {
      transform: translate(3px, -3px);
    }

    @media (max-width: 1024px) {
      .domains__grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 640px) {
      .domains__grid {
        grid-template-columns: 1fr;
      }

      .domains {
        padding-block: 72px;
      }
    }
  `],
})
export class Domains {
  private readonly service = inject(LandingService);
  protected readonly domains = this.service.domains;
}
