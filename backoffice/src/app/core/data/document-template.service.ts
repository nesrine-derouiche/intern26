import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface DocumentTemplate {
  id: string;
  nom: string;
  type: string;
  contenu: string;
  variables: string[];
  actif: boolean;
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentTemplatePage {
  data: DocumentTemplate[];
  total: number;
  page: number;
  pages: number;
}

export interface TemplatePreview {
  preview: string;
}

export interface TemplatePayload {
  nom: string;
  type: string;
  contenu: string;
  variables: string[];
}

export interface TemplateUpdatePayload {
  nom?: string;
  contenu?: string;
  variables?: string[];
}

export interface TemplateQuery {
  type?: string;
  actif?: boolean;
  page?: number;
  limit?: number;
}

export const TEMPLATE_TYPES = ['CV', 'CONVENTION', 'ASSURANCE', 'RAPPORT', 'ATTESTATION'] as const;

@Injectable({ providedIn: 'root' })
export class TemplateService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  listTemplates(query: TemplateQuery = {}): Observable<DocumentTemplatePage> {
    const params: Record<string, string> = {};
    if (query.type) params['type'] = query.type;
    if (query.actif !== undefined) params['actif'] = String(query.actif);
    if (query.page) params['page'] = String(query.page);
    if (query.limit) params['limit'] = String(query.limit);
    return this.http.get<DocumentTemplatePage>(`${this.apiUrl}/document-templates`, { params });
  }

  getTemplate(id: string): Observable<DocumentTemplate> {
    return this.http.get<DocumentTemplate>(`${this.apiUrl}/document-templates/${id}`);
  }

  createTemplate(payload: TemplatePayload): Observable<{ message: string; template: DocumentTemplate }> {
    return this.http.post<{ message: string; template: DocumentTemplate }>(
      `${this.apiUrl}/document-templates`,
      payload
    );
  }

  updateTemplate(id: string, payload: TemplateUpdatePayload): Observable<{ message: string; template: DocumentTemplate }> {
    return this.http.put<{ message: string; template: DocumentTemplate }>(
      `${this.apiUrl}/document-templates/${id}`,
      payload
    );
  }

  deactivateTemplate(id: string): Observable<{ message: string; template: DocumentTemplate }> {
    return this.http.patch<{ message: string; template: DocumentTemplate }>(
      `${this.apiUrl}/document-templates/${id}/deactivate`,
      {}
    );
  }

  previewTemplate(id: string, data: Record<string, string>): Observable<TemplatePreview> {
    return this.http.post<TemplatePreview>(
      `${this.apiUrl}/document-templates/${id}/preview`,
      data
    );
  }
}
