import { Candidature, HumanInterview } from '../models/landing.models';

/** Libellés d'état d'une candidature (portail candidat). */
export function candidatureStatutLabel(statut: Candidature['statut'] | string): string {
  switch (statut) {
    case 'EN_ATTENTE':
      return 'En attente';
    case 'EN_ENTRETIEN_IA':
      return 'En entretien IA';
    case 'EN_ENTRETIEN_HUMAIN':
      return 'Entretien humain planifié';
    case 'RH_ACCEPTED':
      return 'Acceptée pour entretien IA';
    case 'AI_INTERVIEW_PASSED':
      return 'Entretien IA réussi';
    case 'AI_INTERVIEW_FAILED':
      return 'Entretien IA échoué';
    case 'HUMAN_INTERVIEW_COMPLETED':
      return 'Entretien humain terminé';
    case 'HUMAN_INTERVIEW_ACCEPTED':
      return 'Acceptée après entretien';
    case 'HUMAN_INTERVIEW_REJECTED':
      return 'Refusée après entretien';
    case 'ACCEPTEE':
      return 'Acceptée';
    case 'REFUSEE':
      return 'Refusée';
    default:
      return statut;
  }
}

export type StatutTone = 'success' | 'danger' | 'info' | 'warning' | 'neutral';

/** Tonalité du badge selon l'état d'une candidature. */
export function candidatureStatutTone(statut: Candidature['statut'] | string): StatutTone {
  switch (statut) {
    case 'ACCEPTEE':
    case 'HUMAN_INTERVIEW_ACCEPTED':
    case 'HUMAN_INTERVIEW_COMPLETED':
    case 'AI_INTERVIEW_PASSED':
      return 'success';
    case 'REFUSEE':
    case 'HUMAN_INTERVIEW_REJECTED':
    case 'AI_INTERVIEW_FAILED':
      return 'danger';
    case 'EN_ENTRETIEN_IA':
    case 'EN_ENTRETIEN_HUMAIN':
    case 'RH_ACCEPTED':
      return 'info';
    case 'EN_ATTENTE':
      return 'warning';
    default:
      return 'neutral';
  }
}

/** Libellé d'état d'un entretien humain. */
export function humanInterviewStatutLabel(statut: HumanInterview['statut'] | string): string {
  switch (statut) {
    case 'PLANIFIE':
      return 'Planifié';
    case 'HUMAN_INTERVIEW_COMPLETED':
      return 'Entretien terminé';
    case 'ANNULE':
      return 'Entretien annulé';
    default:
      return statut;
  }
}

/** Tonalité du badge d'un entretien humain. */
export function humanInterviewStatutTone(statut: HumanInterview['statut'] | string): StatutTone {
  switch (statut) {
    case 'PLANIFIE':
      return 'info';
    case 'HUMAN_INTERVIEW_COMPLETED':
      return 'success';
    case 'ANNULE':
      return 'danger';
    default:
      return 'neutral';
  }
}

/**
 * Type d'entretien dérivé des données : un lien de visioconférence présent
 * signifie un entretien à distance ; sans lien, l'entretien est en présentiel.
 */
export function interviewTypeLabel(interview: HumanInterview): 'Visioconférence' | 'Présentiel' {
  return interview.lien_visio ? 'Visioconférence' : 'Présentiel';
}

/**
 * Formate une date ISO (YYYY-MM-DD) en DD/MM/YYYY.
 * Transformation purement textuelle : aucune conversion de fuseau, la date
 * renvoyée par le backend est déjà locale (Africa/Tunis).
 */
export function formatIsoDate(iso: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Heure de début (HH:MM) affichée telle que renvoyée par le backend. */
export function formatInterviewHeure(heure: string): string {
  return (heure || '').slice(0, 5);
}
