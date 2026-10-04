import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class MeetingService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/reunions`);
  }

  getById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/reunions/${id}`);
  }

  create(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/reunions`, data);
  }

  update(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/reunions/${id}`, data);
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/reunions/${id}`);
  }
}
