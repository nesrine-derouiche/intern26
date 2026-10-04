import { Component, computed, inject, input, signal } from '@angular/core';
import { Icon } from '../icon/icon';
import { OffersApiService } from '../../../core/services/offers-api.service';
import { ApiError } from '../../../core/services/api.service';
import { Candidature } from '../../../core/models/landing.models';
import { formatIsoDate } from '../../../core/utils/candidature.util';

interface SavedPreferences {
  internship_start_date: string | null;
  internship_duration_months: number | null;
  internship_period_validated_at?: string | null;
  internship_modification_requested_at?: string | null;
}

/**
 * Section « Préparez votre stage » d'une candidature acceptée (portail candidat).
 * Permet au candidat, après acceptation de l'entretien humain
 * (HUMAN_INTERVIEW_ACCEPTED), de renseigner la date de début de stage souhaitée
 * et sa durée (1, 2, 3 mois ou une durée personnalisée), puis de les modifier
 * tant que le RH n'a pas validé la période (étape ultérieure).
 */
@Component({
  selector: 'app-stage-preferences-card',
  standalone: true,
  imports: [Icon],
  templateUrl: './stage-preferences-card.html',
  styles: [
    `
      :host {
        display: block;
      }

      .sp {
        border: 1px solid var(--color-border);
        border-radius: var(--radius);
        background: var(--color-surface);
        padding: 20px;
        display: grid;
        gap: 14px;
      }

      .sp__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .sp__title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 700;
        color: var(--color-text);
        margin: 0;
      }

      .sp__title app-icon {
        color: var(--color-primary);
      }

      .sp__intro {
        font-size: 14px;
        color: var(--color-text-secondary);
        line-height: 1.6;
        margin: 0;
      }

      .sp__fields {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
      }

      .field__label {
        font-size: 13px;
        font-weight: 700;
        color: var(--color-text);
        display: block;
        margin-bottom: 8px;
      }

      .field__input {
        width: 100%;
        height: 46px;
        padding: 0 14px;
        font: inherit;
        font-size: 14.5px;
        color: var(--color-text);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 12px;
        outline: none;
        transition: border-color 0.18s ease, box-shadow 0.18s ease;
      }

      .field__input:focus {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 4px rgba(0, 102, 204, 0.12);
      }

      .sp__options {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .sp__option {
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        padding: 10px 18px;
        border-radius: var(--radius-pill);
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-text);
        transition: border-color 0.18s ease, color 0.18s ease, background-color 0.18s ease;
      }

      .sp__option:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }

      .sp__option--active {
        border-color: var(--color-primary);
        background: var(--color-primary-tint);
        color: var(--color-primary-dark);
      }

      .sp__actions {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .sp__error {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        font-size: 13.5px;
        font-weight: 600;
        color: #b91c1c;
        line-height: 1.5;
      }

      .sp__error app-icon {
        margin-top: 2px;
        flex-shrink: 0;
      }

      .sp__done {
        display: grid;
        gap: 10px;
        padding: 14px 16px;
        border-radius: 14px;
        background: #f0fdf4;
        border: 1px solid rgba(34, 197, 94, 0.35);
      }

      .sp__done--validated {
        background: #eff6ff;
        border-color: rgba(59, 130, 246, 0.35);
      }

      .sp__done-line--warn {
        color: #92400e;
      }

      .sp__done-line--info {
        color: var(--color-primary-dark);
      }

      .sp__done-line {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 600;
        color: #166534;
      }

      .sp__done-line app-icon {
        color: var(--color-accent);
        flex-shrink: 0;
      }

      .sp__done-value {
        font-weight: 700;
      }

      .sp__modify {
        justify-self: start;
      }
    `,
  ],
})
export class StagePreferencesCard {
  readonly candidatureId = input.required<string>();
  readonly startDate = input<string | null | undefined>(null);
  readonly durationMonths = input<number | null | undefined>(null);
  readonly submittedAt = input<string | null | undefined>(null);
  readonly validatedAt = input<string | null | undefined>(null);
  readonly modificationRequestedAt = input<string | null | undefined>(null);
  readonly mobileAccessSentAt = input<string | null | undefined>(null);

  private readonly api = inject(OffersApiService);

  protected readonly editing = signal(false);
  protected readonly pickingStart = signal('');
  protected readonly months = signal<number | null>(null);
  protected readonly showCustom = signal(false);
  protected readonly customMonths = signal<number | null>(null);
  protected readonly submitted = signal<SavedPreferences | null>(null);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly options = [1, 2, 3];

  protected readonly formatDate = formatIsoDate;

  /** Date minimale du sélecteur : aujourd'hui (la date choisie doit être future). */
  protected readonly minStartDate = (() => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }));
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  })();

  /** Préférences déjà enregistrées (soit fraîchement soumises, soit héritées). */
  protected readonly saved = computed<SavedPreferences | null>(() => {
    const fresh = this.submitted();
    if (fresh) return fresh;
    if (this.submittedAt()) {
      return {
        internship_start_date: this.startDate() ?? null,
        internship_duration_months: this.durationMonths() ?? null,
        internship_period_validated_at: this.validatedAt() ?? null,
        internship_modification_requested_at: this.modificationRequestedAt() ?? null,
      };
    }
    return null;
  });

  /** La période de stage a été validée par le RH : elle est figée (lecture seule). */
  protected readonly isValidated = computed(() => !!this.saved()?.internship_period_validated_at);

  /** L'email d'accès à l'application mobile a déjà été envoyé (D-1). */
  protected readonly mobileAccessSent = computed(() => !!this.mobileAccessSentAt());

  /** Le RH a demandé une modification : la période redevient éditable. */
  protected readonly isModificationRequested = computed(
    () => !this.isValidated() && !!this.saved()?.internship_modification_requested_at,
  );

  /** Afficher le formulaire (jamais enregistré, ou en cours de modification, et non validé). */
  protected readonly showForm = computed(() => !this.isValidated() && (this.editing() || !this.saved()));

  protected readonly effectiveMonths = computed<number | null>(() =>
    this.showCustom() ? this.customMonths() : this.months(),
  );

  protected durationLabel(months: number): string {
    return months === 1 ? '1 mois' : `${months} mois`;
  }

  protected selectMonths(months: number): void {
    this.months.set(months);
    this.showCustom.set(false);
    this.customMonths.set(null);
  }

  protected toggleCustom(): void {
    this.showCustom.set(true);
    this.months.set(null);
  }

  protected onStartChange(event: Event): void {
    this.pickingStart.set((event.target as HTMLInputElement).value);
  }

  protected onCustomChange(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.customMonths.set(Number.isFinite(value) && value > 0 ? value : null);
  }

  protected startEditing(): void {
    const saved = this.saved();
    if (saved?.internship_start_date) this.pickingStart.set(saved.internship_start_date);
    const months = saved?.internship_duration_months;
    if (months != null) {
      if (this.options.includes(months)) {
        this.months.set(months);
        this.showCustom.set(false);
      } else {
        this.showCustom.set(true);
        this.customMonths.set(months);
      }
    }
    this.error.set(null);
    this.editing.set(true);
  }

  protected async submit(): Promise<void> {
    const start = this.pickingStart().trim();
    const months = this.effectiveMonths();
    if (!start) {
      this.error.set('Veuillez indiquer la date de début de votre stage.');
      return;
    }
    if (!months || months < 1 || months > 24) {
      this.error.set('Veuillez indiquer une durée comprise entre 1 et 24 mois.');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    try {
      const result = await this.api.submitStagePreferences(this.candidatureId(), {
        internship_start_date: start,
        internship_duration_months: months,
      });
      this.submitted.set({
        internship_start_date: result.internship_start_date ?? start,
        internship_duration_months: result.internship_duration_months ?? months,
        internship_period_validated_at: result.internship_period_validated_at ?? null,
        internship_modification_requested_at: result.internship_modification_requested_at ?? null,
      });
      this.editing.set(false);
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      this.submitting.set(false);
    }
  }
}
