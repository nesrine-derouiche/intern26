import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterOutlet, provideRouter, withComponentInputBinding } from '@angular/router';
import { OfferDetails } from './offer-details';
import { OffersApiService } from '../../core/services/offers-api.service';
import { OffersService } from '../../core/services/offers.service';
import { AuthService } from '../../core/services/auth.service';
import { CandidatService } from '../../core/services/candidat.service';
import { ApiError } from '../../core/services/api.service';
import { LandingOffer } from '../../core/models/landing.models';

const OFFER: LandingOffer = {
  id: 'abc-123',
  titre: 'Développeur Web Fullstack',
  departement: 'DSI',
  departementId: 'd1',
  description: 'Concevoir des applications web modernes.',
  duree: '5 mois',
  localisation: 'Tunis',
  niveau: 'Ingénieur',
  places: 2,
  dateLimite: '2026-08-20',
  competences: ['Angular', 'PostgreSQL'],
  missions: ['Développer', 'Tester'],
  technologies: ['Angular'],
  documents: ['CV', 'Lettre de motivation'],
  encadrant: { nom: 'Mansour', prenom: 'Rachid', service: 'Maintenance' },
};

@Component({
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
class Host {}

interface RouteUser {
  role: string;
}

function authStub(overrides: Record<string, unknown> = {}) {
  const user = (overrides['user'] as RouteUser | null) ?? null;
  return {
    isAuthenticated: vi.fn(() => !!user),
    isCandidat: vi.fn(() => user?.role === 'CANDIDAT'),
    user: vi.fn(() => user),
    fullName: vi.fn(() => ''),
    refreshUser: vi.fn(() => Promise.resolve(null)),
    logout: vi.fn(),
    ...overrides,
  };
}

async function renderRoute(
  user: { role: string } | null,
  cv: unknown = null,
  analyseCvResult: unknown = undefined,
  analyseCvError: unknown = undefined,
) {
  const offersApi = {
    list: vi.fn(() => Promise.resolve({ data: [OFFER], total: 1, page: 1, pages: 1 })),
    getById: vi.fn((id: string) =>
      Promise.resolve(id === OFFER.id ? OFFER : Promise.reject(new Error('404'))),
    ),
    apply: vi.fn(() =>
      Promise.resolve({
        id: 'c1',
        offre_id: OFFER.id,
        statut: 'EN_ATTENTE',
        date_candidature: '2026-08-03',
      }),
    ),
    analyseCv:
      analyseCvError !== undefined
        ? vi.fn(() => Promise.reject(analyseCvError))
        : analyseCvResult !== undefined
          ? vi.fn(() => Promise.resolve(analyseCvResult))
          : vi.fn(() => Promise.reject(new Error('Not Implemented'))),
  };
  const offersService = {
    load: vi.fn(() => Promise.resolve()),
    allOffers: vi.fn(() => [OFFER]),
    getById: vi.fn((id: string) => (id === OFFER.id ? OFFER : undefined)),
  };
  const candidat = {
    getMe: vi.fn(() =>
      Promise.resolve({
        id: 'candidat-1',
        nom: 'Sassi',
        prenom: 'Marwa',
        email: 'marwa@steg.tn',
        emailVerifie: true,
        telephone: null,
        adresse: null,
        universite: null,
        specialite: null,
        niveau: null,
        competences: [],
        langues: [],
        github: null,
        linkedin: null,
        portfolio: null,
        photo: null,
        cv,
        createdAt: '2026-01-01',
      }),
    ),
    uploadCv: vi.fn(() =>
      Promise.resolve({
        filename: 'cv.pdf',
        originalName: 'CV_Marwa.pdf',
        size: 1024,
        uploadedAt: null,
        analysis: null,
      }),
    ),
    deleteCv: vi.fn(() => Promise.resolve()),
  };

  await TestBed.configureTestingModule({
    imports: [OfferDetails],
    providers: [
      provideRouter([{ path: 'offres/:id', component: OfferDetails }], withComponentInputBinding()),
      { provide: OffersApiService, useValue: offersApi },
      { provide: OffersService, useValue: offersService },
      { provide: AuthService, useValue: authStub({ user }) },
      { provide: CandidatService, useValue: candidat },
    ],
  }).compileComponents();

  const router = TestBed.inject(Router);
  await router.navigate(['/offres', OFFER.id]);
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  await fixture.whenStable();
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }
  return { fixture, offersApi, candidat, text: () => fixture.nativeElement.textContent as string };
}

describe('OfferDetails (route)', () => {
  it("affiche l'offre au lieu de « Offre introuvable »", async () => {
    const { text } = await renderRoute({ role: 'CANDIDAT' }, null);
    expect(text()).toContain('Développeur Web Fullstack');
    expect(text()).toContain('À propos de cette offre');
    expect(text()).toContain('Compétences requises');
    expect(text()).toContain('Documents requis');
    expect(text()).toContain('Période du stage');
    expect(text()).toContain('5 mois');
    expect(text()).toContain('2 places');
    expect(text()).toContain('20 août 2026');
    expect(text()).not.toContain('Offre introuvable');
  });

  it('affiche le dépôt de CV quand le candidat na pas de CV', async () => {
    const { text, offersApi } = await renderRoute({ role: 'CANDIDAT' }, null);
    expect(text()).toContain('Déposer mon CV');
    expect(text()).toContain('PDF uniquement — 10 Mo maximum');
    expect(text()).not.toContain('CV déposé — prêt à postuler');
    expect(offersApi.apply).not.toHaveBeenCalled();
  });

  it('débloque « Postuler » après le dépôt inline du CV', async () => {
    const { fixture, text } = await renderRoute({ role: 'CANDIDAT' }, null);
    const fileInput = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['%PDF-1.4'], 'CV_Marwa.pdf', { type: 'application/pdf' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fileInput.dispatchEvent(new Event('change'));
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();
    }
    expect(text()).toContain('CV déposé — prêt à postuler');
    expect(text()).toContain('Postuler');
  });

  it('affiche « Postuler » quand le candidat a déjà un CV', async () => {
    const { text } = await renderRoute(
      { role: 'CANDIDAT' },
      { filename: 'cv.pdf', originalName: 'CV_Marwa.pdf', size: 1024, uploadedAt: null, analysis: null },
    );
    expect(text()).toContain('CV déposé — prêt à postuler');
    expect(text()).toContain('Postuler');
  });

  it('refuse un CV de plus de 10 Mo sans appeler l’API', async () => {
    const { fixture, text, candidat } = await renderRoute({ role: 'CANDIDAT' }, null);
    const fileInput = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fileInput.dispatchEvent(new Event('change'));
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();
    }
    expect(candidat.uploadCv).not.toHaveBeenCalled();
    expect(text()).toContain('Le fichier dépasse 10 Mo');
    expect(text()).toContain('Déposer mon CV');
  });

  it('refuse un fichier non-PDF sans appeler l’API', async () => {
    const { fixture, text, candidat } = await renderRoute({ role: 'CANDIDAT' }, null);
    const fileInput = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['Bonjour'], 'cv.txt', { type: 'text/plain' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fileInput.dispatchEvent(new Event('change'));
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();
    }
    expect(candidat.uploadCv).not.toHaveBeenCalled();
    expect(text()).toContain('Seuls les fichiers PDF sont acceptés');
    expect(text()).toContain('Déposer mon CV');
  });

  it('affiche la carte « Compatibilité IA » pour un candidat avec CV', async () => {
    const { text } = await renderRoute(
      { role: 'CANDIDAT' },
      { filename: 'cv.pdf', originalName: 'CV_Marwa.pdf', size: 1024, uploadedAt: null, analysis: null },
    );
    expect(text()).toContain('Compatibilité IA');
    expect(text()).toContain('Aucune analyse effectuée.');
    expect(text()).toContain('Vérifier avec l\'IA');
  });

  it('appelle analyse-cv puis affiche l\'état indisponible', async () => {
    const { fixture, text, offersApi } = await renderRoute(
      { role: 'CANDIDAT' },
      { filename: 'cv.pdf', originalName: 'CV_Marwa.pdf', size: 1024, uploadedAt: null, analysis: null },
    );
    const button = (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as Element[]
    ).find((b) => (b.textContent ?? '').includes('Vérifier')) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(text()).toContain('Analyse de votre CV avec l\'IA');
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    expect(offersApi.analyseCv).toHaveBeenCalledWith(OFFER.id);
    expect(text()).toContain('n\'est pas disponible pour le moment');
  });

  it('affiche un message convivial quand le service IA renvoie 404', async () => {
    const { fixture, text } = await renderRoute(
      { role: 'CANDIDAT' },
      { filename: 'cv.pdf', originalName: 'CV_Marwa.pdf', size: 1024, uploadedAt: null, analysis: null },
      undefined,
      new ApiError(404, 'Route introuvable.'),
    );
    const button = (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as Element[]
    ).find((b) => (b.textContent ?? '').includes('Vérifier')) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    expect(text()).toContain('Le service d\'analyse IA n\'est pas encore disponible');
    expect(text()).not.toContain('Route introuvable.');
  });

  it('affiche le résultat de l\'analyse IA (panneau recruiter)', async () => {
    const { fixture, text } = await renderRoute(
      { role: 'CANDIDAT' },
      { filename: 'cv.pdf', originalName: 'CV_Marwa.pdf', size: 1024, uploadedAt: null, analysis: null },
      {
        score: 72,
        level: 'GOOD',
        strengths: ['Angular', 'Node.js', 'TypeScript'],
        weaknesses: ['PostgreSQL'],
        experienceMatch: 80,
        educationMatch: 92,
        languages: ['Français', 'Anglais'],
        interviewChance: 72,
        recommendation: 'Votre profil correspond bien au poste. Approfondissez PostgreSQL.',
      },
    );
    const button = (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as Element[]
    ).find((b) => (b.textContent ?? '').includes('Vérifier')) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();
    }
    expect(text()).toContain('72%');
    expect(text()).toContain('Good');
    expect(text()).toContain('Overall score');
    expect(text()).toContain('Estimated interview chance');
    expect(text()).toContain('Probability of being shortlisted');
    expect(text()).toContain('This analysis compares your CV with the internship requirements.');
    expect(text()).toContain('Experience match');
    expect(text()).toContain('80%');
    expect(text()).toContain('Education match');
    expect(text()).toContain('92%');
    expect(text()).toContain('Matching skills');
    expect(text()).toContain('Angular');
    expect(text()).toContain('Node.js');
    expect(text()).toContain('TypeScript');
    expect(text()).toContain('Missing skills');
    expect(text()).toContain('PostgreSQL');
    expect(text()).toContain('Languages');
    expect(text()).toContain('Français');
    expect(text()).toContain('Anglais');
    expect(text()).toContain('Recommendation');
    expect(text()).toContain('Approfondissez PostgreSQL');
    expect(text()).not.toContain('Aucune analyse effectuée.');
  });

  it('ouvre la confirmation quand Postuler est cliqué sans analyse IA', async () => {
    const { fixture, text, offersApi } = await renderRoute(
      { role: 'CANDIDAT' },
      { filename: 'cv.pdf', originalName: 'CV_Marwa.pdf', size: 1024, uploadedAt: null, analysis: null },
    );
    const postuler = (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as Element[]
    ).find((b) => (b.textContent ?? '').includes('Postuler')) as HTMLButtonElement;
    postuler.click();
    fixture.detectChanges();
    expect(text()).toContain('Analyse IA non effectuée');
    expect(text()).toContain('Souhaitez-vous quand même postuler ?');
    expect(offersApi.apply).not.toHaveBeenCalled();
  });

  it('« Continuer » envoie la candidature', async () => {
    const { fixture, text, offersApi } = await renderRoute(
      { role: 'CANDIDAT' },
      { filename: 'cv.pdf', originalName: 'CV_Marwa.pdf', size: 1024, uploadedAt: null, analysis: null },
    );
    const postuler = (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as Element[]
    ).find((b) => (b.textContent ?? '').includes('Postuler')) as HTMLButtonElement;
    postuler.click();
    fixture.detectChanges();
    const continuer = (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as Element[]
    ).find((b) => (b.textContent ?? '').includes('Continuer')) as HTMLButtonElement;
    continuer.click();
    fixture.detectChanges();
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();
    }
    expect(offersApi.apply).toHaveBeenCalledWith(OFFER.id);
    expect(text()).toContain('Candidature envoyée');
  });

  it('« Analyser d\'abord » lance l\'analyse IA', async () => {
    const { fixture, text, offersApi } = await renderRoute(
      { role: 'CANDIDAT' },
      { filename: 'cv.pdf', originalName: 'CV_Marwa.pdf', size: 1024, uploadedAt: null, analysis: null },
      { score: 92, level: 'EXCELLENT', strengths: ['Angular'], weaknesses: [], recommendation: 'Parfait.' },
    );
    const postuler = (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as Element[]
    ).find((b) => (b.textContent ?? '').includes('Postuler')) as HTMLButtonElement;
    postuler.click();
    fixture.detectChanges();
    const analyser = (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as Element[]
    ).find((b) => (b.textContent ?? '').includes('Analyser d\'abord')) as HTMLButtonElement;
    analyser.click();
    fixture.detectChanges();
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();
    }
    expect(offersApi.analyseCv).toHaveBeenCalledWith(OFFER.id);
    expect(text()).toContain('92%');
    expect(offersApi.apply).not.toHaveBeenCalled();
  });

  it('« Supprimer le CV » ouvre la confirmation', async () => {
    const { fixture, text, candidat } = await renderRoute(
      { role: 'CANDIDAT' },
      { filename: 'cv.pdf', originalName: 'CV_Marwa.pdf', size: 1024, uploadedAt: null, analysis: null },
    );
    const supprimer = (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as Element[]
    ).find((b) => (b.textContent ?? '').includes('Supprimer le CV')) as HTMLButtonElement;
    expect(supprimer).toBeTruthy();
    supprimer.click();
    fixture.detectChanges();
    expect(text()).toContain('Supprimer le CV ?');
    expect(text()).toContain('Voulez-vous supprimer le CV déposé pour cette offre ?');
    expect(candidat.deleteCv).not.toHaveBeenCalled();
  });

  it('« Annuler » referme la confirmation sans supprimer le CV', async () => {
    const { fixture, text, candidat } = await renderRoute(
      { role: 'CANDIDAT' },
      { filename: 'cv.pdf', originalName: 'CV_Marwa.pdf', size: 1024, uploadedAt: null, analysis: null },
    );
    const supprimer = (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as Element[]
    ).find((b) => (b.textContent ?? '').includes('Supprimer le CV')) as HTMLButtonElement;
    supprimer.click();
    fixture.detectChanges();
    const annuler = (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as Element[]
    ).find((b) => (b.textContent ?? '').trim() === 'Annuler') as HTMLButtonElement;
    annuler.click();
    fixture.detectChanges();
    expect(text()).not.toContain('Supprimer le CV ?');
    expect(text()).toContain('CV déposé — prêt à postuler');
    expect(text()).toContain('Postuler');
    expect(candidat.deleteCv).not.toHaveBeenCalled();
  });

  it('« Supprimer » appelle le endpoint et remet l\'interface à zéro', async () => {
    const { fixture, text, candidat } = await renderRoute(
      { role: 'CANDIDAT' },
      { filename: 'cv.pdf', originalName: 'CV_Marwa.pdf', size: 1024, uploadedAt: null, analysis: null },
      { score: 92, level: 'EXCELLENT', strengths: ['Angular'], weaknesses: [], recommendation: 'Parfait.' },
    );
    const verifier = (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as Element[]
    ).find((b) => (b.textContent ?? '').includes('Vérifier')) as HTMLButtonElement;
    verifier.click();
    fixture.detectChanges();
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();
    }
    expect(text()).toContain('92%');

    const supprimer = (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as Element[]
    ).find((b) => (b.textContent ?? '').includes('Supprimer le CV')) as HTMLButtonElement;
    expect(supprimer.classList.contains('btn--danger-outline')).toBe(true);
    expect(supprimer.querySelector('app-icon')).toBeTruthy();
    supprimer.click();
    fixture.detectChanges();
    expect(text()).toContain('Supprimer le CV ?');

    const confirmer = (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as Element[]
    ).find(
      (b) =>
        (b.textContent ?? '').includes('Supprimer') &&
        !(b.textContent ?? '').includes('Supprimer le CV'),
    ) as HTMLButtonElement;
    confirmer.click();
    fixture.detectChanges();
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      fixture.detectChanges();
    }
    expect(candidat.deleteCv).toHaveBeenCalled();
    expect(text()).toContain('Déposer mon CV');
    expect(text()).not.toContain('CV déposé — prêt à postuler');
    expect(text()).not.toContain('92%');
    const postulerButtons = (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as Element[]
    ).filter((b) => (b.textContent ?? '').includes('Postuler'));
    expect(postulerButtons).toHaveLength(0);
  });

  it('redirige les visiteurs vers la connexion', async () => {
    const { text } = await renderRoute(null, null);
    expect(text()).toContain('Se connecter pour postuler');
  });
});
