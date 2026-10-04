import {
  candidatureStatutLabel,
  candidatureStatutTone,
  formatIsoDate,
  humanInterviewStatutLabel,
  humanInterviewStatutTone,
  interviewTypeLabel,
} from './candidature.util';
import { HumanInterview } from '../models/landing.models';

const BASE: HumanInterview = {
  id: 'i-1',
  candidature_id: 'c-1',
  date: '2026-09-25',
  heure: '10:00',
  duree: 30,
  interviewer: 'Salma Bouazizi',
  interviewer_email: 'salma.bouazizi@steg.tn',
  lien_visio: null,
  statut: 'PLANIFIE',
  completed_at: null,
  completed_by: null,
  created_at: '2026-09-20T08:00:00.000Z',
  updated_at: '2026-09-20T08:00:00.000Z',
};

describe('candidature.util', () => {
  it('formate YYYY-MM-DD en DD/MM/YYYY sans conversion de fuseau', () => {
    expect(formatIsoDate('2026-09-25')).toBe('25/09/2026');
    expect(formatIsoDate('2026-01-05')).toBe('05/01/2026');
    expect(formatIsoDate('')).toBe('');
  });

  it('formate les libellés de statut de candidature', () => {
    expect(candidatureStatutLabel('EN_ATTENTE')).toBe('En attente');
    expect(candidatureStatutLabel('EN_ENTRETIEN_HUMAIN')).toBe('Entretien humain planifié');
    expect(candidatureStatutLabel('ACCEPTEE')).toBe('Acceptée');
    expect(candidatureStatutLabel('REFUSEE')).toBe('Refusée');
  });

  it('mappe les tonalités de statut de candidature', () => {
    expect(candidatureStatutTone('ACCEPTEE')).toBe('success');
    expect(candidatureStatutTone('REFUSEE')).toBe('danger');
    expect(candidatureStatutTone('EN_ATTENTE')).toBe('warning');
    expect(candidatureStatutTone('EN_ENTRETIEN_HUMAIN')).toBe('info');
  });

  it('formate les libellés de statut d’entretien humain', () => {
    expect(humanInterviewStatutLabel('PLANIFIE')).toBe('Planifié');
    expect(humanInterviewStatutLabel('ANNULE')).toBe('Entretien annulé');
    expect(humanInterviewStatutLabel('HUMAN_INTERVIEW_COMPLETED')).toBe('Entretien terminé');
  });

  it('dérive le type d’entretien depuis la présence du lien de visio', () => {
    expect(interviewTypeLabel({ ...BASE, lien_visio: 'https://meet.example/1' })).toBe(
      'Visioconférence',
    );
    expect(interviewTypeLabel(BASE)).toBe('Présentiel');
  });
});
