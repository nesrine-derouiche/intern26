import { Directive, ElementRef, inject, input, OnDestroy, OnInit, signal } from '@angular/core';

/**
 * Révèle l'élément (fondu + glissement) quand il entre dans le viewport.
 * Utilise un IntersectionObserver et bascule la classe `.is-revealed`
 * (les styles de transition vivent dans styles.scss).
 */
@Directive({
  selector: '[appReveal]',
  standalone: true,
  host: {
    '[attr.data-reveal]': 'marker',
    '[class.is-revealed]': 'revealed()',
    '[style.--reveal-delay]': 'delay() + "ms"',
  },
})
export class RevealDirective implements OnInit, OnDestroy {
  readonly delay = input(0);
  protected readonly revealed = signal(false);
  /** Marqueur statique présent sur l'élément (ciblé par styles.scss). */
  readonly marker = '';

  private readonly host = inject(ElementRef<HTMLElement>);
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    const el = this.host.nativeElement;
    const matchMedia = window.matchMedia?.bind(window);
    const reduceMotion =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      this.revealed.set(true);
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.revealed.set(true);
            this.observer?.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );

    this.observer.observe(el);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
