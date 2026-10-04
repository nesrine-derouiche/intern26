import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class SupervisorService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/encadrants`);
  }

  getById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/encadrants/${id}`);
  }

  create(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/encadrants`, data);
  }

  update(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/encadrants/${id}`, data);
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/encadrants/${id}`);
  }
}
