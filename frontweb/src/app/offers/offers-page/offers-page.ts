import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OffersService, SORT_OPTIONS } from '../../core/services/offers.service';
import { Icon } from '../../shared/components/icon/icon';
import { Header } from '../../landing/header/header';
import { Footer } from '../../landing/footer/footer';
import { OfferCard } from '../../shared/components/offer-card/offer-card';
import { Pagination } from '../pagination/pagination';

@Component({
  selector: 'app-offers-page',
  standalone: true,
  imports: [RouterLink, Icon, Header, Footer, OfferCard, Pagination],
  templateUrl: './offers-page.html',
  styles: [`
    /* ---- Bandeau de tête ---- */
    .page-hero {
      position: relative;
      overflow: hidden;
      color: #fff;
      background:
        radial-gradient(700px 320px at 85% -10%, rgba(59, 157, 255, 0.5), transparent 60%),
        linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
      padding-block: 64px 72px;
    }

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13.5px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.75);
      margin-bottom: 18px;
    }

    .breadcrumb a {
      color: rgba(255, 255, 255, 0.9);
      transition: color 0.18s ease;
    }

    .breadcrumb a:hover {
      color: #fff;
    }

    .breadcrumb app-icon {
      font-size: 14px;
    }

    .page-hero__title {
      font-size: clamp(34px, 4.6vw, 52px);
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.1;
    }

    .page-hero__subtitle {
      margin-top: 14px;
      max-width: 640px;
      font-size: 17px;
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.82);
    }

    /* ---- Barre d'outils ---- */
    .toolbar {
      position: sticky;
      top: var(--nav-height);
      z-index: 30;
      margin-top: -40px;
      margin-bottom: 48px;
    }

    .toolbar__card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow-card);
      padding: 20px;
      display: grid;
      gap: 16px;
    }

    .toolbar__row {
      display: grid;
      grid-template-columns: 1.6fr auto;
      gap: 14px;
      align-items: center;
    }

    .search {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search app-icon {
      position: absolute;
      left: 16px;
      font-size: 18px;
      color: var(--color-text-tertiary);
      pointer-events: none;
    }

    .search input {
      width: 100%;
      height: 50px;
      padding: 0 16px 0 48px;
      font: inherit;
      font-size: 15px;
      color: var(--color-text);
      background: var(--color-surface-tone);
      border: 1px solid var(--color-border);
      border-radius: 14px;
      outline: none;
      transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
    }

    .search input:focus {
      border-color: var(--color-primary);
      background: #fff;
      box-shadow: 0 0 0 4px rgba(0, 102, 204, 0.12);
    }

    .search input::placeholder {
      color: var(--color-text-tertiary);
    }

    .selects {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .select {
      position: relative;
      display: inline-flex;
      align-items: center;
    }

    .select > app-icon:first-child {
      position: absolute;
      left: 13px;
      font-size: 16px;
      color: var(--color-primary);
      pointer-events: none;
    }

    .select select {
      appearance: none;
      -webkit-appearance: none;
      height: 50px;
      padding: 0 38px 0 40px;
      font: inherit;
      font-size: 14.5px;
      font-weight: 600;
      color: var(--color-text);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 14px;
      cursor: pointer;
      outline: none;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }

    .select select:hover {
      border-color: var(--color-primary);
    }

    .select select:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 4px rgba(0, 102, 204, 0.12);
    }

    .select > app-icon:last-child {
      position: absolute;
      right: 13px;
      font-size: 15px;
      color: var(--color-text-tertiary);
      pointer-events: none;
    }

    .toolbar__meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding-top: 14px;
      border-top: 1px solid var(--color-border);
    }

    .toolbar__count {
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text-secondary);
    }

    .toolbar__count strong {
      color: var(--color-primary);
    }

    .toolbar__reset {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 13.5px;
      font-weight: 700;
      color: var(--color-danger);
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.25);
      border-radius: 10px;
      padding: 9px 14px;
      transition: background-color 0.18s ease;
    }

    .toolbar__reset:hover {
      background: rgba(239, 68, 68, 0.16);
    }

    .toolbar__reset app-icon {
      font-size: 14px;
    }

    /* ---- Résultats ---- */
    .results {
      padding-bottom: 96px;
    }

    .results__grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }

    /* ---- État vide ---- */
    .empty {
      text-align: center;
      padding-block: 72px 40px;
      max-width: 420px;
      margin-inline: auto;
    }

    .empty__icon {
      width: 76px;
      height: 76px;
      margin-inline: auto;
      display: grid;
      place-items: center;
      border-radius: 22px;
      background: var(--color-primary-tint);
      color: var(--color-primary);
      font-size: 34px;
      margin-bottom: 22px;
    }

    .empty h3 {
      font-size: 22px;
      font-weight: 800;
      margin-bottom: 10px;
    }

    .empty p {
      font-size: 15px;
      color: var(--color-text-secondary);
      margin-bottom: 26px;
    }

    @media (max-width: 1024px) {
      .results__grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .toolbar__row {
        grid-template-columns: 1fr;
      }

      .selects {
        flex-wrap: wrap;
      }

      .select {
        flex: 1 1 220px;
      }

      .select select {
        width: 100%;
      }
    }

    @media (max-width: 640px) {
      .results__grid {
        grid-template-columns: 1fr;
      }

      .page-hero {
        padding-block: 48px 64px;
      }

      .results {
        padding-bottom: 72px;
      }
    }
  `],
})
export class OffersPage implements OnInit {
  private readonly offersService = inject(OffersService);

  protected readonly loading = this.offersService.loading;
  protected readonly error = this.offersService.error;
  protected readonly searchTerm = this.offersService.searchTerm;
  protected readonly departmentFilter = this.offersService.departmentFilter;
  protected readonly localisationFilter = this.offersService.localisationFilter;
  protected readonly niveauFilter = this.offersService.niveauFilter;
  protected readonly sortBy = this.offersService.sortBy;
  protected readonly currentPage = this.offersService.currentPage;

  protected readonly departementOptions = this.offersService.departementOptions;
  protected readonly localisations = this.offersService.localisations;
  protected readonly niveaux = this.offersService.niveaux;
  protected readonly sortOptions = SORT_OPTIONS;

  protected readonly pageOffers = this.offersService.pageOffers;
  protected readonly totalResults = this.offersService.totalResults;
  protected readonly totalPages = this.offersService.totalPages;
  protected readonly hasActiveFilters = this.offersService.hasActiveFilters;

  ngOnInit(): void {
    void this.offersService.load();
  }

  protected onSearch(event: Event): void {
    this.offersService.setSearch((event.target as HTMLInputElement).value);
  }

  protected onDepartment(event: Event): void {
    this.offersService.setDepartment((event.target as HTMLSelectElement).value);
  }

  protected onLocalisation(event: Event): void {
    this.offersService.setLocalisation((event.target as HTMLSelectElement).value);
  }

  protected onNiveau(event: Event): void {
    this.offersService.setNiveau((event.target as HTMLSelectElement).value);
  }

  protected onSort(event: Event): void {
    this.offersService.setSort((event.target as HTMLSelectElement).value as never);
  }

  protected goToPage(page: number): void {
    this.offersService.goToPage(page);
  }

  protected reset(): void {
    this.offersService.reset();
  }

  protected retry(): void {
    void this.offersService.load();
  }
}
