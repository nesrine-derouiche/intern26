import { Component, effect, inject, input, signal } from '@angular/core';
import { Icon } from '../icon/icon';
import { OffersApiService } from '../../../core/services/offers-api.service';
import { HumanInterview } from '../../../core/models/landing.models';
import {
  formatInterviewHeure,
  formatIsoDate,
  humanInterviewStatutLabel,
  humanInterviewStatutTone,
  interviewTypeLabel,
} from '../../../core/utils/candidature.util';

/**
 * Section « Entretien humain » d'une candidature (portail candidat).
 * Charge l'entretien via GET /candidatures/:id/entretien-humain (endpoint
 * existant, ownership vérifiée côté serveur) et gère les états de chargement,
 * d'erreur et « aucun entretien planifié ».
 */
@Component({
  selector: 'app-human-interview-card',
  standalone: true,
  imports: [Icon],
  templateUrl: './human-interview-card.html',
  styles: [
    `
      :host {
        display: block;
      }

      .hi {
        border: 1px solid var(--color-border);
        border-radius: var(--radius);
        background: var(--color-surface);
        padding: 20px;
        display: grid;
        gap: 16px;
      }

      .hi--muted,
      .hi--empty,
      .hi--error {
        place-items: center;
        text-align: center;
        padding-block: 28px;
        color: var(--color-text-secondary);
        font-size: 14px;
        font-weight: 600;
        display: grid;
        gap: 10px;
      }

      .hi--empty {
        border-style: dashed;
        background: var(--color-surface-tone);
      }

      .hi--error {
        color: var(--color-danger, #b91c1c);
      }

      .hi__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .hi__title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 700;
        color: var(--color-text);
        margin: 0;
      }

      .hi__title app-icon {
        color: var(--color-primary);
      }

      .hi__badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: var(--radius-pill);
        font-size: 12.5px;
        font-weight: 700;
      }

      .hi__badge--info {
        color: var(--color-primary-dark);
        background: var(--color-primary-tint);
      }

      .hi__badge--success {
        color: #166534;
        background: #dcfce7;
      }

      .hi__badge--danger {
        color: #b91c1c;
        background: #fee2e2;
      }

      .hi__badge--warning {
        color: #92400e;
        background: #fef3c7;
      }

      .hi__badge--neutral {
        color: var(--color-text-secondary);
        background: var(--color-surface-tone);
      }

      .hi__list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin: 0;
      }

      .hi__item {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .hi__item dt {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 600;
        color: var(--color-text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      .hi__item dd {
        margin: 0;
        font-size: 14.5px;
        font-weight: 600;
        color: var(--color-text);
      }

      .hi__notes {
        font-size: 13.5px;
        color: var(--color-text-secondary);
        margin: 0;
      }

      .hi__join {
        justify-self: start;
      }

      .hi__join app-icon {
        color: #fff;
      }
    `,
  ],
})
export class HumanInterviewCard {
  readonly candidatureId = input.required<string>();

  private readonly api = inject(OffersApiService);

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly interview = signal<HumanInterview | null>(null);

  protected readonly statutLabel = humanInterviewStatutLabel;
  protected readonly statutTone = humanInterviewStatutTone;
  protected readonly typeLabel = interviewTypeLabel;
  protected readonly formatDate = formatIsoDate;
  protected readonly formatHeure = formatInterviewHeure;

  private loadedId = '';

  constructor() {
    effect(() => {
      const id = this.candidatureId();
      if (id && id !== this.loadedId) {
        this.loadedId = id;
        void this.load(id);
      }
    });
  }

  /** Le candidat peut rejoindre uniquement un entretien planifié en visio. */
  protected canJoin(interview: HumanInterview): boolean {
    return interview.statut === 'PLANIFIE' && !!interview.lien_visio;
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    this.interview.set(null);
    try {
      this.interview.set(await this.api.getHumanInterview(id));
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
