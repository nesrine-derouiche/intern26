import { Component, input, model, signal } from '@angular/core';

/**
 * Saisie de listes sous forme de pastilles (compétences, langues…).
 * Liaison bidirectionnelle via `[(value)]`.
 */
@Component({
  selector: 'app-chips-input',
  standalone: true,
  templateUrl: './chips-input.html',
  styles: [``],
})
export class ChipsInput {
  readonly value = model<string[]>([]);
  readonly placeholder = input('');

  protected readonly draft = signal('');

  protected add(): void {
    const items = this.draft()
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!items.length) return;
    this.value.set([...new Set([...this.value(), ...items])]);
    this.draft.set('');
  }

  protected remove(item: string): void {
    this.value.set(this.value().filter((v) => v !== item));
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.add();
    }
  }
}
