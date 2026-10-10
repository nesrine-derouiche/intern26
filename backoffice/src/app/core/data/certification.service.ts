import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface CertificationRow {
  stage_id: string;
  stagiaire_nom: string;
  stagiaire_prenom: string;
  departement_nom: string;
  date_debut: string | null;
  date_fin: string | null;
  statut: string;
  submitted_at: string | null;
  reason: string | null;
  document_concerne: string | null;
  has_attestation: boolean;
  journal: { present: boolean; version: number | null };
  rapport: { present: boolean; version: number | null };
}

export interface CertificationPage {
  data: CertificationRow[];
  total: number;
  page: number;
  pages: number;
}

export interface CertificationDocument {
  id: string;
  kind: string;
  version: number;
  nom: string;
  taille: number;
  created_at: string;
}

export interface CertificationDecision {
  id: string;
  from_statut: string;
  to_statut: string;
  reviewer_id: string | null;
  reason: string | null;
  document_concerne: string | null;
  created_at: string;
}

export interface CertificationState {
  certification: {
    id: string;
    stage_id: string;
    statut: string;
    reviewer_id: string | null;
    reason: string | null;
    document_concerne: string | null;
    submitted_at: string | null;
    decided_at: string | null;
    has_attestation: boolean;
  } | null;
  statut: string;
  documents: { JOURNAL: CertificationDocument | null; RAPPORT: CertificationDocument | null };
  versions: CertificationDocument[];
  decisions: CertificationDecision[];
}

export interface CertificationQuery {
  search?: string;
  statut?: string;
  page?: number;
  limit?: number;
}

export const CERTIFICATION_STATUSES = [
  { value: '', label: 'Tous les statuts' },
  { value: 'NOT_SUBMITTED', label: 'Non soumis' },
  { value: 'SUBMITTED', label: 'Soumis' },
  { value: 'REDO_REQUESTED', label: 'Reprise demandée' },
  { value: 'DENIED', label: 'Refusé' },
  { value: 'VALIDATED', label: 'Validé' },
  { value: 'CERTIFICATE_GENERATED', label: 'Attestation générée' }
] as const;

@Injectable({ providedIn: 'root' })
export class CertificationService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  listCertifications(query: CertificationQuery = {}): Observable<CertificationPage> {
    const params: Record<string, string> = {};
    if (query.search) params['search'] = query.search;
    if (query.statut) params['statut'] = query.statut;
    if (query.page) params['page'] = String(query.page);
    if (query.limit) params['limit'] = String(query.limit);
    return this.http.get<CertificationPage>(`${this.apiUrl}/certifications`, { params });
  }

  getState(stageId: string): Observable<CertificationState> {
    return this.http.get<CertificationState>(
      `${this.apiUrl}/stages/${stageId}/certification`
    );
  }

  downloadDocument(stageId: string, docId: string): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/stages/${stageId}/certification/documents/${docId}/download`,
      { responseType: 'blob' }
    );
  }

  validate(stageId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.apiUrl}/stages/${stageId}/certification/valider`,
      {}
    );
  }

  deny(stageId: string, reason: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.apiUrl}/stages/${stageId}/certification/refuser`,
      { reason }
    );
  }

  requestRedo(stageId: string, reason: string, documentConcerne?: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.apiUrl}/stages/${stageId}/certification/corriger`,
      { reason, document_concerne: documentConcerne || null }
    );
  }

  generateAttestation(stageId: string): Observable<{ message: string; attestation: { nom: string; taille: number | null } }> {
    return this.http.post<{ message: string; attestation: { nom: string; taille: number | null } }>(
      `${this.apiUrl}/stages/${stageId}/certification/attestation`,
      {}
    );
  }

  downloadAttestation(stageId: string): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/stages/${stageId}/certification/attestation`,
      { responseType: 'blob' }
    );
  }
}
