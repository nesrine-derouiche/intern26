import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  input,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';

/**
 * Compteur animé : démarre la progression (0 → valeur) dès que
 * l'élément entre dans le viewport, via requestAnimationFrame.
 */
@Component({
  selector: 'app-animated-counter',
  standalone: true,
  template: `
    <span #value class="value" [attr.aria-label]="ariaLabel()">{{ display() }}</span>
  `,
  styles: [
    `
      :host {
        display: inline-block;
      }

      .value {
        font-variant-numeric: tabular-nums;
      }
    `,
  ],
})
export class AnimatedCounter implements AfterViewInit, OnDestroy {
  readonly value = input.required<number>();
  readonly duration = input(1400);
  readonly suffix = input('');

  protected readonly display = signal('0');
  protected readonly ariaLabel = computed(() => `${this.value()}${this.suffix()}`);

  private readonly valueEl = viewChild.required<ElementRef<HTMLSpanElement>>('value');
  private raf = 0;
  private observer?: IntersectionObserver;

  private hasStarted = false;

  ngAfterViewInit(): void {
    this.render(0);

    const el = this.valueEl().nativeElement;
    if (typeof IntersectionObserver === 'undefined') {
      this.start();
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.start();
            this.observer?.disconnect();
          }
        }
      },
      { threshold: 0.4 },
    );

    this.observer.observe(el);
  }

  private start(): void {
    if (this.hasStarted) return;
    this.hasStarted = true;

    const start = performance.now();
    const from = 0;
    const to = this.value();
    const duration = this.duration();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.render(from + (to - from) * eased);

      if (progress < 1) {
        this.raf = requestAnimationFrame(tick);
      }
    };

    this.raf = requestAnimationFrame(tick);
  }

  private render(value: number): void {
    this.display.set(Math.round(value).toLocaleString('fr-FR'));
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.raf) cancelAnimationFrame(this.raf);
  }
}
