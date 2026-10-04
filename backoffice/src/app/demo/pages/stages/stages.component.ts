import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SHARED_IMPORTS } from 'src/app/theme/shared/shared.module';
import { InternshipService } from 'src/app/core/data/internship.service';
import { ProjectService } from 'src/app/core/data/project.service';
import { MeetingService } from 'src/app/core/data/meeting.service';
import { EvaluationService } from 'src/app/core/data/evaluation.service';

@Component({
  selector: 'app-stages',
  imports: [...SHARED_IMPORTS, FormsModule],
  templateUrl: './stages.component.html',
  styleUrl: './stages.component.scss'
})
export class StagesComponent implements OnInit {
  private internshipService = inject(InternshipService);
  private projectService = inject(ProjectService);
  private meetingService = inject(MeetingService);
  private evaluationService = inject(EvaluationService);

  stages = signal<any[]>([]);
  searchTerm = signal('');
  filterStatus = signal('tous');
  showDetail = signal(false);
  selectedStage = signal<any>(null);
  activeTab = signal('info');

  stageTaches = signal<any[]>([]);
  stageDocs = signal<any[]>([]);
  stageReunions = signal<any[]>([]);
  stageEvaluations = signal<any[]>([]);
  loadingDetail = signal(false);

  ngOnInit() { this.load(); }

  load() {
    this.internshipService.getAll().subscribe({ next: (d) => this.stages.set(d) });
  }

  filtered() {
    let result = this.stages();
    const term = this.searchTerm().toLowerCase();
    if (term) {
      result = result.filter((s) =>
        s.stagiaire_nom?.toLowerCase().includes(term) ||
        s.stagiaire_prenom?.toLowerCase().includes(term) ||
        s.departement_nom?.toLowerCase().includes(term) ||
        s.encadrant_nom?.toLowerCase().includes(term)
      );
    }
    if (this.filterStatus() !== 'tous') {
      result = result.filter((s) => s.statut === this.filterStatus());
    }
    return result;
  }

  get stats() {
    const all = this.stages();
    return {
      total: all.length,
      en_cours: all.filter(s => s.statut === 'EN_COURS').length,
      termine: all.filter(s => s.statut === 'TERMINE').length,
      en_attente: all.filter(s => s.statut === 'EN_ATTENTE').length,
      suspendu: all.filter(s => s.statut === 'SUSPENDU').length,
    };
  }

  openDetail(stage: any) {
    this.selectedStage.set(stage);
    this.activeTab.set('info');
    this.showDetail.set(true);
    this.loadStageDetails(stage.id);
  }

  closeDetail() {
    this.showDetail.set(false);
    this.selectedStage.set(null);
    this.stageTaches.set([]);
    this.stageDocs.set([]);
    this.stageReunions.set([]);
    this.stageEvaluations.set([]);
  }

  loadStageDetails(stageId: string) {
    this.loadingDetail.set(true);
    this._loadStageTaches(stageId);
    this._loadStageDocs(stageId);
    this._loadStageReunions(stageId);
    this._loadStageEvaluations();
  }

  private _loadStageTaches(stageId: string) {
    this.projectService.getAll().subscribe({
      next: (projets) => {
        const stageProjets = projets.filter((p: any) => p.stage_id === stageId);
        if (stageProjets.length === 0) {
          this.stageTaches.set([]);
          this.loadingDetail.set(false);
          return;
        }
        const allTaches: any[] = [];
        let loaded = 0;
        stageProjets.forEach((p: any) => {
          this.projectService.getById(p.id).subscribe({
            next: (proj) => {
              allTaches.push(...(proj.taches || []));
              loaded++;
              if (loaded === stageProjets.length) {
                this.stageTaches.set(allTaches);
                this.loadingDetail.set(false);
              }
            },
            error: () => { loaded++; if (loaded === stageProjets.length) { this.stageTaches.set(allTaches); this.loadingDetail.set(false); } }
          });
        });
      },
      error: () => { this.loadingDetail.set(false); }
    });
  }

  private _loadStageDocs(stageId: string) {
    this.internshipService.getDocuments(stageId).subscribe({
      next: (d) => this.stageDocs.set(d),
      error: () => this.stageDocs.set([])
    });
  }

  private _loadStageReunions(stageId: string) {
    this.meetingService.getAll().subscribe({
      next: (all) => this.stageReunions.set(all.filter((r: any) => r.stage_id === stageId)),
      error: () => this.stageReunions.set([])
    });
  }

  private _loadStageEvaluations() {
    this.evaluationService.getAll().subscribe({
      next: (all) => this.stageEvaluations.set(all.filter((e: any) => {
        const s = this.selectedStage();
        return s && e.stage_id === s.id;
      })),
      error: () => this.stageEvaluations.set([])
    });
  }

  updateStatus(id: string, statut: string) {
    this.internshipService.update(id, { statut }).subscribe({ next: () => this.load() });
  }

  getStatusBadge(s: string): string {
    switch (s) { case 'TERMINE': return 'badge bg-success'; case 'EN_COURS': return 'badge bg-primary'; case 'SUSPENDU': return 'badge bg-warning'; default: return 'badge bg-secondary'; }
  }

  getStatusLabel(s: string): string {
    switch (s) { case 'TERMINE': return 'Terminé'; case 'EN_COURS': return 'En cours'; case 'SUSPENDU': return 'Suspendu'; default: return 'En attente'; }
  }

  getProgress(stage: any): number {
    if (stage.statut === 'TERMINE') return 100;
    if (stage.statut === 'EN_ATTENTE') return 0;
    if (stage.statut === 'SUSPENDU') return 35;
    const nbProjets = parseInt(stage.nb_projets) || 0;
    if (nbProjets > 0) return 50;
    return 25;
  }

  getTaskStatusBadge(s: string): string {
    switch (s) { case 'TERMINEE': return 'badge bg-success'; case 'EN_COURS': return 'badge bg-primary'; case 'BLOQUEE': return 'badge bg-danger'; default: return 'badge bg-secondary'; }
  }

  getTaskStatusLabel(s: string): string {
    switch (s) { case 'TERMINEE': return 'Terminée'; case 'EN_COURS': return 'En cours'; case 'BLOQUEE': return 'Bloquée'; default: return 'À faire'; }
  }

  getDocTypeIcon(t: string): string {
    switch (t) { case 'CV': return 'ti ti-id'; case 'CONVENTION': return 'ti ti-file-text'; case 'ASSURANCE': return 'ti ti-shield'; case 'RAPPORT': return 'ti ti-notebook'; default: return 'ti ti-certificate'; }
  }

  downloadPdf(stageId: string, type: string) {
    window.open(this.internshipService.downloadPdf(stageId, type), '_blank');
  }
}
