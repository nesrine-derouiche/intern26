import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HumanInterviewCard } from './human-interview-card';
import { OffersApiService } from '../../../core/services/offers-api.service';
import { HumanInterview } from '../../../core/models/landing.models';
import { ApiError } from '../../../core/services/api.service';

const VISIO_LINK = 'https://meet.steg.example/room/abc';

const INTERVIEW: HumanInterview = {
  id: 'i-1',
  candidature_id: 'c-1',
  date: '2026-09-25',
  heure: '10:00',
  duree: 30,
  interviewer: 'Salma Bouazizi',
  interviewer_email: 'salma.bouazizi@steg.tn',
  lien_visio: VISIO_LINK,
  statut: 'PLANIFIE',
  completed_at: null,
  completed_by: null,
  created_at: '2026-09-20T08:00:00.000Z',
  updated_at: '2026-09-20T08:00:00.000Z',
};

function withInterview(interview: HumanInterview | null | undefined, reject = false) {
  return {
    getHumanInterview: vi.fn(
      () =>
        reject
          ? Promise.reject(new ApiError(500, 'Erreur serveur.'))
          : Promise.resolve(interview ?? null),
    ),
  };
}

@Component({
  standalone: true,
  imports: [HumanInterviewCard],
  template: '<app-human-interview-card [candidatureId]="candidatureId" />',
})
class Host {
  candidatureId = 'c-1';
}

async function render(api: Record<string, unknown>) {
  await TestBed.configureTestingModule({
    imports: [Host],
    providers: [{ provide: OffersApiService, useValue: api }],
  }).compileComponents();
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  await fixture.whenStable();
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }
  return {
    fixture,
    text: () => fixture.nativeElement.textContent as string,
    link: () => fixture.nativeElement.querySelector('a[href]') as HTMLAnchorElement | null,
  };
}

describe('HumanInterviewCard', () => {
  it('affiche le chargement puis l’entretien planifié (date, heure, durée, type, lien)', async () => {
    const { text, link } = await render(withInterview(INTERVIEW));
    expect(text()).toContain('Entretien humain');
    expect(text()).toContain('Planifié');
    expect(text()).toContain('25/09/2026');
    expect(text()).toContain('10:00');
    expect(text()).toContain('30 minutes');
    expect(text()).toContain('Visioconférence');
    expect(text()).toContain('Salma Bouazizi');
    expect(text()).toContain('Rejoindre l\'entretien');
    expect(link()).toBeTruthy();
    expect(link()!.href).toBe(VISIO_LINK);
    expect(link()!.target).toBe('_blank');
  });

  it('n’affiche pas de bouton de jointure pour un entretien annulé', async () => {
    const { text, link } = await render(withInterview({ ...INTERVIEW, statut: 'ANNULE' }));
    expect(text()).toContain('Entretien annulé');
    expect(link()).toBeNull();
    expect(text()).not.toContain('Rejoindre l’entretien');
  });

  it('affiche « Entretien terminé » sans bouton de jointure pour un entretien complété', async () => {
    const { text, link } = await render(
      withInterview({ ...INTERVIEW, statut: 'HUMAN_INTERVIEW_COMPLETED' }),
    );
    expect(text()).toContain('Entretien terminé');
    expect(link()).toBeNull();
    expect(text()).not.toContain('Rejoindre l’entretien');
  });

  it('détecte un entretien présentiel (sans lien) : pas de bouton de jointure', async () => {
    const { text, link } = await render(withInterview({ ...INTERVIEW, lien_visio: null }));
    expect(text()).toContain('Présentiel');
    expect(link()).toBeNull();
    expect(text()).not.toContain('Visioconférence');
  });

  it('affiche l’état vide quand aucun entretien n’est planifié', async () => {
    const { text } = await render(withInterview(null));
    expect(text()).toContain('Aucun entretien humain planifié.');
  });

  it('affiche l’état d’erreur en cas d’échec du chargement', async () => {
    const { text } = await render(withInterview(null, true));
    expect(text()).toContain('Impossible de charger les informations de l\'entretien.');
  });

  it('appelle le endpoint avec l’identifiant de la candidature', async () => {
    const api = withInterview(INTERVIEW);
    await render(api);
    expect(api.getHumanInterview).toHaveBeenCalledWith('c-1');
  });
});
