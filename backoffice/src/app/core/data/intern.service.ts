import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class InternService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/stagiaires`);
  }

  getById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/stagiaires/${id}`);
  }

  create(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/stagiaires`, data);
  }

  update(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/stagiaires/${id}`, data);
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/stagiaires/${id}`);
  }
}
