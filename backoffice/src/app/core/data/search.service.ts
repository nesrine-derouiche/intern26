import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  search(query: string, type?: string): Observable<any> {
    const params: any = { q: query };
    if (type) params.type = type;
    return this.http.get(`${this.apiUrl}/search`, { params });
  }
}
