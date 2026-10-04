import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StagePreferencesCard } from './stage-preferences-card';
import { OffersApiService } from '../../../core/services/offers-api.service';
import { ApiError } from '../../../core/services/api.service';

function apiStub() {
  return {
    submitStagePreferences: vi.fn(() =>
      Promise.resolve({
        id: 'c-1',
        internship_start_date: '2026-10-05',
        internship_duration_months: 2,
        internship_details_submitted_at: '2026-09-21T09:30:00.000Z',
        internship_period_validated_at: null,
        internship_modification_requested_at: null,
      }),
    ),
  };
}

@Component({
  standalone: true,
  imports: [StagePreferencesCard],
  template: `
    <app-stage-preferences-card
      [candidatureId]="candidatureId"
      [startDate]="startDate"
      [durationMonths]="durationMonths"
      [submittedAt]="submittedAt"
      [validatedAt]="validatedAt"
      [modificationRequestedAt]="modificationRequestedAt"
      [mobileAccessSentAt]="mobileAccessSentAt"
    />
  `,
})
class Host {
  candidatureId = 'c-1';
  startDate: string | null = null;
  durationMonths: number | null = null;
  submittedAt: string | null = null;
  validatedAt: string | null = null;
  modificationRequestedAt: string | null = null;
  mobileAccessSentAt: string | null = null;
}

async function render(api: Record<string, unknown>, host?: Partial<Host>) {
  await TestBed.configureTestingModule({
    imports: [Host],
    providers: [{ provide: OffersApiService, useValue: api }],
  }).compileComponents();
  const fixture = TestBed.createComponent(Host);
  if (host) Object.assign(fixture.componentInstance, host);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const native = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    text: () => native.textContent ?? '',
    query: (selector: string) => native.querySelector(selector),
    inputs: () => Array.from(native.querySelectorAll('input')) as HTMLInputElement[],
    buttons: () => Array.from(native.querySelectorAll('button')) as HTMLButtonElement[],
  };
}

describe('StagePreferencesCard', () => {
  it('affiche le formulaire de préparation du stage quand rien n’est enregistré', async () => {
    const { text, inputs } = await render(apiStub());
    expect(text()).toContain('Préparez votre stage');
    expect(text()).toContain('Avant de poursuivre votre intégration');
    expect(text()).toContain('Date de début du stage');
    expect(text()).toContain('Durée du stage');
    expect(text()).toContain('Confirmer la période de stage');
    expect(inputs().some((i) => i.type === 'date')).toBe(true);
  });

  it('affiche la période enregistrée en attente de validation RH', async () => {
    const { text } = await render(apiStub(), {
      startDate: '2026-10-05',
      durationMonths: 2,
      submittedAt: '2026-09-21T09:30:00.000Z',
    });
    expect(text()).toContain('Votre période de stage est en attente de validation par RH.');
    expect(text()).toContain('Date de début');
    expect(text()).toContain('05/10/2026');
    expect(text()).toContain('Durée');
    expect(text()).toContain('2 mois');
    expect(text()).toContain('Modifier mes préférences');
  });

  it('affiche la période validée par le RH en lecture seule (pas de bouton modifier)', async () => {
    const { text, buttons } = await render(apiStub(), {
      startDate: '2026-10-05',
      durationMonths: 2,
      submittedAt: '2026-09-21T09:30:00.000Z',
      validatedAt: '2026-09-25T10:00:00.000Z',
    });
    expect(text()).toContain('Votre période de stage a été validée par RH.');
    expect(text()).toContain('Date de début');
    expect(text()).toContain('05/10/2026');
    expect(text()).toContain('2 mois');
    expect(buttons().some((b) => b.textContent?.includes('Modifier mes préférences'))).toBe(false);
  });

  it('annonce l’envoi de l’accès mobile avant le jour J (période validée, email non envoyé)', async () => {
    const { text } = await render(apiStub(), {
      startDate: '2026-10-05',
      durationMonths: 2,
      submittedAt: '2026-09-21T09:30:00.000Z',
      validatedAt: '2026-09-25T10:00:00.000Z',
    });
    expect(text()).toContain(
      'Votre accès à l\'application mobile sera envoyé par email un jour avant le début de votre stage.',
    );
    expect(text()).not.toContain('Les informations d\'accès à l\'application mobile');
  });

  it('indique que l’email d’accès mobile a été envoyé (période validée)', async () => {
    const { text } = await render(apiStub(), {
      startDate: '2026-10-05',
      durationMonths: 2,
      submittedAt: '2026-09-21T09:30:00.000Z',
      validatedAt: '2026-09-25T10:00:00.000Z',
      mobileAccessSentAt: '2026-10-04T08:00:00.000Z',
    });
    expect(text()).toContain(
      'Les informations d\'accès à l\'application mobile vous ont été envoyées par email.',
    );
    expect(text()).not.toContain('sera envoyé par email un jour avant');
  });

  it('affiche la demande de modification du RH et laisse la période éditable', async () => {
    const { text, buttons } = await render(apiStub(), {
      startDate: '2026-10-05',
      durationMonths: 2,
      submittedAt: '2026-09-21T09:30:00.000Z',
      modificationRequestedAt: '2026-09-23T14:00:00.000Z',
    });
    expect(text()).toContain('Votre période de stage doit être modifiée.');
    expect(buttons().some((b) => b.textContent?.includes('Modifier mes préférences'))).toBe(true);
  });

  it('affiche la durée au singulier pour un mois', async () => {
    const { text } = await render(apiStub(), {
      startDate: '2026-10-05',
      durationMonths: 1,
      submittedAt: '2026-09-21T09:30:00.000Z',
    });
    expect(text()).toContain('1 mois');
  });

  it('affiche une durée personnalisée dans le récapitulatif', async () => {
    const { text } = await render(apiStub(), {
      startDate: '2026-10-05',
      durationMonths: 6,
      submittedAt: '2026-09-21T09:30:00.000Z',
    });
    expect(text()).toContain('6 mois');
  });

  it('permet de soumettre une date et une durée via le bouton Confirmer', async () => {
    const api = apiStub();
    const { fixture, inputs, buttons } = await render(api);
    const date = inputs().find((i) => i.type === 'date')!;
    date.value = '2026-10-05';
    date.dispatchEvent(new Event('input'));
    buttons().find((b) => b.textContent?.includes('2 mois'))!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const confirm = buttons().find((b) => b.textContent?.includes('Confirmer la période de stage'))!;
    confirm.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.submitStagePreferences).toHaveBeenCalledWith('c-1', {
      internship_start_date: '2026-10-05',
      internship_duration_months: 2,
    });
    expect(fixture.nativeElement.textContent).toContain(
      'Votre période de stage est en attente de validation par RH.',
    );
  });

  it('après une resoumission, la demande de modification disparaît (retour en attente)', async () => {
    const api = apiStub();
    const { fixture, text, inputs, buttons } = await render(api, {
      startDate: '2026-10-05',
      durationMonths: 2,
      submittedAt: '2026-09-21T09:30:00.000Z',
      modificationRequestedAt: '2026-09-23T14:00:00.000Z',
    });
    expect(text()).toContain('Votre période de stage doit être modifiée.');

    buttons().find((b) => b.textContent?.includes('Modifier mes préférences'))!.click();
    fixture.detectChanges();
    const date = inputs().find((i) => i.type === 'date')!;
    date.value = '2026-11-02';
    date.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    buttons().find((b) => b.textContent?.includes('Confirmer la période de stage'))!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.submitStagePreferences).toHaveBeenCalledWith('c-1', {
      internship_start_date: '2026-11-02',
      internship_duration_months: 2,
    });
    expect(fixture.nativeElement.textContent).not.toContain(
      'Votre période de stage doit être modifiée.',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Votre période de stage est en attente de validation par RH.',
    );
  });

  it('refuse une soumission sans date ni durée (message local)', async () => {
    const api = apiStub();
    const { buttons, text, fixture } = await render(api);
    buttons().find((b) => b.textContent?.includes('Confirmer la période de stage'))!.click();
    await Promise.resolve();
    fixture.detectChanges();
    expect(api.submitStagePreferences).not.toHaveBeenCalled();
    expect(text()).toContain('Veuillez indiquer la date de début de votre stage.');
  });

  it('affiche l’erreur renvoyée par le serveur', async () => {
    const api = {
      submitStagePreferences: vi.fn(() =>
        Promise.reject(new ApiError(400, 'La date de début doit être future.')),
      ),
    };
    const { buttons, inputs, text, fixture } = await render(api);
    const date = inputs().find((i) => i.type === 'date')!;
    date.value = '2020-01-01';
    date.dispatchEvent(new Event('input'));
    buttons().find((b) => b.textContent?.includes('2 mois'))!.click();
    fixture.detectChanges();
    buttons().find((b) => b.textContent?.includes('Confirmer la période de stage'))!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(text()).toContain('La date de début doit être future.');
  });

  it('permet de modifier les préférences déjà enregistrées', async () => {
    const { text, buttons, fixture } = await render(apiStub(), {
      startDate: '2026-10-05',
      durationMonths: 2,
      submittedAt: '2026-09-21T09:30:00.000Z',
    });
    buttons().find((b) => b.textContent?.includes('Modifier mes préférences'))!.click();
    fixture.detectChanges();
    expect(text()).toContain('Confirmer la période de stage');
  });
});
