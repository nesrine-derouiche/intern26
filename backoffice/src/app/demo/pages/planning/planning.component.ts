import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { SHARED_IMPORTS } from 'src/app/theme/shared/shared.module';
import {
  PlanningEvent,
  PlanningPeriode,
  PlanningQuery,
  PlanningResponse,
  PlanningService
} from 'src/app/core/data/planning.service';
import { InternshipService } from 'src/app/core/data/internship.service';
import { AuthService } from 'src/app/core/data/auth.service';

const PAGE_SIZE = 10;
/** L'API n'expose pas de filtre `type` : on récupère la période entière (limite serveur 500). */
const FETCH_LIMIT = 500;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const BACKOFFICE_ROLES = ['ADMIN', 'RH', 'ENCADRANT', 'CHEF_DEPARTEMENT'];

/** Les 6 types renvoyés par GET /api/planning — aucun autre mapping. */
export const EVENT_TYPES = ['STAGE_START', 'STAGE_END', 'REUNION', 'TASK_DEADLINE', 'POINTAGE_ENTREE', 'POINTAGE_SORTIE'] as const;

interface AppliedFilters {
  date_debut?: string;
  date_fin?: string;
  stage_id?: string;
  type?: string;
}

interface StageRow {
  id: string;
  stagiaire_id?: string;
  stagiaire_nom?: string;
  stagiaire_prenom?: string;
  departement_nom?: string;
}

@Component({
  selector: 'app-planning',
  imports: [...SHARED_IMPORTS],
  templateUrl: './planning.component.html',
  styleUrl: './planning.component.scss'
})
export class PlanningComponent implements OnInit, OnDestroy {
  private planningService = inject(PlanningService);
  private internshipService = inject(InternshipService);
  private authService = inject(AuthService);

  readonly PAGE_SIZE = PAGE_SIZE;
  readonly EVENT_TYPES = EVENT_TYPES;
  readonly TYPE_LABELS: Record<string, string> = {
    STAGE_START: 'Début du stage',
    STAGE_END: 'Fin du stage',
    REUNION: 'Réunion',
    TASK_DEADLINE: 'Échéance de tâche',
    POINTAGE_ENTREE: 'Pointage — entrée',
    POINTAGE_SORTIE: 'Pointage — sortie'
  };
  readonly STATUS_LABELS: Record<string, string> = {
    PRESENT: 'Présent',
    RETARD: 'Retard',
    ABSENT: 'Absent',
    EN_COURS: 'En cours',
    TERMINE: 'Terminé',
    ANNULE: 'Annulé',
    A_FAIRE: 'À faire',
    BLOQUE: 'Bloqué'
  };

  /** Portée lecture seule : le backend applique lui-même les droits (withScope). */
  readonly role = this.authService.currentUser()?.role ?? '';
  readonly isBlocked = !BACKOFFICE_ROLES.includes(this.role);
  readonly scopeLabel =
    this.role === 'ADMIN' || this.role === 'RH'
      ? 'Tous les stages'
      : this.role === 'CHEF_DEPARTEMENT'
        ? 'Mon département'
        : this.role === 'ENCADRANT'
          ? 'Mes stages'
          : '';

  events = signal<PlanningEvent[]>([]);
  total = signal(0);
  page = signal(1);
  pages = signal(1);
  loading = signal(false);
  error = signal('');
  success = signal('');

  statEvenements = signal(0);
  statReunions = signal(0);
  statTaches = signal(0);
  statPointages = signal(0);
  periode = signal<PlanningPeriode | null>(null);
  /** true quand la période demandée dépasse la limite serveur (500) sous filtre type. */
  truncated = signal(false);

  stages = signal<StageRow[]>([]);

  fDateDebut = signal('');
  fDateFin = signal('');
  fStagiaireId = signal('');
  fStageId = signal('');
  fType = signal('TOUS');
  applied = signal<AppliedFilters>({});

  detail = signal<PlanningEvent | null>(null);

  stagiaireOptions = computed(() => {
    const seen = new Map<string, string>();
    for (const s of this.stages()) {
      const key = s.stagiaire_id ?? '';
      if (!key || seen.has(key)) continue;
      const label = `${s.stagiaire_prenom ?? ''} ${s.stagiaire_nom ?? ''}`.trim();
      seen.set(key, label || 'Stagiaire sans nom');
    }
    return Array.from(seen.entries()).map(([id, label]) => ({ id, label }));
  });

  stageOptions = computed(() => {
    const stagiaireId = this.fStagiaireId();
    if (!stagiaireId) return this.stages();
    return this.stages().filter((s) => (s.stagiaire_id ?? '') === stagiaireId);
  });

  private stageById = computed(() => new Map(this.stages().map((s) => [s.id, s])));

  private successTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    if (this.isBlocked) return;
    this.load();
    this.loadStages();
  }

  ngOnDestroy(): void {
    if (this.successTimer) clearTimeout(this.successTimer);
  }

  loadStages(): void {
    this.internshipService.getAll().subscribe({
      next: (data) => this.stages.set(Array.isArray(data) ? data : []),
      error: () => this.stages.set([])
    });
  }

  load(): void {
    if (this.isBlocked) return;
    this.loading.set(true);
    this.error.set('');

    const filters = this.applied();
    const typeFilter = filters.type;
    const params: PlanningQuery = {};
    if (filters.date_debut) params.date_debut = filters.date_debut;
    if (filters.date_fin) params.date_fin = filters.date_fin;
    if (filters.stage_id) params.stage_id = filters.stage_id;
    params.page = typeFilter ? 1 : this.page();
    params.limit = typeFilter ? FETCH_LIMIT : PAGE_SIZE;

    this.planningService.get(params).subscribe({
      next: (res) => this.applyResult(res, typeFilter),
      error: (err) => {
        this.loading.set(false);
        this.events.set([]);
        this.total.set(0);
        this.pages.set(1);
        this.error.set(err?.error?.message || 'Le chargement du planning a échoué.');
      }
    });
  }

  private applyResult(res: PlanningResponse, typeFilter?: string): void {
    const pagination = res.pagination;
    this.statEvenements.set(pagination.total);
    this.statReunions.set(res.reunions.length);
    this.statTaches.set(res.taches.length);
    this.statPointages.set(res.pointages.length);
    this.periode.set(res.periode);

    if (typeFilter) {
      const filtered = res.evenements.filter((e) => e.type === typeFilter);
      const pagesCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      const current = Math.min(this.page(), pagesCount);
      const start = (current - 1) * PAGE_SIZE;
      this.events.set(filtered.slice(start, start + PAGE_SIZE));
      this.total.set(filtered.length);
      this.pages.set(pagesCount);
      this.page.set(current);
      this.truncated.set(pagination.total > pagination.limit);
    } else {
      this.events.set(res.evenements);
      this.total.set(pagination.total);
      this.pages.set(Math.max(1, pagination.pages));
      this.page.set(pagination.page);
      this.truncated.set(false);
    }
    this.loading.set(false);
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
    const stageId = this.fStageId() || this.stageOfStagiaire(this.fStagiaireId());
    if (stageId) filters.stage_id = stageId;
    const type = this.fType();
    if (type && type !== 'TOUS') filters.type = type;

    this.error.set('');
    this.applied.set(filters);
    this.page.set(1);
    this.load();
  }

  resetFilters(): void {
    this.fDateDebut.set('');
    this.fDateFin.set('');
    this.fStagiaireId.set('');
    this.fStageId.set('');
    this.fType.set('TOUS');
    this.applied.set({});
    this.error.set('');
    this.page.set(1);
    this.load();
  }

  refresh(): void {
    this.load();
    this.showSuccess('Planning actualisé.');
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.pages() || p === this.page() || this.loading()) return;
    this.page.set(p);
    this.load();
  }

  onStagiaireChange(stagiaireId: string): void {
    this.fStagiaireId.set(stagiaireId);
    const stillVisible = this.stages().some((s) => s.id === this.fStageId() && (!stagiaireId || (s.stagiaire_id ?? '') === stagiaireId));
    if (!stillVisible) this.fStageId.set('');
  }

  openDetail(event: PlanningEvent): void {
    this.detail.set(event);
  }

  closeDetail(): void {
    this.detail.set(null);
  }

  /** ── Affichage (aucun décalage de date : on découpe la chaîne, on ne repasse pas par Date) ── */
  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const raw = String(value);
    if (ISO_DATE.test(raw)) {
      const [year, month, day] = raw.split('-');
      return `${day}/${month}/${year}`;
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(parsed.getDate())}/${pad(parsed.getMonth() + 1)}/${parsed.getFullYear()}`;
  }

  formatTime(time: string | null | undefined): string {
    if (!time) return '—';
    const raw = String(time);
    return raw.length >= 5 ? raw.slice(0, 5) : raw;
  }

  typeLabel(type: string): string {
    return this.TYPE_LABELS[type] ?? type;
  }

  typeBadge(type: string): string {
    switch (type) {
      case 'STAGE_START':
        return 'badge bg-primary';
      case 'STAGE_END':
        return 'badge bg-dark';
      case 'REUNION':
        return 'badge bg-info';
      case 'TASK_DEADLINE':
        return 'badge bg-warning';
      case 'POINTAGE_ENTREE':
        return 'badge bg-success';
      case 'POINTAGE_SORTIE':
        return 'badge bg-danger';
      default:
        return 'badge bg-secondary';
    }
  }

  statusLabel(status: string | null | undefined): string {
    if (!status) return '—';
    return this.STATUS_LABELS[status] ?? status;
  }

  statusBadge(status: string | null | undefined): string {
    switch (status) {
      case 'PRESENT':
      case 'TERMINE':
        return 'badge bg-success';
      case 'RETARD':
      case 'EN_COURS':
        return 'badge bg-warning';
      case 'ABSENT':
      case 'ANNULE':
      case 'BLOQUE':
        return 'badge bg-danger';
      case null:
      case undefined:
      case '':
        return 'text-muted';
      default:
        return 'badge bg-secondary';
    }
  }

  stagiaireLabel(event: PlanningEvent): string {
    const stage = this.stageOf(event);
    if (!stage) return '—';
    const label = `${stage.stagiaire_prenom ?? ''} ${stage.stagiaire_nom ?? ''}`.trim();
    return label || '—';
  }

  stageLabel(event: PlanningEvent): string {
    const stage = this.stageOf(event);
    return stage?.departement_nom || '—';
  }

  metaValue(event: PlanningEvent, key: string): string {
    const metadata = event.metadata;
    if (!metadata || typeof metadata !== 'object') return '';
    const value = (metadata as Record<string, unknown>)[key];
    if (value === null || value === undefined || value === '') return '';
    return String(value);
  }

  hasMeta(event: PlanningEvent, keys: string[]): boolean {
    return keys.some((key) => this.metaValue(event, key) !== '');
  }

  private stageOf(event: PlanningEvent): StageRow | undefined {
    const metadata = event.metadata;
    if (!metadata || typeof metadata !== 'object') return undefined;
    const stageId = (metadata as Record<string, unknown>)['stage_id'];
    return typeof stageId === 'string' ? this.stageById().get(stageId) : undefined;
  }

  private stageOfStagiaire(stagiaireId: string): string {
    if (!stagiaireId) return '';
    return this.stages().find((s) => (s.stagiaire_id ?? '') === stagiaireId)?.id ?? '';
  }

  private showSuccess(message: string): void {
    this.success.set(message);
    if (this.successTimer) clearTimeout(this.successTimer);
    this.successTimer = setTimeout(() => this.success.set(''), 4000);
  }
}
