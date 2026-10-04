import { Component, input } from '@angular/core';
import { RevealDirective } from '../../directives/reveal.directive';

/**
 * En-tête de section réutilisable : eyebrow + titre + sous-titre,
 * aligné au choix (centre ou gauche).
 */
@Component({
  selector: 'app-section-header',
  standalone: true,
  imports: [RevealDirective],
  template: `
    <header
      class="section-header"
      [class.section-header--center]="centered()"
      appReveal
    >
      @if (eyebrow()) {
        <span class="eyebrow">{{ eyebrow() }}</span>
      }
      <h2 class="section-header__title">{{ title() }}</h2>
      @if (subtitle()) {
        <p class="section-header__subtitle">{{ subtitle() }}</p>
      }
    </header>
  `,
  styles: [
    `
      .section-header {
        display: flex;
        flex-direction: column;
        gap: 14px;
        max-width: 680px;
        margin-bottom: 56px;
      }

      .section-header--center {
        margin-inline: auto;
        text-align: center;
        align-items: center;
      }

      .section-header__title {
        font-size: clamp(30px, 4vw, 44px);
        font-weight: 800;
        line-height: 1.12;
        letter-spacing: -0.02em;
        color: var(--color-text);
      }

      .section-header__subtitle {
        font-size: 17px;
        line-height: 1.6;
        color: var(--color-text-secondary);
      }
    `,
  ],
})
export class SectionHeader {
  readonly eyebrow = input('');
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly centered = input(false);
}
