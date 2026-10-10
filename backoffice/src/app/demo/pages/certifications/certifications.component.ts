import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SHARED_IMPORTS } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/data/auth.service';
import {
  CertificationService,
  CertificationRow,
  CERTIFICATION_STATUSES
} from 'src/app/core/data/certification.service';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-certifications',
  imports: [...SHARED_IMPORTS, FormsModule],
  templateUrl: './certifications.component.html',
  styleUrl: './certifications.component.scss'
})
export class CertificationsComponent implements OnInit {
  private certificationService = inject(CertificationService);
  private authService = inject(AuthService);
  private router = inject(Router);

  rows = signal<CertificationRow[]>([]);
  total = signal(0);
  page = signal(1);
  pages = signal(1);
  loading = signal(false);
  error = signal('');

  searchTerm = signal('');
  filterStatut = signal('');

  readonly STATUSES = CERTIFICATION_STATUSES;

  get isEncadrant(): boolean {
    return this.authService.currentUser()?.role === 'ENCADRANT';
  }

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.certificationService
      .listCertifications({
        search: this.searchTerm() || undefined,
        statut: this.filterStatut() || undefined,
        page: this.page(),
        limit: PAGE_SIZE
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.data);
          this.total.set(res.total);
          this.pages.set(res.pages);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(
            err.error?.message || 'Chargement des certifications impossible.'
          );
        }
      });
  }

  onSearch(term: string) {
    this.searchTerm.set(term);
    this.page.set(1);
    this.load();
  }

  onFilterStatut(statut: string) {
    this.filterStatut.set(statut);
    this.page.set(1);
    this.load();
  }

  resetFilters() {
    this.searchTerm.set('');
    this.filterStatut.set('');
    this.page.set(1);
    this.load();
  }

  goToPage(p: number) {
    if (p < 1 || p > this.pages() || p === this.page()) return;
    this.page.set(p);
    this.load();
  }

  openReview(row: CertificationRow) {
    this.router.navigate(['/certifications', row.stage_id]);
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
