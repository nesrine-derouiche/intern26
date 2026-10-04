import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SHARED_IMPORTS } from 'src/app/theme/shared/shared.module';
import { MeetingService } from 'src/app/core/data/meeting.service';
import { InternshipService } from 'src/app/core/data/internship.service';

@Component({
  selector: 'app-reunions',
  imports: [...SHARED_IMPORTS, FormsModule],
  templateUrl: './reunions.component.html',
  styleUrl: './reunions.component.scss'
})
export class ReunionsComponent implements OnInit {
  private meetingService = inject(MeetingService);
  private internshipService = inject(InternshipService);

  reunions = signal<any[]>([]);
  stages = signal<any[]>([]);
  showModal = signal(false);
  loading = signal(false);
  error = signal('');

  form: any = { stage_id: '', date: '', heure: '', salle: '', sujet: '' };

  ngOnInit() { this.load(); }

  load() {
    this.meetingService.getAll().subscribe({ next: (d) => this.reunions.set(d) });
    this.internshipService.getAll().subscribe({ next: (d) => this.stages.set(d) });
  }

  openAdd() {
    this.form = { stage_id: '', date: '', heure: '', salle: '', sujet: '' };
    this.error.set('');
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); }

  save() {
    if (!this.form.stage_id || !this.form.date || !this.form.heure || !this.form.sujet) {
      this.error.set('Tous les champs obligatoires doivent être remplis.');
      return;
    }
    this.loading.set(true);
    this.meetingService.create(this.form).subscribe({
      next: () => { this.loading.set(false); this.closeModal(); this.load(); },
      error: (err) => { this.loading.set(false); this.error.set(err.error?.message || 'Erreur.'); }
    });
  }

  delete(id: string) {
    if (!confirm('Supprimer cette réunion ?')) return;
    this.meetingService.delete(id).subscribe({ next: () => this.load() });
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
}
