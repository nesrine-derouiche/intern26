import { Injectable } from '@angular/core';
import { AuthUser } from '../models/landing.models';

const TOKEN_KEY = 'steg_portal_token';
const USER_KEY = 'steg_portal_user';

/**
 * Persistance du jeton JWT et de l'utilisateur courant (localStorage).
 * Les accès sont sécurisés pour les environnements sans stockage local
 * (tests, SSR) : la session est simplement volatilisée.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  private get store(): Storage | null {
    try {
      return typeof window !== 'undefined' ? window.localStorage : null;
    } catch {
      return null;
    }
  }

  getToken(): string | null {
    return this.store?.getItem(TOKEN_KEY) ?? null;
  }

  setToken(token: string): void {
    this.store?.setItem(TOKEN_KEY, token);
  }

  clearToken(): void {
    this.store?.removeItem(TOKEN_KEY);
  }

  getUser(): AuthUser | null {
    const raw = this.store?.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  setUser(user: AuthUser): void {
    this.store?.setItem(USER_KEY, JSON.stringify(user));
  }

  clearUser(): void {
    this.store?.removeItem(USER_KEY);
  }

  clearAll(): void {
    this.clearToken();
    this.clearUser();
  }
}
