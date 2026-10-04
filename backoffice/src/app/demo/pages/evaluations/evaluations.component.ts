import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SHARED_IMPORTS } from 'src/app/theme/shared/shared.module';
import { EvaluationService } from 'src/app/core/data/evaluation.service';
import { InternshipService } from 'src/app/core/data/internship.service';

@Component({
  selector: 'app-evaluations',
  imports: [...SHARED_IMPORTS, FormsModule],
  templateUrl: './evaluations.component.html',
  styleUrl: './evaluations.component.scss'
})
export class EvaluationsComponent implements OnInit {
  private evaluationService = inject(EvaluationService);
  private internshipService = inject(InternshipService);

  evaluations = signal<any[]>([]);
  stages = signal<any[]>([]);
  showModal = signal(false);
  loading = signal(false);
  error = signal('');
  searchTerm = signal('');

  form: any = { stage_id: '', technique: 5, communication: 5, autonomie: 5, ponctualite: 5, qualite: 5, commentaire: '' };

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.evaluationService.getAll().subscribe({ next: (d) => this.evaluations.set(d) });
    this.internshipService.getAll().subscribe({ next: (d) => this.stages.set(d) });
  }

  filtered() {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.evaluations();
    return this.evaluations().filter(
      (e) => e.stagiaire_nom?.toLowerCase().includes(term) || e.stagiaire_prenom?.toLowerCase().includes(term)
    );
  }

  openAdd() {
    this.form = { stage_id: '', technique: 5, communication: 5, autonomie: 5, ponctualite: 5, qualite: 5, commentaire: '' };
    this.error.set('');
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); }

  save() {
    if (!this.form.stage_id) {
      this.error.set('Veuillez sélectionner un stage.');
      return;
    }
    this.loading.set(true);
    this.evaluationService.create(this.form).subscribe({
      next: () => { this.loading.set(false); this.closeModal(); this.loadAll(); },
      error: (err) => { this.loading.set(false); this.error.set(err.error?.message || 'Erreur.'); }
    });
  }

  delete(id: string) {
    if (!confirm('Supprimer cette évaluation ?')) return;
    this.evaluationService.delete(id).subscribe({ next: () => this.loadAll() });
  }

  getNoteBadge(note: number): string {
    if (note >= 15) return 'badge bg-success';
    if (note >= 10) return 'badge bg-warning text-dark';
    return 'badge bg-danger';
  }

  calcNote(): number {
    const f = this.form;
    return Math.round(((+f.technique + +f.communication + +f.autonomie + +f.ponctualite + +f.qualite) / 5) * 100) / 100;
  }
}
