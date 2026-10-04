import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ApiError } from '../../core/services/api.service';
import { Header } from '../../landing/header/header';
import { Footer } from '../../landing/footer/footer';
import { Icon } from '../../shared/components/icon/icon';

@Component({
  selector: 'app-connexion',
  standalone: true,
  imports: [RouterLink, FormsModule, Header, Footer, Icon],
  templateUrl: './connexion.html',
  styles: [
    `
      .auth-shell {
        background:
          radial-gradient(700px 320px at 85% -10%, rgba(59, 157, 255, 0.12), transparent 60%),
          var(--color-background);
      }

      .field + .field {
        margin-top: 2px;
      }
    `,
  ],
})
export class Connexion {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);

  constructor() {
    // Session expirée/invalidée par le backend : message explicite renvoyé
    // par l'intercepteur HTTP (redirection vers /connexion?session=expiree).
    if (this.route.snapshot.queryParamMap.get('session') === 'expiree') {
      this.error.set('Votre session a expiré. Veuillez vous reconnecter.');
    }
  }

  async onSubmit(): Promise<void> {
    if (this.submitting()) return;
    this.error.set(null);
    this.submitting.set(true);
    try {
      await this.auth.login(this.email(), this.password());
      const retour = this.route.snapshot.queryParamMap.get('retour');
      this.router.navigate([retour && retour.startsWith('/') ? retour : '/mon-profil']);
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      this.submitting.set(false);
    }
  }
}
