import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { SHARED_IMPORTS } from 'src/app/theme/shared/shared.module';
import {
  Horaire,
  Pointage,
  PointageCorrection,
  PointagePage,
  PointageStats,
  PointageService
} from 'src/app/core/data/pointage.service';
import { InternshipService } from 'src/app/core/data/internship.service';
import { AuthService } from 'src/app/core/data/auth.service';

const PAGE_SIZE = 10;
const STATUTS = ['PRESENT', 'RETARD', 'ABSENT'] as const;
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

interface AppliedFilters {
  date_debut?: string;
  date_fin?: string;
  stage_id?: string;
  statut?: string;
}

interface StageRow {
  id: string;
  stagiaire_id?: string;
  stagiaire_nom?: string;
  stagiaire_prenom?: string;
  departement_nom?: string;
}

@Component({
  selector: 'app-presences',
  imports: [...SHARED_IMPORTS],
  templateUrl: './presences.component.html',
  styleUrl: './presences.component.scss'
})
export class PresencesComponent implements OnInit, OnDestroy {
  private pointageService = inject(PointageService);
  private internshipService = inject(InternshipService);
  private authService = inject(AuthService);

  readonly PAGE_SIZE = PAGE_SIZE;
  readonly STATUT_LABELS: Record<string, string> = {
    PRESENT: 'Présent',
    RETARD: 'Retard',
    ABSENT: 'Absent'
  };

  private readonly role = this.authService.currentUser()?.role ?? '';
  readonly canCorrect = ['ADMIN', 'RH'].includes(this.role);
  readonly canManageHoraires = ['ADMIN', 'RH', 'ENCADRANT'].includes(this.role);

  view = signal<'presences' | 'retards'>('presences');

  pointages = signal<Pointage[]>([]);
  total = signal(0);
  page = signal(1);
  pages = signal(1);
  loading = signal(false);
  error = signal('');
  success = signal('');

  stages = signal<StageRow[]>([]);

  globalTotal = signal(0);
  globalPresents = signal(0);
  globalRetards = signal(0);
  globalAbsents = signal(0);

  fDateDebut = signal('');
  fDateFin = signal('');
  fStageId = signal('');
  fStatut = signal('TOUS');
  fRetardsOnly = signal(false);
  applied = signal<AppliedFilters>({});

  detailStageId = signal('');
  detailLoading = signal(false);
  detailError = signal('');
  horaire = signal<Horaire | null>(null);
  stats = signal<PointageStats | null>(null);

  showCorrectModal = signal(false);
  savingCorrection = signal(false);
  correctionError = signal('');
  selected = signal<Pointage | null>(null);
  correction: PointageCorrection & { retard_minutes: number } = {
    heure_entree: '',
    heure_sortie: '',
    retard_minutes: 0,
    statut: 'PRESENT',
    commentaire: ''
  };

  showHoraireModal = signal(false);
  savingHoraire = signal(false);
  horaireError = signal('');
  horaireForm: { heure_debut: string; heure_fin: string; duree_pause_minutes: number | string } = {
    heure_debut: '09:00',
    heure_fin: '17:00',
    duree_pause_minutes: 60
  };

  stagiaireOptions = computed(() => {
    const seen = new Map<string, { label: string; stageId: string }>();
    for (const s of this.stages()) {
      const key = s.stagiaire_id ?? s.id;
      if (!seen.has(key)) {
        seen.set(key, {
          label: `${s.stagiaire_prenom ?? ''} ${s.stagiaire_nom ?? ''} — ${s.departement_nom ?? ''}`.trim(),
          stageId: s.id
        });
      }
    }
    return Array.from(seen.values());
  });

  private successTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.load();
    this.loadGlobalStats();
    this.loadStages();
  }

  ngOnDestroy(): void {
    if (this.successTimer) clearTimeout(this.successTimer);
  }

  loadStages(): void {
    this.internshipService.getAll().subscribe({
      next: (data) => this.stages.set(data || []),
      error: () => this.stages.set([])
    });
  }

  loadGlobalStats(): void {
    const count = (statut?: string) => this.pointageService.getAll({ page: 1, limit: 1, statut });
    const emptyPage = (res: PointagePage) => res?.total ?? 0;
    count().subscribe({ next: (res) => this.globalTotal.set(emptyPage(res)), error: () => undefined });
    count('PRESENT').subscribe({ next: (res) => this.globalPresents.set(emptyPage(res)), error: () => undefined });
    count('RETARD').subscribe({ next: (res) => this.globalRetards.set(emptyPage(res)), error: () => undefined });
    count('ABSENT').subscribe({ next: (res) => this.globalAbsents.set(emptyPage(res)), error: () => undefined });
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    const params = { page: this.page(), limit: this.PAGE_SIZE, ...this.applied() };
    const request = this.view() === 'retards' ? this.pointageService.getRetards(params) : this.pointageService.getAll(params);
    request.subscribe({
      next: (res) => {
        const page: PointagePage = res ?? { data: [], total: 0, page: 1, pages: 1 };
        this.pointages.set(page.data ?? []);
        this.total.set(page.total ?? 0);
        this.pages.set(page.pages ?? 1);
        this.page.set(page.page ?? this.page());
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.pointages.set([]);
        this.error.set(err?.error?.message || 'Le chargement des présences a échoué.');
      }
    });
  }

  setView(view: 'presences' | 'retards'): void {
    if (this.view() === view) return;
    this.view.set(view);
    this.page.set(1);
    this.load();
  }

  applyFilters(): void {
    const debut = this.fDateDebut();
    const fin = this.fDateFin();
    if (debut && fin && debut > fin) {
      this.error.set('La date de début doit être antérieure ou égale à la date de fin.');
      return;
    }
    const filters: AppliedFilters = {};
    if (debut) filters.date_debut = debut;
    if (fin) filters.date_fin = fin;
    if (this.fStageId()) filters.stage_id = this.fStageId();
    const statut = this.fRetardsOnly() ? 'RETARD' : this.fStatut();
    if (statut && statut !== 'TOUS') filters.statut = statut;
    this.error.set('');
    this.applied.set(filters);
    this.page.set(1);
    this.load();
  }

  resetFilters(): void {
    this.fDateDebut.set('');
    this.fDateFin.set('');
    this.fStageId.set('');
    this.fStatut.set('TOUS');
    this.fRetardsOnly.set(false);
    this.applied.set({});
    this.error.set('');
    this.page.set(1);
    this.load();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.pages() || p === this.page() || this.loading()) return;
    this.page.set(p);
    this.load();
  }

  // ── Correction ────────────────────────────────────────────────
  openCorrection(p: Pointage): void {
    if (!this.canCorrect) return;
    this.selected.set(p);
    this.correction = {
      heure_entree: this.toInputValue(p.heure_entree),
      heure_sortie: this.toInputValue(p.heure_sortie),
      retard_minutes: p.retard_minutes ?? 0,
      statut: p.statut,
      commentaire: p.commentaire || ''
    };
    this.correctionError.set('');
    this.showCorrectModal.set(true);
  }

  closeCorrection(): void {
    this.showCorrectModal.set(false);
    this.selected.set(null);
    this.correctionError.set('');
  }

  validateCorrection(): string | null {
    const c = this.correction;
    if (!c.statut || !STATUTS.includes(c.statut)) return 'Veuillez sélectionner un statut valide.';
    const retard = Number(c.retard_minutes);
    if (!Number.isInteger(retard) || retard < 0) return 'Le retard doit être un nombre entier positif (en minutes).';
    if (c.commentaire && c.commentaire.length > 500) return 'Le commentaire ne peut pas dépasser 500 caractères.';
    if (c.heure_entree && c.heure_sortie) {
      const entree = new Date(c.heure_entree).getTime();
      const sortie = new Date(c.heure_sortie).getTime();
      if (Number.isNaN(entree) || Number.isNaN(sortie)) return 'Les heures saisies ne sont pas valides.';
      if (sortie <= entree) return "L'heure de sortie doit être postérieure à l'heure d'entrée.";
    }
    return null;
  }

  saveCorrection(): void {
    if (!this.selected()) return;
    const validation = this.validateCorrection();
    if (validation) {
      this.correctionError.set(validation);
      return;
    }
    const c = this.correction;
    const payload: PointageCorrection = {
      retard_minutes: Number(c.retard_minutes),
      statut: c.statut,
      commentaire: c.commentaire ?? ''
    };
    if (c.heure_entree) payload.heure_entree = c.heure_entree;
    if (c.heure_sortie) payload.heure_sortie = c.heure_sortie;

    this.savingCorrection.set(true);
    this.pointageService.update(this.selected()!.id, payload).subscribe({
      next: () => {
        this.savingCorrection.set(false);
        this.closeCorrection();
        this.load();
        this.loadGlobalStats();
        this.refreshDetail();
        this.showSuccess('Présence corrigée avec succès.');
      },
      error: (err) => {
        this.savingCorrection.set(false);
        this.correctionError.set(err?.error?.message || "La correction n'a pas pu être enregistrée.");
      }
    });
  }

  // ── Horaires & statistiques ───────────────────────────────────
  onDetailStageChange(stageId: string): void {
    this.detailStageId.set(stageId);
    this.horaire.set(null);
    this.stats.set(null);
    this.detailError.set('');
    if (!stageId) return;
    this.detailLoading.set(true);
    forkJoin({
      horaire: this.pointageService.getHoraires(stageId),
      stats: this.pointageService.getStats(stageId)
    }).subscribe({
      next: ({ horaire, stats }) => {
        this.horaire.set(horaire);
        this.stats.set(stats);
        this.detailLoading.set(false);
      },
      error: (err) => {
        this.detailLoading.set(false);
        this.detailError.set(err?.error?.message || 'Impossible de charger les horaires et statistiques.');
      }
    });
  }

  refreshDetail(): void {
    if (this.detailStageId()) this.onDetailStageChange(this.detailStageId());
  }

  openHoraireEdit(): void {
    if (!this.canManageHoraires) return;
    const h = this.horaire();
    if (!h) return;
    this.horaireForm = {
      heure_debut: h.heure_debut,
      heure_fin: h.heure_fin,
      duree_pause_minutes: h.duree_pause_minutes ?? 0
    };
    this.horaireError.set('');
    this.showHoraireModal.set(true);
  }

  closeHoraireEdit(): void {
    this.showHoraireModal.set(false);
    this.horaireError.set('');
  }

  validateHoraire(): string | null {
    const f = this.horaireForm;
    if (!HH_MM.test(f.heure_debut || '')) return "L'heure de début doit être au format HH:MM.";
    if (!HH_MM.test(f.heure_fin || '')) return "L'heure de fin doit être au format HH:MM.";
    if (f.heure_fin <= f.heure_debut) return "L'heure de fin doit être postérieure à l'heure de début.";
    const pause = Number(f.duree_pause_minutes);
    if (!Number.isInteger(pause) || pause < 0 || pause > 480) return 'La durée de pause doit être entre 0 et 480 minutes.';
    return null;
  }

  saveHoraire(): void {
    const stageId = this.detailStageId();
    if (!stageId) return;
    const validation = this.validateHoraire();
    if (validation) {
      this.horaireError.set(validation);
      return;
    }
    this.savingHoraire.set(true);
    this.pointageService
      .updateHoraire(stageId, {
        heure_debut: this.horaireForm.heure_debut,
        heure_fin: this.horaireForm.heure_fin,
        duree_pause_minutes: Number(this.horaireForm.duree_pause_minutes)
      })
      .subscribe({
        next: () => {
          this.savingHoraire.set(false);
          this.closeHoraireEdit();
          this.refreshDetail();
          this.showSuccess('Horaires mis à jour avec succès.');
        },
        error: (err) => {
          this.savingHoraire.set(false);
          this.horaireError.set(err?.error?.message || "Les horaires n'ont pas pu être enregistrés.");
        }
      });
  }

  // ── Affichage ─────────────────────────────────────────────────
  formatDatePointage(value: string): string {
    if (!value) return '—';
    if (!value.includes('T')) {
      const [year, month, day] = value.slice(0, 10).split('-');
      return year && month && day ? `${day}/${month}/${year}` : value;
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  formatHeure(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  /** L'API ne renvoie pas l'horaire prévu : dérivé de heure_entree - retard_minutes. */
  heurePrevue(p: Pointage): string {
    if (!p.heure_entree) return '—';
    const d = new Date(p.heure_entree);
    if (Number.isNaN(d.getTime())) return '—';
    const shifted = new Date(d.getTime() - (p.retard_minutes ?? 0) * 60000);
    return `${String(shifted.getHours()).padStart(2, '0')}:${String(shifted.getMinutes()).padStart(2, '0')}`;
  }

  formatDuree(minutes: number | null): string {
    if (minutes === null || minutes === undefined) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h${m > 0 ? ` ${m}` : ''}`;
  }

  formatRetard(minutes: number | null): string {
    if (!minutes || minutes <= 0) return '—';
    return `+${minutes} min`;
  }

  statutBadge(statut: string): string {
    switch (statut) {
      case 'PRESENT':
        return 'badge bg-success';
      case 'RETARD':
        return 'badge bg-warning';
      case 'ABSENT':
        return 'badge bg-danger';
      default:
        return 'badge bg-secondary';
    }
  }

  statutLabel(statut: string): string {
    return this.STATUT_LABELS[statut] ?? statut;
  }

  initials(p: Pointage): string {
    return `${(p.stagiaire_prenom ?? '').charAt(0)}${(p.stagiaire_nom ?? '').charAt(0)}` || '?';
  }

  stageLabel(p: Pointage): string {
    return p.departement_nom || '—';
  }

  formatMinutes(minutes: number | null | undefined): string {
    if (!minutes) return '0h';
    return this.formatDuree(Math.round(minutes));
  }

  private toInputValue(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private showSuccess(message: string): void {
    this.success.set(message);
    if (this.successTimer) clearTimeout(this.successTimer);
    this.successTimer = setTimeout(() => this.success.set(''), 4000);
  }
}
