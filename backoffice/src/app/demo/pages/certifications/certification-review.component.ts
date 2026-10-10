import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SHARED_IMPORTS } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/data/auth.service';
import {
  CertificationService,
  CertificationState
} from 'src/app/core/data/certification.service';

@Component({
  selector: 'app-certification-review',
  imports: [...SHARED_IMPORTS, FormsModule],
  templateUrl: './certification-review.component.html',
  styleUrl: './certification-review.component.scss'
})
export class CertificationReviewComponent implements OnInit {
  private certificationService = inject(CertificationService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  stageId = '';
  state = signal<CertificationState | null>(null);
  loading = signal(false);
  error = signal('');
  actionLoading = signal(false);
  actionError = signal('');

  showDenyDialog = signal(false);
  showRedoDialog = signal(false);
  reason = signal('');
  documentConcerne = signal('');
  previewUrl = signal<string | null>(null);
  previewTitle = signal('');

  get isEncadrant(): boolean {
    return this.authService.currentUser()?.role === 'ENCADRANT';
  }

  ngOnInit() {
    this.stageId = this.route.snapshot.paramMap.get('stageId') || '';
    if (!this.stageId) {
      this.error.set('Stage introuvable.');
      return;
    }
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.certificationService.getState(this.stageId).subscribe({
      next: (state) => {
        this.state.set(state);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err.error?.message || 'Chargement du dossier impossible.'
        );
      }
    });
  }

  back() {
    this.router.navigate(['/certifications']);
  }

  openPreview(kind: 'JOURNAL' | 'RAPPORT') {
    const doc =
      kind === 'JOURNAL' ? this.state()?.documents.JOURNAL : this.state()?.documents.RAPPORT;
    if (!doc) return;
    this.certificationService
      .downloadDocument(this.stageId, doc.id)
      .subscribe({
        next: (blob) => {
          this.closePreview();
          const url = URL.createObjectURL(blob);
          this.previewTitle.set(doc.nom);
          this.previewUrl.set(url);
        },
        error: () => {
          this.actionError.set('Aperçu impossible.');
        }
      });
  }

  closePreview() {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewUrl.set(null);
  }

  downloadDoc(kind: 'JOURNAL' | 'RAPPORT') {
    const doc =
      kind === 'JOURNAL' ? this.state()?.documents.JOURNAL : this.state()?.documents.RAPPORT;
    if (!doc) return;
    this.certificationService
      .downloadDocument(this.stageId, doc.id)
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.download = doc.nom;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        error: () => {
          this.actionError.set('Téléchargement impossible.');
        }
      });
  }

  validate() {
    if (!confirm('Valider ce dossier de certification ?')) return;
    this.actionLoading.set(true);
    this.actionError.set('');
    this.certificationService.validate(this.stageId).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.load();
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.actionError.set(err.error?.message || 'Validation impossible.');
      }
    });
  }

  openDeny() {
    this.reason.set('');
    this.actionError.set('');
    this.showDenyDialog.set(true);
  }

  confirmDeny() {
    if (!this.reason().trim()) {
      this.actionError.set('Un motif est requis pour refuser le dossier.');
      return;
    }
    this.actionLoading.set(true);
    this.certificationService.deny(this.stageId, this.reason().trim()).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.showDenyDialog.set(false);
        this.load();
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.actionError.set(err.error?.message || 'Refus impossible.');
      }
    });
  }

  openRedo() {
    this.reason.set('');
    this.documentConcerne.set('');
    this.actionError.set('');
    this.showRedoDialog.set(true);
  }

  confirmRedo() {
    if (!this.reason().trim()) {
      this.actionError.set('Un motif est requis pour demander une reprise.');
      return;
    }
    this.actionLoading.set(true);
    this.certificationService
      .requestRedo(this.stageId, this.reason().trim(), this.documentConcerne() || undefined)
      .subscribe({
        next: () => {
          this.actionLoading.set(false);
          this.showRedoDialog.set(false);
          this.load();
        },
        error: (err) => {
          this.actionLoading.set(false);
          this.actionError.set(err.error?.message || 'Demande impossible.');
        }
      });
  }

  generateAttestation() {
    if (!confirm('Générer l’attestation de stage ?')) return;
    this.actionLoading.set(true);
    this.actionError.set('');
    this.certificationService.generateAttestation(this.stageId).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.load();
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.actionError.set(err.error?.message || 'Génération impossible.');
      }
    });
  }

  downloadAttestation() {
    this.certificationService.downloadAttestation(this.stageId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.download = this.state()?.certification
          ? `attestation_${this.state()?.certification?.stage_id.slice(0, 8)}.pdf`
          : 'attestation.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => {
        this.actionError.set('Téléchargement de l’attestation impossible.');
      }
    });
  }

  getStatusBadge(statut: string): string {
    switch (statut) {
      case 'VALIDATED':
      case 'CERTIFICATE_GENERATED':
        return 'badge bg-success';
      case 'SUBMITTED':
        return 'badge bg-primary';
      case 'REDO_REQUESTED':
        return 'badge bg-warning text-dark';
      case 'DENIED':
        return 'badge bg-danger';
      default:
        return 'badge bg-secondary';
    }
  }

  getStatusLabel(statut: string): string {
    switch (statut) {
      case 'VALIDATED':
        return 'Validé';
      case 'CERTIFICATE_GENERATED':
        return 'Attestation générée';
      case 'SUBMITTED':
        return 'Soumis';
      case 'REDO_REQUESTED':
        return 'Reprise demandée';
      case 'DENIED':
        return 'Refusé';
      default:
        return 'Non soumis';
    }
  }
}
