import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface User {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl + '/auth';
  currentUser = signal<User | null>(null);

  constructor() {
    const stored = localStorage.getItem('current_user');
    if (stored) {
      try { this.currentUser.set(JSON.parse(stored)); } catch { localStorage.removeItem('current_user'); }
    }
  }

  login(credentials: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credentials).pipe(
      tap((res: any) => {
        if (res && res.token) {
          this.saveToken(res.token);
          if (res.user) this.saveUser(res.user);
        }
      })
    );
  }

  register(data: { email: string; password: string; firstName: string; lastName: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, data);
  }

  fetchCurrentUser(): Observable<any> {
    return this.http.get(`${this.apiUrl}/me`).pipe(
      tap((res: any) => { if (res?.user) this.saveUser(res.user); })
    );
  }

  saveToken(token: string) { localStorage.setItem('auth_token', token); }
  getToken(): string | null { return localStorage.getItem('auth_token'); }
  saveUser(user: User) { localStorage.setItem('current_user', JSON.stringify(user)); this.currentUser.set(user); }
  isAuthenticated(): boolean { return !!this.getToken(); }
  logout() { localStorage.removeItem('auth_token'); localStorage.removeItem('current_user'); this.currentUser.set(null); }
}
