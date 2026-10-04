import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SHARED_IMPORTS } from 'src/app/theme/shared/shared.module';
import { DepartmentService } from 'src/app/core/data/department.service';
import { SupervisorService } from 'src/app/core/data/supervisor.service';

@Component({
  selector: 'app-departements',
  imports: [...SHARED_IMPORTS, FormsModule],
  templateUrl: './departements.component.html',
  styleUrl: './departements.component.scss'
})
export class DepartementsComponent implements OnInit {
  private departmentService = inject(DepartmentService);
  private supervisorService = inject(SupervisorService);

  departements = signal<any[]>([]);
  encadrants = signal<any[]>([]);
  showModal = signal(false);
  editMode = signal(false);
  loading = signal(false);
  error = signal('');
  searchTerm = signal('');

  form: any = { nom: '', description: '', chef_departement_id: '' };
  editingId: string | null = null;

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.departmentService.getAll().subscribe({ next: (d) => this.departements.set(d) });
    this.supervisorService.getAll().subscribe({ next: (d) => this.encadrants.set(d) });
  }

  filtered() {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.departements();
    return this.departements().filter((d) => d.nom?.toLowerCase().includes(term));
  }

  openAdd() {
    this.editMode.set(false);
    this.form = { nom: '', description: '', chef_departement_id: '' };
    this.editingId = null;
    this.error.set('');
    this.showModal.set(true);
  }

  openEdit(d: any) {
    this.editMode.set(true);
    this.form = { nom: d.nom, description: d.description || '', chef_departement_id: d.chef_departement_id || '' };
    this.editingId = d.id;
    this.error.set('');
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); this.error.set(''); }

  save() {
    if (!this.form.nom) {
      this.error.set('Le nom du département est requis.');
      return;
    }
    this.loading.set(true);
    const obs = this.editMode()
      ? this.departmentService.update(this.editingId!, this.form)
      : this.departmentService.create(this.form);
    obs.subscribe({
      next: () => { this.loading.set(false); this.closeModal(); this.loadAll(); },
      error: (err) => { this.loading.set(false); this.error.set(err.error?.message || 'Erreur.'); }
    });
  }

  delete(id: string) {
    if (!confirm('Supprimer ce département ?')) return;
    this.departmentService.delete(id).subscribe({ next: () => this.loadAll() });
  }
}
