import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { OffersService } from '../../core/services/offers.service';
import { OffersApiService, AnalyseCvResult } from '../../core/services/offers-api.service';
import { AuthService } from '../../core/services/auth.service';
import { CandidatService } from '../../core/services/candidat.service';
import { ApiError } from '../../core/services/api.service';
import { LandingOffer } from '../../core/models/landing.models';
import { Icon } from '../../shared/components/icon/icon';
import { Header } from '../../landing/header/header';
import { Footer } from '../../landing/footer/footer';
import { OfferCard } from '../../shared/components/offer-card/offer-card';
import { formatDeadline } from '../../core/utils/date.util';

/** État du CV du candidat pour choisir la bonne action. */
type CvStatus = 'checking' | 'none' | 'ready';

/**
 * Page de détail d'une offre de stage, inspirée des annonces LinkedIn Jobs.
 *
 * Affiche toutes les informations de l'offre (titre, département, localisation,
 * durée, description, compétences, places, date limite, période, documents) puis,
 * en bas de page, une action contextuelle : « Déposer mon CV » si le candidat
 * n'en a pas encore, sinon « Postuler ».
 */
@Component({
  selector: 'app-offer-details',
  standalone: true,
  imports: [RouterLink, Icon, Header, Footer, OfferCard, NgTemplateOutlet],
  templateUrl: './offer-details.html',
  styles: [
    `
      .page {
        padding-block: 36px 96px;
        background: var(--color-background);
      }

      /* ---- Fil d'Ariane ---- */
      .crumbs {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13.5px;
        font-weight: 600;
        color: var(--color-text-tertiary);
        margin-bottom: 20px;
        flex-wrap: wrap;
      }

      .crumbs a {
        color: var(--color-text-secondary);
        transition: color 0.18s ease;
      }

      .crumbs a:hover {
        color: var(--color-primary);
      }

      .crumbs app-icon {
        font-size: 14px;
      }

      /* ---- Carte d'en-tête (LinkedIn) ---- */
      .offer-hero {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 28px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-card);
        padding: 30px 34px;
      }

      .offer-hero__left {
        display: flex;
        align-items: flex-start;
        gap: 22px;
        min-width: 0;
      }

      .offer-hero__logo {
        flex: none;
        display: grid;
        place-items: center;
        width: 68px;
        height: 68px;
        border-radius: 16px;
        font-size: 22px;
        font-weight: 800;
        letter-spacing: 0.02em;
        color: #fff;
        background:
          radial-gradient(120px 120px at 30% 0%, rgba(255, 255, 255, 0.25), transparent 60%),
          linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
      }

      .offer-hero__dept {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--color-primary);
      }

      .offer-hero__title {
        font-size: clamp(26px, 3.6vw, 38px);
        font-weight: 800;
        letter-spacing: -0.02em;
        line-height: 1.15;
        margin-top: 8px;
        color: var(--color-text);
      }

      .offer-hero__meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 18px;
      }

      .offer-hero__chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 600;
        color: var(--color-text-secondary);
        background: var(--color-surface-tone);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-pill);
        padding: 8px 14px;
      }

      .offer-hero__chip app-icon {
        font-size: 15px;
        color: var(--color-primary);
      }

      .offer-hero__chip--deadline {
        color: var(--color-warning);
        border-color: rgba(245, 158, 11, 0.4);
        background: rgba(245, 158, 11, 0.08);
      }

      .offer-hero__tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 16px;
      }

      .offer-hero__tag {
        font-size: 12.5px;
        font-weight: 600;
        color: var(--color-primary-dark);
        background: var(--color-primary-tint);
        padding: 6px 12px;
        border-radius: var(--radius-pill);
      }

      /* ---- Grille principale ---- */
      .layout {
        display: grid;
        grid-template-columns: 1.65fr 1fr;
        gap: 28px;
        align-items: start;
        margin-top: 28px;
      }

      .layout__main {
        display: grid;
        gap: 24px;
        min-width: 0;
      }

      .layout__side {
        display: grid;
        gap: 24px;
        position: sticky;
        top: calc(var(--nav-height) + 20px);
      }

      .panel {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius);
        box-shadow: var(--shadow-soft);
        padding: 28px;
      }

      .panel__title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 17px;
        font-weight: 800;
        letter-spacing: -0.01em;
        margin-bottom: 16px;
        color: var(--color-text);
      }

      .panel__title app-icon {
        font-size: 18px;
        color: var(--color-primary);
      }

      .panel__text {
        font-size: 15.5px;
        line-height: 1.75;
        color: var(--color-text-secondary);
        white-space: pre-line;
      }

      .panel__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 10px;
      }

      .panel__list li {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        font-size: 15px;
        line-height: 1.6;
        color: var(--color-text-secondary);
      }

      .panel__list li app-icon {
        margin-top: 3px;
        font-size: 15px;
        color: var(--color-primary);
        flex-shrink: 0;
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .chips__item {
        font-size: 13px;
        font-weight: 600;
        color: var(--color-primary);
        background: var(--color-primary-tint);
        border: 1px solid rgba(0, 102, 204, 0.18);
        padding: 8px 14px;
        border-radius: var(--radius-pill);
      }

      .subtitle {
        font-size: 12.5px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
        margin: 0 0 12px;
      }

      .subtitle + .chips {
        margin-bottom: 18px;
      }

      /* ---- Colonne latérale ---- */
      .apply-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius);
        box-shadow: var(--shadow-card);
        padding: 26px;
        display: grid;
        gap: 14px;
      }

      .apply-card__title {
        font-size: 18px;
        font-weight: 800;
        letter-spacing: -0.01em;
        color: var(--color-text);
      }

      .apply-card__deadline {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 13.5px;
        font-weight: 700;
        color: var(--color-warning);
      }

      .apply-card__deadline app-icon {
        font-size: 15px;
      }

      .apply-card__cv-status {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 600;
        color: var(--color-text-secondary);
        padding: 10px 12px;
        border-radius: 10px;
        background: var(--color-surface-tone);
      }

      .apply-card__cv-status app-icon {
        font-size: 15px;
        color: var(--color-accent);
      }

      /* Zone CV + IA : fondue en douceur pendant la suppression */
      .apply-card__flow {
        display: grid;
        gap: 14px;
        transition:
          opacity 0.3s ease,
          transform 0.3s ease;
      }

      .apply-card__flow--leaving {
        opacity: 0;
        transform: translateY(-8px);
      }

      /* ---- Compatibilité IA ---- */
      .apply-card__ai {
        display: grid;
        gap: 12px;
        padding: 16px;
        margin-top: 4px;
        border: 1px dashed rgba(99, 102, 241, 0.4);
        border-radius: var(--radius-lg);
        background:
          radial-gradient(120px 120px at 12% 0%, rgba(139, 92, 246, 0.14), transparent 65%),
          radial-gradient(140px 140px at 100% 100%, rgba(6, 182, 212, 0.16), transparent 65%),
          linear-gradient(160deg, #eef2ff, #f0fdfa);
      }

      .apply-card__ai-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14.5px;
        font-weight: 800;
        letter-spacing: -0.01em;
        color: var(--color-text);
      }

      .apply-card__ai-title app-icon {
        font-size: 16px;
        color: var(--color-primary);
      }

      .apply-card__ai-empty {
        margin: 0;
        font-size: 13.5px;
        color: var(--color-text-tertiary);
        text-align: center;
      }

      .apply-card__ai-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        font-size: 13.5px;
        font-weight: 600;
        color: var(--color-text-secondary);
        padding-block: 6px;
      }

      .apply-card__ai-loading app-icon {
        font-size: 17px;
        color: var(--color-primary);
      }

      /* ---- Panneau IA (glassmorphism, style LinkedIn Premium) ---- */
      .ai-result {
        position: relative;
        overflow: hidden;
        display: grid;
        gap: 16px;
        padding: 20px 18px;
        border-radius: 20px;
        background: linear-gradient(145deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.3) 55%, rgba(255, 255, 255, 0.55));
        backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.6);
        box-shadow: 0 22px 44px -14px rgba(15, 23, 42, 0.3);
        animation: aiFadeUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      .ai-result__body {
        position: relative;
        z-index: 1;
        display: grid;
        gap: 16px;
      }

      .ai-result__orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(34px);
        pointer-events: none;
      }

      .ai-result__orb--one {
        top: -44px;
        left: -34px;
        width: 180px;
        height: 180px;
        background: radial-gradient(circle at 30% 30%, rgba(139, 92, 246, 0.55), transparent 70%);
      }

      .ai-result__orb--two {
        right: -44px;
        bottom: -34px;
        width: 190px;
        height: 190px;
        background: radial-gradient(circle at 70% 70%, rgba(6, 182, 212, 0.5), transparent 70%);
      }

      @keyframes aiFadeUp {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes aiPop {
        from {
          opacity: 0;
          transform: scale(0.5);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      @keyframes aiGrow {
        from {
          transform: scaleX(0);
        }
        to {
          transform: scaleX(1);
        }
      }

      /* Badge de statut : Excellent / Good / Average / Low */
      .ai-result__head {
        display: flex;
        justify-content: flex-end;
      }

      .ai-badge {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        padding: 7px 13px;
        border-radius: var(--radius-pill);
        border: 1px solid;
      }

      .ai-badge__dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: currentColor;
      }

      .ai-badge--excellent,
      .ai-badge--good {
        color: #059669;
        background: rgba(16, 185, 129, 0.14);
        border-color: rgba(16, 185, 129, 0.42);
      }

      .ai-badge--average {
        color: #d97706;
        background: rgba(245, 158, 11, 0.16);
        border-color: rgba(245, 158, 11, 0.45);
      }

      .ai-badge--low {
        color: #dc2626;
        background: rgba(239, 68, 68, 0.14);
        border-color: rgba(239, 68, 68, 0.42);
      }

      /* Hero : jauge circulaire + chance d'entretien */
      .ai-hero {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 20px;
        align-items: center;
      }

      .ai-gauge {
        position: relative;
        width: 150px;
        height: 150px;
        margin-inline: auto;
        display: grid;
        place-items: center;
      }

      .ai-gauge__svg {
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
      }

      .ai-gauge__track {
        fill: none;
        stroke: rgba(148, 163, 184, 0.28);
        stroke-width: 11;
      }

      .ai-gauge__bar {
        fill: none;
        stroke-width: 11;
        stroke-linecap: round;
        transition: stroke-dashoffset 1.15s cubic-bezier(0.22, 1, 0.36, 1);
      }

      .ai-gauge__value {
        position: absolute;
        inset: 0;
        display: grid;
        place-content: center;
        justify-items: center;
        gap: 4px;
      }

      .ai-gauge__value strong {
        font-size: 38px;
        font-weight: 800;
        letter-spacing: -0.03em;
        line-height: 1;
        background: linear-gradient(120deg, #6d28d9, #2563eb 55%, #0891b2);
        -webkit-background-clip: text;
        color: transparent;
        animation: aiPop 0.6s 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }

      .ai-gauge__value strong span {
        font-size: 19px;
      }

      .ai-gauge__label {
        font-size: 10.5px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #64748b;
      }

      /* Chance d'entretien : 72 % — probability of being shortlisted */
      .ai-chance {
        display: grid;
        gap: 8px;
        padding: 16px 18px;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.65);
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.2));
        animation: aiFadeUp 0.5s 0.15s cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      .ai-chance__label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #475569;
      }

      .ai-chance__label app-icon {
        font-size: 15px;
        color: #6366f1;
      }

      .ai-chance__value {
        font-size: 32px;
        font-weight: 800;
        line-height: 1;
        background: linear-gradient(120deg, #6d28d9, #0891b2);
        -webkit-background-clip: text;
        color: transparent;
      }

      .ai-chance__track,
      .ai-meter__track {
        height: 8px;
        border-radius: var(--radius-pill);
        background: rgba(148, 163, 184, 0.28);
        overflow: hidden;
      }

      .ai-chance__bar,
      .ai-meter__bar {
        height: 100%;
        border-radius: var(--radius-pill);
        background: linear-gradient(90deg, #8b5cf6, #6366f1, #06b6d4);
      }

      .ai-chance__bar {
        transition: width 1s cubic-bezier(0.22, 1, 0.36, 1);
      }

      .ai-chance__hint {
        font-size: 11.5px;
        font-weight: 600;
        color: #64748b;
      }

      .ai-result__desc {
        margin: 0;
        font-size: 12.5px;
        line-height: 1.6;
        font-weight: 500;
        color: #475569;
        text-align: center;
      }

      /* Jauges Experience / Education match */
      .ai-meters {
        display: grid;
        gap: 12px;
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.65);
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.2));
        animation: aiFadeUp 0.5s 0.25s ease both;
      }

      .ai-meter {
        display: grid;
        gap: 6px;
      }

      .ai-meter__head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 10px;
      }

      .ai-meter__head span {
        font-size: 12.5px;
        font-weight: 700;
        color: #475569;
      }

      .ai-meter__head strong {
        font-size: 12.5px;
        font-weight: 800;
        color: #334155;
      }

      .ai-meter__bar {
        transform-origin: left;
        animation: aiGrow 0.9s 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      /* Sections : matching / missing skills, langues */
      .ai-section {
        display: grid;
        gap: 8px;
      }

      .ai-section__label {
        margin: 0;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: #64748b;
      }

      .ai-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .ai-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 700;
        padding: 7px 12px;
        border-radius: var(--radius-pill);
        border: 1px solid;
        animation: aiFadeUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      .ai-chip app-icon {
        font-size: 13px;
      }

      .ai-chip--strength {
        color: #047857;
        background: rgba(16, 185, 129, 0.12);
        border-color: rgba(16, 185, 129, 0.34);
      }

      .ai-chip--weakness {
        color: #b45309;
        background: rgba(245, 158, 11, 0.12);
        border-color: rgba(245, 158, 11, 0.36);
      }

      .ai-chip--language {
        color: #475569;
        background: rgba(99, 102, 241, 0.08);
        border-color: rgba(99, 102, 241, 0.3);
      }

      .ai-chip--language app-icon {
        color: #6366f1;
      }

      /* Recommandation */
      .ai-reco {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid rgba(99, 102, 241, 0.36);
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.14), rgba(6, 182, 212, 0.1));
        animation: aiFadeUp 0.5s 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      .ai-reco__icon {
        flex: none;
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        border-radius: 11px;
        font-size: 17px;
        color: #fff;
        background: linear-gradient(135deg, #8b5cf6, #6366f1);
      }

      .ai-reco__title {
        margin: 0;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: #4c1d95;
      }

      .ai-reco__text {
        margin: 4px 0 0;
        font-size: 13px;
        line-height: 1.6;
        color: #475569;
      }

      /* ---- Actions après le résultat IA ---- */
      .ai-actions {
        display: grid;
        gap: 10px;
      }

      /* ---- Dialogue de confirmation ---- */
      .ai-dialog {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: grid;
        place-items: center;
        padding: 20px;
        background: rgba(15, 23, 42, 0.55);
        backdrop-filter: blur(4px);
        animation: aiFadeUp 0.2s ease both;
      }

      .ai-dialog__card {
        position: relative;
        width: min(420px, 100%);
        display: grid;
        gap: 14px;
        text-align: center;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-card);
        padding: 28px 26px 24px;
        animation: aiPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }

      .ai-dialog__close {
        position: absolute;
        top: 12px;
        right: 12px;
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border-radius: 10px;
        border: 1px solid var(--color-border);
        background: var(--color-surface-tone);
        color: var(--color-text-tertiary);
        cursor: pointer;
        transition: color 0.18s ease, border-color 0.18s ease;
      }

      .ai-dialog__close:hover {
        color: var(--color-text);
        border-color: var(--color-text-tertiary);
      }

      .ai-dialog__close app-icon {
        font-size: 15px;
      }

      .ai-dialog__icon {
        width: 54px;
        height: 54px;
        margin-inline: auto;
        display: grid;
        place-items: center;
        border-radius: 17px;
        background: var(--color-primary-tint);
        color: var(--color-primary);
        font-size: 24px;
      }

      .ai-dialog__icon--danger {
        background: rgba(239, 68, 68, 0.1);
        color: #dc2626;
      }

      .ai-dialog__title {
        margin: 0;
        font-size: 18px;
        font-weight: 800;
        letter-spacing: -0.01em;
        color: var(--color-text);
      }

      .ai-dialog__text {
        margin: 0;
        font-size: 14px;
        line-height: 1.65;
        color: var(--color-text-secondary);
      }

      .ai-dialog__actions {
        display: grid;
        gap: 10px;
        margin-top: 4px;
      }

      /* ---- Détails de l'offre (rail) ---- */
      .overview {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 14px;
      }

      .overview li {
        display: grid;
        grid-template-columns: 22px 1fr;
        gap: 12px;
        align-items: start;
      }

      .overview app-icon {
        font-size: 17px;
        color: var(--color-primary);
        margin-top: 1px;
      }

      .overview__label {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
      }

      .overview__value {
        font-size: 14.5px;
        font-weight: 600;
        color: var(--color-text);
        margin-top: 2px;
        line-height: 1.5;
      }

      .overview__value--muted {
        color: var(--color-text-secondary);
      }

      /* ---- Bandeau d'action en bas ---- */
      .bottom-cta {
        margin-top: 28px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-card);
        padding: 26px 32px;
      }

      .bottom-cta__text {
        display: grid;
        gap: 4px;
        min-width: 220px;
      }

      .bottom-cta__title {
        font-size: 17px;
        font-weight: 800;
        color: var(--color-text);
      }

      .bottom-cta__desc {
        font-size: 13.5px;
        color: var(--color-text-secondary);
      }

      .bottom-cta__actions {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
        justify-content: flex-end;
        flex: 1;
      }

      /* ---- Bloc d'action réutilisable ---- */
      .cta {
        display: grid;
        gap: 10px;
        min-width: 260px;
      }

      .cta .btn {
        width: 100%;
        padding: 14px 22px;
        font-size: 14.5px;
      }

      /* Bouton « Supprimer le CV » : contour rouge + icône corbeille */
      .btn--danger-outline {
        background: var(--color-surface);
        color: #dc2626;
        border-color: rgba(220, 38, 38, 0.45);
        box-shadow: var(--shadow-soft);
      }

      .btn--danger-outline:hover {
        background: rgba(220, 38, 38, 0.06);
        border-color: #dc2626;
        transform: translateY(-1px);
      }

      /* Apparition en douceur du bloc « Déposer mon CV » après suppression */
      .cta--entering {
        animation: aiFadeUp 0.32s ease both;
      }

      .cta__hint {
        margin: 0;
        font-size: 12.5px;
        color: var(--color-text-tertiary);
        text-align: center;
      }

      .cta__error {
        margin: 0;
        font-size: 13px;
        color: #b91c1c;
        background: rgba(239, 68, 68, 0.08);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 10px;
        padding: 10px 12px;
        text-align: center;
      }

      .cta__done {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: 14.5px;
        font-weight: 700;
        color: var(--color-accent);
      }

      .cta__done app-icon {
        font-size: 18px;
      }

      .cta__upload {
        display: grid;
        gap: 10px;
      }

      .cta__progress {
        height: 8px;
        border-radius: var(--radius-pill);
        background: var(--color-surface-tone);
        border: 1px solid var(--color-border);
        overflow: hidden;
      }

      .cta__progress-bar {
        height: 100%;
        border-radius: var(--radius-pill);
        background: linear-gradient(90deg, var(--color-primary), var(--color-accent));
        transition: width 0.2s ease;
      }

      /* ---- États de chargement / introuvable ---- */
      .state {
        text-align: center;
        padding-block: 72px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-soft);
        margin-top: 28px;
      }

      .state__icon {
        width: 76px;
        height: 76px;
        margin-inline: auto;
        display: grid;
        place-items: center;
        border-radius: 22px;
        background: var(--color-primary-tint);
        color: var(--color-primary);
        font-size: 34px;
        margin-bottom: 20px;
      }

      .state h2 {
        font-size: 24px;
        font-weight: 800;
        margin-bottom: 10px;
      }

      .state p {
        color: var(--color-text-secondary);
        margin-bottom: 26px;
      }

      /* ---- Offres similaires ---- */
      .related {
        margin-top: 56px;
      }

      .related__head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 24px;
      }

      .related__title {
        font-size: 22px;
        font-weight: 800;
        letter-spacing: -0.01em;
      }

      .related__link {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 700;
        color: var(--color-primary);
      }

      .related__grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 24px;
      }

      @media (max-width: 1000px) {
        .layout {
          grid-template-columns: 1fr;
        }

        .layout__side {
          position: static;
          grid-template-columns: 1fr 1fr;
        }

        .related__grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 640px) {
        .page {
          padding-block: 24px 64px;
        }

        .offer-hero {
          padding: 24px 20px;
          flex-direction: column;
        }

        .offer-hero__left {
          flex-direction: column;
          gap: 14px;
        }

        .offer-hero__logo {
          width: 56px;
          height: 56px;
          font-size: 18px;
        }

        .ai-hero {
          grid-template-columns: 1fr;
        }

        .layout__side {
          grid-template-columns: 1fr;
        }

        .bottom-cta {
          padding: 22px 20px;
          flex-direction: column;
          align-items: stretch;
        }

        .bottom-cta__actions {
          justify-content: stretch;
        }

        .cta {
          min-width: 0;
        }

        .related__grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class OfferDetails {
  readonly id = input.required<string>();

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly offersService = inject(OffersService);
  private readonly offersApi = inject(OffersApiService);
  private readonly auth = inject(AuthService);
  private readonly candidat = inject(CandidatService);

  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly offer = signal<LandingOffer | null>(null);

  protected readonly isAuthenticated = this.auth.isAuthenticated;
  protected readonly isCandidat = this.auth.isCandidat;

  /* ---- État CV + candidature ---- */
  protected readonly cvStatus = signal<CvStatus>('checking');
  protected readonly cvUploading = signal(false);
  protected readonly cvProgress = signal<number | null>(null);
  protected readonly cvUploadError = signal<string | null>(null);
  protected readonly applying = signal(false);
  protected readonly applied = signal(false);
  protected readonly applyError = signal<string | null>(null);
  protected readonly applySuccess = signal<string | null>(null);

  /* ---- Compatibilité IA (UI seule, backend à venir) ---- */
  protected readonly aiState = signal<'idle' | 'loading' | 'done'>('idle');
  protected readonly aiResult = signal<AnalyseCvResult | null>(null);
  protected readonly aiError = signal<string | null>(null);
  protected readonly showConfirm = signal(false);

  /* ---- Suppression du CV pour cette offre ---- */
  protected readonly showDeleteConfirm = signal(false);
  protected readonly deletingCv = signal(false);
  protected readonly deleteError = signal<string | null>(null);
  protected readonly cvLeaving = signal(false);

  protected readonly ringCircumference = 2 * Math.PI * 52;
  protected readonly ringOffset = signal(2 * Math.PI * 52);

  private readonly levelLabels: Record<string, string> = {
    EXCELLENT: 'Excellent',
    GOOD: 'Good',
    AVERAGE: 'Average',
    WEAK: 'Low',
    LOW: 'Low',
  };

  protected levelLabel(level: string | undefined): string {
    if (!level) return '';
    return this.levelLabels[level.toUpperCase()] ?? level;
  }

  /** Classe du badge de statut selon le niveau de compatibilité. */
  protected badgeClass(level: string | undefined): string {
    const l = (level ?? '').toUpperCase();
    if (l === 'EXCELLENT') return 'ai-badge--excellent';
    if (l === 'GOOD') return 'ai-badge--good';
    if (l === 'AVERAGE') return 'ai-badge--average';
    return 'ai-badge--low';
  }

  /** Probabilité d'entretien (repliée sur le score global). */
  protected interviewChance(result: AnalyseCvResult): number {
    return this.clampPct(result.interviewChance ?? result.score ?? 0);
  }

  /** Pourcentage borné 0-100 pour les jauges (expérience, études). */
  protected pct(value: number | null | undefined): number {
    return this.clampPct(value ?? 0);
  }

  private clampPct(value: number): number {
    return Math.max(0, Math.min(100, value));
  }

  protected readonly related = computed(() => {
    const current = this.offer();
    if (!current) return [];
    return this.offersService
      .allOffers()
      .filter((o) => o.departement === current.departement && o.id !== current.id)
      .slice(0, 3);
  });

  protected readonly formatDate = formatDeadline;

  /** Format « 12 août 2026 » pour les dates complètes. */
  protected formatFullDate(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${iso}T00:00:00`));
  }

  private loadedId = '';

  constructor() {
    effect(() => {
      const id = this.id() || this.route.snapshot.paramMap.get('id') || '';
      if (id && id !== this.loadedId) {
        this.loadedId = id;
        void this.load(id);
      }
    });
  }

  private async load(id: string): Promise<void> {
    void this.offersService.load();
    this.loading.set(true);
    this.notFound.set(false);
    this.aiState.set('idle');
    this.aiResult.set(null);
    this.aiError.set(null);
    this.applied.set(false);
    this.applySuccess.set(null);
    this.applyError.set(null);
    try {
      this.offer.set(await this.offersApi.getById(id));
    } catch {
      const fromCatalog = this.offersService.getById(id);
      if (fromCatalog) {
        this.offer.set(fromCatalog);
      } else {
        this.notFound.set(true);
      }
    } finally {
      this.loading.set(false);
    }
    void this.initCvStatus();
    void this.initAppliedState();
    this.scrollToFragment();
  }

  private async initCvStatus(): Promise<void> {
    this.cvStatus.set('checking');
    this.applyError.set(null);
    if (this.isAuthenticated() && this.isCandidat()) {
      try {
        const profile = await this.candidat.getMe();
        this.cvStatus.set(profile.cv ? 'ready' : 'none');
      } catch {
        this.cvStatus.set('none');
      }
    } else {
      this.cvStatus.set('none');
    }
  }

  /**
   * Restaure l'état « déjà postulé » depuis le backend au chargement,
   * afin qu'un rafraîchissement (ou une navigation) désactive correctement
   * le bouton « Postuler ». Best effort : une erreur ne bloque pas la page,
   * le serveur protège déjà par un 409.
   */
  private async initAppliedState(): Promise<void> {
    if (!this.isAuthenticated() || !this.isCandidat()) return;
    const offer = this.offer();
    if (!offer) return;
    try {
      const offreIds = await this.offersApi.myAppliedOffers();
      if (offreIds.includes(offer.id)) {
        this.applied.set(true);
        this.applySuccess.set('Vous avez déjà postulé à cette offre.');
      }
    } catch {
      /* silencieux */
    }
  }

  private scrollToFragment(): void {
    if (this.route.snapshot.fragment !== 'postuler') return;
    requestAnimationFrame(() => {
      document.getElementById('postuler')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  protected async onCvSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const validationError = this.validateCvFile(file);
    if (validationError) {
      this.cvUploadError.set(validationError);
      return;
    }
    this.cvUploading.set(true);
    this.cvProgress.set(0);
    this.cvUploadError.set(null);
    try {
      await this.candidat.uploadCv(file, (p) => this.cvProgress.set(p));
      this.cvStatus.set('ready');
    } catch (err) {
      this.cvUploadError.set(
        err instanceof ApiError ? err.message : 'Votre CV n\'a pas pu être envoyé.',
      );
    } finally {
      this.cvUploading.set(false);
    }
  }

  /** Validation rapide côté client (le serveur reste l'autorité finale). */
  private validateCvFile(file: File): string | null {
    if (file.size > 10 * 1024 * 1024) {
      return 'Le fichier dépasse 10 Mo. Taille maximale : 10 Mo.';
    }
    if (file.type && file.type !== 'application/pdf') {
      return 'Seuls les fichiers PDF sont acceptés pour le CV.';
    }
    return null;
  }

  protected async analyseCv(): Promise<void> {
    const offer = this.offer();
    if (!offer) return;
    if (this.aiState() === 'loading' || this.applying() || this.cvStatus() !== 'ready') return;

    this.aiState.set('loading');
    this.aiError.set(null);
    try {
      const result = await this.offersApi.analyseCv(offer.id);
      this.aiResult.set(result);
      this.aiState.set('done');
      this.animateRing(result.score);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        this.aiError.set(
          'Le service d\'analyse IA n\'est pas encore disponible pour cette offre.',
        );
      } else {
        this.aiError.set(
          err instanceof ApiError
            ? err.message
            : 'L\'analyse IA n\'est pas disponible pour le moment.',
        );
      }
      this.aiState.set('idle');
    }
  }

  /** Anime l'anneau du score (départ plein cercle → valeur cible). */
  private animateRing(score: number | null): void {
    const value = Math.max(0, Math.min(100, score ?? 0));
    const target = this.ringCircumference * (1 - value / 100);
    this.ringOffset.set(this.ringCircumference);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.ringOffset.set(target));
    });
  }

  /** Ouvre la confirmation si l'analyse IA n'a pas été faite, sinon postule. */
  protected async apply(): Promise<void> {
    const offer = this.offer();
    if (!offer) return;
    if (!this.isAuthenticated()) {
      this.router.navigate(['/connexion'], {
        queryParams: { retour: `/offres/${offer.id}` },
      });
      return;
    }
    if (!this.isCandidat() || this.applying() || this.applied() || this.aiState() === 'loading') {
      return;
    }
    if (this.aiState() !== 'done') {
      this.showConfirm.set(true);
      return;
    }
    await this.submitApplication();
  }

  /** Poursuit la candidature après confirmation (pas d'analyse IA). */
  protected async continueApply(): Promise<void> {
    this.showConfirm.set(false);
    await this.submitApplication();
  }

  /** Ferme la confirmation et lance l'analyse IA. */
  protected async analyzeFirst(): Promise<void> {
    this.showConfirm.set(false);
    await this.analyseCv();
  }

  protected closeConfirm(): void {
    this.showConfirm.set(false);
  }

  /** Ouvre la confirmation de suppression du CV. */
  protected requestCvDelete(): void {
    if (this.applying() || this.deletingCv()) return;
    this.deleteError.set(null);
    this.showDeleteConfirm.set(true);
  }

  protected closeDeleteConfirm(): void {
    this.showDeleteConfirm.set(false);
  }

  /** Supprime le CV puis réinitialise l'interface après l'animation. */
  protected async confirmDeleteCv(): Promise<void> {
    if (this.deletingCv()) return;
    this.deletingCv.set(true);
    this.deleteError.set(null);
    try {
      await this.candidat.deleteCv();
      this.showDeleteConfirm.set(false);
      this.cvLeaving.set(true);
      setTimeout(() => {
        this.resetAfterCvDelete();
        this.cvLeaving.set(false);
      }, 320);
    } catch (err) {
      this.deleteError.set(
        err instanceof ApiError ? err.message : 'Le CV n\'a pas pu être supprimé.',
      );
    } finally {
      this.deletingCv.set(false);
    }
  }

  /** Retour à l'état « Déposer mon CV » : plus de CV ni de résultat IA. */
  private resetAfterCvDelete(): void {
    this.cvStatus.set('none');
    this.aiState.set('idle');
    this.aiResult.set(null);
    this.aiError.set(null);
    this.ringOffset.set(this.ringCircumference);
    this.applyError.set(null);
    this.applySuccess.set(null);
    this.applied.set(false);
  }

  private async submitApplication(): Promise<void> {
    const offer = this.offer();
    if (!offer || this.applying()) return;

    this.applying.set(true);
    this.applyError.set(null);
    this.applySuccess.set(null);
    try {
      await this.offersApi.apply(offer.id);
      this.applied.set(true);
      this.applySuccess.set('Votre candidature a bien été envoyée. Bonne chance !');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        this.applied.set(true);
        this.applySuccess.set(err.message);
      } else {
        this.applyError.set(
          err instanceof ApiError ? err.message : 'Une erreur est survenue.',
        );
      }
    } finally {
      this.applying.set(false);
    }
  }
}
