import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SHARED_IMPORTS } from 'src/app/theme/shared/shared.module';
import { TemplateService, DocumentTemplate, TEMPLATE_TYPES } from 'src/app/core/data/document-template.service';
import { AuthService } from 'src/app/core/data/auth.service';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-templates',
  imports: [...SHARED_IMPORTS, FormsModule],
  templateUrl: './document-template.component.html',
  styleUrl: './document-template.component.scss'
})
export class TemplatesComponent implements OnInit {
  private templateService = inject(TemplateService);
  private authService = inject(AuthService);

  templates = signal<DocumentTemplate[]>([]);
  total = signal(0);
  page = signal(1);
  pages = signal(1);
  loading = signal(false);
  error = signal('');

  filterType = signal('');
  filterActif = signal<boolean | ''>('');
  searchTerm = signal('');

  showForm = signal(false);
  editMode = signal(false);
  formLoading = signal(false);
  formError = signal('');
  editingId = signal<string | null>(null);
  editingTemplate = signal<DocumentTemplate | null>(null);

  form: any = { nom: '', type: '', contenu: '', variables: '' };

  showPreview = signal(false);
  previewLoading = signal(false);
  previewError = signal('');
  previewContent = signal('');
  previewTemplateId = signal<string | null>(null);
  previewDataRaw = signal('');
  previewData: any = {};

  showDeactivateConfirm = signal(false);
  deactivateTarget = signal<DocumentTemplate | null>(null);
  deactivateLoading = signal(false);

  readonly TYPES = TEMPLATE_TYPES;
  readonly contenuPlaceholder = 'Utilisez {{nom_variable}} pour les variables dynamiques';

  get isAdminOrRh(): boolean {
    return ['ADMIN', 'RH'].includes(this.authService.currentUser()?.role ?? '');
  }

  ngOnInit() {
    if (!this.isAdminOrRh) {
      this.error.set('Accès refusé : seuls l\'Administrateur et le RH peuvent gérer les templates.');
      return;
    }
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.templateService.listTemplates({
      type: this.filterType() || undefined,
      actif: this.filterActif() === '' ? undefined : this.filterActif() as boolean,
      page: this.page(),
      limit: PAGE_SIZE
    }).subscribe({
      next: (res) => {
        this.templates.set(res.data);
        this.total.set(res.total);
        this.pages.set(res.pages);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'Erreur lors du chargement des templates.');
      }
    });
  }

  filtered() {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.templates();
    return this.templates().filter(
      (t) => t.nom?.toLowerCase().includes(term) || t.type?.toLowerCase().includes(term)
    );
  }

  setFilterType(type: string) {
    this.filterType.set(type);
    this.page.set(1);
    this.load();
  }

  setFilterActif(actif: boolean | '') {
    this.filterActif.set(actif);
    this.page.set(1);
    this.load();
  }

  resetFilters() {
    this.filterType.set('');
    this.filterActif.set('');
    this.searchTerm.set('');
    this.page.set(1);
    this.load();
  }

  goToPage(p: number) {
    if (p < 1 || p > this.pages() || p === this.page()) return;
    this.page.set(p);
    this.load();
  }

  openCreate() {
    this.editMode.set(false);
    this.form = { nom: '', type: '', contenu: '', variables: '' };
    this.editingId.set(null);
    this.editingTemplate.set(null);
    this.formError.set('');
    this.showForm.set(true);
  }

  openEdit(t: DocumentTemplate) {
    this.editMode.set(true);
    this.form = {
      nom: t.nom,
      type: t.type,
      contenu: t.contenu,
      variables: t.variables.join(', ')
    };
    this.editingId.set(t.id);
    this.editingTemplate.set(t);
    this.formError.set('');
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.formError.set('');
  }

  saveForm() {
    if (!this.form.nom?.trim() || !this.form.type || !this.form.contenu?.trim()) {
      this.formError.set('Nom, type et contenu sont requis.');
      return;
    }
    const variables = this.form.variables
      .split(',')
      .map((v: string) => v.trim())
      .filter((v: string) => v.length > 0);

    this.formLoading.set(true);
    this.formError.set('');

    const payload = { nom: this.form.nom.trim(), type: this.form.type, contenu: this.form.contenu, variables };

    const obs = this.editMode()
      ? this.templateService.updateTemplate(this.editingId()!, payload)
      : this.templateService.createTemplate(payload);

    obs.subscribe({
      next: () => {
        this.formLoading.set(false);
        this.closeForm();
        this.load();
      },
      error: (err) => {
        this.formLoading.set(false);
        this.formError.set(err.error?.message || 'Erreur lors de l\'enregistrement.');
      }
    });
  }

  openDeactivate(t: DocumentTemplate) {
    this.deactivateTarget.set(t);
    this.showDeactivateConfirm.set(true);
  }

  cancelDeactivate() {
    this.showDeactivateConfirm.set(false);
    this.deactivateTarget.set(null);
  }

  confirmDeactivate() {
    const target = this.deactivateTarget();
    if (!target) return;
    this.deactivateLoading.set(true);
    this.templateService.deactivateTemplate(target.id).subscribe({
      next: () => {
        this.deactivateLoading.set(false);
        this.cancelDeactivate();
        this.load();
      },
      error: (err) => {
        this.deactivateLoading.set(false);
        this.cancelDeactivate();
        this.error.set(err.error?.message || 'Erreur lors de la désactivation.');
      }
    });
  }

  openPreview(t: DocumentTemplate) {
    this.previewTemplateId.set(t.id);
    this.previewContent.set('');
    this.previewError.set('');
    this.previewDataRaw.set('');
    this.previewData = {};
    this.showPreview.set(true);
  }

  closePreview() {
    this.showPreview.set(false);
    this.previewError.set('');
  }

  loadPreview() {
    if (!this.previewTemplateId()) return;
    this.previewLoading.set(true);
    this.previewError.set('');
    this.previewData = this.parsePreviewData(this.previewDataRaw());
    this.templateService.previewTemplate(this.previewTemplateId()!, this.previewData).subscribe({
      next: (res) => {
        this.previewContent.set(res.preview);
        this.previewLoading.set(false);
      },
      error: (err) => {
        this.previewLoading.set(false);
        this.previewError.set(err.error?.message || 'Erreur lors de l\'aperçu.');
      }
    });
  }

  private parsePreviewData(raw: string): Record<string, string> {
    const result: Record<string, string> = {};
    if (!raw?.trim()) return result;
    raw.split('\n').forEach((line) => {
      const [key, ...rest] = line.split('=');
      if (key?.trim() && rest.length) {
        result[key.trim()] = rest.join('=').trim();
      }
    });
    return result;
  }

  getTypeBadge(type: string): string {
    switch (type) {
      case 'CONVENTION': return 'badge bg-primary';
      case 'ATTESTATION': return 'badge bg-success';
      case 'CV': return 'badge bg-info';
      case 'ASSURANCE': return 'badge bg-warning text-dark';
      case 'RAPPORT': return 'badge bg-secondary';
      default: return 'badge bg-light text-dark';
    }
  }

  getVariablesList(t: DocumentTemplate): string {
    return t.variables?.length ? t.variables.join(', ') : '—';
  }

  variablesDisplay(t: DocumentTemplate): string {
    if (!t.variables?.length) return '—';
    return t.variables.map((v) => `{{${v}}}`).join(' ');
  }
}
