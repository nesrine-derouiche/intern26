import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LandingOffer } from '../../../core/models/landing.models';
import { formatDeadline } from '../../../core/utils/date.util';
import { Icon } from '../icon/icon';

/**
 * Carte d'offre moderne et réutilisable (landing + page Offres).
 * Affiche les informations clés et les actions « Voir le détail »
 * et « Postuler ».
 */
@Component({
  selector: 'app-offer-card',
  standalone: true,
  imports: [RouterLink, Icon],
  templateUrl: './offer-card.html',
  styles: [`
    .offer-card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      height: 100%;
      padding: 26px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      background: var(--color-surface);
      box-shadow: var(--shadow-soft);
      transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
    }

    .offer-card:hover {
      transform: translateY(-6px);
      box-shadow: var(--shadow-hover);
      border-color: rgba(0, 102, 204, 0.4);
    }

    .offer-card__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .offer-card__dept {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--color-primary);
    }

    .offer-card__level {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 700;
      color: var(--color-primary-dark);
      background: var(--color-primary-tint);
      padding: 6px 11px;
      border-radius: var(--radius-pill);
    }

    .offer-card__level app-icon {
      font-size: 14px;
    }

    .offer-card__title {
      font-size: 18px;
      font-weight: 800;
      line-height: 1.35;
      letter-spacing: -0.01em;
      color: var(--color-text);
    }

    .offer-card__desc {
      font-size: 14px;
      line-height: 1.6;
      color: var(--color-text-secondary);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .offer-card__meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 9px 16px;
      padding-block: 10px 4px;
      border-top: 1px dashed var(--color-border);
    }

    .offer-card__meta-item {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-secondary);
    }

    .offer-card__meta-item app-icon {
      font-size: 15px;
      color: var(--color-primary);
      flex-shrink: 0;
    }

    .offer-card__tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .offer-card__tag {
      font-size: 12px;
      font-weight: 600;
      color: var(--color-primary);
      background: var(--color-primary-tint);
      padding: 6px 11px;
      border-radius: var(--radius-pill);
    }

    .offer-card__footer {
      margin-top: auto;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .offer-card__footer .btn {
      padding: 12px 10px;
      font-size: 13.5px;
      border-radius: 12px;
    }
  `],
})
export class OfferCard {
  readonly offer = input.required<LandingOffer>();

  protected readonly formatDate = formatDeadline;
}
