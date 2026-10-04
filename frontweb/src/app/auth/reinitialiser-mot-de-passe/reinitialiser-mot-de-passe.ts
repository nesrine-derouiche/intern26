import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ApiError } from '../../core/services/api.service';
import { Header } from '../../landing/header/header';
import { Footer } from '../../landing/footer/footer';
import { Icon } from '../../shared/components/icon/icon';

@Component({
  selector: 'app-reinitialiser-mot-de-passe',
  standalone: true,
  imports: [FormsModule, Header, Footer, Icon],
  templateUrl: './reinitialiser-mot-de-passe.html',
  styles: [``],
})
export class ReinitialiserMotDePasse {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly password = signal('');
  protected readonly confirm = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly submitting = signal(false);

  async onSubmit(): Promise<void> {
    if (this.submitting()) return;
    this.error.set(null);

    if (this.password() !== this.confirm()) {
      this.error.set('Les mots de passe ne correspondent pas.');
      return;
    }

    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.error.set('Lien de réinitialisation invalide : jeton manquant.');
      return;
    }

    this.submitting.set(true);
    try {
      const result = await this.auth.resetPassword(token, this.password());
      this.success.set(result.message);
      this.submitting.set(false);
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      this.submitting.set(false);
    }
  }

  goToLogin(): void {
    this.router.navigate(['/connexion']);
  }
}
