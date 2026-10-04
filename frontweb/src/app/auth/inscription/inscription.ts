import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ApiError } from '../../core/services/api.service';
import { Header } from '../../landing/header/header';
import { Footer } from '../../landing/footer/footer';
import { Icon } from '../../shared/components/icon/icon';

@Component({
  selector: 'app-inscription',
  standalone: true,
  imports: [RouterLink, FormsModule, Header, Footer, Icon],
  templateUrl: './inscription.html',
  styles: [
    `
      .auth-shell {
        background:
          radial-gradient(700px 320px at 85% -10%, rgba(59, 157, 255, 0.12), transparent 60%),
          var(--color-background);
      }

      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0 16px;
      }

      @media (max-width: 520px) {
        .form-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class Inscription {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly nom = signal('');
  protected readonly prenom = signal('');
  protected readonly email = signal('');
  protected readonly telephone = signal('');
  protected readonly password = signal('');
  protected readonly confirm = signal('');
  protected readonly universite = signal('');
  protected readonly specialite = signal('');
  protected readonly niveau = signal('Licence');
  protected readonly competencesInput = signal('');
  protected readonly languesInput = signal('');

  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly verificationLink = signal<string | null>(null);
  protected readonly submitting = signal(false);

  protected readonly niveaux = ['BTS', 'Technicien', 'Licence', 'Master', 'Ingénieur'];

  private parseList(value: string): string[] {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async onSubmit(): Promise<void> {
    if (this.submitting()) return;
    this.error.set(null);
    this.success.set(null);

    if (this.password() !== this.confirm()) {
      this.error.set('Les mots de passe ne correspondent pas.');
      return;
    }

    this.submitting.set(true);
    try {
      const result = await this.auth.register({
        nom: this.nom().trim(),
        prenom: this.prenom().trim(),
        email: this.email().trim(),
        password: this.password(),
        telephone: this.telephone().trim() || undefined,
        universite: this.universite().trim() || undefined,
        specialite: this.specialite().trim() || undefined,
        niveau: this.niveau(),
        competences: this.parseList(this.competencesInput()),
        langues: this.parseList(this.languesInput()),
      });
      this.success.set(result.message);
      this.verificationLink.set(result.dev?.verificationLink ?? null);
      this.submitting.set(false);
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      this.submitting.set(false);
    }
  }
}
