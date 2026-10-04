import { Component, inject } from '@angular/core';
import { LandingService } from '../../core/services/landing.service';
import { AnimatedCounter } from '../../shared/components/animated-counter/animated-counter';
import { Icon } from '../../shared/components/icon/icon';
import { RevealDirective } from '../../shared/directives/reveal.directive';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [AnimatedCounter, Icon, RevealDirective],
  templateUrl: './stats.html',
  styles: [`
    .stats {
      position: relative;
      overflow: hidden;
      padding-block: 84px;
      background:
        radial-gradient(700px 320px at 90% 0%, rgba(59, 157, 255, 0.35), transparent 60%),
        linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 100%);
      color: #fff;
    }

    .stats__grid {
      position: relative;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 32px;
    }

    .stat {
      text-align: center;
      padding: 10px;
    }

    .stat__icon {
      width: 56px;
      height: 56px;
      margin-inline: auto;
      margin-bottom: 18px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      font-size: 26px;
      color: #fff;
      background: rgba(255, 255, 255, 0.16);
      border: 1px solid rgba(255, 255, 255, 0.22);
    }

    .stat__value {
      font-size: clamp(36px, 4.4vw, 52px);
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1;
    }

    .stat__label {
      margin-top: 12px;
      font-size: 14.5px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.78);
    }

    @media (max-width: 960px) {
      .stats__grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 40px 24px;
      }
    }
  `],
})
export class Stats {
  private readonly service = inject(LandingService);
  protected readonly stats = this.service.stats;
}
