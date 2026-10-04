import { computed, inject, Injectable, signal } from '@angular/core';
import { OffersApiService } from './offers-api.service';
import { LandingOffer, OfferLevel } from '../models/landing.models';

export type OfferSort = 'deadline' | 'recent' | 'duration' | 'places';

export const SORT_OPTIONS: { value: OfferSort; label: string }[] = [
  { value: 'deadline', label: 'Date limite (proche)' },
  { value: 'recent', label: 'Plus récentes' },
  { value: 'duration', label: 'Durée la plus longue' },
  { value: 'places', label: 'Le plus de places' },
];

export interface DepartmentOption {
  id: string;
  nom: string;
}

const PAGE_SIZE = 9;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Catalogue d'offres de stage du portail public, piloté par la base de données.
 *
 * Chaque recherche, filtre, tri ou changement de page déclenche une requête
 * vers `GET /api/public/offres` ; les résultats, le total et le nombre de pages
 * proviennent directement de l'API. Un catalogue complet (jusqu'à 100 offres)
 * est chargé une fois pour alimenter les options de filtres, les « dernières
 * offres » du landing et les offres similaires.
 */
@Injectable({ providedIn: 'root' })
export class OffersService {
  private readonly api = inject(OffersApiService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  private readonly ready = signal(false);

  /** Catalogue complet (options de filtres, landing, offres similaires). */
  private readonly catalog = signal<LandingOffer[]>([]);

  /* ---- État de la requête (signaux) ---- */
  readonly searchTerm = signal('');
  readonly departmentFilter = signal('');
  readonly localisationFilter = signal('');
  readonly niveauFilter = signal('');
  readonly sortBy = signal<OfferSort>('deadline');
  readonly currentPage = signal(1);

  readonly pageSize = PAGE_SIZE;

  /* ---- Résultats renvoyés par l'API ---- */
  private readonly results = signal<LandingOffer[]>([]);
  private readonly total = signal(0);
  private readonly pages = signal(1);

  readonly pageOffers = this.results.asReadonly();
  readonly totalResults = this.total.asReadonly();
  readonly totalPages = this.pages.asReadonly();

  private querySeq = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  /** Chargement initial : catalogue complet puis première page de résultats. */
  async load(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const catalogResult = await this.api.list({ limit: 100 });
      this.catalog.set(catalogResult.data);
      this.ready.set(true);
      await this.fetchPage();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      this.loading.set(false);
    }
  }

  /* ---- Options de filtres dérivées du catalogue ---- */
  readonly departementOptions = computed<DepartmentOption[]>(() => {
    const seen = new Map<string, string>();
    for (const offer of this.catalog()) {
      if (offer.departementId && !seen.has(offer.departementId)) {
        seen.set(offer.departementId, offer.departement);
      }
    }
    return [...seen.entries()]
      .map(([id, nom]) => ({ id, nom }))
      .sort((a, b) => a.nom.localeCompare(b.nom));
  });

  readonly localisations = computed(() =>
    [...new Set(this.catalog().map((o) => o.localisation))].sort((a, b) => a.localeCompare(b)),
  );

  readonly niveaux = computed<OfferLevel[]>(() => [
    ...new Set(this.catalog().map((o) => o.niveau)),
  ]);

  /** Offres « dernières » affichées sur le landing (échéances les plus proches). */
  readonly latestOffers = computed<LandingOffer[]>(() =>
    [...this.catalog()].sort((a, b) => a.dateLimite.localeCompare(b.dateLimite)).slice(0, 6),
  );

  readonly allOffers = this.catalog.asReadonly();

  readonly isReady = this.ready.asReadonly();

  readonly hasActiveFilters = computed(
    () =>
      !!this.searchTerm() ||
      !!this.departmentFilter() ||
      !!this.localisationFilter() ||
      !!this.niveauFilter(),
  );

  /* ---- Requête serveur ---- */
  private async fetchPage(): Promise<void> {
    const seq = ++this.querySeq;
    try {
      const result = await this.api.list({
        search: this.searchTerm().trim() || undefined,
        departementId: this.departmentFilter() || undefined,
        niveau: this.niveauFilter() || undefined,
        localisation: this.localisationFilter() || undefined,
        sort: this.sortBy(),
        page: this.currentPage(),
        limit: PAGE_SIZE,
      });
      if (seq !== this.querySeq) return;
      this.results.set(result.data);
      this.total.set(result.total);
      this.pages.set(Math.max(1, result.pages ?? Math.ceil(result.total / PAGE_SIZE)));
    } catch (err) {
      if (seq !== this.querySeq) return;
      this.error.set(err instanceof Error ? err.message : 'Chargement impossible.');
    }
  }

  private scheduleSearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.fetchPage(), SEARCH_DEBOUNCE_MS);
  }

  /* ---- Mutations ---- */
  setSearch(value: string): void {
    this.searchTerm.set(value);
    this.currentPage.set(1);
    this.scheduleSearch();
  }

  setDepartment(value: string): void {
    this.departmentFilter.set(value);
    this.currentPage.set(1);
    void this.fetchPage();
  }

  setLocalisation(value: string): void {
    this.localisationFilter.set(value);
    this.currentPage.set(1);
    void this.fetchPage();
  }

  setNiveau(value: string): void {
    this.niveauFilter.set(value);
    this.currentPage.set(1);
    void this.fetchPage();
  }

  setSort(value: OfferSort): void {
    this.sortBy.set(value);
    void this.fetchPage();
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    void this.fetchPage();
  }

  reset(): void {
    this.searchTerm.set('');
    this.departmentFilter.set('');
    this.localisationFilter.set('');
    this.niveauFilter.set('');
    this.sortBy.set('deadline');
    this.currentPage.set(1);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    void this.fetchPage();
  }

  getById(id: string): LandingOffer | undefined {
    return this.catalog().find((offer) => offer.id === id);
  }
}
