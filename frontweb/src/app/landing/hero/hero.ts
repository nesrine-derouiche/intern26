import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/components/icon/icon';
import { RevealDirective } from '../../shared/directives/reveal.directive';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [RouterLink, Icon, RevealDirective],
  templateUrl: './hero.html',
  styles: [`
    .hero {
      position: relative;
      overflow: hidden;
      color: #fff;
      background:
        radial-gradient(900px 480px at 85% -10%, rgba(59, 157, 255, 0.55), transparent 60%),
        radial-gradient(700px 420px at -10% 110%, rgba(0, 76, 158, 0.9), transparent 55%),
        linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
    }

    .hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
      background-size: 56px 56px;
      mask-image: radial-gradient(720px 420px at 70% 30%, #000 0%, transparent 70%);
      -webkit-mask-image: radial-gradient(720px 420px at 70% 30%, #000 0%, transparent 70%);
      pointer-events: none;
    }

    .hero__inner {
      position: relative;
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: 56px;
      align-items: center;
      padding-block: 96px 108px;
    }

    .hero__badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 16px;
      border-radius: var(--radius-pill);
      background: rgba(255, 255, 255, 0.14);
      border: 1px solid rgba(255, 255, 255, 0.28);
      backdrop-filter: blur(8px);
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    .hero__badge app-icon {
      color: #a9d3ff;
      font-size: 16px;
    }

    .hero__title {
      margin-top: 22px;
      font-size: clamp(38px, 5.4vw, 62px);
      font-weight: 800;
      line-height: 1.06;
      letter-spacing: -0.03em;
    }

    .hero__title .accent {
      background: linear-gradient(100deg, #9fd1ff, #ffffff 70%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .hero__subtitle {
      margin-top: 22px;
      font-size: 18px;
      line-height: 1.65;
      color: rgba(255, 255, 255, 0.82);
      max-width: 540px;
    }

    .hero__actions {
      margin-top: 34px;
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
    }

    .hero__trust {
      margin-top: 40px;
      display: flex;
      flex-wrap: wrap;
      gap: 14px 26px;
    }

    .hero__trust-item {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.85);
    }

    .hero__trust-item app-icon {
      color: #4ade80;
      font-size: 17px;
    }

    /* --- Aperçu produit (colonne droite) --- */
    .hero__preview {
      position: relative;
      perspective: 1200px;
    }

    .preview-card {
      background: rgba(255, 255, 255, 0.98);
      color: var(--color-text);
      border-radius: 22px;
      padding: 22px;
      box-shadow: 0 30px 60px rgba(0, 33, 75, 0.45);
      transform: rotateY(-6deg) rotateX(2deg);
      animation: float 6s ease-in-out infinite;
      backdrop-filter: blur(4px);
    }

    @keyframes float {
      0%, 100% { transform: rotateY(-6deg) rotateX(2deg) translateY(0); }
      50% { transform: rotateY(-6deg) rotateX(2deg) translateY(-10px); }
    }

    .preview-card__head {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--color-border);
    }

    .preview-card__logo {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: var(--bg-gradient);
      color: #fff;
      display: grid;
      place-items: center;
    }

    .preview-card__title {
      font-weight: 800;
      font-size: 15px;
    }

    .preview-card__subtitle {
      font-size: 12px;
      color: var(--color-text-secondary);
    }

    .preview-card__search {
      margin-top: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--color-surface-tone);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      padding: 11px 14px;
      color: var(--color-text-tertiary);
      font-size: 13.5px;
    }

    .preview-card__list {
      margin-top: 14px;
      display: grid;
      gap: 10px;
    }

    .preview-offer {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border: 1px solid var(--color-border);
      border-radius: 14px;
      background: #fff;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }

    .preview-offer:hover {
      border-color: var(--color-primary);
      box-shadow: var(--shadow-soft);
    }

    .preview-offer__icon {
      width: 40px;
      height: 40px;
      flex-shrink: 0;
      border-radius: 11px;
      display: grid;
      place-items: center;
      font-size: 18px;
      color: var(--color-primary);
      background: var(--color-primary-tint);
    }

    .preview-offer__title {
      font-size: 13.5px;
      font-weight: 700;
      line-height: 1.35;
    }

    .preview-offer__meta {
      font-size: 12px;
      color: var(--color-text-secondary);
      margin-top: 2px;
    }

    .preview-chip {
      position: absolute;
      right: -18px;
      bottom: 46px;
      background: #fff;
      border-radius: 14px;
      padding: 14px 16px;
      box-shadow: var(--shadow-card);
      display: flex;
      align-items: center;
      gap: 12px;
      animation: float 6s ease-in-out infinite;
      animation-delay: 1.2s;
    }

    .preview-chip__icon {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: rgba(34, 197, 94, 0.14);
      color: var(--color-accent);
      font-size: 19px;
    }

    .preview-chip__value {
      font-size: 17px;
      font-weight: 800;
      line-height: 1.1;
    }

    .preview-chip__label {
      font-size: 12px;
      color: var(--color-text-secondary);
    }

    @media (max-width: 960px) {
      .hero__inner {
        grid-template-columns: 1fr;
        padding-block: 64px 72px;
        gap: 48px;
      }

      .hero__preview {
        max-width: 480px;
      }

      .preview-chip {
        right: 0;
      }
    }

    @media (max-width: 520px) {
      .hero__trust {
        gap: 12px 18px;
      }
    }
  `],
})
export class Hero {}
