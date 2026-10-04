import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SHARED_IMPORTS } from 'src/app/theme/shared/shared.module';
import { ApplicationService } from 'src/app/core/data/application.service';
import { OfferService } from 'src/app/core/data/offer.service';
import { InternService } from 'src/app/core/data/intern.service';

@Component({
  selector: 'app-candidatures',
  imports: [...SHARED_IMPORTS, FormsModule],
  templateUrl: './candidatures.component.html',
  styleUrl: './candidatures.component.scss'
})
export class CandidaturesComponent implements OnInit {
  private applicationService = inject(ApplicationService);
  private offerService = inject(OfferService);
  private internService = inject(InternService);

  candidatures = signal<any[]>([]);
  offres = signal<any[]>([]);
  stagiaires = signal<any[]>([]);
  showModal = signal(false);
  loading = signal(false);
  error = signal('');
  searchTerm = signal('');
  filterStatus = signal('tous');

  form: any = { stagiaire_id: '', offre_id: '' };

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.applicationService.getAll().subscribe({ next: (d) => this.candidatures.set(d) });
    this.offerService.getAll().subscribe({ next: (d) => this.offres.set(d) });
    this.internService.getAll().subscribe({ next: (d) => this.stagiaires.set(d) });
  }

  filtered() {
    let result = this.candidatures();
    const term = this.searchTerm().toLowerCase();
    if (term) result = result.filter(
      (c) => this.displayName(c).toLowerCase().includes(term) || c.offre_titre?.toLowerCase().includes(term)
    );
    if (this.filterStatus() !== 'tous') result = result.filter((c) => c.statut === this.filterStatus());
    return result;
  }

  displayName(c: any): string {
    const prenom = c.candidat_prenom || c.stagiaire_prenom || '';
    const nom = c.candidat_nom || c.stagiaire_nom || '';
    return `${prenom} ${nom}`.trim();
  }

  openAdd() {
    this.form = { stagiaire_id: '', offre_id: '' };
    this.error.set('');
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); }

  save() {
    if (!this.form.stagiaire_id || !this.form.offre_id) {
      this.error.set('Veuillez sélectionner un stagiaire et une offre.');
      return;
    }
    this.loading.set(true);
    this.applicationService.create(this.form).subscribe({
      next: () => { this.loading.set(false); this.closeModal(); this.loadAll(); },
      error: (err) => { this.loading.set(false); this.error.set(err.error?.message || 'Erreur.'); }
    });
  }

  updateStatut(id: string, statut: string) {
    this.applicationService.updateStatus(id, statut).subscribe({ next: () => this.loadAll() });
  }

  acceptForAiInterview(id: string) {
    if (!confirm('Accepter cette candidature pour l’entretien IA ?')) return;
    this.applicationService.updateStatus(id, 'RH_ACCEPTED').subscribe({ next: () => this.loadAll() });
  }

  delete(id: string) {
    if (!confirm('Supprimer cette candidature ?')) return;
    this.applicationService.delete(id).subscribe({ next: () => this.loadAll() });
  }

  sendInterviewLink(id: string) {
    if (!confirm('Envoyer le lien de l\'entretien humain par email au candidat ?')) return;
    this.loading.set(true);
    this.applicationService.scheduleExpressHumanInterview(id).subscribe({
      next: () => { this.loading.set(false); alert('Email envoyé avec succès.'); this.loadAll(); },
      error: (err) => { this.loading.set(false); alert(err.error?.message || 'Erreur lors de l\'envoi.'); }
    });
  }

  getStatutBadge(s: string): string {
    switch (s) {
      case 'ACCEPTEE': return 'badge bg-success';
      case 'REFUSEE': return 'badge bg-danger';
      case 'EN_ENTRETIEN_IA': return 'badge bg-info text-dark';
      case 'RH_ACCEPTED': return 'badge bg-info text-dark';
      case 'AI_INTERVIEW_PASSED': return 'badge bg-success';
      case 'AI_INTERVIEW_FAILED': return 'badge bg-danger';
      case 'EN_ATTENTE': return 'badge bg-warning text-dark';
      default: return 'badge bg-secondary';
    }
  }

  getStatutLabel(s: string): string {
    switch (s) {
      case 'ACCEPTEE': return 'Acceptée';
      case 'REFUSEE': return 'Refusée';
      case 'EN_ENTRETIEN_IA': return 'Entretien IA';
      case 'RH_ACCEPTED': return 'Acceptée pour entretien IA';
      case 'AI_INTERVIEW_PASSED': return 'Entretien IA réussi';
      case 'AI_INTERVIEW_FAILED': return 'Entretien IA échoué';
      case 'EN_ATTENTE': return 'En attente';
      default: return s;
    }
  }
}
