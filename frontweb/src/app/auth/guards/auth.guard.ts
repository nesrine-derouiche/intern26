import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/** Bloque l'accès aux pages « invité » si un utilisateur est déjà connecté. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return router.createUrlTree(['/mon-profil']);
  }
  return true;
};

/** Autorise uniquement les candidats authentifiés (redirige vers la connexion). */
export const candidatGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/connexion']);
  }
  if (auth.user()?.role !== 'CANDIDAT') {
    return router.createUrlTree(['/']);
  }
  return true;
};
