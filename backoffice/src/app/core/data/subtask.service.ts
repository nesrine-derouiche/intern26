import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface Subtask {
  id: string;
  tache_id: string;
  titre: string;
  description: string | null;
  statut: string;
  created_at?: string;
  updated_at?: string;
}

export interface SubtaskAggregate {
  total: number;
  todo: number;
  in_progress: number;
  done: number;
  progress: number | null;
  empty: boolean;
}

export interface SubtaskPayload {
  titre?: string;
  description?: string;
  statut?: string;
}

export interface SubtaskListResponse {
  subtasks: Subtask[];
  aggregate: SubtaskAggregate;
}

export const SUBTASK_STATUSES = [
  { value: 'TODO', label: 'À faire', progress: 0 },
  { value: 'IN_PROGRESS', label: 'En cours', progress: 50 },
  { value: 'DONE', label: 'Terminée', progress: 100 }
] as const;

@Injectable({ providedIn: 'root' })
export class SubtaskService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  listByTask(taskId: string): Observable<SubtaskListResponse> {
    return this.http.get<SubtaskListResponse>(
      `${this.apiUrl}/taches/${taskId}/subtasks`
    );
  }

  getProgress(taskId: string): Observable<{ tache_id: string; aggregate: SubtaskAggregate }> {
    return this.http.get<{ tache_id: string; aggregate: SubtaskAggregate }>(
      `${this.apiUrl}/taches/${taskId}/progress`
    );
  }

  create(taskId: string, payload: SubtaskPayload): Observable<{ message: string; subtask: Subtask }> {
    return this.http.post<{ message: string; subtask: Subtask }>(
      `${this.apiUrl}/taches/${taskId}/subtasks`,
      payload
    );
  }

  update(id: string, payload: SubtaskPayload): Observable<{ message: string; subtask: Subtask }> {
    return this.http.put<{ message: string; subtask: Subtask }>(
      `${this.apiUrl}/subtasks/${id}`,
      payload
    );
  }

  updateStatus(id: string, statut: string): Observable<{ message: string; subtask: Subtask }> {
    return this.http.patch<{ message: string; subtask: Subtask }>(
      `${this.apiUrl}/subtasks/${id}/status`,
      { statut }
    );
  }

  remove(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/subtasks/${id}`
    );
  }
}
