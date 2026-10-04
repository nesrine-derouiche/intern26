import { Component, inject, signal } from '@angular/core';
import { Header } from '../landing/header/header';
import { Footer } from '../landing/footer/footer';
import { Icon } from '../shared/components/icon/icon';
import { HumanInterviewCard } from '../shared/components/human-interview-card/human-interview-card';
import { StagePreferencesCard } from '../shared/components/stage-preferences-card/stage-preferences-card';
import { OffersApiService } from '../core/services/offers-api.service';
import { ApiError } from '../core/services/api.service';
import { CandidatureListItem } from '../core/models/landing.models';
import {
  candidatureStatutLabel,
  candidatureStatutTone,
  formatIsoDate,
} from '../core/utils/candidature.util';

/**
 * « Mes candidatures » du candidat connecté (portail public).
 * Liste les candidatures filtrées côté serveur sur le candidat, puis affiche
 * pour chacune la section « Entretien humain » correspondante.
 */
@Component({
  selector: 'app-mes-candidatures',
  standalone: true,
  imports: [Header, Footer, Icon, HumanInterviewCard, StagePreferencesCard],
  templateUrl: './mes-candidatures.html',
  styles: [
    `
      .page {
        min-height: 60vh;
      }

      .page__head {
        padding-block: 44px 8px;
      }

      .page__title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 26px;
        font-weight: 800;
        letter-spacing: -0.02em;
        margin: 0 0 6px;
      }

      .page__title app-icon {
        color: var(--color-primary);
      }

      .page__sub {
        color: var(--color-text-secondary);
        font-size: 14.5px;
        margin: 0;
      }

      .state {
        min-height: 40vh;
        display: grid;
        place-items: center;
        gap: 10px;
        text-align: center;
        color: var(--color-text-secondary);
        font-weight: 600;
        font-size: 15px;
      }

      .state app-icon {
        font-size: 30px;
        color: var(--color-primary);
      }

      .state--error app-icon {
        color: var(--color-danger, #b91c1c);
      }

      .list {
        display: grid;
        gap: 18px;
        padding-block: 28px 56px;
      }

      .candidature {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        background: var(--color-surface);
        padding: 22px;
        display: grid;
        gap: 16px;
        box-shadow: 0 6px 24px rgba(17, 24, 39, 0.05);
      }

      .candidature__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .candidature__titre {
        font-size: 18px;
        font-weight: 700;
        color: var(--color-text);
        margin: 0 0 4px;
      }

      .candidature__meta {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--color-text-secondary);
        margin: 0;
      }

      .candidature__meta app-icon {
        color: var(--color-text-tertiary);
      }

      .hi__badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: var(--radius-pill);
        font-size: 12.5px;
        font-weight: 700;
        white-space: nowrap;
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
    `,
  ],
})
export class MesCandidatures {
  private readonly api = inject(OffersApiService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly candidatures = signal<CandidatureListItem[]>([]);

  protected readonly statutLabel = candidatureStatutLabel;
  protected readonly statutTone = candidatureStatutTone;
  protected readonly formatDate = formatIsoDate;

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.candidatures.set(await this.api.myCandidatures());
    } catch (err) {
      this.error.set(
        err instanceof ApiError ? err.message : 'Impossible de charger vos candidatures.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
