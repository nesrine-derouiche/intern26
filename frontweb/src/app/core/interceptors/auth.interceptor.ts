import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TokenStorage } from '../services/token-storage.service';

/**
 * Attache le jeton JWT aux requêtes sortantes.
 * Sur 401 avec session active (jeton expiré/invalide) : purge la session via
 * AuthService.logout() (stockage + signaux) et redirige vers la connexion avec
 * un message explicite.
 * Un 401 sans jeton (ex. identifiants incorrects à la connexion) ne déclenche
 * pas de redirection : l'erreur est gérée localement par le formulaire.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const storage = inject(TokenStorage);
  const router = inject(Router);
  const auth = inject(AuthService);
  const token = storage.getToken();

  const authenticated = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authenticated).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && token) {
        auth.logout();
        router.navigate(['/connexion'], { queryParams: { session: 'expiree' } });
      }
      return throwError(() => error);
    }),
  );
};
