import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';

/** Les 6 types réellement renvoyés par GET /api/planning (aucun autre type connu). */
export type PlanningEventType = 'STAGE_START' | 'STAGE_END' | 'REUNION' | 'TASK_DEADLINE' | 'POINTAGE_ENTREE' | 'POINTAGE_SORTIE';

export interface PlanningEvent {
  id: string;
  type: PlanningEventType | string;
  title: string;
  /** Date calendaire 'YYYY-MM-DD' (jamais un instant ISO). */
  date: string;
  /** Heure locale 'HH:MM' ou null. */
  time: string | null;
  status: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
}

export interface PlanningHoraire {
  id?: string;
  stage_id?: string;
  heure_debut: string;
  heure_fin: string;
  duree_pause_minutes: number;
}

export interface PlanningStage {
  id: string;
  stagiaire_id: string | null;
  encadrant_id: string | null;
  date_debut: string;
  date_fin: string;
  statut: string;
  horaire: PlanningHoraire | null;
}

export interface PlanningPeriode {
  date_debut: string;
  date_fin: string;
}

export interface PlanningPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PlanningResponse {
  stage_id: string | null;
  periode: PlanningPeriode | null;
  stages: PlanningStage[];
  horaire: PlanningHoraire | null;
  evenements: PlanningEvent[];
  reunions: unknown[];
  taches: unknown[];
  pointages: unknown[];
  pagination: PlanningPagination;
}

/** L'API ne supporte ni `stagiaire_id` ni `type` : ces filtres sont traités côté page. */
export interface PlanningQuery {
  date_debut?: string;
  date_fin?: string;
  stage_id?: string;
  page?: number;
  limit?: number;
}

const EMPTY_RESPONSE: PlanningResponse = {
  stage_id: null,
  periode: null,
  stages: [],
  horaire: null,
  evenements: [],
  reunions: [],
  taches: [],
  pointages: [],
  pagination: { page: 1, limit: 100, total: 0, pages: 0 }
};

@Injectable({ providedIn: 'root' })
export class PlanningService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/planning`;

  private buildParams(params: PlanningQuery): HttpParams {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return httpParams;
  }

  /** GET /api/planning — lecture seule, la portée est appliquée par le backend. */
  get(query: PlanningQuery = {}): Observable<PlanningResponse> {
    return this.http
      .get<{ planning?: PlanningResponse } | null>(this.apiUrl, { params: this.buildParams(query) })
      .pipe(map((raw) => this.normalize(raw)));
  }

  /** Enveloppe { planning } + défenses contre une réponse vide ou malformée. */
  private normalize(raw: { planning?: PlanningResponse } | null): PlanningResponse {
    const planning = raw?.planning;
    if (!planning || typeof planning !== 'object') return { ...EMPTY_RESPONSE, pagination: { ...EMPTY_RESPONSE.pagination } };

    const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
    const paginationRaw = (planning.pagination ?? {}) as Partial<PlanningPagination>;
    const toInt = (value: unknown, fallback: number): number => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
    };

    const page = toInt(paginationRaw.page, 1);
    const limit = toInt(paginationRaw.limit, 100);
    const total = toInt(paginationRaw.total, list(planning.evenements).length);
    const pages = paginationRaw.pages !== undefined && paginationRaw.pages !== null ? toInt(paginationRaw.pages, 0) : Math.ceil(total / limit) || 0;

    return {
      stage_id: planning.stage_id ?? null,
      periode: planning.periode ?? null,
      stages: list(planning.stages) as PlanningStage[],
      horaire: planning.horaire ?? null,
      evenements: list(planning.evenements) as PlanningEvent[],
      reunions: list(planning.reunions),
      taches: list(planning.taches),
      pointages: list(planning.pointages),
      pagination: { page, limit, total, pages }
    };
  }
}
