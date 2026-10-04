import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SHARED_IMPORTS } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/data/auth.service';
import { DashboardService } from 'src/app/core/data/dashboard.service';
import { TaskService } from 'src/app/core/data/task.service';
import { InternshipService } from 'src/app/core/data/internship.service';
import { WidgetChartComponent } from '../widget-chart/widget-chart.component';
import { ApexOptions } from 'ng-apexcharts';

const C = {
  primary: '#5B5CEB',
  success: '#16a34a',
  warning: '#ea580c',
  danger: '#dc2626',
  info: '#2196f3'
};

const STATUS_LABELS: Record<string, string> = {
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
  SUSPENDU: 'Suspendu',
  ANNULE: 'Annulé'
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  ENCADRANT: 'Encadrant',
  STAGIAIRE: 'Stagiaire',
  CHEF_DEPARTEMENT: 'Chef de Département',
  RH: 'Ressources Humaines'
};

interface SummaryItem {
  label: string;
  value: number;
  icon: string;
  color: string;
  sub: string;
}

interface QuickAction {
  label: string;
  icon: string;
  color: string;
  route?: string;
  action?: () => void;
}

@Component({
  selector: 'app-default',
  imports: [...SHARED_IMPORTS, RouterLink, WidgetChartComponent],
  templateUrl: './default.component.html',
  styleUrl: './default.component.scss'
})
export class DefaultComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private taskService = inject(TaskService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private internshipService = inject(InternshipService);

  stats = signal<any>(null);
  loading = signal(true);
  recentTaches = signal<any[]>([]);
  errorMessage = signal<string>('');
  today = new Date();

  currentUser = this.authService.currentUser;
  isAdmin = computed(() => this.currentUser()?.role === 'ADMIN');
  isRH = computed(() => this.currentUser()?.role === 'RH');
  isEncadrant = computed(() => this.currentUser()?.role === 'ENCADRANT');
  isStagiaire = computed(() => this.currentUser()?.role === 'STAGIAIRE');

  greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  });

  initials = computed(() => {
    const user = this.currentUser();
    return `${(user?.prenom ?? '')?.charAt(0)}${(user?.nom ?? '')?.charAt(0)}`.toUpperCase() || 'U';
  });

  todayLabel = this.today.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  skeletonCards = Array.from({ length: 8 });
  skeletonRows = Array.from({ length: 5 });
  skeletonSummary = Array.from({ length: 5 });
  skeletonActions = Array.from({ length: 5 });

  kpis = computed(() => {
    const s = this.stats() ?? {};
    return [
      { label: 'Stagiaires', value: s.stagiairesTotal ?? 0, icon: 'ti-users', color: 'primary', sub: `${s.stagiairesActifs ?? 0} actifs` },
      { label: 'Encadrants', value: s.encadrantsTotal ?? 0, icon: 'ti-user-check', color: 'success', sub: `${s.encadrantsActifs ?? 0} disponibles` },
      { label: 'Départements', value: s.departementsTotal ?? 0, icon: 'ti-building', color: 'info', sub: 'services' },
      { label: 'Offres de stage', value: s.offresTotal ?? 0, icon: 'ti-briefcase', color: 'warning', sub: `${s.offresOuvertes ?? 0} ouvertes` },
      { label: 'Candidatures', value: s.candidaturesTotal ?? 0, icon: 'ti-file-description', color: 'primary', sub: `${s.candidaturesEnAttente ?? 0} en attente` },
      { label: 'Stages actifs', value: s.stagesEnCours ?? 0, icon: 'ti-school', color: 'success', sub: 'en cours' },
      { label: 'Stages terminés', value: s.stagesTermines ?? 0, icon: 'ti-circle-check', color: 'info', sub: 'terminés' },
      { label: 'Stages suspendus', value: s.stagesSuspendus ?? 0, icon: 'ti-alert-octagon', color: 'danger', sub: 'suspendus' }
    ];
  });

  alerts = computed(() => {
    const a = this.stats()?.alerts ?? {};
    return [
      { key: 'stagesSeTerminantSous7Jours', title: 'Fin sous 7 jours', icon: 'ti-alarm', color: 'danger', items: a.stagesSeTerminantSous7Jours ?? [], emptyMsg: 'Aucun stage ne se termine bientôt' },
      { key: 'evaluationsManquantes', title: 'Évaluations manquantes', icon: 'ti-report', color: 'warning', items: a.evaluationsManquantes ?? [], emptyMsg: 'Toutes les évaluations sont à jour' },
      { key: 'rapportsEnAttente', title: 'Rapports en attente', icon: 'ti-file-text', color: 'primary', items: a.rapportsEnAttente ?? [], emptyMsg: 'Aucun rapport en attente' },
      { key: 'offresExpirantBientot', title: 'Offres expirant bientôt', icon: 'ti-briefcase', color: 'info', items: a.offresExpirantBientot ?? [], emptyMsg: 'Aucune offre à risque' }
    ];
  });

  appsChart = computed<ApexOptions>(() => this._buildAppsChart());
  deptChart = computed<ApexOptions>(() => this._buildDeptChart());
  statusChart = computed<ApexOptions>(() => this._buildStatusChart());
  topSupChart = computed<ApexOptions>(() => this._buildTopSupChart());

  rhKpis = computed(() => {
    const s = this.stats() ?? {};
    const a = s.alerts ?? {};
    return [
      { label: 'Nouvelles candidatures', value: s.candidaturesNouvelles ?? 0, icon: 'ti-user-plus', color: 'primary', sub: '30 derniers jours' },
      { label: 'Candidatures en attente', value: s.candidaturesEnAttente ?? 0, icon: 'ti-clock', color: 'warning', sub: 'à traiter' },
      { label: 'Candidatures acceptées', value: s.candidaturesAcceptees ?? 0, icon: 'ti-circle-check', color: 'success', sub: 'admis' },
      { label: 'Candidatures refusées', value: s.candidaturesRefusees ?? 0, icon: 'ti-circle-x', color: 'danger', sub: 'rejetés' },
      { label: 'Offres ouvertes', value: s.offresOuvertes ?? 0, icon: 'ti-briefcase', color: 'success', sub: 'disponibles' },
      { label: 'Offres fermées', value: s.offresFermees ?? 0, icon: 'ti-lock', color: 'danger', sub: 'clôturées' },
      { label: 'Offres totales', value: s.offresTotal ?? 0, icon: 'ti-file-description', color: 'info', sub: 'au total' },
      { label: 'Stages cette semaine', value: (a.stagesDemarrantCetteSemaine ?? []).length, icon: 'ti-calendar', color: 'primary', sub: 'démarrent sous 7 jours' }
    ];
  });

  rhAlerts = computed(() => {
    const a = this.stats()?.alerts ?? {};
    return [
      { key: 'offresExpirantBientot', title: 'Offres expirant bientôt', icon: 'ti-briefcase', color: 'info', items: a.offresExpirantBientot ?? [], emptyMsg: 'Aucune offre à risque' },
      { key: 'documentsManquants', title: 'Documents manquants', icon: 'ti-file-alert', color: 'warning', items: a.documentsManquants ?? [], emptyMsg: 'Tous les documents sont déposés' },
      { key: 'entretiensAPrevoir', title: 'Entretiens à prévoir', icon: 'ti-calendar-stats', color: 'primary', items: a.entretiensAPrevoir ?? [], emptyMsg: 'Aucun entretien à planifier' },
      { key: 'stagesDemarrantCetteSemaine', title: 'Stages cette semaine', icon: 'ti-alarm', color: 'danger', items: a.stagesDemarrantCetteSemaine ?? [], emptyMsg: 'Aucun démarrage cette semaine' }
    ];
  });

  rhAppsDeptChart = computed<ApexOptions>(() => this._buildAppsDeptChart());
  rhRecruitChart = computed<ApexOptions>(() => this._buildRecruitChart());
  rhOffresDeptChart = computed<ApexOptions>(() => this._buildOffresDeptChart());

  encKpis = computed(() => {
    const s = this.stats() ?? {};
    const e = s.encadrant ?? {};
    return [
      { label: 'Mes stagiaires', value: e.stagiairesTotal ?? 0, icon: 'ti-users', color: 'primary', sub: `${e.stagiairesActifs ?? 0} en stage actif` },
      { label: 'Stages actifs', value: s.stagesEnCours ?? 0, icon: 'ti-school', color: 'success', sub: 'encadrés' },
      { label: 'Mes réunions', value: e.reunionsTotal ?? 0, icon: 'ti-calendar-event', color: 'info', sub: `${e.reunionsAVenir ?? 0} à venir` },
      { label: 'Mes tâches', value: s.tachesTotal ?? 0, icon: 'ti-checklist', color: 'warning', sub: `${s.tachesEnRetard ?? 0} en retard` },
      { label: 'Rapports à valider', value: e.rapportsAValider ?? 0, icon: 'ti-file-text', color: 'danger', sub: 'en attente' }
    ];
  });

  encAlerts = computed(() => {
    const a = this.stats()?.alerts ?? {};
    const e = this.stats()?.encadrant ?? {};
    return [
      { key: 'tachesEnRetard', title: 'Tâches en retard', icon: 'ti-alarm', color: 'danger', items: e.tachesEnRetard ?? [], emptyMsg: 'Aucune tâche en retard' },
      { key: 'rapportsSoumis', title: 'Rapports soumis', icon: 'ti-file-text', color: 'primary', items: e.rapportsSoumis ?? [], emptyMsg: 'Aucun rapport soumis' },
      { key: 'evaluationsManquantes', title: 'Évaluations en attente', icon: 'ti-report', color: 'warning', items: a.evaluationsManquantes ?? [], emptyMsg: 'Toutes les évaluations sont faites' },
      { key: 'stagesSeTerminantSous7Jours', title: 'Stages se terminant', icon: 'ti-alarm', color: 'info', items: a.stagesSeTerminantSous7Jours ?? [], emptyMsg: 'Aucun stage ne se termine bientôt' }
    ];
  });

  encTaskChart = computed<ApexOptions>(() => this._buildTaskChart());
  encInternshipsChart = computed<ApexOptions>(() => this._buildInternshipsChart());
  encTasksStatusChart = computed<ApexOptions>(() => this._buildTasksStatusChart());
  encMeetingsChart = computed<ApexOptions>(() => this._buildMeetingsChart());

  ngOnInit() {
    this.loadStats();
    this.loadRecentTaches();
  }

  loadStats() {
    this.loading.set(true);
    this.dashboardService.getStats().subscribe({
      next: (data: any) => {
        this.stats.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        console.error('loadStats error:', err);
        this.errorMessage.set(`Erreur Stats: ${err.message || 'Erreur réseau/CORS'}`);
      }
    });
  }

  loadRecentTaches() {
    this.taskService.getMyTaches().subscribe({
      next: (data: any) => this.recentTaches.set(Array.isArray(data) ? data.slice(0, 5) : []),
      error: (err) => {
        console.error('loadRecentTaches error:', err);
        if (!this.errorMessage()) {
          this.errorMessage.set(`Erreur Tâches: ${err.message || 'Erreur réseau/CORS'}`);
        }
      }
    });
  }

  getPriorityBadge(priority: string): string {
    switch (priority) {
      case 'HAUTE': case 'URGENTE': return 'badge bg-danger';
      case 'MOYENNE': return 'badge bg-warning';
      default: return 'badge bg-info';
    }
  }

  getStatusBadge(status: string): string {
    switch (status) {
      case 'TERMINEE': return 'badge bg-success';
      case 'EN_COURS': return 'badge bg-primary';
      case 'BLOQUEE': return 'badge bg-danger';
      default: return 'badge bg-secondary';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'TERMINEE': return 'Terminée';
      case 'EN_COURS': return 'En cours';
      case 'A_FAIRE': return 'À faire';
      case 'BLOQUEE': return 'Bloquée';
      default: return status;
    }
  }

  getStageStatusBadge(statut: string): string {
    switch (statut) {
      case 'EN_COURS': return 'badge bg-primary';
      case 'TERMINE': return 'badge bg-success';
      case 'SUSPENDU': return 'badge bg-warning';
      case 'ANNULE': return 'badge bg-secondary';
      default: return 'badge bg-secondary';
    }
  }

  getStageStatusLabel(statut: string): string {
    return STATUS_LABELS[statut] ?? statut;
  }

  getCandStatusBadge(statut: string): string {
    switch (statut) {
      case 'ACCEPTEE': return 'badge bg-success';
      case 'REFUSEE': return 'badge bg-danger';
      case 'AI_INTERVIEW_PASSED': return 'badge bg-success';
      case 'AI_INTERVIEW_FAILED': return 'badge bg-danger';
      case 'RH_ACCEPTED': return 'badge bg-info text-dark';
      default: return 'badge bg-warning';
    }
  }

  getCandStatusLabel(statut: string): string {
    switch (statut) {
      case 'ACCEPTEE': return 'Acceptée';
      case 'REFUSEE': return 'Refusée';
      case 'AI_INTERVIEW_PASSED': return 'Entretien IA réussi';
      case 'AI_INTERVIEW_FAILED': return 'Entretien IA échoué';
      case 'RH_ACCEPTED': return 'Acceptée pour entretien IA';
      case 'EN_ENTRETIEN_IA': return 'En entretien IA';
      default: return 'En attente';
    }
  }

  getDocIcon(type: string): string {
    switch (type) {
      case 'CV': return 'ti-id-badge';
      case 'CONVENTION': return 'ti-file-signature';
      case 'ASSURANCE': return 'ti-shield-check';
      case 'RAPPORT': return 'ti-file-text';
      case 'ATTESTATION': return 'ti-certificate';
      default: return 'ti-file';
    }
  }

  alertItemTitle(item: any): string {
    if (item.titre) return item.titre;
    if (item.sujet) return item.sujet;
    if (item.stagiaire_prenom) return `${item.stagiaire_prenom} ${item.stagiaire_nom}`;
    return item.type ?? '';
  }

  alertItemSub(item: any): string {
    if (item.departement_nom) return item.departement_nom;
    if (item.executant_prenom) return `${item.executant_prenom} ${item.executant_nom}`;
    return item.type ?? '';
  }

  alertItemDate(item: any): string {
    return item.date_fin ?? item.date_limite ?? item.date ?? item.date_debut ?? '';
  }

  getProgress(): number {
    const s = this.stats();
    if (!s || !s.tachesTotal || s.tachesTotal === 0) return 0;
    return Math.round((s.tachesTerminees / s.tachesTotal) * 100);
  }

  getRoleLabel(): string {
    return ROLE_LABELS[this.currentUser()?.role ?? ''] ?? 'Utilisateur';
  }

  summary = computed<SummaryItem[]>(() => {
    const s = this.stats() ?? {};
    const a = s.alerts ?? {};
    const e = s.encadrant ?? {};
    const meetingsToday = (s.prochainesReunions ?? []).filter((r: any) => this.isToday(r.date)).length;
    const stagesToday = (s.prochainsStages ?? []).filter((st: any) => this.isToday(st.date_debut)).length;

    if (this.isAdmin()) {
      return [
        { label: 'Stages aujourd\'hui', value: stagesToday, icon: 'ti-school', color: 'primary', sub: 'qui démarrent' },
        { label: 'Réunions aujourd\'hui', value: meetingsToday, icon: 'ti-calendar-event', color: 'info', sub: 'à venir' },
        { label: 'Candidatures en attente', value: s.candidaturesEnAttente ?? 0, icon: 'ti-file-description', color: 'warning', sub: 'à traiter' },
        { label: 'Rapports en attente', value: (a.rapportsEnAttente ?? []).length, icon: 'ti-file-text', color: 'danger', sub: 'à valider' },
        { label: 'Évaluations manquantes', value: (a.evaluationsManquantes ?? []).length, icon: 'ti-report', color: 'success', sub: 'à remplir' }
      ];
    }

    if (this.isRH()) {
      return [
        { label: 'Candidatures nouvelles', value: s.candidaturesNouvelles ?? 0, icon: 'ti-user-plus', color: 'primary', sub: '30 derniers jours' },
        { label: 'Candidatures en attente', value: s.candidaturesEnAttente ?? 0, icon: 'ti-clock', color: 'warning', sub: 'de décision' },
        { label: 'Entretiens à prévoir', value: (a.entretiensAPrevoir ?? []).length, icon: 'ti-calendar-stats', color: 'info', sub: 'à planifier' },
        { label: 'Documents manquants', value: (a.documentsManquants ?? []).length, icon: 'ti-file-alert', color: 'danger', sub: 'à collecter' },
        { label: 'Stages cette semaine', value: (a.stagesDemarrantCetteSemaine ?? []).length, icon: 'ti-calendar', color: 'success', sub: 'démarrent bientôt' }
      ];
    }

    if (this.isEncadrant()) {
      return [
        { label: 'Stagiaires actifs', value: e.stagiairesActifs ?? 0, icon: 'ti-users', color: 'primary', sub: 'en stage' },
        { label: 'Réunions aujourd\'hui', value: meetingsToday, icon: 'ti-calendar-event', color: 'info', sub: 'à venir' },
        { label: 'Tâches du jour', value: (e.tachesDuJour ?? []).length, icon: 'ti-checklist', color: 'warning', sub: 'aujourd\'hui' },
        { label: 'Rapports à valider', value: e.rapportsAValider ?? 0, icon: 'ti-file-text', color: 'danger', sub: 'en attente' },
        { label: 'Évaluations en attente', value: (a.evaluationsManquantes ?? []).length, icon: 'ti-report', color: 'success', sub: 'à remplir' }
      ];
    }

    return [
      { label: 'Stages en cours', value: s.stagesEnCours ?? 0, icon: 'ti-school', color: 'success', sub: 'actifs' },
      { label: 'Tâches en cours', value: s.tachesEnCours ?? 0, icon: 'ti-clock', color: 'warning', sub: 'en cours' },
      { label: 'Tâches en retard', value: s.tachesEnRetard ?? 0, icon: 'ti-alarm', color: 'danger', sub: 'à traiter' },
      { label: 'Réunions à venir', value: (s.prochainesReunions ?? []).length, icon: 'ti-calendar-event', color: 'info', sub: 'planifiées' },
      { label: 'Candidatures en attente', value: s.candidaturesEnAttente ?? 0, icon: 'ti-file-description', color: 'primary', sub: 'à traiter' }
    ];
  });

  quickActions = computed<QuickAction[]>(() => {
    if (this.isAdmin() || this.isRH()) {
      return [
        { label: 'Créer un stage', icon: 'ti-school', color: 'primary', route: '/stages' },
        { label: 'Créer une réunion', icon: 'ti-calendar-event', color: 'info', route: '/reunions' },
        { label: 'Assigner une tâche', icon: 'ti-checklist', color: 'warning', route: '/taches' },
        { label: 'Voir les candidatures', icon: 'ti-file-description', color: 'success', route: '/candidatures' },
        { label: 'Générer un PDF', icon: 'ti-file-download', color: 'danger', action: () => this.generatePdf() }
      ];
    }

    if (this.isEncadrant()) {
      return [
        { label: 'Créer une réunion', icon: 'ti-calendar-event', color: 'info', route: '/reunions' },
        { label: 'Assigner une tâche', icon: 'ti-checklist', color: 'warning', route: '/taches' },
        { label: 'Voir les stages', icon: 'ti-school', color: 'primary', route: '/stages' },
        { label: 'Voir les évaluations', icon: 'ti-star', color: 'success', route: '/evaluations' },
        { label: 'Générer un PDF', icon: 'ti-file-download', color: 'danger', action: () => this.generatePdf() }
      ];
    }

    if (this.isStagiaire()) {
      return [
        { label: 'Mes stages', icon: 'ti-school', color: 'primary', route: '/stages' },
        { label: 'Mes réunions', icon: 'ti-calendar-event', color: 'info', route: '/reunions' },
        { label: 'Mes tâches', icon: 'ti-checklist', color: 'warning', route: '/taches' },
        { label: 'Mes évaluations', icon: 'ti-star', color: 'success', route: '/evaluations' },
        { label: 'Mon attestation', icon: 'ti-file-download', color: 'danger', action: () => this.generatePdf() }
      ];
    }

    return [
      { label: 'Créer un stage', icon: 'ti-school', color: 'primary', route: '/stages' },
      { label: 'Créer une réunion', icon: 'ti-calendar-event', color: 'info', route: '/reunions' },
      { label: 'Voir les stagiaires', icon: 'ti-users', color: 'warning', route: '/stagiaires' },
      { label: 'Voir les encadrants', icon: 'ti-user-check', color: 'success', route: '/encadrants' },
      { label: 'Générer un PDF', icon: 'ti-file-download', color: 'danger', action: () => this.generatePdf() }
    ];
  });

  runAction(action: QuickAction): void {
    if (action.action) {
      action.action();
    } else if (action.route) {
      this.router.navigate([action.route]);
    }
  }

  generatePdf(): void {
    const s = this.stats() ?? {};
    const stages = [...(s.recentStages ?? []), ...(s.prochainsStages ?? [])];
    const stage = stages.find((st: any) => st.statut === 'EN_COURS') ?? stages[0] ?? null;
    if (stage?.id) {
      const type = this.isStagiaire() ? 'attestation' : 'convention';
      window.open(this.internshipService.downloadPdf(stage.id, type), '_blank');
    } else {
      this.router.navigate(['/stages']);
    }
  }

  private isToday(value: string | undefined): boolean {
    if (!value) return false;
    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (match) return match[0] === todayStr;
    const d = new Date(value);
    if (isNaN(d.getTime())) return false;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` === todayStr;
  }

  private _buildAppsChart(): ApexOptions {
    const rows = this.stats()?.applicationsParMois ?? [];
    return {
      series: [{ name: 'Candidatures', data: rows.map((r: any) => r.total) }],
      chart: { type: 'area', height: 280, toolbar: { show: false } },
      colors: [C.primary],
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 3 },
      fill: { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0.05 } },
      xaxis: { categories: rows.map((r: any) => r.libelle), axisBorder: { show: false }, axisTicks: { show: false } },
      grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
      noData: { text: 'Aucune candidature', align: 'center', verticalAlign: 'middle' }
    };
  }

  private _buildDeptChart(): ApexOptions {
    const rows = this.stats()?.stagesParDepartement ?? [];
    return {
      series: [{ name: 'Stages', data: rows.map((r: any) => r.total) }],
      chart: { type: 'bar', height: 280, toolbar: { show: false } },
      colors: [C.primary],
      plotOptions: { bar: { columnWidth: '45%', borderRadius: 4 } },
      dataLabels: { enabled: false },
      xaxis: { categories: rows.map((r: any) => r.departement) },
      grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
      noData: { text: 'Aucun stage', align: 'center', verticalAlign: 'middle' }
    };
  }

  private _buildStatusChart(): ApexOptions {
    const rows = this.stats()?.repartitionStatutsStages ?? [];
    return {
      series: rows.map((r: any) => r.total),
      chart: { type: 'donut', height: 280 },
      labels: rows.map((r: any) => STATUS_LABELS[r.statut] ?? r.statut),
      colors: [C.primary, C.success, C.warning, '#9ca3af'],
      dataLabels: { enabled: true, formatter: (val: number) => `${Math.round(val)}%` },
      legend: { position: 'bottom' },
      plotOptions: { pie: { donut: { size: '72%' } } },
      noData: { text: 'Aucun stage', align: 'center', verticalAlign: 'middle' }
    };
  }

  private _buildTopSupChart(): ApexOptions {
    const rows = this.stats()?.topEncadrants ?? [];
    return {
      series: [{ name: 'Stagiaires', data: rows.map((r: any) => r.nb_stages) }],
      chart: { type: 'bar', height: 280, toolbar: { show: false } },
      colors: [C.success],
      plotOptions: { bar: { horizontal: true, barHeight: '40%', borderRadius: 4 } },
      dataLabels: { enabled: true, formatter: (val: number) => String(val) },
      xaxis: { categories: rows.map((r: any) => `${r.prenom} ${r.nom}`) },
      grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
      noData: { text: 'Aucun encadrant', align: 'center', verticalAlign: 'middle' }
    };
  }

  private _buildAppsDeptChart(): ApexOptions {
    const rows = this.stats()?.applicationsParDepartement ?? [];
    return {
      series: [
        { name: 'Total', data: rows.map((r: any) => r.total) },
        { name: 'Acceptées', data: rows.map((r: any) => r.acceptees) }
      ],
      chart: { type: 'bar', height: 280, toolbar: { show: false } },
      colors: [C.primary, C.success],
      plotOptions: { bar: { columnWidth: '45%', borderRadius: 4 } },
      dataLabels: { enabled: false },
      xaxis: { categories: rows.map((r: any) => r.departement) },
      legend: { position: 'top' },
      grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
      noData: { text: 'Aucune candidature', align: 'center', verticalAlign: 'middle' }
    };
  }

  private _buildRecruitChart(): ApexOptions {
    const rows = this.stats()?.recrutementStatistiques ?? [];
    return {
      series: rows.map((r: any) => r.total),
      chart: { type: 'donut', height: 280 },
      labels: rows.map((r: any) => this.getCandStatusLabel(r.statut)),
      colors: [C.success, C.danger, C.warning, C.primary],
      dataLabels: { enabled: true, formatter: (val: number) => `${Math.round(val)}%` },
      legend: { position: 'bottom' },
      plotOptions: { pie: { donut: { size: '72%' } } },
      noData: { text: 'Aucune candidature', align: 'center', verticalAlign: 'middle' }
    };
  }

  private _buildOffresDeptChart(): ApexOptions {
    const rows = this.stats()?.offresParDepartement ?? [];
    return {
      series: [
        { name: 'Ouvertes', data: rows.map((r: any) => r.ouvertes) },
        { name: 'Fermées', data: rows.map((r: any) => r.fermees) }
      ],
      chart: { type: 'bar', height: 280, stacked: true, toolbar: { show: false } },
      colors: [C.success, C.danger],
      plotOptions: { bar: { columnWidth: '45%', borderRadius: 4 } },
      dataLabels: { enabled: false },
      xaxis: { categories: rows.map((r: any) => r.departement) },
      legend: { position: 'top' },
      grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
      noData: { text: 'Aucune offre', align: 'center', verticalAlign: 'middle' }
    };
  }

  private _buildTaskChart(): ApexOptions {
    const s = this.stats() ?? {};
    const total = s.tachesTotal ?? 0;
    const done = s.tachesTerminees ?? 0;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return {
      series: [pct],
      chart: { type: 'radialBar', height: 280 },
      labels: ['Tâches terminées'],
      colors: [C.success],
      plotOptions: {
        radialBar: {
          hollow: { size: '60%' },
          dataLabels: {
            name: { show: true, fontSize: '14px', offsetY: 20 },
            value: { fontSize: '24px', formatter: (v: number) => `${v}%` }
          }
        }
      },
      noData: { text: 'Aucune tâche', align: 'center', verticalAlign: 'middle' }
    };
  }

  private _buildInternshipsChart(): ApexOptions {
    const rows = this.stats()?.encadrant?.progressStages ?? [];
    return {
      series: [{ name: 'Progression', data: rows.map((r: any) => r.progress) }],
      chart: { type: 'bar', height: 280, toolbar: { show: false } },
      colors: [C.primary],
      plotOptions: { bar: { horizontal: true, barHeight: '40%', borderRadius: 4 } },
      dataLabels: { enabled: true, formatter: (val: number) => `${val}%` },
      xaxis: { categories: rows.map((r: any) => `${r.stagiaire_prenom} ${r.stagiaire_nom}`), max: 100 },
      grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
      noData: { text: 'Aucun stage actif', align: 'center', verticalAlign: 'middle' }
    };
  }

  private _buildTasksStatusChart(): ApexOptions {
    const s = this.stats() ?? {};
    const data = [
      { label: 'À faire', value: s.tachesAFaire ?? 0 },
      { label: 'En cours', value: s.tachesEnCours ?? 0 },
      { label: 'Terminées', value: s.tachesTerminees ?? 0 },
      { label: 'Bloquées', value: s.tachesBloquees ?? 0 }
    ].filter((d) => d.value > 0);
    return {
      series: data.map((d) => d.value),
      chart: { type: 'donut', height: 280 },
      labels: data.map((d) => d.label),
      colors: [C.warning, C.primary, C.success, C.danger],
      dataLabels: { enabled: true, formatter: (val: number) => `${Math.round(val)}%` },
      legend: { position: 'bottom' },
      plotOptions: { pie: { donut: { size: '72%' } } },
      noData: { text: 'Aucune tâche', align: 'center', verticalAlign: 'middle' }
    };
  }

  private _buildMeetingsChart(): ApexOptions {
    const rows = this.stats()?.encadrant?.reunionsParMois ?? [];
    return {
      series: [{ name: 'Réunions', data: rows.map((r: any) => r.total) }],
      chart: { type: 'bar', height: 280, toolbar: { show: false } },
      colors: [C.info],
      plotOptions: { bar: { columnWidth: '45%', borderRadius: 4 } },
      dataLabels: { enabled: false },
      xaxis: { categories: rows.map((r: any) => r.libelle) },
      grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
      noData: { text: 'Aucune réunion', align: 'center', verticalAlign: 'middle' }
    };
  }
}
