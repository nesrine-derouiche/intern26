import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface NotificationItem {
  id: string;
  utilisateur_id: string;
  titre: string;
  message: string;
  date: string;
  type: string;
  lue: boolean;
  lien?: string;
}

export interface NotificationPage {
  data: NotificationItem[];
  total: number;
  page: number;
  pages: number;
}

export interface NotificationQuery {
  page?: number;
  limit?: number;
  type?: string | null;
}

export interface NotificationCategory {
  value: string;
  label: string;
  icon: string;
}

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  { value: 'STAGE', label: 'Stage', icon: 'ti-briefcase' },
  { value: 'CANDIDATURE', label: 'Candidature', icon: 'ti-user-check' },
  { value: 'TACHE', label: 'Tâche', icon: 'ti-checklist' },
  { value: 'REUNION', label: 'Réunion', icon: 'ti-calendar-event' },
  { value: 'DOCUMENT', label: 'Document', icon: 'ti-file-text' },
  { value: 'RAPPORT', label: 'Rapport', icon: 'ti-report' },
  { value: 'EVALUATION', label: 'Évaluation', icon: 'ti-star' }
];

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(query: NotificationQuery = {}): Observable<NotificationPage> {
    const params: Record<string, string> = {};
    if (query.page) params['page'] = String(query.page);
    if (query.limit) params['limit'] = String(query.limit);
    if (query.type) params['type'] = query.type;
    return this.http.get<NotificationPage>(`${this.apiUrl}/notifications`, { params });
  }

  getUnreadCount(): Observable<{ total: number }> {
    return this.http.get<{ total: number }>(`${this.apiUrl}/notifications/unread`);
  }

  markAsRead(id: string): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/notifications/${id}/lire`, {});
  }

  markAllAsRead(): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/notifications/lire-tout`, {});
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/notifications/${id}`);
  }
}
