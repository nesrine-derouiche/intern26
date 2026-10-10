import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminComponent } from './theme/layout/admin/admin.component';
import { GuestComponent } from './theme/layout/guest/guest.component';
import { authGuard, guestGuard } from './core/guards/auth.guard';

const appRoutes: Routes = [
  {
    path: '',
    component: AdminComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: '/default', pathMatch: 'full' },
      { path: 'default', loadComponent: () => import('./demo/dashboard/default/default.component').then((c) => c.DefaultComponent) },
      { path: 'stagiaires', loadComponent: () => import('./demo/pages/stagiaires/stagiaires.component').then((c) => c.StagiairesComponent) },
      { path: 'encadrants', loadComponent: () => import('./demo/pages/encadrants/encadrants.component').then((c) => c.EncadrantsComponent) },
      { path: 'taches', loadComponent: () => import('./demo/pages/taches/taches.component').then((c) => c.TachesComponent) },
      { path: 'stages', loadComponent: () => import('./demo/pages/stages/stages.component').then((c) => c.StagesComponent) },
      { path: 'presences', loadComponent: () => import('./demo/pages/presences/presences.component').then((c) => c.PresencesComponent) },
      { path: 'planning', loadComponent: () => import('./demo/pages/planning/planning.component').then((c) => c.PlanningComponent) },
      { path: 'reunions', loadComponent: () => import('./demo/pages/reunions/reunions.component').then((c) => c.ReunionsComponent) },
      { path: 'offres', loadComponent: () => import('./demo/pages/offres/offres.component').then((c) => c.OffresComponent) },
      { path: 'candidatures', loadComponent: () => import('./demo/pages/candidatures/candidatures.component').then((c) => c.CandidaturesComponent) },
      { path: 'candidatures/:id', loadComponent: () => import('./demo/pages/candidature-details/candidature-details.component').then((c) => c.CandidatureDetailsComponent) },
      { path: 'evaluations', loadComponent: () => import('./demo/pages/evaluations/evaluations.component').then((c) => c.EvaluationsComponent) },
      { path: 'departements', loadComponent: () => import('./demo/pages/departements/departements.component').then((c) => c.DepartementsComponent) },
      { path: 'notifications', loadComponent: () => import('./demo/pages/notifications/notifications.component').then((c) => c.NotificationsComponent) },
      { path: 'templates', loadComponent: () => import('./demo/pages/templates/document-template.component').then((c) => c.TemplatesComponent) },
      { path: 'certifications', loadComponent: () => import('./demo/pages/certifications/certifications.component').then((c) => c.CertificationsComponent) },
      { path: 'certifications/:stageId', loadComponent: () => import('./demo/pages/certifications/certification-review.component').then((c) => c.CertificationReviewComponent) }
    ]
  },
  {
    path: '',
    component: GuestComponent,
    canActivate: [guestGuard],
    children: [
      { path: 'login', loadComponent: () => import('./demo/pages/authentication/login/login.component').then((c) => c.LoginComponent) }
    ]
  },
  { path: '**', redirectTo: '/default' }
];

@NgModule({
  imports: [RouterModule.forRoot(appRoutes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
