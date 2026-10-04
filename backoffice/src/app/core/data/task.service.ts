import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/taches`);
  }

  getById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/taches/${id}`);
  }

  getMyTaches(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/taches/mes-taches`);
  }

  create(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/taches`, data);
  }

  update(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/taches/${id}`, data);
  }

  updateStatus(id: string, statut: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/taches/${id}`, { statut });
  }

  updateProgress(id: string, progress: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/taches/${id}`, { progress });
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/taches/${id}`);
  }
}
