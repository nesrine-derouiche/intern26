import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SHARED_IMPORTS } from 'src/app/theme/shared/shared.module';
import { OfferService } from 'src/app/core/data/offer.service';
import { DepartmentService } from 'src/app/core/data/department.service';

@Component({
  selector: 'app-offres',
  imports: [...SHARED_IMPORTS, FormsModule],
  templateUrl: './offres.component.html',
  styleUrl: './offres.component.scss'
})
export class OffresComponent implements OnInit {
  private offerService = inject(OfferService);
  private departmentService = inject(DepartmentService);

  offres = signal<any[]>([]);
  departements = signal<any[]>([]);
  showModal = signal(false);
  editMode = signal(false);
  loading = signal(false);
  error = signal('');
  searchTerm = signal('');

  form: any = { departement_id: '', titre: '', description: '', duree: '', competences_demandees: '', nombre_places: '', date_limite: '' };
  editingId: string | null = null;

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.offerService.getAll().subscribe({ next: (d) => this.offres.set(d) });
    this.departmentService.getAll().subscribe({ next: (d) => this.departements.set(d) });
  }

  filtered() {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.offres();
    return this.offres().filter(
      (o) => o.titre?.toLowerCase().includes(term) || o.departement_nom?.toLowerCase().includes(term)
    );
  }

  openAdd() {
    this.editMode.set(false);
    this.form = { departement_id: '', titre: '', description: '', duree: '', competences_demandees: '', nombre_places: '', date_limite: '' };
    this.editingId = null;
    this.error.set('');
    this.showModal.set(true);
  }

  openEdit(o: any) {
    this.editMode.set(true);
    this.form = {
      departement_id: o.departement_id, titre: o.titre, description: o.description || '',
      duree: o.duree, competences_demandees: o.competences_demandees || '',
      nombre_places: o.nombre_places, date_limite: o.date_limite || ''
    };
    this.editingId = o.id;
    this.error.set('');
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); this.error.set(''); }

  save() {
    if (!this.form.titre || !this.form.departement_id || !this.form.duree || !this.form.nombre_places || !this.form.date_limite) {
      this.error.set('Tous les champs obligatoires doivent être remplis.');
      return;
    }
    this.loading.set(true);
    const obs = this.editMode()
      ? this.offerService.update(this.editingId!, this.form)
      : this.offerService.create(this.form);
    obs.subscribe({
      next: () => { this.loading.set(false); this.closeModal(); this.loadAll(); },
      error: (err) => { this.loading.set(false); this.error.set(err.error?.message || 'Erreur.'); }
    });
  }

  delete(id: string) {
    if (!confirm('Supprimer cette offre ?')) return;
    this.offerService.delete(id).subscribe({ next: () => this.loadAll() });
  }

  getStatutBadge(s: string): string {
    switch (s) {
      case 'ACTIVE': return 'badge bg-success';
      case 'CLOTUREE': return 'badge bg-secondary';
      default: return 'badge bg-primary';
    }
  }

  getStatutLabel(s: string): string {
    switch (s) {
      case 'ACTIVE': return 'Active';
      case 'CLOTUREE': return 'Clôturée';
      case 'BROUILLON': return 'Brouillon';
      default: return s;
    }
  }
}
