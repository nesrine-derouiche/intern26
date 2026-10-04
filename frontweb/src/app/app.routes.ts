import { Routes } from '@angular/router';
import { LandingPage } from './landing/landing-page/landing-page';
import { OffersPage } from './offers/offers-page/offers-page';
import { OfferDetails } from './offers/offer-details/offer-details';
import { Connexion } from './auth/connexion/connexion';
import { Inscription } from './auth/inscription/inscription';
import { VerificationEmail } from './auth/verification-email/verification-email';
import { MotDePasseOublie } from './auth/mot-de-passe-oublie/mot-de-passe-oublie';
import { ReinitialiserMotDePasse } from './auth/reinitialiser-mot-de-passe/reinitialiser-mot-de-passe';
import { Profil } from './profil/profil';
import { EntretienIa } from './entretien-ia/entretien-ia';
import { MesCandidatures } from './mes-candidatures/mes-candidatures';
import { candidatGuard, guestGuard } from './auth/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: LandingPage,
    title: 'STEG Internship — Stages & opportunités à la STEG',
  },
  {
    path: 'offres',
    component: OffersPage,
    title: 'Offres de stage — STEG Internship',
  },
  {
    path: 'offres/:id',
    component: OfferDetails,
    title: 'Détail de l\'offre — STEG Internship',
  },
  {
    path: 'connexion',
    component: Connexion,
    canActivate: [guestGuard],
    title: 'Connexion — STEG Internship',
  },
  {
    path: 'inscription',
    component: Inscription,
    canActivate: [guestGuard],
    title: 'Créer un compte — STEG Internship',
  },
  {
    path: 'verification-email',
    component: VerificationEmail,
    title: 'Vérification de l\'email — STEG Internship',
  },
  {
    path: 'mot-de-passe-oublie',
    component: MotDePasseOublie,
    canActivate: [guestGuard],
    title: 'Mot de passe oublié — STEG Internship',
  },
  {
    path: 'reinitialiser-mot-de-passe',
    component: ReinitialiserMotDePasse,
    title: 'Réinitialiser le mot de passe — STEG Internship',
  },
  {
    path: 'mon-profil',
    component: Profil,
    canActivate: [candidatGuard],
    title: 'Mon profil — STEG Internship',
  },
  {
    path: 'mes-candidatures',
    component: MesCandidatures,
    canActivate: [candidatGuard],
    title: 'Mes candidatures — STEG Internship',
  },
  {
    path: 'entretien-ia/:token',
    component: EntretienIa,
    canActivate: [candidatGuard],
    title: 'Entretien IA — STEG Internship',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
