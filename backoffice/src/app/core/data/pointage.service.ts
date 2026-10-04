import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';

export type PointageStatut = 'PRESENT' | 'RETARD' | 'ABSENT';

export interface Pointage {
  id: string;
  stage_id: string;
  date_pointage: string;
  heure_entree: string | null;
  heure_sortie: string | null;
  duree_minutes: number | null;
  retard_minutes: number;
  statut: PointageStatut;
  commentaire: string | null;
  stagiaire_nom?: string;
  stagiaire_prenom?: string;
  encadrant_nom?: string;
  encadrant_prenom?: string;
  departement_nom?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PointagePage {
  data: Pointage[];
  total: number;
  page: number;
  pages: number;
}

export interface PointageQuery {
  page?: number;
  limit?: number;
  stage_id?: string;
  statut?: string;
  date_debut?: string;
  date_fin?: string;
}

export interface Horaire {
  id?: string;
  stage_id?: string;
  heure_debut: string;
  heure_fin: string;
  duree_pause_minutes: number;
}

export interface PointageStats {
  total_jours: number;
  presents: number;
  retards: number;
  absents: number;
  total_minutes: number;
  moyenne_minutes: number;
  total_retard_minutes: number;
}

export interface PointageCorrection {
  heure_entree?: string;
  heure_sortie?: string;
  retard_minutes?: number;
  statut?: PointageStatut;
  commentaire?: string;
}

@Injectable({ providedIn: 'root' })
export class PointageService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  private buildParams(params: object): HttpParams {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return httpParams;
  }

  /** Le backend renvoie l'enveloppe { data, total, page, pages } dès que page/limit sont fournis. */
  getAll(params: PointageQuery = {}): Observable<PointagePage> {
    return this.http.get<PointagePage>(`${this.apiUrl}/pointages`, { params: this.buildParams(params) });
  }

  getByStage(stageId: string, params: PointageQuery = {}): Observable<PointagePage> {
    return this.http.get<PointagePage>(`${this.apiUrl}/pointages/stage/${stageId}`, { params: this.buildParams(params) });
  }

  getRetards(params: PointageQuery = {}): Observable<PointagePage> {
    return this.http.get<PointagePage>(`${this.apiUrl}/pointages/retards`, { params: this.buildParams(params) });
  }

  getStats(stageId: string, params: PointageQuery = {}): Observable<PointageStats> {
    return this.http
      .get<Record<string, unknown>>(`${this.apiUrl}/pointages/stats/${stageId}`, { params: this.buildParams(params) })
      .pipe(map((raw) => this.normalizeStats(raw)));
  }

  getHoraires(stageId: string): Observable<Horaire> {
    return this.http.get<Horaire>(`${this.apiUrl}/pointages/horaires/${stageId}`).pipe(map((h) => this.normalizeHoraire(h)));
  }

  update(id: string, data: PointageCorrection): Observable<{ pointage: Pointage; message: string }> {
    return this.http.put<{ pointage: Pointage; message: string }>(`${this.apiUrl}/pointages/${id}/corriger`, data);
  }

  updateHoraire(stageId: string, data: Partial<Horaire>): Observable<{ horaire: Horaire; message: string }> {
    return this.http
      .put<{ horaire: Horaire; message: string }>(`${this.apiUrl}/pointages/horaires/${stageId}`, data)
      .pipe(map((res) => ({ ...res, horaire: this.normalizeHoraire(res.horaire) })));
  }

  /** La colonne time de pg est sérialisée en HH:MM:SS alors que la saisie attend HH:MM. */
  private normalizeHoraire(horaire: Horaire): Horaire {
    if (!horaire) return horaire;
    const toHhMm = (value: string): string => (/^\d{2}:\d{2}:\d{2}$/.test(value) ? value.slice(0, 5) : value);
    return {
      ...horaire,
      heure_debut: horaire.heure_debut ? toHhMm(horaire.heure_debut) : horaire.heure_debut,
      heure_fin: horaire.heure_fin ? toHhMm(horaire.heure_fin) : horaire.heure_fin
    };
  }

  /** pg renvoie COUNT/SUM/AVG sous forme de chaîne : on normalise en nombres. */
  private normalizeStats(raw: Record<string, unknown>): PointageStats {
    const n = (value: unknown): number => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return {
      total_jours: n(raw['total_jours']),
      presents: n(raw['presents']),
      retards: n(raw['retards']),
      absents: n(raw['absents']),
      total_minutes: n(raw['total_minutes']),
      moyenne_minutes: n(raw['moyenne_minutes']),
      total_retard_minutes: n(raw['total_retard_minutes'])
    };
  }
}
