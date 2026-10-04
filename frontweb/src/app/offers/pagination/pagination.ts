import { Component, computed, input, output } from '@angular/core';
import { Icon } from '../../shared/components/icon/icon';

export type PageItem = number | 'ellipsis';

/**
 * Pagination numérotée avec ellipses, précédent/suivant.
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [Icon],
  templateUrl: './pagination.html',
  styles: [`
    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 48px;
    }

    .pagination__btn {
      min-width: 42px;
      height: 42px;
      padding-inline: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 14.5px;
      font-weight: 700;
      color: var(--color-text-secondary);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      transition: color 0.18s ease, background-color 0.18s ease, border-color 0.18s ease;
    }

    .pagination__btn:hover:not(:disabled):not(.is-active) {
      color: var(--color-primary);
      border-color: var(--color-primary);
    }

    .pagination__btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .pagination__btn.is-active {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: #fff;
      box-shadow: 0 6px 16px rgba(0, 102, 204, 0.3);
    }

    .pagination__dots {
      color: var(--color-text-tertiary);
      font-weight: 700;
      padding-inline: 4px;
    }

    .pagination__btn app-icon {
      font-size: 16px;
    }
  `],
})
export class Pagination {
  readonly currentPage = input(1);
  readonly totalPages = input(1);
  readonly pageChange = output<number>();

  protected readonly items = computed<PageItem[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();

    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages = new Set<number>([1, total]);
    for (let p = current - 1; p <= current + 1; p++) {
      if (p >= 1 && p <= total) pages.add(p);
    }

    const sorted = [...pages].sort((a, b) => a - b);
    const items: PageItem[] = [];
    let previous = 0;
    for (const p of sorted) {
      if (p - previous > 1) items.push('ellipsis');
      items.push(p);
      previous = p;
    }
    return items;
  });

  protected go(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.pageChange.emit(page);
    }
  }
}
