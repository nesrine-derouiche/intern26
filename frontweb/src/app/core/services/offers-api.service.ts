import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import {
  AiFingerprintResult,
  AiInterviewAnswer,
  AiInterviewAnswerResult,
  AiInterviewQuestion,
  AiInterviewSession,
  AiInterviewStarted,
  AiInterviewSynth,
  AiIntegrityPayload,
  Candidature,
  CandidatureListItem,
  HumanInterview,
  LandingOffer,
  OfferLevel,
  OffreApiRow,
  Paginated,
} from '../models/landing.models';

export interface PublicOffersQuery {
  search?: string;
  departementId?: string;
  niveau?: string;
  localisation?: string;
  sort?: 'deadline' | 'recent' | 'duration' | 'places';
  page?: number;
  limit?: number;
}

/** Résultat attendu de l'analyse IA (contrat futur — POST /offres/:id/analyse-cv). */
export interface AnalyseCvResult {
  score: number | null;
  level?: string;
  strengths?: string[];
  weaknesses?: string[];
  recommendation?: string;
  synthese?: string;
  message?: string;
  /** Correspondance avec l'expérience exigée (%). */
  experienceMatch?: number | null;
  /** Correspondance avec le niveau d'études exigé (%). */
  educationMatch?: number | null;
  /** Langues détectées sur le CV. */
  languages?: string[];
  /** Probabilité estimée d'être présélectionné (%). */
  interviewChance?: number | null;
}

const SPLIT = /[,;\n]+/;

const toList = (value: string | null | undefined): string[] =>
  value
    ? value
        .split(SPLIT)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

/** Convertit la durée (en semaines) en libellé lisible (« 5 mois »). */
export function formatDuree(weeks: number): string {
  const months = Math.round(weeks / 4.33);
  if (months >= 1 && Math.abs(weeks - months * 4.33) <= 2) {
    return `${months} mois`;
  }
  return `${weeks} semaines`;
}

/**
 * Normalise une date (YYYY-MM-DD ou objet Date renvoyé par l'API) en
 * ISO local (YYYY-MM-DD). Le driver PostgreSQL renvoie les dates sous
 * forme d'objet Date déjà en heure locale : on relit donc les composantes
 * locales pour éviter tout décalage de jour.
 */
export function toIsoDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const LEVELS: OfferLevel[] = ['BTS', 'Technicien', 'Licence', 'Master', 'Ingénieur'];

function isLevel(value: string): value is OfferLevel {
  return (LEVELS as string[]).includes(value);
}

export function mapOffre(row: OffreApiRow): LandingOffer {
  const niveau = row.niveau ?? 'Licence';
  return {
    id: row.id,
    titre: row.titre,
    departement: row.departement_nom,
    departementId: row.departement_id,
    description: row.description,
    duree: formatDuree(row.duree),
    localisation: row.localisation ?? '—',
    niveau: isLevel(niveau) ? niveau : 'Licence',
    places: row.nombre_places,
    dateLimite: toIsoDate(row.date_limite),
    competences: toList(row.competences_demandees),
    missions: row.missions
      ? row.missions
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    technologies: toList(row.technologies),
    documents: toList(row.documents_demandes),
    encadrant:
      row.encadrant_id && row.encadrant_nom
        ? {
            nom: row.encadrant_nom,
            prenom: row.encadrant_prenom ?? '',
            service: row.encadrant_service ?? undefined,
          }
        : null,
  };
}

/** Appels API dédiés aux offres publiques et aux candidatures du candidat. */
@Injectable({ providedIn: 'root' })
export class OffersApiService {
  private readonly api = inject(ApiService);

  async list(query: PublicOffersQuery = {}): Promise<Paginated<LandingOffer>> {
    const result = await firstValueFrom(
      this.api.get<Paginated<OffreApiRow>>('/public/offres', {
        search: query.search,
        departementId: query.departementId,
        niveau: query.niveau,
        localisation: query.localisation,
        sort: query.sort,
        page: query.page,
        limit: query.limit,
      }),
    );
    return { ...result, data: result.data.map(mapOffre) };
  }

  async getById(id: string): Promise<LandingOffer> {
    const result = await firstValueFrom(
      this.api.get<{ offre: OffreApiRow }>(`/public/offres/${id}`),
    );
    return mapOffre(result.offre);
  }

  /** Dépose une candidature (jeton CANDIDAT requis). */
  async apply(offreId: string): Promise<Candidature> {
    const result = await firstValueFrom(
      this.api.post<{ candidature: Candidature }>('/candidatures', { offre_id: offreId }),
    );
    return result.candidature;
  }

  /** Offres (id) auxquelles le candidat connecté a déjà postulé. */
  async myAppliedOffers(): Promise<string[]> {
    const result = await firstValueFrom(
      this.api.get<{ offre_ids: string[] }>('/candidatures/mes-offres'),
    );
    return result.offre_ids;
  }

  /**
   * Candidatures du candidat connecté (portail « Mes candidatures »).
   * Liste filtrée côté serveur sur le candidat : aucune candidature d'un
   * autre candidat ne peut être renvoyée.
   */
  async myCandidatures(): Promise<CandidatureListItem[]> {
    const result = await firstValueFrom(
      this.api.get<{ candidatures: CandidatureListItem[] }>('/candidatures/mes-candidatures'),
    );
    return result.candidatures;
  }

  /**
   * Entretien humain d'une candidature du candidat connecté.
   * `null` si aucun entretien n'est planifié ; 403 si la candidature ne
   * appartient pas au candidat (sécurité renforcée côté serveur).
   */
  async getHumanInterview(candidatureId: string): Promise<HumanInterview | null> {
    const result = await firstValueFrom(
      this.api.get<{ interview: HumanInterview | null }>(
        `/candidatures/${candidatureId}/entretien-humain`,
      ),
    );
    return result.interview;
  }

  /**
   * Préférences de stage du candidat (date de début souhaitée + durée en mois).
   * Réservé au candidat propriétaire de la candidature, uniquement après son
   * acceptation suite à l'entretien humain (HUMAN_INTERVIEW_ACCEPTED).
   */
  async submitStagePreferences(
    candidatureId: string,
    preferences: { internship_start_date: string; internship_duration_months: number },
  ): Promise<Candidature> {
    return firstValueFrom(
      this.api.put<Candidature>(`/candidatures/${candidatureId}/stage-preferences`, preferences),
    );
  }

  /**
   * Entretien IA accédé par lien sécurisé (token). Réservé au candidat
   * associé (403 sinon) ; 404 si l'entretien n'existe pas.
   */
  async getAiInterviewByToken(token: string): Promise<AiInterviewSession> {
    return firstValueFrom(this.api.get<AiInterviewSession>(`/entretien-ia/${token}`));
  }

  /**
   * État du microservice Python d'entretien IA (ping backend → Python).
   * 503 si le service IA est indisponible : on n'invite pas le candidat à
   * rejoindre un entretien quand l'IA est injoignable.
   */
  async checkAiServiceHealth(): Promise<{ ok: boolean }> {
    return firstValueFrom(this.api.get<{ ok: boolean }>('/entretien-ia/health'));
  }

  /** Démarre l'entretien vocal : 1re question + son audio (TTS). */
  async startAiInterview(token: string): Promise<AiInterviewStarted> {
    return firstValueFrom(
      this.api.post<AiInterviewStarted>(`/entretien-ia/${token}/commencer`, {}),
    );
  }

  /** Envoie la réponse vocale (multipart) et reçoit la question suivante + son audio. */
  async sendAudioAnswer(
    token: string,
    questionNumber: number,
    blob: Blob,
    filename: string,
    mime: string,
    recordingDuration?: number,
  ): Promise<AiInterviewAnswerResult> {
    const formData = new FormData();
    formData.append('audio', blob, filename);
    formData.append('question_number', String(questionNumber));
    if (recordingDuration !== undefined && recordingDuration > 0) {
      formData.append('recording_duration', String(Math.round(recordingDuration)));
    }
    return firstValueFrom(
      this.api.post<AiInterviewAnswerResult>(`/entretien-ia/${token}/audio`, formData),
    );
  }

  /**
   * Signale l'empreinte de l'appareil du candidat. Appelé au démarrage de
   * l'entretien puis périodiquement : le serveur détecte un changement
   * d'appareil en cours de session. Faits techniques uniquement.
   */
  async reportAiFingerprint(token: string, fingerprint: string): Promise<AiFingerprintResult> {
    return firstValueFrom(
      this.api.post<AiFingerprintResult>(`/entretien-ia/${token}/fingerprint`, { fingerprint }),
    );
  }

  /** Synthétise un texte (relance / relecture d'une question). */
  async synthesizeAiQuestion(token: string, text: string): Promise<AiInterviewSynth> {
    return firstValueFrom(
      this.api.post<AiInterviewSynth>(`/entretien-ia/${token}/synthesize`, { text }),
    );
  }

  /**
   * Enregistre des événements d'intégrité (événements techniques uniquement).
   * Appelé par le moniteur du navigateur : aucun signalement n'est fait par
   * reconnaissance faciale ni analyse biométrique.
   */
  async reportAiIntegrity(token: string, payload: AiIntegrityPayload): Promise<{ stored: number }> {
    return firstValueFrom(
      this.api.post<{ stored: number }>(`/entretien-ia/${token}/integrity`, payload),
    );
  }

  /** Enregistre (ou met à jour) la réponse d'une question. */
  async saveAiAnswer(token: string, numero: number, answer: string): Promise<void> {
    await firstValueFrom(this.api.put(`/entretien-ia/${token}/reponses/${numero}`, { answer }));
  }

  /** Termine l'entretien puis déclenche l'évaluation IA côté serveur. */
  async completeAiInterview(
    token: string,
  ): Promise<{ statut: string; evaluation_status: string; score?: number | null }> {
    return firstValueFrom(
      this.api.post<{ statut: string; evaluation_status: string; score?: number | null }>(
        `/entretien-ia/${token}/terminer`,
        {},
      ),
    );
  }

  /** « Quitter » : bloque le lien du mail (l'entretien devient inaccessible). */
  async quitAiInterview(token: string): Promise<{ statut: string }> {
    return firstValueFrom(this.api.post<{ statut: string }>(`/entretien-ia/${token}/quitter`, {}));
  }

  /**
   * Lance l'analyse IA du CV du candidat pour cette offre.
   * Endpoint prévu (POST /api/offres/:id/analyse-cv) mais non implémenté
   * côté backend : la requête échouera tant qu'il n'existe pas.
   */
  async analyseCv(offreId: string): Promise<AnalyseCvResult> {
    return firstValueFrom(this.api.post<AnalyseCvResult>(`/offres/${offreId}/analyse-cv`, {}));
  }
}
