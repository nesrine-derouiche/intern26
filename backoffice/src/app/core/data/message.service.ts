import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class MessageService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/messages`);
  }

  getByStagiaire(stagiaireId: string | number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/messages/${stagiaireId}`);
  }

  send(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/messages`, data);
  }
}
