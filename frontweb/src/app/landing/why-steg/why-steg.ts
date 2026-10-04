import { Component, inject } from '@angular/core';
import { LandingService } from '../../core/services/landing.service';
import { Icon } from '../../shared/components/icon/icon';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { SectionHeader } from '../../shared/components/section-header/section-header';

@Component({
  selector: 'app-why-steg',
  standalone: true,
  imports: [Icon, RevealDirective, SectionHeader],
  templateUrl: './why-steg.html',
  styles: [`
    .why {
      padding-block: 96px;
    }

    .why__grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 22px;
    }

    .why-card {
      position: relative;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      padding: 30px 26px;
      box-shadow: var(--shadow-soft);
      transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
    }

    .why-card:hover {
      transform: translateY(-6px);
      box-shadow: var(--shadow-hover);
      border-color: rgba(0, 102, 204, 0.35);
    }

    .why-card__icon {
      width: 54px;
      height: 54px;
      border-radius: 15px;
      display: grid;
      place-items: center;
      font-size: 25px;
      color: var(--color-primary);
      background: var(--color-primary-tint);
      margin-bottom: 20px;
    }

    .why-card__title {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.01em;
      margin-bottom: 10px;
    }

    .why-card__text {
      font-size: 14.5px;
      line-height: 1.6;
      color: var(--color-text-secondary);
    }

    @media (max-width: 1024px) {
      .why__grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 560px) {
      .why__grid {
        grid-template-columns: 1fr;
      }

      .why {
        padding-block: 72px;
      }
    }
  `],
})
export class WhySteg {
  private readonly service = inject(LandingService);
  protected readonly points = this.service.whyPoints;
}
