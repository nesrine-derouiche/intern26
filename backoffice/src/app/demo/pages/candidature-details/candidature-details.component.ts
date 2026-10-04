import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SHARED_IMPORTS } from 'src/app/theme/shared/shared.module';
import { ApplicationService } from 'src/app/core/data/application.service';
import { AuthService } from 'src/app/core/data/auth.service';

@Component({
  selector: 'app-candidature-details',
  imports: [...SHARED_IMPORTS],
  templateUrl: './candidature-details.component.html',
  styleUrl: './candidature-details.component.scss'
})
export class CandidatureDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private applicationService = inject(ApplicationService);
  private authService = inject(AuthService);

  details = signal<any>(null);
  loading = signal(true);
  notFound = signal(false);
  busy = signal(false);
  success = signal('');
  error = signal('');

  readiness = signal<any>(null);
  readinessLoading = signal(true);
  readinessError = signal('');

  showScheduleModal = signal(false);
  showCancelModal = signal(false);
  showCompleteModal = signal(false);
  showDecisionModal = signal(false);
  pendingDecision = signal<'ACCEPTED' | 'REJECTED' | null>(null);
  editMode = signal(false);
  showDocumentModal = signal(false);
  pendingDocument = signal<any>(null);
  documentDecision = signal<'VALID' | 'REJECTED' | null>(null);
  documentRejectedReason = signal('');
  showConvertModal = signal(false);
  trainee = signal<any>(null);
  scheduleForm: any = {
    date: '',
    heure: '',
    duree: 45,
    interviewer: '',
    interviewer_email: '',
    lien_visio: ''
  };

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }
    this.applicationService.getById(id).subscribe({
      next: (d) => {
        this.details.set(d);
        this.loading.set(false);
        this.loadReadiness(id);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 403) {
          this.error.set('Accès refusé : seuls le RH et l’Administrateur peuvent consulter une candidature.');
        } else {
          this.notFound.set(true);
        }
      }
    });
  }

  /** Charge l'éligibilité du dossier (déterminée par le backend). */
  loadReadiness(id: string) {
    this.readinessLoading.set(true);
    this.readinessError.set('');
    this.applicationService.getInternshipReadiness(id).subscribe({
      next: (r) => {
        this.readiness.set(r);
        this.readinessLoading.set(false);
      },
      error: (err) => {
        this.readinessLoading.set(false);
        this.readinessError.set(err.error?.message || 'Impossible de vérifier l’état du dossier.');
      }
    });
  }

  isDecider(): boolean {
    return ['RH', 'ADMIN'].includes(this.authService.currentUser()?.role ?? '');
  }

  /** Classe CSS du badge d'état d'évaluation IA. */
  aiStatusBadge(ai: any): string {
    const status = ai?.evaluation_status;
    if (status === 'EVALUEE') return 'badge bg-success';
    if (status === 'INDISPONIBLE') return 'badge bg-warning text-dark';
    return 'badge bg-secondary';
  }

  /** Libellé d'état d'évaluation IA. */
  aiStatusLabel(ai: any): string {
    const status = ai?.evaluation_status;
    if (status === 'EVALUEE') return 'Évaluée';
    if (status === 'INDISPONIBLE') return 'Indisponible';
    return 'En attente';
  }

  /** Pourcentage de réussite de l'entretien IA (0-100). */
  aiScorePercent(ai: any): string {
    const v = ai?.evaluation?.score_global ?? ai?.evaluation?.score;
    if (typeof v !== 'number' || Number.isNaN(v)) return '—';
    return `${Math.round(Math.max(0, Math.min(100, v)))}%`;
  }

  /** Recommandation de l'évaluation IA (FAVORABLE / DÉFAVORABLE). */
  aiRecommendation(ai: any): string {
    const r = ai?.evaluation?.recommendation;
    return typeof r === 'string' && r.trim() ? r : '—';
  }

  canDecide(): boolean {
    return this.isDecider() && this.details()?.statut === 'EN_ATTENTE';
  }

  /** La candidature a réussi l'entretien IA : le RH peut planifier l'entretien humain. */
  canSchedule(): boolean {
    return this.isDecider() && this.details()?.statut === 'AI_INTERVIEW_PASSED';
  }

  /** Un entretien humain actif est planifié (affichage + actions modifier/annuler). */
  hasActiveInterview(): boolean {
    const hi = this.details()?.human_interview;
    return !!hi && hi.statut === 'PLANIFIE';
  }

  /** L'entretien humain a été complété par le RH. */
  isInterviewCompleted(): boolean {
    const d = this.details();
    return (
      d?.statut === 'HUMAN_INTERVIEW_COMPLETED' &&
      !!d.human_interview &&
      d.human_interview.statut === 'HUMAN_INTERVIEW_COMPLETED'
    );
  }

  /** Une décision finale a déjà été enregistrée. */
  hasDecision(): boolean {
    return !!this.details()?.decision;
  }

  /** Le RH peut prendre la décision finale : entretien complété et pas encore décidé. */
  canDecideHumanInterview(): boolean {
    return this.isDecider() && this.isInterviewCompleted() && !this.hasDecision();
  }

  /** Le candidat accepté a-t-il renseigné sa période de stage souhaitée ? */
  hasStagePreferences(): boolean {
    return !!this.details()?.internship_details_submitted_at;
  }

  /** La période de stage du candidat a été validée par le RH (figée). */
  isStagePeriodValidated(): boolean {
    return !!this.details()?.internship_period_validated_at;
  }

  /** État de l'accès à l'application mobile de la candidature. */
  mobileAccess(): any {
    return this.details()?.mobile_access || null;
  }

  /** L'email d'accès (J-1) est-il déjà dû (date d'envoi prévue atteinte) ? */
  isMobileEmailDue(): boolean {
    const planned = this.mobileAccess()?.email_planned_for;
    if (!planned) return false;
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }));
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    return planned <= todayStr;
  }

  /** Libellé d'état de l'accès application mobile. */
  mobileAccessStateLabel(): string {
    const ma = this.mobileAccess();
    if (!ma) return '—';
    if (ma.email_state === 'SENT') return 'Email d\'accès envoyé';
    if (ma.email_state === 'ERROR') return 'Erreur d\'envoi — nouvelle tentative prévue';
    if (this.isMobileEmailDue()) return 'Email d\'accès programmé';
    return 'Compte en préparation';
  }

  /** Classe de badge associée à l'état d'accès mobile. */
  mobileAccessBadgeClass(): string {
    const ma = this.mobileAccess();
    if (!ma) return 'badge bg-secondary';
    if (ma.email_state === 'SENT') return 'badge bg-success';
    if (ma.email_state === 'ERROR') return 'badge bg-danger';
    if (this.isMobileEmailDue()) return 'badge bg-info text-dark';
    return 'badge bg-warning text-dark';
  }

  /** Date d'envoi prévue de l'email d'accès (DD/MM/YYYY). */
  mobileAccessPlannedDate(): string {
    const planned = this.mobileAccess()?.email_planned_for;
    if (!planned) return '—';
    const [y, m, d] = String(planned).split('-');
    return `${d}/${m}/${y}`;
  }

  /** Date d'envoi effectif de l'email d'accès (ou null). */
  mobileAccessSentAt(): string | null {
    return this.mobileAccess()?.email_sent_at || null;
  }

  /** Le RH peut valider la période : accepté après entretien humain, période soumise et non validée. */
  canValidateStagePeriod(): boolean {
    return this.isDecider() && this.hasStagePreferences() && !this.isStagePeriodValidated();
  }

  /** Valide la période de stage du candidat. */
  validateStagePeriod() {
    const d = this.details();
    if (!d || this.busy()) return;
    if (!confirm('Valider la période de stage du candidat ? La période sera figée et ne pourra plus être modifiée.')) return;
    this.busy.set(true);
    this.success.set('');
    this.error.set('');
    this.applicationService.validateStagePeriod(d.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.success.set('La période de stage a été validée.');
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err.error?.message || 'Erreur lors de la validation de la période de stage.');
      }
    });
  }

  /** Demande au candidat de modifier sa période de stage. */
  requestStagePeriodModification() {
    const d = this.details();
    if (!d || this.busy()) return;
    if (!confirm('Demander au candidat de modifier sa période de stage ?')) return;
    this.busy.set(true);
    this.success.set('');
    this.error.set('');
    this.applicationService.requestStagePeriodModification(d.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.success.set('Une modification de la période de stage a été demandée au candidat.');
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err.error?.message || 'Erreur lors de la demande de modification.');
      }
    });
  }

  /** Durée de stage affichée au singulier/pluriel. */
  formatDuration(months: number): string {
    return months === 1 ? '1 mois' : `${months} mois`;
  }

  /** La candidature a déjà été convertie en stagiaire. */
  isConverted(): boolean {
    return this.details()?.statut === 'STAGIAIRE_CREATED';
  }

  /** Un stagiaire a déjà été créé pour cette candidature (chargé ou réponse de conversion). */
  stageCreated(): boolean {
    return !!this.trainee() || !!this.details()?.stage_created;
  }

  /** Le RH/Admin peut créer le stagiaire : dossier complet, période validée, non déjà converti. */
  canConvertToTrainee(): boolean {
    return (
      this.isDecider() &&
      this.details()?.statut === 'HUMAN_INTERVIEW_ACCEPTED' &&
      this.isStagePeriodValidated() &&
      this.dossierReady() &&
      !this.isConverted()
    );
  }

  openConvertModal() {
    this.error.set('');
    this.showConvertModal.set(true);
  }

  keepConvert() {
    this.showConvertModal.set(false);
  }

  confirmConvert() {
    const d = this.details();
    if (!d || this.busy()) return;
    this.showConvertModal.set(false);
    this.busy.set(true);
    this.error.set('');
    this.applicationService.convertToTrainee(d.id).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.trainee.set({
          stagiaire_id: res?.stagiaire_id || res?.stagiaire?.id || null,
          stage_id: res?.stage_id || null,
          stagiaire: res?.stagiaire || null,
          stage: res?.stage || null
        });
        this.success.set('Le stagiaire a été créé avec succès.');
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err.error?.message || 'Erreur lors de la création du stagiaire.');
      }
    });
  }

  openDecision(decision: 'ACCEPTED' | 'REJECTED') {
    this.error.set('');
    this.pendingDecision.set(decision);
    this.showDecisionModal.set(true);
  }

  keepDecision() {
    this.showDecisionModal.set(false);
    this.pendingDecision.set(null);
  }

  confirmHumanDecision() {
    const d = this.details();
    const decision = this.pendingDecision();
    if (!d || !decision || this.busy()) return;
    this.showDecisionModal.set(false);
    this.pendingDecision.set(null);
    this.busy.set(true);
    this.applicationService.decideHumanInterview(d.id, decision).subscribe({
      next: () => {
        this.busy.set(false);
        this.success.set(decision === 'ACCEPTED' ? 'Candidat accepté après l’entretien humain.' : 'Candidat refusé après l’entretien humain.');
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err.error?.message || 'Erreur lors de la décision finale.');
      }
    });
  }

  decisionLabel(decision: string): string {
    switch (decision) {
      case 'ACCEPTED': return 'Accepté';
      case 'REJECTED': return 'Refusé';
      case 'CONVERTED': return 'Converti en stagiaire';
      case 'VALIDATED': return 'Période validée';
      case 'MODIFICATION_REQUESTED': return 'Modification demandée';
      default: return decision;
    }
  }

  decisionBadgeClass(decision: string): string {
    switch (decision) {
      case 'ACCEPTED': return 'badge bg-success';
      case 'REJECTED': return 'badge bg-danger';
      case 'CONVERTED': return 'badge bg-success';
      case 'VALIDATED': return 'badge bg-info text-dark';
      case 'MODIFICATION_REQUESTED': return 'badge bg-warning text-dark';
      default: return 'badge bg-secondary';
    }
  }

  /** Le créneau planifié est-il déjà passé (date + heure, fuseau Africa/Tunis) ? */
  hasInterviewPassed(): boolean {
    const hi = this.details()?.human_interview;
    if (!hi?.date) return false;
    const instant = new Date(`${hi.date}T${this.formatTime(hi.heure) || '00:00'}:00Z`);
    if (Number.isNaN(instant.getTime())) return false;
    return instant.getTime() < new Date().getTime();
  }

  /** Le RH peut marquer l'entretien comme terminé : planifié et créneau passé. */
  canCompleteInterview(): boolean {
    return (
      this.isDecider() &&
      this.details()?.statut === 'EN_ENTRETIEN_HUMAIN' &&
      this.hasActiveInterview() &&
      this.hasInterviewPassed()
    );
  }

  openComplete() {
    this.error.set('');
    this.showCompleteModal.set(true);
  }

  keepComplete() {
    this.showCompleteModal.set(false);
  }

  confirmCompleteInterview() {
    const d = this.details();
    if (!d || this.busy()) return;
    this.showCompleteModal.set(false);
    this.busy.set(true);
    this.applicationService.completeHumanInterview(d.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.success.set('Human interview completed');
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err.error?.message || 'Erreur lors de la validation de l’entretien.');
      }
    });
  }

  openSchedule() {
    this.scheduleForm = { date: '', heure: '', duree: 45, interviewer: '', interviewer_email: '', lien_visio: '' };
    this.editMode.set(false);
    this.error.set('');
    this.showScheduleModal.set(true);
  }

  /** Raccourci démo : planifie l'entretien humain avec des valeurs par défaut et envoie l'email en un clic. */
  scheduleExpress() {
    const d = this.details();
    if (!d?.id) return;
    this.busy.set(true);
    this.error.set('');
    this.applicationService.scheduleExpressHumanInterview(d.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.success.set('Entretien humain planifié : email d\'invitation envoyé au candidat.');
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err.error?.message || 'Erreur lors de la planification rapide.');
      }
    });
  }

  openEdit() {
    const hi = this.details()?.human_interview;
    if (!hi) return;
    this.scheduleForm = {
      date: hi.date || '',
      heure: this.formatTime(hi.heure),
      duree: hi.duree ?? 45,
      interviewer: hi.interviewer || '',
      interviewer_email: hi.interviewer_email || '',
      lien_visio: hi.lien_visio || ''
    };
    this.editMode.set(true);
    this.error.set('');
    this.showScheduleModal.set(true);
  }

  closeScheduleModal() {
    this.showScheduleModal.set(false);
  }

  submitSchedule() {
    const f = this.scheduleForm;
    const validationError = this.validateScheduleForm();
    if (validationError) {
      this.error.set(validationError);
      return;
    }
    this.busy.set(true);
    this.error.set('');
    const payload = {
      date: f.date,
      heure: f.heure,
      duree: Number(f.duree),
      interviewer: f.interviewer.trim(),
      interviewer_email: f.interviewer_email.trim(),
      lien_visio: f.lien_visio.trim()
    };
    const call = this.editMode()
      ? this.applicationService.updateHumanInterview(this.details()!.id, payload)
      : this.applicationService.scheduleHumanInterview(this.details()!.id, payload);
    call.subscribe({
      next: () => {
        this.busy.set(false);
        this.closeScheduleModal();
        this.success.set(this.editMode() ? 'Entretien humain modifié.' : 'Entretien humain planifié.');
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err.error?.message || 'Erreur lors de la planification de l’entretien.');
      }
    });
  }

  validateScheduleForm(): string {
    const f = this.scheduleForm;
    if (!f.date || !f.heure || !f.duree || !f.interviewer?.trim() || !f.interviewer_email?.trim() || !f.lien_visio?.trim()) {
      return 'Tous les champs sont requis.';
    }
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }));
    const selected = new Date(`${f.date}T00:00:00`);
    if (Number.isNaN(selected.getTime()) || selected <= new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      return 'La date de l’entretien doit être dans le futur.';
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(f.heure)) {
      return 'L’heure de début doit être au format HH:MM.';
    }
    const duree = Number(f.duree);
    if (!Number.isInteger(duree) || duree <= 0 || duree > 600) {
      return 'La durée doit être un nombre de minutes entre 1 et 600.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.interviewer_email.trim())) {
      return 'L’email de l’intervieweur est invalide.';
    }
    let url: URL;
    try {
      url = new URL(f.lien_visio.trim());
    } catch {
      return 'Le lien de visioconférence doit être une URL valide.';
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return 'Le lien de visioconférence doit être une URL http(s) valide.';
    }
    return '';
  }

  cancelInterview() {
    const d = this.details();
    if (!d || this.busy()) return;
    this.error.set('');
    this.showCancelModal.set(true);
  }

  keepInterview() {
    this.showCancelModal.set(false);
  }

  confirmCancelInterview() {
    const d = this.details();
    if (!d || this.busy()) return;
    this.showCancelModal.set(false);
    this.busy.set(true);
    this.applicationService.cancelHumanInterview(d.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.success.set('Entretien humain annulé.');
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err.error?.message || 'Erreur lors de l’annulation de l’entretien.');
      }
    });
  }

  /** Heure HH:MM à partir d'une valeur HH:MM:SS éventuelle. */
  formatTime(value: string): string {
    return (value || '').slice(0, 5);
  }

  preselectForInterview() {
    if (!confirm('Accepter cette candidature pour l’entretien IA ?')) return;
    this.decide('RH_ACCEPTED', 'Candidature acceptée pour l’entretien IA.');
  }

  refuse() {
    this.decide('REFUSEE', 'Candidature refusée.');
  }

  private decide(statut: string, message: string) {
    const d = this.details();
    if (!d || this.busy()) return;
    this.busy.set(true);
    this.success.set('');
    this.applicationService.updateStatus(d.id, statut).subscribe({
      next: () => {
        this.busy.set(false);
        this.success.set(message);
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err.error?.message || 'Erreur lors de la mise à jour.');
      }
    });
  }

  downloadCv() {
    const d = this.details();
    if (!d?.cvUrl || this.busy()) return;
    this.applicationService.getCvBlob(d.cvUrl).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.download = d.cv?.originalName || 'cv.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => {
        this.error.set('Impossible de récupérer le CV.');
      }
    });
  }

  /** Documents du dossier de stage (dossier d'onboarding de la candidature). */
  onboardingDocuments(): any[] {
    return this.details()?.documents_onboarding?.documents || [];
  }

  /** Résumé de dépôt du dossier (ex : « 3 / 4 documents déposés »). */
  onboardingProgressLabel(): string {
    const docs = this.details()?.documents_onboarding;
    if (!docs) return '';
    return `${docs.submitted} / ${docs.total} documents déposés`;
  }

  documentTypeLabel(type: string): string {
    switch (type) {
      case 'CV': return 'CV';
      case 'CIN': return 'Carte d’identité (CIN)';
      case 'DEMANDE_STAGE': return 'Demande de stage';
      case 'LETTRE_AFFECTATION': return 'Lettre d’affectation';
      default: return type;
    }
  }

  /** Statut effectif d'un document — miroir du calcul backend/Flutter. */
  documentStatus(doc: any): string {
    if (!doc) return 'MANQUANT';
    const statut = doc.statut;
    const verification = doc.verification_status;
    if (statut === 'REJETE' || verification === 'REJECTED') return 'REJETE';
    if (verification === 'REVIEW_REQUIRED') return 'REVIEW_REQUIRED';
    if (verification === 'PENDING') return 'VERIFICATION';
    if (verification === 'VALID' || statut === 'VALIDE' || statut === 'VALID') return 'VALIDE';
    return statut || 'MANQUANT';
  }

  documentStatusLabel(doc: any): string {
    switch (this.documentStatus(doc)) {
      case 'REJETE': return 'Document rejeté';
      case 'REVIEW_REQUIRED': return 'Nécessite une vérification';
      case 'VERIFICATION': return 'Vérification en cours';
      case 'VALIDE': return 'Document validé';
      case 'EN_ATTENTE': return 'Document envoyé';
      default: return 'Document manquant';
    }
  }

  documentBadgeClass(doc: any): string {
    switch (this.documentStatus(doc)) {
      case 'REJETE': return 'badge bg-danger';
      case 'REVIEW_REQUIRED': return 'badge bg-warning text-dark';
      case 'VERIFICATION': return 'badge bg-info text-dark';
      case 'VALIDE': return 'badge bg-success';
      case 'EN_ATTENTE': return 'badge bg-secondary';
      default: return 'badge bg-light text-dark';
    }
  }

  /** Réduit le statut effectif d'un document aux 4 états du tableau de bord du dossier. */
  dossierDocState(doc: any): string {
    if (!doc) return 'MANQUANT';
    switch (doc.status) {
      case 'VALID': return 'VALID';
      case 'REJECTED': return 'REJECTED';
      case 'MANQUANT': return 'MANQUANT';
      default: return 'EN_ATTENTE';
    }
  }

  /** Ligne d'état d'un élément du dossier. */
  dossierItem(label: string, state: string): any {
    return { label, state, badgeClass: this.dossierBadgeClass(state) };
  }

  /** Items affichés dans la section « État du dossier ». */
  dossierItems(): any[] {
    const d = this.details();
    const r = this.readiness();
    const docs = (r?.documents || []).reduce(
      (acc: any, doc: any) => ({ ...acc, [doc.type]: doc }),
      {}
    );
    const interviewState = d?.statut === 'HUMAN_INTERVIEW_ACCEPTED' ? 'VALID' : d?.statut === 'HUMAN_INTERVIEW_REJECTED' ? 'REJECTED' : 'EN_ATTENTE';
    const periodState = d?.internship_period_validated_at ? 'VALID' : 'EN_ATTENTE';
    return [
      this.dossierItem('Entretien humain', interviewState),
      this.dossierItem('Période de stage', periodState),
      ...['CV', 'CIN', 'LETTRE_AFFECTATION', 'DEMANDE_STAGE'].map((type) =>
        this.dossierItem(this.documentTypeLabel(type), this.dossierDocState(docs[type]))
      )
    ];
  }

  /** Libellé d'un état du tableau de bord du dossier. */
  dossierStateLabel(state: string): string {
    switch (state) {
      case 'VALID': return 'Validé';
      case 'REJECTED': return 'Rejeté';
      case 'MANQUANT': return 'Manquant';
      default: return 'En attente';
    }
  }

  dossierBadgeClass(state: string): string {
    switch (state) {
      case 'VALID': return 'badge bg-success';
      case 'REJECTED': return 'badge bg-danger';
      case 'MANQUANT': return 'badge bg-secondary';
      default: return 'badge bg-warning text-dark';
    }
  }

  /** Le dossier est-il complet (tous les éléments requis par le backend) ? */
  dossierReady(): boolean {
    if (this.isConverted()) return true;
    return this.readiness()?.ready === true;
  }

  /** « Dossier complet » / « Dossier incomplet ». */
  dossierVerdictLabel(): string {
    return this.dossierReady() ? 'Dossier complet' : 'Dossier incomplet';
  }

  dossierVerdictBadgeClass(): string {
    return this.dossierReady() ? 'badge bg-success' : 'badge bg-danger';
  }

  /** Éléments manquants ou invalides du dossier (libellés). */
  dossierPendingItems(): string[] {
    if (this.isConverted()) return [];
    const r = this.readiness();
    if (!r) return [];
    return [...(r.missingDocuments || []), ...(r.invalidDocuments || [])].map((t) => this.documentTypeLabel(t));
  }

  /** Le RH/Admin peut trancher un document en attente de vérification manuelle. */
  canReviewDocument(doc: any): boolean {
    return this.isDecider() && !!doc?.id && doc.verification_status === 'REVIEW_REQUIRED';
  }

  openDocumentDecision(doc: any, decision: 'VALID' | 'REJECTED') {
    this.error.set('');
    this.documentRejectedReason.set('');
    this.pendingDocument.set(doc);
    this.documentDecision.set(decision);
    this.showDocumentModal.set(true);
  }

  keepDocumentDecision() {
    this.showDocumentModal.set(false);
    this.pendingDocument.set(null);
    this.documentDecision.set(null);
  }

  confirmDocumentDecision() {
    const d = this.details();
    const doc = this.pendingDocument();
    const decision = this.documentDecision();
    if (!d || !doc?.id || !decision || this.busy()) return;
    const reason = this.documentRejectedReason().trim();
    if (decision === 'REJECTED' && !reason) {
      this.error.set('Veuillez indiquer le motif du rejet.');
      return;
    }
    this.showDocumentModal.set(false);
    this.pendingDocument.set(null);
    this.documentDecision.set(null);
    this.busy.set(true);
    this.applicationService.decideDocumentVerification(d.id, doc.id, decision, reason || undefined).subscribe({
      next: () => {
        this.busy.set(false);
        this.success.set(
          decision === 'VALID'
            ? `Le document ${this.documentTypeLabel(doc.type)} a été validé.`
            : `Le document ${this.documentTypeLabel(doc.type)} a été rejeté.`
        );
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err.error?.message || 'Erreur lors de la décision sur le document.');
      }
    });
  }

  downloadOnboardingDocument(doc: any) {
    const d = this.details();
    if (!d?.id || !doc?.id || this.busy()) return;
    this.applicationService.downloadOnboardingDocument(d.id, doc.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.download = doc.nom || `${doc.type.toLowerCase()}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => {
        this.error.set('Impossible de récupérer le document.');
      }
    });
  }

  goBack() {
    this.router.navigate(['/candidatures']);
  }

  getStatutBadge(s: string): string {
    switch (s) {
      case 'ACCEPTEE': return 'badge bg-success';
      case 'REFUSEE': return 'badge bg-danger';
      case 'EN_ENTRETIEN_IA': return 'badge bg-info text-dark';
      case 'RH_ACCEPTED': return 'badge bg-info text-dark';
      case 'AI_INTERVIEW_PASSED': return 'badge bg-success';
      case 'AI_INTERVIEW_FAILED': return 'badge bg-danger';
      case 'EN_ENTRETIEN_HUMAIN': return 'badge bg-primary';
      case 'HUMAN_INTERVIEW_COMPLETED': return 'badge bg-success';
      case 'HUMAN_INTERVIEW_ACCEPTED': return 'badge bg-success';
      case 'HUMAN_INTERVIEW_REJECTED': return 'badge bg-danger';
      case 'STAGIAIRE_CREATED': return 'badge bg-primary';
      case 'EN_ATTENTE': return 'badge bg-warning text-dark';
      default: return 'badge bg-secondary';
    }
  }

  getStatutLabel(s: string): string {
    switch (s) {
      case 'ACCEPTEE': return 'Acceptée';
      case 'REFUSEE': return 'Refusée';
      case 'EN_ENTRETIEN_IA': return 'En entretien IA';
      case 'RH_ACCEPTED': return 'Acceptée pour entretien IA';
      case 'AI_INTERVIEW_PASSED': return 'Entretien IA réussi';
      case 'AI_INTERVIEW_FAILED': return 'Entretien IA échoué';
      case 'EN_ENTRETIEN_HUMAIN': return 'Entretien humain planifié';
      case 'HUMAN_INTERVIEW_COMPLETED': return 'Entretien humain complété';
      case 'HUMAN_INTERVIEW_ACCEPTED': return 'Candidat accepté après entretien humain';
      case 'HUMAN_INTERVIEW_REJECTED': return 'Candidat refusé après entretien humain';
      case 'STAGIAIRE_CREATED': return 'Stagiaire créé';
      case 'EN_ATTENTE': return 'En attente';
      default: return s;
    }
  }
}
