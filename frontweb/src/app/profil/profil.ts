import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/services/auth.service';
import { CandidatService } from '../core/services/candidat.service';
import { ApiError } from '../core/services/api.service';
import { CandidatProfile } from '../core/models/landing.models';
import { Header } from '../landing/header/header';
import { Footer } from '../landing/footer/footer';
import { Icon } from '../shared/components/icon/icon';
import { ChipsInput } from '../shared/components/chips-input/chips-input';

@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [RouterLink, FormsModule, Header, Footer, Icon, ChipsInput],
  templateUrl: './profil.html',
  styles: [
    `
      .profile-loading {
        min-height: 50vh;
        display: grid;
        place-items: center;
        gap: 10px;
        font-size: 15px;
        font-weight: 600;
        color: var(--color-text-secondary);
      }

      .profile-loading app-icon {
        font-size: 28px;
        color: var(--color-primary);
      }

      /* ---- Bandeau identité ---- */
      .profile__hero {
        color: #fff;
        background:
          radial-gradient(700px 320px at 85% -10%, rgba(59, 157, 255, 0.5), transparent 60%),
          linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
        padding-block: 40px 44px;
      }

      .profile__hero-inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        flex-wrap: wrap;
      }

      .profile__identity {
        display: flex;
        align-items: center;
        gap: 18px;
      }

      .profile__avatar {
        width: 84px;
        height: 84px;
        border-radius: 24px;
        object-fit: cover;
        border: 3px solid rgba(255, 255, 255, 0.4);
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
        flex-shrink: 0;
      }

      .profile__avatar--fallback {
        display: grid;
        place-items: center;
        font-size: 28px;
        font-weight: 800;
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
      }

      .profile__name {
        font-size: 28px;
        font-weight: 800;
        letter-spacing: -0.02em;
      }

      .profile__meta {
        margin-top: 4px;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.82);
      }

      .profile__badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 12px;
        font-size: 12.5px;
        font-weight: 700;
        background: rgba(255, 255, 255, 0.16);
        border: 1px solid rgba(255, 255, 255, 0.28);
        border-radius: var(--radius-pill);
        padding: 7px 13px;
        backdrop-filter: blur(6px);
      }

      .profile__logout {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 700;
        color: #fff;
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.35);
        border-radius: 12px;
        padding: 12px 18px;
        transition: background-color 0.18s ease;
      }

      .profile__logout:hover {
        background: rgba(255, 255, 255, 0.24);
      }

      /* ---- Corps ---- */
      .profile__body {
        padding-block: 40px 96px;
      }

      .profile__grid {
        display: grid;
        grid-template-columns: 320px 1fr;
        gap: 28px;
        align-items: start;
        margin-top: 28px;
      }

      .profile__aside {
        display: grid;
        gap: 24px;
        position: sticky;
        top: calc(var(--nav-height) + 20px);
      }

      .panel {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius);
        box-shadow: var(--shadow-soft);
        padding: 26px;
      }

      .panel__title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 16.5px;
        font-weight: 800;
        letter-spacing: -0.01em;
        margin-bottom: 20px;
      }

      .panel__title app-icon {
        font-size: 17px;
        color: var(--color-primary);
      }

      .panel__hint {
        margin-top: 12px;
        font-size: 12.5px;
        color: var(--color-text-tertiary);
        text-align: center;
      }

      .profile__form {
        display: grid;
        gap: 24px;
      }

      .profile__fields {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0 18px;
      }

      .profile__fields .field:nth-child(odd):last-child {
        grid-column: 1 / -1;
      }

      .profile__form > .btn {
        justify-self: start;
        min-width: 280px;
      }

      /* ---- Photo ---- */
      .photo-upload {
        display: grid;
        gap: 16px;
      }

      .photo-upload__preview {
        width: 100%;
        aspect-ratio: 1;
        border-radius: var(--radius);
        object-fit: cover;
        border: 1px solid var(--color-border);
      }

      .photo-upload__empty {
        width: 100%;
        aspect-ratio: 1;
        display: grid;
        place-items: center;
        gap: 10px;
        color: var(--color-text-tertiary);
        font-size: 14px;
        font-weight: 600;
        background: var(--color-surface-tone);
        border: 1px dashed var(--color-border);
        border-radius: var(--radius);
      }

      .photo-upload__empty app-icon {
        font-size: 34px;
      }

      @media (max-width: 960px) {
        .profile__grid {
          grid-template-columns: 1fr;
        }

        .profile__aside {
          position: static;
        }

        .profile__aside {
          grid-template-columns: 1fr 1fr;
        }
      }

      @media (max-width: 640px) {
        .profile__fields {
          grid-template-columns: 1fr;
        }

        .profile__aside {
          grid-template-columns: 1fr;
        }

        .profile__name {
          font-size: 23px;
        }
      }
    `,
  ],
})
export class Profil {
  private readonly auth = inject(AuthService);
  private readonly candidat = inject(CandidatService);

  protected readonly profile = signal<CandidatProfile | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notFound = signal(false);
  protected readonly success = signal<string | null>(null);
  protected readonly emailNotice = signal<string | null>(null);
  protected readonly photoUrl = signal<string | null>(null);

  protected readonly niveaux = ['BTS', 'Technicien', 'Licence', 'Master', 'Ingénieur'];

  protected readonly fullName = this.auth.fullName;

  protected readonly initials = computed(() => {
    const profile = this.profile();
    if (!profile) return '';
    return `${profile.prenom.charAt(0) ?? ''}${profile.nom.charAt(0) ?? ''}`.toUpperCase();
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.notFound.set(false);
    this.error.set(null);
    try {
      const profile = await this.candidat.getMe();
      this.profile.set(profile);
      await this.loadPhoto();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        this.notFound.set(true);
      } else {
        this.error.set(err instanceof ApiError ? err.message : 'Impossible de charger le profil.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  private async loadPhoto(): Promise<void> {
    if (!this.profile()?.photo) return;
    try {
      const blob = await this.candidat.getPhotoBlob();
      const url = URL.createObjectURL(blob);
      const previous = this.photoUrl();
      this.photoUrl.set(url);
      if (previous) URL.revokeObjectURL(previous);
    } catch {
      /* photo indisponible */
    }
  }

  protected update(field: keyof CandidatProfile, value: string | string[]): void {
    this.profile.update((p) => (p ? { ...p, [field]: value } : p));
  }

  protected async onPhotoSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.error.set(null);
    try {
      await this.candidat.uploadPhoto(file);
      await this.loadPhoto();
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'Photo non enregistrée.');
    } finally {
      this.uploading.set(false);
    }
  }

  protected async save(): Promise<void> {
    const profile = this.profile();
    if (!profile || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.emailNotice.set(null);
    try {
      const result = await this.candidat.updateMe({
        email: profile.email,
        telephone: profile.telephone ?? '',
        adresse: profile.adresse ?? '',
        universite: profile.universite ?? '',
        specialite: profile.specialite ?? '',
        niveau: profile.niveau ?? '',
        competences: profile.competences,
        langues: profile.langues,
        github: profile.github ?? '',
        linkedin: profile.linkedin ?? '',
        portfolio: profile.portfolio ?? '',
      });
      this.success.set(result.message);
      if (result.emailChanged) {
        this.emailNotice.set(
          'Un email de vérification a été envoyé à votre nouvelle adresse. Vérifiez votre boîte de réception avant de vous reconnecter.',
        );
        await this.auth.refreshUser().catch(() => undefined);
      }
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      this.saving.set(false);
    }
  }

  protected logout(): void {
    this.auth.logout();
  }

  protected readonly pwdCurrent = signal('');
  protected readonly pwdNew = signal('');
  protected readonly pwdConfirm = signal('');
  protected readonly pwdSaving = signal(false);
  protected readonly pwdError = signal<string | null>(null);
  protected readonly pwdSuccess = signal<string | null>(null);

  protected get pwdMismatch(): boolean {
    return this.pwdNew() !== '' && this.pwdConfirm() !== '' && this.pwdNew() !== this.pwdConfirm();
  }

  protected async changePassword(): Promise<void> {
    if (this.pwdSaving()) return;
    this.pwdError.set(null);
    this.pwdSuccess.set(null);
    if (this.pwdNew().length < 8) {
      this.pwdError.set('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (this.pwdMismatch) {
      this.pwdError.set('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }
    this.pwdSaving.set(true);
    try {
      const result = await this.candidat.changePassword(this.pwdCurrent(), this.pwdNew());
      this.pwdSuccess.set(result.message);
      this.pwdCurrent.set('');
      this.pwdNew.set('');
      this.pwdConfirm.set('');
    } catch (err) {
      this.pwdError.set(err instanceof ApiError ? err.message : 'Mot de passe non modifié.');
    } finally {
      this.pwdSaving.set(false);
    }
  }
}
