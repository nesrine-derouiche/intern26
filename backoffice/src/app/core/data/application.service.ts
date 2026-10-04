import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class ApplicationService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/candidatures`);
  }

  getById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/candidatures/${id}`);
  }

  getCvBlob(cvUrl: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}${cvUrl}`, { responseType: 'blob' });
  }

  create(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/candidatures`, data);
  }

  update(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/candidatures/${id}`, data);
  }

  updateStatus(id: string, statut: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/candidatures/${id}`, { statut });
  }

  scheduleHumanInterview(id: string, data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/candidatures/${id}/entretien-humain`, data);
  }

  scheduleExpressHumanInterview(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/candidatures/${id}/entretien-humain/express`, {});
  }

  updateHumanInterview(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/candidatures/${id}/entretien-humain`, data);
  }

  cancelHumanInterview(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/candidatures/${id}/entretien-humain`);
  }

  completeHumanInterview(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/candidatures/${id}/entretien-humain/completion`, {});
  }

  decideHumanInterview(id: string, decision: 'ACCEPTED' | 'REJECTED'): Observable<any> {
    return this.http.post(`${this.apiUrl}/candidatures/${id}/entretien-humain/decision`, { decision });
  }

  /** Valide la période de stage choisie par le candidat accepté (fige la période). */
  validateStagePeriod(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/candidatures/${id}/stage-preferences/validate`, {});
  }

  /** Demande au candidat de modifier sa période de stage. */
  requestStagePeriodModification(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/candidatures/${id}/stage-preferences/request-modification`, {});
  }

  /** Décision RH de vérification manuelle d'un document du dossier de stage. */
  decideDocumentVerification(id: string, documentId: string, status: 'VALID' | 'REJECTED', rejected_reason?: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/candidatures/${id}/documents/${documentId}/verification`, {
      status,
      ...(status === 'REJECTED' ? { rejected_reason } : {})
    });
  }

  /** Télécharge le fichier d'un document du dossier de stage. */
  downloadOnboardingDocument(id: string, documentId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/candidatures/${id}/documents/${documentId}/download`, { responseType: 'blob' });
  }

  /** État d'éligibilité du dossier à la création du stagiaire (lecture seule). */
  getInternshipReadiness(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/candidatures/${id}/internship-readiness`);
  }

  /** Convertit la candidature en stagiaire : profil, stage et affectation (RH/Admin). */
  convertToTrainee(id: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/candidatures/${id}/convert-to-trainee`, {});
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/candidatures/${id}`);
  }
}
