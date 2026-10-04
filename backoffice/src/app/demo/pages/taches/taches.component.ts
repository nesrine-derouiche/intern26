import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SHARED_IMPORTS } from 'src/app/theme/shared/shared.module';
import { TaskService } from 'src/app/core/data/task.service';
import { ProjectService } from 'src/app/core/data/project.service';
import { InternService } from 'src/app/core/data/intern.service';

@Component({
  selector: 'app-taches',
  imports: [...SHARED_IMPORTS, FormsModule],
  templateUrl: './taches.component.html',
  styleUrl: './taches.component.scss'
})
export class TachesComponent implements OnInit {
  private taskService = inject(TaskService);
  private projectService = inject(ProjectService);
  private internService = inject(InternService);

  taches = signal<any[]>([]);
  projets = signal<any[]>([]);
  stagiaires = signal<any[]>([]);
  showModal = signal(false);
  showDetail = signal(false);
  editMode = signal(false);
  loading = signal(false);
  error = signal('');
  searchTerm = signal('');
  filterStatus = signal('tous');
  filterPriorite = signal('toutes');
  selectedTask = signal<any>(null);
  viewMode = signal('table');

  form: any = { projet_id: '', executant_id: '', titre: '', description: '', priorite: 'MOYENNE', date_debut: '', date_fin: '' };
  editingId: string | null = null;

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.taskService.getAll().subscribe({ next: (d) => this.taches.set(d) });
    this.projectService.getAll().subscribe({ next: (d) => this.projets.set(d) });
    this.internService.getAll().subscribe({ next: (d) => this.stagiaires.set(d) });
  }

  filtered() {
    let result = this.taches();
    const term = this.searchTerm().toLowerCase();
    if (term) {
      result = result.filter((t) =>
        t.titre?.toLowerCase().includes(term) ||
        t.executant_nom?.toLowerCase().includes(term) ||
        t.projet_titre?.toLowerCase().includes(term)
      );
    }
    if (this.filterStatus() !== 'tous') {
      result = result.filter((t) => t.statut === this.filterStatus());
    }
    if (this.filterPriorite() !== 'toutes') {
      result = result.filter((t) => t.priorite === this.filterPriorite());
    }
    return result;
  }

  get stats() {
    const all = this.taches();
    return {
      total: all.length,
      a_faire: all.filter(t => t.statut === 'A_FAIRE').length,
      en_cours: all.filter(t => t.statut === 'EN_COURS').length,
      terminee: all.filter(t => t.statut === 'TERMINEE').length,
      bloquee: all.filter(t => t.statut === 'BLOQUEE').length,
    };
  }

  getKanbanCount(status: string): number {
    return this.filtered().filter(t => t.statut === status).length;
  }

  openAdd() {
    this.editMode.set(false);
    this.form = { projet_id: '', executant_id: '', titre: '', description: '', priorite: 'MOYENNE', date_debut: '', date_fin: '' };
    this.editingId = null;
    this.error.set('');
    this.showModal.set(true);
  }

  openEdit(t: any) {
    this.editMode.set(true);
    this.form = {
      projet_id: t.projet_id, executant_id: t.executant_id,
      titre: t.titre, description: t.description || '',
      priorite: t.priorite, date_debut: t.date_debut || '',
      date_fin: t.date_fin || ''
    };
    this.editingId = t.id;
    this.error.set('');
    this.showModal.set(true);
  }

  openDetail(t: any) {
    this.selectedTask.set(t);
    this.showDetail.set(true);
  }

  closeModal() { this.showModal.set(false); this.error.set(''); }
  closeDetail() { this.showDetail.set(false); this.selectedTask.set(null); }

  save() {
    if (!this.form.titre || !this.form.projet_id || !this.form.executant_id) {
      this.error.set('Titre, projet et exécutant sont requis.');
      return;
    }
    this.loading.set(true);
    const obs = this.editMode()
      ? this.taskService.update(this.editingId!, this.form)
      : this.taskService.create(this.form);
    obs.subscribe({
      next: () => { this.loading.set(false); this.closeModal(); this.loadAll(); },
      error: (err) => { this.loading.set(false); this.error.set(err.error?.message || 'Erreur.'); }
    });
  }

  updateStatus(id: string, statut: string) {
    this.taskService.updateStatus(id, statut).subscribe({ next: () => this.loadAll() });
  }

  updateProgress(id: string, progress: number) {
    this.taskService.updateProgress(id, progress).subscribe({ next: () => this.loadAll() });
  }

  delete(id: string) {
    if (!confirm('Supprimer cette tâche ?')) return;
    this.taskService.delete(id).subscribe({ next: () => this.loadAll() });
  }

  getPriorityBadge(p: string): string {
    switch (p) { case 'HAUTE': case 'URGENTE': return 'badge bg-danger'; case 'MOYENNE': return 'badge bg-warning'; default: return 'badge bg-info'; }
  }

  getStatusBadge(s: string): string {
    switch (s) { case 'TERMINEE': return 'badge bg-success'; case 'EN_COURS': return 'badge bg-primary'; case 'BLOQUEE': return 'badge bg-danger'; default: return 'badge bg-secondary'; }
  }

  getStatusLabel(s: string): string {
    switch (s) { case 'TERMINEE': return 'Terminée'; case 'EN_COURS': return 'En cours'; case 'BLOQUEE': return 'Bloquée'; default: return 'À faire'; }
  }

  getPriorityLabel(p: string): string {
    switch (p) { case 'HAUTE': return 'Haute'; case 'URGENTE': return 'Urgente'; case 'MOYENNE': return 'Moyenne'; default: return 'Basse'; }
  }

  getProgressWidth(t: any): number {
    if (t.statut === 'TERMINEE') return 100;
    if (t.progress != null && t.progress > 0) return t.progress;
    if (t.statut === 'EN_COURS') return 40;
    if (t.statut === 'BLOQUEE') return 25;
    return 5;
  }

  getProgressColor(t: any): string {
    const w = this.getProgressWidth(t);
    if (w >= 80) return '#16a34a';
    if (w >= 40) return '#5B5CEB';
    if (w >= 20) return '#ea580c';
    return '#9ca3af';
  }

  getDaysInfo(t: any): string {
    if (!t.date_fin) return 'Pas de date de fin';
    const now = new Date();
    const fin = new Date(t.date_fin);
    const diff = Math.ceil((fin.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (t.statut === 'TERMINEE') return 'Terminée';
    if (diff < 0) return `En retard de ${Math.abs(diff)}j`;
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return 'Demain';
    return `${diff}j restant(s)`;
  }

  getDaysClass(t: any): string {
    if (!t.date_fin || t.statut === 'TERMINEE') return 'text-muted';
    const now = new Date();
    const fin = new Date(t.date_fin);
    const diff = Math.ceil((fin.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'text-danger fw-bold';
    if (diff <= 2) return 'text-warning fw-bold';
    return 'text-muted';
  }

  getTimeline(t: any): { icon: string; color: string; label: string; date: string }[] {
    const items: { icon: string; color: string; label: string; date: string }[] = [];
    items.push({ icon: 'ti ti-plus', color: '#5B5CEB', label: 'Tâche créée', date: t.created_at ? new Date(t.created_at).toLocaleDateString('fr-FR') : '—' });
    if (t.date_debut) {
      const started = new Date(t.date_debut) <= new Date();
      items.push({ icon: started ? 'ti ti-player-play-filled' : 'ti ti-calendar', color: started ? '#16a34a' : '#9ca3af', label: 'Date de début', date: new Date(t.date_debut).toLocaleDateString('fr-FR') });
    }
    if (t.statut === 'TERMINEE' && t.completion_date) {
      items.push({ icon: 'ti ti-circle-check-filled', color: '#16a34a', label: 'Terminée', date: new Date(t.completion_date).toLocaleDateString('fr-FR') });
    } else if (t.date_fin) {
      items.push({ icon: 'ti ti-clock', color: '#ea580c', label: 'Échéance', date: new Date(t.date_fin).toLocaleDateString('fr-FR') });
    }
    return items;
  }
}
