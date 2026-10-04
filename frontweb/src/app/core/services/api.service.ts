import { Injectable, inject } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpEvent,
  HttpEventType,
  HttpParams,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

/** URL racine de l'API backend (Express, port 3000). */
export const API_BASE = 'http://localhost:3000/api';

export interface ApiFieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: ApiFieldError[];

  constructor(status: number, message: string, fieldErrors: ApiFieldError[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/** Enveloppe d'erreur renvoyée par le backend. */
interface ApiErrorBody {
  success?: boolean;
  message?: string;
  errors?: ApiFieldError[];
}

function toApiError(error: HttpErrorResponse): Observable<never> {
  if (error.status === 0) {
    return throwError(
      () => new ApiError(0, "Impossible de contacter le serveur. Vérifiez votre connexion."),
    );
  }

  const body = error.error as ApiErrorBody | undefined;
  const message =
    body?.message ??
    (typeof error.error === 'string' ? error.error : 'Une erreur est survenue.');
  const fieldErrors = Array.isArray(body?.errors) ? body.errors! : [];

  return throwError(() => new ApiError(error.status, message, fieldErrors));
}

/**
 * Client HTTP générique vers l'API REST.
 * Attache automatiquement le jeton JWT via l'intercepteur.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: Record<string, string | number | boolean | null | undefined>): Observable<T> {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== null && value !== undefined && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return this.http.get<T>(`${API_BASE}${path}`, { params: httpParams }).pipe(catchError(toApiError));
  }

  post<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http.post<T>(`${API_BASE}${path}`, body).pipe(catchError(toApiError));
  }

  put<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http.put<T>(`${API_BASE}${path}`, body).pipe(catchError(toApiError));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${API_BASE}${path}`).pipe(catchError(toApiError));
  }

  /** Requête multipart (upload de fichiers). */
  upload<T>(method: 'post' | 'put', path: string, formData: FormData): Observable<T> {
    const request = this.http.request<T>(method, `${API_BASE}${path}`, { body: formData });
    return request.pipe(catchError(toApiError));
  }

  /** Upload multipart avec progression (0-100). `body` n'est renseigné que sur la réponse finale. */
  uploadWithProgress<T>(
    method: 'post' | 'put',
    path: string,
    formData: FormData,
  ): Observable<{ progress: number | null; body: T | null }> {
    return this.http
      .request<T>(method, `${API_BASE}${path}`, {
        body: formData,
        reportProgress: true,
        observe: 'events',
      })
      .pipe(
        map((event: HttpEvent<T>) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            return { progress: Math.round((event.loaded / event.total) * 100), body: null };
          }
          if (event.type === HttpEventType.Response) {
            return { progress: 100, body: event.body };
          }
          return { progress: null, body: null };
        }),
        catchError(toApiError),
      );
  }

  /** Télécharge un fichier protégé sous forme de Blob (photo, CV). */
  blob(path: string): Observable<Blob> {
    return this.http.get(`${API_BASE}${path}`, { responseType: 'blob' }).pipe(catchError(toApiError));
  }
}
