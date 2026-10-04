import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { TokenStorage } from './token-storage.service';
import { AuthUser, LoginResponse, RegisterPayload } from '../models/landing.models';

interface AuthMessage {
  message: string;
  dev?: { verificationLink: string };
}

/** Gestion de la session du portail (connexion, inscription, vérification, mot de passe). */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly storage = inject(TokenStorage);

  private readonly userSignal = signal<AuthUser | null>(this.storage.getUser());
  private readonly tokenSignal = signal<string | null>(this.storage.getToken());

  readonly user = this.userSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.tokenSignal() && !!this.userSignal());
  readonly isCandidat = computed(() => this.userSignal()?.role === 'CANDIDAT');

  /** Affichage du nom complet dans l'interface. */
  readonly fullName = computed(() => {
    const user = this.userSignal();
    return user ? `${user.prenom} ${user.nom}` : '';
  });

  async login(email: string, password: string): Promise<void> {
    const result = await firstValueFrom(
      this.api.post<LoginResponse>('/auth/login', { email, password }),
    );
    this.storage.setToken(result.token);
    this.storage.setUser(result.user);
    this.tokenSignal.set(result.token);
    this.userSignal.set(result.user);
  }

  async register(payload: RegisterPayload): Promise<AuthMessage> {
    return firstValueFrom(this.api.post<AuthMessage>('/auth/register', payload));
  }

  async verifyEmail(token: string): Promise<AuthMessage> {
    return firstValueFrom(this.api.post<AuthMessage>('/auth/verify-email', { token }));
  }

  async resendVerification(email: string): Promise<AuthMessage> {
    return firstValueFrom(this.api.post<AuthMessage>('/auth/verify-email/resend', { email }));
  }

  async forgotPassword(email: string): Promise<AuthMessage> {
    return firstValueFrom(this.api.post<AuthMessage>('/auth/forgot-password', { email }));
  }

  async resetPassword(token: string, password: string): Promise<AuthMessage> {
    return firstValueFrom(this.api.post<AuthMessage>('/auth/reset-password', { token, password }));
  }

  /** Rafraîchit les informations du compte depuis l'API. */
  async refreshUser(): Promise<AuthUser | null> {
    if (!this.tokenSignal()) return null;
    const result = await firstValueFrom(
      this.api.get<{ user: AuthUser }>('/auth/me'),
    );
    this.storage.setUser(result.user);
    this.userSignal.set(result.user);
    return result.user;
  }

  logout(): void {
    this.storage.clearAll();
    this.tokenSignal.set(null);
    this.userSignal.set(null);
  }
}
