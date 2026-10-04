import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { CandidatProfile, CvInfo } from '../models/landing.models';

export interface CandidatUpdatePayload {
  email?: string;
  telephone?: string;
  adresse?: string;
  universite?: string;
  specialite?: string;
  niveau?: string;
  competences?: string[];
  langues?: string[];
  github?: string;
  linkedin?: string;
  portfolio?: string;
}

export interface UpdateProfileResult {
  message: string;
  emailChanged: boolean;
  dev?: { verificationLink: string };
}

interface UploadFileResult {
  photo?: { filename: string };
}

/** Profil candidat : lecture, modification, photo et CV. */
@Injectable({ providedIn: 'root' })
export class CandidatService {
  private readonly api = inject(ApiService);

  async getMe(): Promise<CandidatProfile> {
    const result = await firstValueFrom(
      this.api.get<{ candidat: CandidatProfile }>('/candidat/me'),
    );
    return result.candidat;
  }

  async updateMe(payload: CandidatUpdatePayload): Promise<UpdateProfileResult> {
    return firstValueFrom(this.api.put<UpdateProfileResult>('/candidat/me', payload));
  }

  async uploadPhoto(file: File): Promise<void> {
    const formData = new FormData();
    formData.append('photo', file, file.name);
    await firstValueFrom(this.api.upload<UploadFileResult>('post', '/candidat/photo', formData));
  }

  async uploadCv(file: File, onProgress?: (percent: number) => void): Promise<CvInfo> {
    const formData = new FormData();
    formData.append('cv', file, file.name);
    return new Promise<CvInfo>((resolve, reject) => {
      this.api.uploadWithProgress<{ cv: CvInfo }>('post', '/candidat/cv', formData).subscribe({
        next: ({ progress, body }) => {
          if (progress != null) onProgress?.(progress);
          if (body) resolve(body.cv);
        },
        error: (err) => reject(err),
      });
    });
  }

  async deleteCv(): Promise<void> {
    await firstValueFrom(this.api.delete<{ message: string }>('/candidat/cv'));
  }

  /** Métadonnées du CV (nom, taille, date, analyse) sans télécharger le fichier. */
  async getCvInfo(): Promise<CvInfo | null> {
    const result = await firstValueFrom(this.api.get<{ cv: CvInfo | null }>('/candidat/cv/info'));
    return result.cv;
  }

  /** Change le mot de passe de l'utilisateur connecté. */
  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return firstValueFrom(
      this.api.put<{ message: string }>('/candidat/password', {
        currentPassword,
        newPassword,
      }),
    );
  }

  /** Photo du candidat sous forme de Blob (URL interne, pas de jeton en query string). */
  async getPhotoBlob(): Promise<Blob> {
    return firstValueFrom(this.api.blob('/candidat/photo'));
  }

  async getCvBlob(): Promise<Blob> {
    return firstValueFrom(this.api.blob('/candidat/cv'));
  }
}
