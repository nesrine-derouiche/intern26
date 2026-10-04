import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class InternshipService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/stages`);
  }

  getById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/stages/${id}`);
  }

  update(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/stages/${id}`, data);
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/stages/${id}`);
  }

  getDocuments(stageId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/stages/${stageId}/documents`);
  }

  downloadPdf(stageId: string, type: string): string {
    return `${this.apiUrl}/stages/${stageId}/pdf/${type}`;
  }
}
