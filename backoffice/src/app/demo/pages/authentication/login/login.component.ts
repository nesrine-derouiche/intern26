import { ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { email, form, minLength, required, FormField } from '@angular/forms/signals';
import { AuthService } from '../../../../core/data/auth.service';

@Component({
  selector: 'app-login',
  imports: [RouterModule, FormsModule, FormField],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private cd = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private router = inject(Router);

  submitted = signal(false);
  loading = signal(false);
  error = signal('');
  showPassword = signal(false);

  loginModal = signal<{ email: string; password: string }>({
    email: '',
    password: ''
  });

  loginForm = form(this.loginModal, (schemaPath) => {
    required(schemaPath.email, { message: 'L\'email est requis' });
    email(schemaPath.email, { message: 'Entrez un email valide' });
    required(schemaPath.password, { message: 'Le mot de passe est requis' });
    minLength(schemaPath.password, 6, { message: 'Le mot de passe doit contenir au moins 6 caractères' });
  });

  onSubmit(event: Event) {
    this.submitted.set(true);
    this.error.set('');
    event.preventDefault();

    const credentials = this.loginModal();
    if (!credentials.email || !credentials.password) return;

    this.loading.set(true);

    this.authService.login(credentials).subscribe({
      next: (res: any) => {
        this.loading.set(false);
        // Bloquer les stagiaires — ils utilisent l'application mobile
        const role = res?.user?.role;
        if (role === 'STAGIAIRE') {
          this.authService.logout();
          this.error.set('⚠️ L\'accès au portail web est réservé au personnel STEG. Les stagiaires doivent utiliser l\'application mobile.');
          this.cd.detectChanges();
          return;
        }
        this.router.navigate(['/default']);
      },
      error: (err: any) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Échec de la connexion. Veuillez réessayer.');
        this.cd.detectChanges();
      }
    });
  }
}
