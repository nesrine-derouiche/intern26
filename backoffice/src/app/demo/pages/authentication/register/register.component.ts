import { ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../../core/data/auth.service';

@Component({
  selector: 'app-register',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private cd = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private router = inject(Router);

  submitted = signal(false);
  loading = signal(false);
  error = signal('');
  success = signal('');
  showPassword = signal(false);

  registerForm = new FormGroup({
    firstName: new FormControl('', [Validators.required]),
    lastName: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(8)])
  });

  onSubmit(event: Event) {
    this.submitted.set(true);
    this.error.set('');
    this.success.set('');
    event.preventDefault();

    if (this.registerForm.invalid) {
      return;
    }

    this.loading.set(true);

    const formValue = this.registerForm.value as { email: string; password: string; firstName: string; lastName: string };

    this.authService.register(formValue).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.success.set('Account created successfully! Redirecting to login...');
        this.cd.detectChanges();
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 1500);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'Registration failed. Please try again.');
        this.cd.detectChanges();
      }
    });
  }
}
