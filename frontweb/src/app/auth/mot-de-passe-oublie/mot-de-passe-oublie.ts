import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ApiError } from '../../core/services/api.service';
import { Header } from '../../landing/header/header';
import { Footer } from '../../landing/footer/footer';
import { Icon } from '../../shared/components/icon/icon';

@Component({
  selector: 'app-mot-de-passe-oublie',
  standalone: true,
  imports: [RouterLink, FormsModule, Header, Footer, Icon],
  templateUrl: './mot-de-passe-oublie.html',
  styles: [``],
})
export class MotDePasseOublie {
  private readonly auth = inject(AuthService);

  protected readonly email = signal('');
  protected readonly sent = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);

  async onSubmit(): Promise<void> {
    if (this.submitting()) return;
    this.error.set(null);
    this.submitting.set(true);
    try {
      const result = await this.auth.forgotPassword(this.email().trim());
      this.sent.set(true);
      this.submitting.set(false);
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      this.submitting.set(false);
    }
  }
}
