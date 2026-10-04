import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SHARED_IMPORTS } from 'src/app/theme/shared/shared.module';
import { InternService } from 'src/app/core/data/intern.service';

@Component({
  selector: 'app-stagiaires',
  imports: [...SHARED_IMPORTS, FormsModule],
  templateUrl: './stagiaires.component.html',
  styleUrl: './stagiaires.component.scss'
})
export class StagiairesComponent implements OnInit {
  private internService = inject(InternService);

  stagiaires = signal<any[]>([]);
  showModal = signal(false);
  editMode = signal(false);
  loading = signal(false);
  error = signal('');
  searchTerm = signal('');

  form: any = { nom: '', prenom: '', email: '', telephone: '', ecole: '', specialite: '', niveau: '', competences: '' };
  editingId: string | null = null;

  ngOnInit() { this.load(); }

  load() {
    this.internService.getAll().subscribe({
      next: (data) => this.stagiaires.set(data),
      error: () => this.error.set('Erreur de chargement.')
    });
  }

  filtered() {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.stagiaires();
    return this.stagiaires().filter(
      (s) => s.nom?.toLowerCase().includes(term) || s.prenom?.toLowerCase().includes(term) || s.specialite?.toLowerCase().includes(term)
    );
  }

  openAdd() {
    this.editMode.set(false);
    this.form = { nom: '', prenom: '', email: '', telephone: '', ecole: '', specialite: '', niveau: '', competences: '' };
    this.editingId = null;
    this.error.set('');
    this.showModal.set(true);
  }

  openEdit(s: any) {
    this.editMode.set(true);
    this.form = { nom: s.nom, prenom: s.prenom, email: s.email, telephone: s.telephone || '', ecole: s.ecole || '', specialite: s.specialite || '', niveau: s.niveau || '', competences: s.competences || '' };
    this.editingId = s.id;
    this.error.set('');
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); this.error.set(''); }

  save() {
    if (!this.form.nom || !this.form.prenom || !this.form.email) {
      this.error.set('Nom, prénom et email sont requis.');
      return;
    }
    this.loading.set(true);
    const obs = this.editMode()
      ? this.internService.update(this.editingId!, this.form)
      : this.internService.create(this.form);
    obs.subscribe({
      next: () => { this.loading.set(false); this.closeModal(); this.load(); },
      error: (err) => { this.loading.set(false); this.error.set(err.error?.message || 'Erreur.'); }
    });
  }

  delete(id: string) {
    if (!confirm('Supprimer ce stagiaire ?')) return;
    this.internService.delete(id).subscribe({ next: () => this.load() });
  }

  getProgress(s: any): number {
    if (!s.nb_taches || s.nb_taches === 0) return 0;
    return Math.round((s.nb_taches_terminees / s.nb_taches) * 100);
  }
}
