import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class EvaluationService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/evaluations`);
  }

  getById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/evaluations/${id}`);
  }

  create(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/evaluations`, data);
  }

  update(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/evaluations/${id}`, data);
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/evaluations/${id}`);
  }
}
