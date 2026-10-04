import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ApiError } from '../../core/services/api.service';
import { Header } from '../../landing/header/header';
import { Footer } from '../../landing/footer/footer';
import { Icon } from '../../shared/components/icon/icon';

@Component({
  selector: 'app-verification-email',
  standalone: true,
  imports: [RouterLink, Header, Footer, Icon],
  templateUrl: './verification-email.html',
  styles: [``],
})
export class VerificationEmail {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly status = signal<'loading' | 'success' | 'error'>('loading');
  protected readonly message = signal('Vérification de votre adresse email…');

  constructor() {
    void this.verify();
  }

  private async verify(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.status.set('error');
      this.message.set('Lien de vérification invalide : jeton manquant.');
      return;
    }
    try {
      const result = await this.auth.verifyEmail(token);
      this.status.set('success');
      this.message.set(result.message);
    } catch (err) {
      this.status.set('error');
      this.message.set(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    }
  }

  protected goToLogin(): void {
    this.router.navigate(['/connexion']);
  }
}
