import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SHARED_IMPORTS } from 'src/app/theme/shared/shared.module';
import { SupervisorService } from 'src/app/core/data/supervisor.service';
import { DepartmentService } from 'src/app/core/data/department.service';

@Component({
  selector: 'app-encadrants',
  imports: [...SHARED_IMPORTS, FormsModule],
  templateUrl: './encadrants.component.html',
  styleUrl: './encadrants.component.scss'
})
export class EncadrantsComponent implements OnInit {
  private supervisorService = inject(SupervisorService);
  private departmentService = inject(DepartmentService);

  encadrants = signal<any[]>([]);
  departements = signal<any[]>([]);
  showModal = signal(false);
  editMode = signal(false);
  loading = signal(false);
  error = signal('');
  searchTerm = signal('');

  form: any = { nom: '', prenom: '', email: '', telephone: '', service: '', nombre_max_stagiaires: 3, competences: '', departement_id: '', disponibilite: true };
  editingId: string | null = null;

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.supervisorService.getAll().subscribe({ next: (d) => this.encadrants.set(d) });
    this.departmentService.getAll().subscribe({ next: (d) => this.departements.set(d) });
  }

  filtered() {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.encadrants();
    return this.encadrants().filter(
      (e) => e.nom?.toLowerCase().includes(term) || e.prenom?.toLowerCase().includes(term) || e.service?.toLowerCase().includes(term) || e.departement_nom?.toLowerCase().includes(term)
    );
  }

  openAdd() {
    this.editMode.set(false);
    this.form = { nom: '', prenom: '', email: '', telephone: '', service: '', nombre_max_stagiaires: 3, competences: '', departement_id: '', disponibilite: true };
    this.editingId = null;
    this.error.set('');
    this.showModal.set(true);
  }

  openEdit(e: any) {
    this.editMode.set(true);
    this.form = {
      nom: e.nom, prenom: e.prenom, email: e.email, telephone: e.telephone || '',
      service: e.service || '', nombre_max_stagiaires: e.nombre_max_stagiaires || 3,
      competences: e.competences || '', departement_id: e.departement_id || '',
      disponibilite: e.disponibilite !== undefined ? e.disponibilite : true
    };
    this.editingId = e.id;
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
      ? this.supervisorService.update(this.editingId!, this.form)
      : this.supervisorService.create(this.form);
    obs.subscribe({
      next: () => { this.loading.set(false); this.closeModal(); this.loadAll(); },
      error: (err) => { this.loading.set(false); this.error.set(err.error?.message || 'Une erreur est survenue.'); }
    });
  }

  delete(id: string) {
    if (!confirm('Voulez-vous vraiment supprimer cet encadrant ?')) return;
    this.supervisorService.delete(id).subscribe({
      next: () => this.loadAll(),
      error: (err) => alert(err.error?.message || 'Erreur lors de la suppression.')
    });
  }
}
