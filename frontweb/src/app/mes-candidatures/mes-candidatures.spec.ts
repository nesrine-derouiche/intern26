import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MesCandidatures } from './mes-candidatures';
import { OffersApiService } from '../core/services/offers-api.service';
import { AuthService } from '../core/services/auth.service';
import { ApiError } from '../core/services/api.service';
import { CandidatureListItem, HumanInterview } from '../core/models/landing.models';

const CANDIDATURE: CandidatureListItem = {
  id: 'c-1',
  offre_id: 'o-1',
  offre_titre: 'Développeur Web Fullstack',
  departement_nom: 'DSI',
  statut: 'EN_ENTRETIEN_HUMAIN',
  date_candidature: '2026-09-03',
};

const INTERVIEW: HumanInterview = {
  id: 'i-1',
  candidature_id: 'c-1',
  date: '2026-09-25',
  heure: '10:00',
  duree: 30,
  interviewer: 'Salma Bouazizi',
  interviewer_email: 'salma.bouazizi@steg.tn',
  lien_visio: 'https://meet.steg.example/room/abc',
  statut: 'PLANIFIE',
  completed_at: null,
  completed_by: null,
  created_at: '2026-09-20T08:00:00.000Z',
  updated_at: '2026-09-20T08:00:00.000Z',
};

const ACCEPTED: CandidatureListItem = {
  ...CANDIDATURE,
  id: 'c-2',
  statut: 'HUMAN_INTERVIEW_ACCEPTED',
  internship_start_date: null,
  internship_duration_months: null,
  internship_details_submitted_at: null,
};

const ACCEPTED_WITH_PREFS: CandidatureListItem = {
  ...ACCEPTED,
  id: 'c-3',
  internship_start_date: '2026-10-05',
  internship_duration_months: 2,
  internship_details_submitted_at: '2026-09-21T09:30:00.000Z',
};

const ACCEPTED_WITH_PREFS_VALIDATED: CandidatureListItem = {
  ...ACCEPTED_WITH_PREFS,
  id: 'c-4',
  internship_period_validated_at: '2026-09-25T10:00:00.000Z',
  internship_period_validated_by: 'rh-1',
};

function authStub() {
  return {
    isAuthenticated: vi.fn(() => true),
    user: vi.fn(() => ({ id: 'u-1', nom: 'Sassi', prenom: 'Marwa', email: 'm@steg.tn', role: 'CANDIDAT' })),
    fullName: vi.fn(() => 'Marwa Sassi'),
    logout: vi.fn(),
  };
}

function apiStub(
  candidatures: CandidatureListItem[] | (() => Promise<CandidatureListItem[]>),
  interview: HumanInterview | null = INTERVIEW,
) {
  return {
    myCandidatures: vi.fn(() =>
      typeof candidatures === 'function'
        ? candidatures()
        : Promise.resolve(candidatures),
    ),
    getHumanInterview: vi.fn(() => Promise.resolve(interview)),
    submitStagePreferences: vi.fn(() =>
      Promise.resolve({
        ...CANDIDATURE,
        internship_start_date: '2026-10-05',
        internship_duration_months: 2,
        internship_details_submitted_at: '2026-09-21T09:30:00.000Z',
      }),
    ),
  };
}

async function render(api: Record<string, unknown>) {
  await TestBed.configureTestingModule({
    imports: [MesCandidatures],
    providers: [
      provideRouter([]),
      { provide: OffersApiService, useValue: api },
      { provide: AuthService, useValue: authStub() },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(MesCandidatures);
  fixture.detectChanges();
  await fixture.whenStable();
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }
  return {
    fixture,
    text: () => fixture.nativeElement.textContent as string,
    links: () => Array.from(fixture.nativeElement.querySelectorAll('a[href]')) as HTMLAnchorElement[],
    buttons: () => Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[],
  };
}

describe('MesCandidatures', () => {
  it('affiche la candidature et son entretien humain planifié', async () => {
    const { text, links } = await render(apiStub([CANDIDATURE]));
    expect(text()).toContain('Mes candidatures');
    expect(text()).toContain('Développeur Web Fullstack');
    expect(text()).toContain('DSI');
    expect(text()).toContain('Postulée le 03/09/2026');
    expect(text()).toContain('Entretien humain planifié');
    expect(text()).toContain('Entretien humain');
    expect(text()).toContain('25/09/2026');
    expect(text()).toContain('10:00');
    expect(text()).toContain('30 minutes');
    expect(links().some((a) => a.href === 'https://meet.steg.example/room/abc')).toBe(true);
  });

  it('affiche l’état vide quand le candidat n’a aucune candidature', async () => {
    const { text } = await render(apiStub([]));
    expect(text()).toContain('Aucune candidature pour le moment.');
  });

  it('affiche l’erreur en cas d’échec du chargement', async () => {
    const api = apiStub(() => Promise.reject(new ApiError(500, 'Erreur serveur.')));
    const { text } = await render(api);
    expect(text()).toContain('Erreur serveur.');
  });

  it('affiche la section vide « aucun entretien » quand la candidature n’en a pas', async () => {
    const { text } = await render(apiStub([CANDIDATURE], null));
    expect(text()).toContain('Aucun entretien humain planifié.');
  });

  it('n’affiche pas la section stage pour une candidature non acceptée', async () => {
    const { text } = await render(apiStub([CANDIDATURE]));
    expect(text()).not.toContain('Préparez votre stage');
    expect(text()).not.toContain('Confirmer la période de stage');
  });

  it('affiche le formulaire « Préparez votre stage » pour une candidature acceptée', async () => {
    const { text } = await render(apiStub([ACCEPTED]));
    expect(text()).toContain('Préparez votre stage');
    expect(text()).toContain('Avant de poursuivre votre intégration');
    expect(text()).toContain('Date de début du stage');
    expect(text()).toContain('Durée du stage');
    expect(text()).toContain('1 mois');
    expect(text()).toContain('2 mois');
    expect(text()).toContain('3 mois');
    expect(text()).toContain('Autre');
    expect(text()).toContain('Confirmer la période de stage');
  });

  it('affiche la période de stage déjà enregistrée', async () => {
    const { text } = await render(apiStub([ACCEPTED_WITH_PREFS]));
    expect(text()).toContain('Votre période de stage est en attente de validation par RH.');
    expect(text()).toContain('05/10/2026');
    expect(text()).toContain('2 mois');
    expect(text()).toContain('Modifier mes préférences');
  });

  it('affiche la période de stage validée par le RH en lecture seule', async () => {
    const { text, buttons } = await render(apiStub([ACCEPTED_WITH_PREFS_VALIDATED]));
    expect(text()).toContain('Votre période de stage a été validée par RH.');
    expect(text()).toContain('05/10/2026');
    expect(text()).toContain('2 mois');
    expect(buttons().some((b) => b.textContent?.includes('Modifier mes préférences'))).toBe(false);
  });
});
