import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OffersApiService } from '../core/services/offers-api.service';
import { ApiError, API_BASE } from '../core/services/api.service';
import { TokenStorage } from '../core/services/token-storage.service';
import {
  AiIntegrityEvent,
  AiIntegrityEventName,
  AiIntegrityPayload,
  AiInterviewAnswer,
  AiInterviewQuestion,
  AiInterviewSession,
} from '../core/models/landing.models';
import { Icon } from '../shared/components/icon/icon';
import { Header } from '../landing/header/header';
import { Footer } from '../landing/footer/footer';
import { IntegrityMonitor } from './integrity-monitor';
import { computeDeviceFingerprint } from './device-fingerprint';

/**
 * Phase de l'interface « visioconférence » :
 *  - intro      → salle d'attente : présentation + vérification équipement ;
 *  - preparing  → « L'IA prépare sa réponse... » : attente de l'audio (TTS) ;
 *  - speaking   → « L'IA parle... » : la question est lue (TTS) ;
 *  - recording  → « À vous de répondre... » : le micro écoute/enregistre ;
 *  - analyzing  → « Analyse de votre réponse... » : STT + moteur IA ;
 *  - next       → courte transition avant la question suivante ;
 *  - done       → écran de confirmation.
 */
type Phase = 'intro' | 'preparing' | 'speaking' | 'recording' | 'analyzing' | 'next' | 'done';

interface TranscriptEntry {
  id: number;
  speaker: 'ai' | 'candidate';
  text: string;
  time: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  MOTIVATION: 'Motivation',
  PROJET: 'Projet',
  TECHNIQUE: 'Technique',
  RESOLUTION: 'Résolution de problème',
  COMPORTEMENTAL: 'Comportemental',
};

/** Formats audio acceptés par l'API TTS (Python). */
const RECORDER_MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];

/** Seuil (RMS 0..1) sous lequel l'analyseur considère le micro silencieux. */
const SILENCE_THRESHOLD = 0.04;
/** Nombre de mesures (≈250 ms) consécutives de silence avant arrêt automatique. */
const SILENCE_POLLS = 6;
/** Durée minimale d'enregistrement (s) avant qu'un silence puisse conclure. */
const MIN_RECORD_SECONDS = 4;

function audioMime(format: string): string {
  switch (format) {
    case 'mp3':
      return 'audio/mpeg';
    case 'ogg':
      return 'audio/ogg';
    case 'aac':
      return 'audio/aac';
    default:
      return 'audio/wav';
  }
}

/**
 * Page « Entretien IA » du portail candidat (route /entretien-ia/:token).
 *
 * Expérience type visioconférence (Meet/Teams) : avatar IA pleine scène,
 * aperçu caméra en incrustation, barre de contrôle (micro / caméra / son /
 * transcription / quitter). L'IA pose chaque question à voix haute (TTS) puis
 * bascule en écoute : le candidat répond au micro (MediaRecorder), la détection
 * de silence coupe automatiquement, le STT + le moteur IA produisent la question
 * suivante. Aucune donnée n'est mockée : tout transite par le backend Node qui
 * orchestre le microservice Python (moteur + voix). À la fin, le pourcentage de
 * réussite (score 0-100) est affiché au candidat et le lien du mail est bloqué.
 */
@Component({
  selector: 'app-entretien-ia',
  standalone: true,
  imports: [RouterLink, Icon, Header, Footer],
  templateUrl: './entretien-ia.html',
  styles: [
    `
      .page {
        padding-block: 44px 96px;
        background: var(--color-background);
        min-height: calc(100vh - var(--nav-height));
      }

      .interview {
        max-width: 760px;
        margin-inline: auto;
      }

      .interview-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-card);
        padding: 48px 44px;
        text-align: center;
      }

      .interview-card__badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-primary);
        background: var(--color-primary-tint);
        padding: 8px 16px;
        border-radius: var(--radius-pill);
        margin-bottom: 22px;
      }

      .interview-card__title {
        font-size: 30px;
        font-weight: 800;
        line-height: 1.2;
        margin-bottom: 10px;
      }

      .interview-card__name {
        color: var(--color-text-secondary);
        font-size: 15px;
        margin-bottom: 26px;
      }

      .interview-card__offer {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 700;
        color: var(--color-text-secondary);
        background: var(--color-background);
        border: 1px solid var(--color-border);
        padding: 9px 16px;
        border-radius: var(--radius-pill);
        margin-bottom: 30px;
      }

      .interview-card__offer app-icon {
        color: var(--color-primary);
      }

      .interview-card__instructions {
        color: var(--color-text-secondary);
        font-size: 15.5px;
        line-height: 1.7;
        max-width: 520px;
        margin: 0 auto 34px;
      }

      .interview-card__actions {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
      }

      .interview-card__actions .btn {
        min-width: 280px;
      }

      .interview-hint {
        font-size: 13px;
        color: var(--color-text-tertiary);
      }

      /* ---- Vérification de l'équipement ---- */
      .devices {
        text-align: left;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-background);
        padding: 18px 20px;
        margin-bottom: 30px;
      }

      .devices__row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px dashed var(--color-border);
      }

      .devices__row:last-child {
        border-bottom: none;
      }

      .devices__label {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 700;
        color: var(--color-text);
      }

      .devices__label app-icon {
        color: var(--color-primary);
      }

      .devices__status {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-size: 13.5px;
        font-weight: 800;
      }

      .devices__status--ok {
        color: #16a34a;
      }

      .devices__status--ko {
        color: #dc2626;
      }

      .devices__status--pending {
        color: var(--color-text-tertiary);
      }

      .devices__preview {
        width: 100%;
        max-height: 180px;
        object-fit: cover;
        border-radius: var(--radius-md);
        background: #0b1220;
        margin-bottom: 16px;
      }

      .devices__error {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        color: #dc2626;
        font-size: 14px;
        line-height: 1.6;
        margin-top: 12px;
      }

      /* ---- États (chargement / 403 / 404 / erreur) ---- */
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

      .state__icon--danger {
        background: #fdecec;
        color: #dc2626;
      }

      .state__code {
        font-size: 15px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
        margin-bottom: 8px;
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

      /* ---- Visioconférence ---- */
      .meeting {
        position: fixed;
        inset: 0;
        z-index: 40;
        display: flex;
        flex-direction: column;
        background: linear-gradient(180deg, #0b1220, #0e1730);
        color: #e7edf7;
      }

      .meeting__top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 14px 22px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      .meeting__brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .meeting__logo {
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        background: var(--color-primary);
        color: #fff;
        font-weight: 900;
        font-size: 13px;
        border-radius: 10px;
      }

      .meeting__title {
        font-weight: 800;
        font-size: 15px;
      }

      .meeting__meta {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .meeting__chip {
        font-size: 12.5px;
        font-weight: 800;
        background: rgba(255, 255, 255, 0.08);
        padding: 6px 12px;
        border-radius: 999px;
      }

      .meeting__timer {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-variant-numeric: tabular-nums;
        font-size: 13px;
        font-weight: 800;
        color: #9fb0cf;
      }

      .meeting__fullscreen {
        display: inline-grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: 9px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.06);
        color: #c6d2ea;
        cursor: pointer;
        transition:
          background 0.15s ease,
          color 0.15s ease;
      }

      .meeting__fullscreen:hover {
        background: rgba(255, 255, 255, 0.14);
        color: #fff;
      }

      .meeting__integrity-warning {
        position: absolute;
        top: 14px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 5;
        display: inline-flex;
        align-items: center;
        gap: 9px;
        max-width: min(720px, 92%);
        font-size: 13px;
        font-weight: 800;
        line-height: 1.45;
        color: #fde68a;
        background: rgba(69, 42, 8, 0.9);
        border: 1px solid rgba(250, 204, 21, 0.45);
        backdrop-filter: blur(4px);
        padding: 9px 16px;
        border-radius: 999px;
        text-align: center;
      }

      .suspend-overlay {
        position: fixed;
        inset: 0;
        z-index: 90;
        display: grid;
        place-items: center;
        background: rgba(4, 8, 18, 0.82);
        backdrop-filter: blur(5px);
        padding: 20px;
      }

      .suspend-overlay__card {
        width: min(440px, 100%);
        background: linear-gradient(160deg, #16223e, #0d1730);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 18px;
        padding: 30px 26px;
        text-align: center;
        color: #e7edf7;
      }

      .suspend-overlay__icon {
        width: 58px;
        height: 58px;
        margin: 0 auto 16px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        font-size: 26px;
        color: #fde68a;
        background: rgba(250, 204, 21, 0.14);
        border: 1px solid rgba(250, 204, 21, 0.35);
      }

      .suspend-overlay__card h3 {
        margin: 0 0 8px;
        font-size: 19px;
      }

      .suspend-overlay__card p {
        margin: 0 0 22px;
        font-size: 14px;
        line-height: 1.55;
        color: #c6d2ea;
      }

      .meeting__stage {
        position: relative;
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 24px;
        padding: 18px 24px 30px;
        min-height: 0;
        background: radial-gradient(
          1100px 480px at 50% -10%,
          rgba(0, 102, 204, 0.18),
          transparent 62%
        );
      }

      .tile {
        position: relative;
        border-radius: 16px;
        overflow: hidden;
        background: linear-gradient(160deg, #16223e, #0d1730);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .tile--ai {
        width: min(720px, 60vw);
        aspect-ratio: 16 / 9;
        display: grid;
        place-items: center;
      }

      .tile--self {
        width: min(280px, 22vw);
        aspect-ratio: 4 / 3;
        display: grid;
        place-items: center;
        align-self: flex-end;
        border: 2px solid rgba(255, 255, 255, 0.16);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
      }

      .tile__avatar-wrap {
        position: relative;
        display: grid;
        place-items: center;
      }

      .tile__avatar {
        width: 150px;
        height: 150px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 30%, #1e3c74, #0f2450);
        border: 3px solid rgba(255, 255, 255, 0.18);
        color: #cdd9f2;
        font-size: 64px;
        transition:
          border-color 0.2s,
          box-shadow 0.2s;
      }

      .tile--self .tile__avatar {
        width: 90px;
        height: 90px;
        font-size: 40px;
      }

      .tile__avatar--speaking {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 4px rgba(0, 102, 204, 0.25);
      }

      .tile__equalizer {
        position: absolute;
        bottom: -40px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: flex-end;
        gap: 5px;
        height: 28px;
      }

      .tile__equalizer span {
        width: 5px;
        border-radius: 3px;
        background: var(--color-primary);
        animation: eq 0.9s ease-in-out infinite;
      }

      .tile__equalizer span:nth-child(1) {
        animation-delay: 0s;
      }
      .tile__equalizer span:nth-child(2) {
        animation-delay: 0.12s;
      }
      .tile__equalizer span:nth-child(3) {
        animation-delay: 0.24s;
      }
      .tile__equalizer span:nth-child(4) {
        animation-delay: 0.36s;
      }
      .tile__equalizer span:nth-child(5) {
        animation-delay: 0.48s;
      }

      @keyframes eq {
        0%,
        100% {
          height: 30%;
        }
        50% {
          height: 100%;
        }
      }

      .tile__label {
        position: absolute;
        left: 14px;
        right: 14px;
        bottom: 12px;
        text-align: left;
        pointer-events: none;
      }

      .tile__label--self {
        text-align: center;
      }

      .tile__name {
        display: block;
        font-weight: 800;
        font-size: 15px;
        text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
      }

      .tile__subtitle {
        display: block;
        color: #9fb0cf;
        font-size: 12.5px;
        margin-top: 2px;
      }

      .tile__bubble {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        bottom: 54px;
        max-width: 86%;
        background: rgba(8, 16, 38, 0.88);
        border: 1px solid rgba(255, 255, 255, 0.14);
        backdrop-filter: blur(4px);
        border-radius: 14px;
        padding: 12px 18px;
        font-size: 15px;
        font-weight: 700;
        line-height: 1.5;
        color: #fff;
        text-align: center;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
      }

      .tile__bubble::after {
        content: '';
        position: absolute;
        bottom: -7px;
        left: 50%;
        transform: translateX(-50%) rotate(45deg);
        width: 14px;
        height: 14px;
        background: rgba(8, 16, 38, 0.88);
        border-right: 1px solid rgba(255, 255, 255, 0.14);
        border-bottom: 1px solid rgba(255, 255, 255, 0.14);
      }

      .tile__status {
        position: absolute;
        top: 14px;
        left: 14px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: #c6d2ea;
        background: rgba(8, 16, 38, 0.72);
        border: 1px solid rgba(255, 255, 255, 0.16);
        backdrop-filter: blur(4px);
        padding: 7px 13px;
        border-radius: 999px;
      }

      .tile__status-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #38bdf8;
      }

      .tile__status--active .tile__status-dot {
        background: #22c55e;
        animation: dot-pulse 1.1s ease-in-out infinite;
      }

      @keyframes dot-pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.3;
        }
      }

      .tile__video {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .tile__placeholder {
        display: grid;
        place-items: center;
        width: 100%;
        height: 100%;
      }

      .tile__speaking-ring {
        position: absolute;
        inset: 0;
        border-radius: 16px;
        border: 3px solid var(--color-primary);
        animation: ring-pulse 1.2s ease-out infinite;
        pointer-events: none;
      }

      @keyframes ring-pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(0, 102, 204, 0.5);
        }
        100% {
          box-shadow: 0 0 0 24px rgba(0, 102, 204, 0);
        }
      }

      .tile__micbadge {
        position: absolute;
        right: 12px;
        bottom: 12px;
        width: 38px;
        height: 38px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: var(--color-primary);
        color: #fff;
        font-size: 18px;
      }

      .tile__micbadge--off {
        background: #ef4444;
      }

      .meeting__status {
        position: absolute;
        bottom: 22px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 9px;
        font-size: 14px;
        font-weight: 800;
        color: #c6d2ea;
        background: rgba(8, 16, 38, 0.82);
        border: 1px solid rgba(255, 255, 255, 0.14);
        backdrop-filter: blur(4px);
        padding: 9px 16px;
        border-radius: 999px;
        white-space: nowrap;
      }

      .meeting__status--live {
        color: #fff;
        background: rgba(239, 68, 68, 0.92);
        border-color: transparent;
      }

      .meeting__record-time {
        font-variant-numeric: tabular-nums;
      }

      .meeting__error {
        position: absolute;
        bottom: 74px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 8px;
        color: #fecaca;
        background: rgba(127, 29, 29, 0.85);
        font-size: 13.5px;
        font-weight: 700;
        padding: 10px 16px;
        border-radius: 10px;
        max-width: 86%;
      }

      .meeting__sound-lock {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        text-align: center;
        background: rgba(8, 16, 38, 0.94);
        border: 1px solid rgba(255, 255, 255, 0.16);
        backdrop-filter: blur(6px);
        border-radius: 16px;
        padding: 26px 30px;
        max-width: 360px;
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
        z-index: 6;
      }

      .meeting__sound-lock-icon {
        width: 60px;
        height: 60px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: rgba(0, 102, 204, 0.2);
        color: var(--color-primary);
        font-size: 28px;
      }

      .meeting__sound-lock p {
        margin: 0;
        font-size: 14.5px;
        font-weight: 700;
        line-height: 1.5;
        color: #e7edf7;
      }

      .meeting__transcript {
        position: absolute;
        top: 70px;
        right: 16px;
        bottom: 96px;
        width: min(360px, 92vw);
        display: flex;
        flex-direction: column;
        background: rgba(10, 18, 38, 0.94);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 14px;
        backdrop-filter: blur(6px);
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
        z-index: 5;
      }

      .meeting__transcript-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        font-weight: 800;
        font-size: 14px;
      }

      .meeting__transcript-head span {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .meeting__transcript-close {
        background: none;
        border: none;
        color: #9fb0cf;
        cursor: pointer;
        font-size: 16px;
        display: grid;
        place-items: center;
        padding: 4px;
      }

      .meeting__transcript-list {
        flex: 1;
        overflow-y: auto;
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .meeting__transcript-empty {
        color: #7d8db0;
        font-size: 13.5px;
        text-align: center;
        padding: 24px 0;
      }

      .talk {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .talk__who {
        font-size: 12px;
        font-weight: 800;
        color: #9fb0cf;
      }

      .talk--ai .talk__who {
        color: var(--color-primary);
      }

      .talk__text {
        margin: 0;
        font-size: 14px;
        line-height: 1.5;
        color: #e7edf7;
        padding: 8px 12px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.05);
      }

      .talk--ai .talk__text {
        background: rgba(0, 102, 204, 0.16);
        border-left: 3px solid var(--color-primary);
      }

      .talk__time {
        font-size: 11px;
        color: #7d8db0;
      }

      .meeting__controls {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 10px;
        padding: 14px 20px 18px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }

      .ctl {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        min-width: 84px;
        background: rgba(255, 255, 255, 0.08);
        color: #e7edf7;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 10px 12px;
        cursor: pointer;
        font: inherit;
        transition:
          background 0.15s,
          transform 0.1s;
      }

      .ctl:hover {
        background: rgba(255, 255, 255, 0.16);
      }

      .ctl:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .ctl__icon {
        font-size: 20px;
        line-height: 1;
      }

      .ctl__label {
        font-size: 12px;
        font-weight: 700;
      }

      .ctl--active {
        background: #ef4444;
        border-color: #ef4444;
      }

      .ctl--active:hover {
        background: #dc2626;
      }

      .ctl--on {
        background: rgba(34, 197, 94, 0.18);
        border-color: rgba(34, 197, 94, 0.4);
        color: #86efac;
      }

      .ctl--off {
        background: rgba(255, 255, 255, 0.04);
        color: #9fb0cf;
      }

      .ctl--ghost {
        background: transparent;
      }

      .ctl--leave {
        background: #ef4444;
        border-color: #ef4444;
      }

      .ctl--leave:hover {
        background: #dc2626;
      }

      /* ---- Confirmation de départ ---- */
      .quit-modal {
        position: fixed;
        inset: 0;
        z-index: 50;
        display: grid;
        place-items: center;
        background: rgba(5, 15, 40, 0.55);
        padding: 20px;
      }

      .quit-modal__card {
        max-width: 420px;
        width: 100%;
        background: var(--color-surface);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-card);
        padding: 30px;
        text-align: center;
      }

      .quit-modal__icon {
        width: 56px;
        height: 56px;
        margin-inline: auto;
        display: grid;
        place-items: center;
        border-radius: 16px;
        background: #fef2f2;
        color: #dc2626;
        font-size: 26px;
        margin-bottom: 16px;
      }

      .quit-modal h3 {
        font-size: 20px;
        font-weight: 800;
        margin-bottom: 8px;
      }

      .quit-modal p {
        color: var(--color-text-secondary);
        font-size: 14.5px;
        line-height: 1.6;
        margin-bottom: 24px;
      }

      .quit-modal__actions {
        display: flex;
        gap: 12px;
        justify-content: center;
      }

      .btn--danger {
        color: #fff;
        background: #dc2626;
        border: 1px solid #dc2626;
      }

      .btn--danger:hover {
        background: #b91c1c;
        border-color: #b91c1c;
      }

      /* ---- Écran « Entretien terminé » ---- */
      .done__icon {
        width: 84px;
        height: 84px;
        margin-inline: auto;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: #ecfdf3;
        color: #16a34a;
        font-size: 40px;
        margin-bottom: 22px;
      }

      .done__message {
        color: var(--color-text-secondary);
        font-size: 15.5px;
        line-height: 1.7;
        max-width: 440px;
        margin: 0 auto 30px;
      }

      .done__score {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        margin: 0 auto 26px;
        padding: 20px 28px;
        max-width: 300px;
        border-radius: 18px;
        background: #eff6ff;
        border: 1px solid #dbeafe;
      }

      .done__score-icon {
        color: #2563eb;
        font-size: 26px;
        margin-bottom: 2px;
      }

      .done__score-value {
        font-size: 40px;
        font-weight: 800;
        color: #1d4ed8;
        line-height: 1;
      }

      .done__score-label {
        color: #1e40af;
        font-size: 13.5px;
        font-weight: 600;
      }

      @media (max-width: 860px) {
        .meeting__stage {
          flex-direction: column;
          gap: 16px;
        }

        .tile--ai {
          width: 100%;
        }

        .tile--self {
          width: 46%;
          align-self: center;
        }
      }

      @media (max-width: 560px) {
        .page {
          padding-block: 28px 72px;
        }

        .interview-card {
          padding: 32px 22px;
        }

        .interview-card__title {
          font-size: 24px;
        }

        .interview-card__actions .btn {
          min-width: 100%;
          width: 100%;
        }

        .meeting__top {
          padding: 10px 14px;
        }

        .meeting__chip {
          display: none;
        }

        .meeting__transcript {
          top: 62px;
          right: 8px;
          bottom: 92px;
        }

        .ctl {
          min-width: 64px;
          padding: 8px 10px;
        }

        .state {
          padding-block: 48px;
        }
      }
    `,
  ],
})
export class EntretienIa {
  readonly token = input.required<string>();

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly offersApi = inject(OffersApiService);
  private readonly tokenStorage = inject(TokenStorage);

  private readonly camPreview = viewChild<ElementRef<HTMLVideoElement>>('camPreview');

  protected readonly loading = signal(true);
  protected readonly forbidden = signal(false);
  protected readonly notFound = signal(false);
  protected readonly loadError = signal<string | null>(null);

  protected readonly session = signal<AiInterviewSession | null>(null);
  protected readonly completed = signal(false);
  protected readonly finalScore = signal<number | null>(null);

  protected readonly phase = signal<Phase>('intro');
  protected readonly starting = signal(false);
  protected readonly replaying = signal(false);
  protected readonly sending = signal(false);
  protected readonly finishing = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected readonly question = signal<AiInterviewQuestion | null>(null);
  protected readonly totalQuestions = signal(8);
  protected readonly answeredCount = signal(0);
  protected readonly savedAnswers = signal<Record<number, string>>({});

  protected readonly timerSeconds = signal(0);
  protected readonly recordSeconds = signal(0);
  protected readonly recordingLive = signal(false);

  protected readonly micOk = signal(false);
  protected readonly camOk = signal(false);
  protected readonly videoReady = signal(false);
  protected readonly deviceChecked = signal(false);
  protected readonly deviceError = signal<string | null>(null);
  protected readonly checkingDevices = signal(false);

  protected readonly serviceOk = signal(false);
  protected readonly serviceError = signal<string | null>(null);

  protected readonly confirmQuit = signal(false);

  protected readonly soundMuted = signal(false);
  protected readonly showTranscript = signal(false);
  protected readonly speakingNow = signal(false);
  protected readonly transcript = signal<TranscriptEntry[]>([]);
  protected readonly playbackBlocked = signal(false);

  protected readonly integrityWarning = signal<string | null>(null);
  protected readonly suspended = signal(false);
  protected readonly fullscreenActive = signal(false);

  private loadedToken = '';
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recorderMime = 'audio/webm';
  private recordChunks: Blob[] = [];
  private audioEl: HTMLAudioElement | null = null;
  private currentAudio: { base64: string; format: string } | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private recordTick: ReturnType<typeof setInterval> | null = null;
  private transitionTimer: ReturnType<typeof setTimeout> | null = null;

  /** Moniteur d'intégrité : uniquement des événements techniques (aucune biométrie). */
  private integrityMonitor: IntegrityMonitor | null = null;
  private integrityBuffer: AiIntegrityEvent[] = [];
  private integrityFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private integrityDevices: { camera?: string; microphone?: string } = {};
  private networkWarningActive = false;

  /** Empreinte d'appareil : envoyée au démarrage puis périodiquement (anti-triche). */
  private fingerprint: string | null = null;
  private fingerprintTimer: ReturnType<typeof setInterval> | null = null;

  /** Plein écran requis pendant l'entretien : réimposé s'il est quitté. */
  private fullscreenRequired = false;

  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private analyserTick: ReturnType<typeof setInterval> | null = null;
  private silencePolls = 0;
  private spokeOnce = false;

  private transcriptId = 0;

  protected readonly questionNumber = computed(() => this.question()?.question_number ?? 0);

  protected readonly progressPercent = computed(() => {
    const total = this.totalQuestions();
    if (!total) return 0;
    return (this.answeredCount() / total) * 100;
  });

  protected readonly canFinish = computed(() => this.answeredCount() > 0 && !this.suspended());

  protected readonly elapsedTime = computed(() => this.formatTime(this.timerSeconds()));
  protected readonly recordTime = computed(() => this.formatTime(this.recordSeconds()));

  /** L'IA est-elle en train de parler (TTS en cours) ? */
  protected readonly aiSpeaking = computed(() => this.phase() === 'speaking');

  /** Le candidat est-il en train de parler (micro actif + niveau audio) ? */
  protected readonly candidateSpeaking = computed(() => this.recordingLive() && this.speakingNow());

  /** Micro considéré « allumé » (badge + icône) dès la phase d'écoute. */
  protected readonly micOn = computed(() => this.recordingLive() || this.phase() === 'recording');

  protected readonly micDisabled = computed(() => {
    if (this.suspended()) return true;
    const p = this.phase();
    return (
      p === 'intro' ||
      p === 'preparing' ||
      p === 'speaking' ||
      p === 'analyzing' ||
      p === 'next' ||
      p === 'done'
    );
  });

  protected readonly canReplay = computed(
    () => this.phase() === 'recording' && !this.recordingLive() && !this.suspended(),
  );

  protected readonly micLabel = computed(() => {
    if (this.recordingLive()) return 'Arrêter';
    if (this.phase() === 'speaking') return 'Écoute…';
    if (this.phase() === 'analyzing') return 'Analyse…';
    if (this.phase() === 'preparing' || this.phase() === 'next') return 'Préparation…';
    return 'Micro';
  });

  protected readonly statusText = computed(() => {
    switch (this.phase()) {
      case 'preparing':
        return "L'IA prépare sa réponse…";
      case 'speaking':
        return "L'IA parle…";
      case 'recording':
        return this.recordingLive()
          ? this.speakingNow()
            ? 'Vous parlez…'
            : 'À vous de répondre'
          : 'À vous de répondre';
      case 'analyzing':
        return 'Analyse de votre réponse…';
      case 'next':
        return "L'IA prépare la question suivante…";
      default:
        return 'En entretien';
    }
  });

  protected readonly statusIcon = computed(() => {
    switch (this.phase()) {
      case 'preparing':
      case 'next':
        return 'loader';
      case 'speaking':
        return 'volume';
      case 'recording':
        return 'mic';
      case 'analyzing':
        return 'loader';
      default:
        return 'mic';
    }
  });

  /** Badge d'état affiché sur la tuile de l'IA. */
  protected readonly aiStatus = computed(() => {
    switch (this.phase()) {
      case 'preparing':
        return "L'IA prépare sa réponse…";
      case 'speaking':
        return "L'IA parle…";
      case 'recording':
        return this.recordingLive() ? "À l'écoute de votre réponse" : 'À vous de répondre';
      case 'analyzing':
        return 'Analyse de votre réponse…';
      case 'next':
        return "L'IA prépare la question suivante…";
      default:
        return 'En entretien';
    }
  });

  /** Sous-titre de la tuile candidat. */
  protected readonly selfStatus = computed(() => {
    if (this.recordingLive()) {
      return this.speakingNow() ? 'Vous parlez…' : 'À vous de répondre';
    }
    if (this.phase() === 'speaking') return "À l'écoute";
    if (this.phase() === 'analyzing') return 'Analyse en cours…';
    if (this.phase() === 'preparing' || this.phase() === 'next') return 'Patience…';
    return 'Vous';
  });

  constructor() {
    window.addEventListener('pagehide', this.onPageHide);
    document.addEventListener('fullscreenchange', this.onFullscreenState);
    effect(() => {
      const token = this.token() || this.route.snapshot.paramMap.get('token') || '';
      if (token && token !== this.loadedToken) {
        this.loadedToken = token;
        void this.load(token);
      }
    });
    effect(() => {
      if (this.camPreview() && this.stream) {
        this.attachVideo();
      }
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('pagehide', this.onPageHide);
    document.removeEventListener('fullscreenchange', this.onFullscreenState);
    this.stopIntegrityMonitor('interrupted');
    this.stopIntegrityFlush();
    this.stopFingerprintTracking();
    this.fullscreenRequired = false;
    this.suspended.set(false);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.videoReady.set(false);
  }

  private formatTime(total: number): string {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  private messageOf(err: unknown, fallback: string): string {
    return err instanceof ApiError ? err.message : fallback;
  }

  private nowLabel(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ─────────────────────────── Chargement ───────────────────────────

  private async load(token: string): Promise<void> {
    this.loading.set(true);
    this.forbidden.set(false);
    this.notFound.set(false);
    this.loadError.set(null);
    this.completed.set(false);
    this.session.set(null);
    this.serviceOk.set(false);
    this.serviceError.set(null);
    try {
      const session = await this.offersApi.getAiInterviewByToken(token);
      this.session.set(session);
      if (session.statut === 'TERMINE') {
        this.completed.set(true);
      } else if (session.statut === 'EN_COURS') {
        await this.resume(session.questions ?? [], session.answers ?? []);
      }
      if (session.statut !== 'TERMINE') {
        void this.checkService();
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        this.forbidden.set(true);
      } else if (err instanceof ApiError && err.status === 404) {
        this.notFound.set(true);
      } else {
        this.loadError.set(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  /** Reprend un entretien déjà commencé à la première question sans réponse. */
  private async resume(
    questions: AiInterviewQuestion[],
    answers: AiInterviewAnswer[],
  ): Promise<void> {
    const saved: Record<number, string> = {};
    for (const answer of answers) {
      saved[answer.question_number] = answer.answer ?? '';
    }
    this.savedAnswers.set(saved);
    this.answeredCount.set(Object.values(saved).filter((v) => v.trim()).length);
    this.totalQuestions.set(questions.length || 8);

    const next = questions.find((q) => !saved[q.question_number]?.trim());
    this.question.set(next ?? questions[questions.length - 1] ?? null);
    this.startTimer();
    this.startIntegrityMonitor();
    this.fullscreenRequired = true;
    this.forceFullscreen();

    this.phase.set('recording');
    this.recordingLive.set(false);
  }

  // ─────────────────────────── Intégrité ───────────────────────────

  /** Enregistre un événement d'intégrité et planifie son envoi (lot toutes les 30 s). */
  private onIntegrityEvent(event: AiIntegrityEvent): void {
    this.integrityBuffer.push(event);
    this.startIntegrityFlushTimer();
    this.applyIntegrityEvent(event.event);
  }

  private recordEvent(name: AiIntegrityEventName): void {
    const event: AiIntegrityEvent = { event: name, timestamp: new Date().toISOString() };
    this.onIntegrityEvent(event);
  }

  /** Effet des événements sur l'état de l'entretien (suspension temporaire). */
  private applyIntegrityEvent(name: AiIntegrityEventName): void {
    switch (name) {
      case 'SESSION_START':
      case 'SESSION_END':
        return;
      case 'NETWORK_DOWN':
        this.networkWarningActive = true;
        this.warnAndSuspend('⚠️ Connexion interrompue. L’entretien est temporairement suspendu.');
        return;
      case 'NETWORK_RECOVERED':
        this.networkWarningActive = false;
        this.clearWarningAndResume();
        return;
      case 'TAB_SWITCH':
        this.warnAndSuspend('⚠️ Vous avez quitté la fenêtre de l’entretien.');
        return;
      case 'WINDOW_BLUR':
        this.warnAndSuspend('⚠️ L’entretien requiert votre attention. Revenez à cette fenêtre.');
        return;
      case 'CAMERA_DISABLED':
        this.warnAndSuspend(
          '⚠️ Votre caméra a été désactivée. L’entretien est temporairement suspendu.',
        );
        return;
      case 'MIC_DISABLED':
        this.warnAndSuspend(
          '⚠️ Votre microphone a été désactivé. L’entretien est temporairement suspendu.',
        );
        return;
      case 'FULLSCREEN_EXIT':
        this.warnAndSuspend(
          '⚠️ Vous avez quitté le mode plein écran. L’entretien est temporairement suspendu.',
        );
        this.forceFullscreenSoon();
        return;
      case 'CAMERA_LOST':
        this.warnAndSuspend(
          '⚠️ La caméra est injoignable. L’entretien est temporairement suspendu.',
        );
        return;
      case 'MIC_LOST':
        this.warnAndSuspend(
          '⚠️ Le microphone est injoignable. L’entretien est temporairement suspendu.',
        );
        return;
      case 'DEVTOOLS_DETECTED':
        this.warnAndSuspend(
          '⚠️ Les outils de développement ont été détectés. L’entretien est temporairement suspendu.',
        );
        return;
      case 'COPY_ATTEMPT':
        this.warnAndSuspend('⚠️ La copie de contenu est interdite pendant l’entretien.');
        return;
      case 'PASTE_ATTEMPT':
        this.warnAndSuspend('⚠️ Le collage de contenu est interdit pendant l’entretien.');
        return;
      case 'DEVICE_CHANGE':
        this.warnAndSuspend(
          '⚠️ Un changement d’appareil a été détecté. L’entretien est temporairement suspendu.',
        );
        return;
    }
  }

  /** Réimpose le plein écran peu après une sortie (sans boucle de combat). */
  private forceFullscreenSoon(): void {
    setTimeout(() => this.forceFullscreen(), 1500);
  }

  /** Demande le plein écran (requis pendant l'entretien). Échec silencieux. */
  private forceFullscreen(): void {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
    if (!request || this.fullscreenActive()) return;
    void request.call(el).catch(() => undefined);
  }

  /** Envoie l'empreinte de l'appareil et suspend si un changement est détecté. */
  private async sendFingerprint(): Promise<void> {
    if (!this.loadedToken || this.suspended()) return;
    try {
      this.fingerprint ??= await computeDeviceFingerprint();
      const result = await this.offersApi.reportAiFingerprint(this.loadedToken, this.fingerprint);
      if (!result.matched && !result.first_time) {
        this.warnAndSuspend(
          '⚠️ Un changement d’appareil a été détecté. L’entretien est temporairement suspendu.',
        );
      }
    } catch {
      // Le serveur reprendra la vérification au prochain envoi.
    }
  }

  /** Démarre l'envoi périodique de l'empreinte d'appareil (toutes les 60 s). */
  private startFingerprintTracking(): void {
    this.stopFingerprintTracking();
    void this.sendFingerprint();
    this.fingerprintTimer = setInterval(() => void this.sendFingerprint(), 60_000);
  }

  private stopFingerprintTracking(): void {
    if (this.fingerprintTimer) {
      clearInterval(this.fingerprintTimer);
      this.fingerprintTimer = null;
    }
  }

  private warnAndSuspend(message: string): void {
    this.stopRecordingForSuspension();
    this.integrityWarning.set(message);
    this.suspended.set(true);
  }

  private clearWarningAndResume(): void {
    this.integrityWarning.set(null);
    this.suspended.set(false);
    this.watchTracks();
  }

  /** Interrompt proprement un enregistrement en cours (le chunk vide est ignoré). */
  private stopRecordingForSuspension(): void {
    this.teardownAnalyser();
    const recorder = this.mediaRecorder;
    this.mediaRecorder = null;
    this.recordingLive.set(false);
    if (this.recordTick) {
      clearInterval(this.recordTick);
      this.recordTick = null;
    }
    this.recordChunks = [];
    try {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
    } catch {
      // ignore
    }
  }

  /** Reprendre (bouton « Reprendre l’entretien » ou retour réseau). */
  protected resumeInterview(): void {
    this.forceFullscreen();
    this.clearWarningAndResume();
  }

  /** Démarre la surveillance d'intégrité (déclenchée au début de l'entretien). */
  private startIntegrityMonitor(): void {
    this.stopIntegrityMonitor('interrupted');
    this.integrityMonitor = new IntegrityMonitor((event) => this.onIntegrityEvent(event));
    this.integrityMonitor.start();
    this.watchTracks();
    this.startFingerprintTracking();
  }

  /** Mise à jour de la surveillance des pistes (après changement de caméra/micro). */
  private watchTracks(): void {
    const monitor = this.integrityMonitor;
    const stream = this.stream;
    if (!monitor || !stream) return;
    monitor.watchTracks(stream, 'video');
    monitor.watchTracks(stream, 'audio');
  }

  /** Planifie l'envoi du lot d'événements (toutes les 30 secondes). */
  private startIntegrityFlushTimer(): void {
    if (this.integrityFlushTimer) return;
    this.integrityFlushTimer = setTimeout(() => {
      this.integrityFlushTimer = null;
      this.flushIntegrity();
    }, 30_000);
  }

  private stopIntegrityFlush(): void {
    if (this.integrityFlushTimer) {
      clearTimeout(this.integrityFlushTimer);
      this.integrityFlushTimer = null;
    }
  }

  /** Envoie le lot d'événements en attente. */
  private flushIntegrity(): void {
    this.stopIntegrityFlush();
    if (!this.loadedToken || !this.integrityBuffer.length) return;

    const events = this.integrityBuffer;
    this.integrityBuffer = [];
    const payload: AiIntegrityPayload = { events };
    if (this.integrityDevices.camera || this.integrityDevices.microphone) {
      payload.devices = this.integrityDevices;
    }
    this.offersApi
      .reportAiIntegrity(this.loadedToken, payload)
      .catch(() => this.integrityBuffer.unshift(...events));
  }

  /** Clôture la session d'intégrité côté serveur (fin d'entretien, interruption). */
  private closeIntegritySession(reason: 'completed' | 'interrupted'): void {
    this.stopIntegrityMonitor(reason);
    this.flushIntegrity();
  }

  private stopIntegrityMonitor(reason: 'completed' | 'interrupted'): void {
    if (!this.integrityMonitor) return;
    this.integrityMonitor.stop(reason);
    this.integrityMonitor = null;
  }

  /** Clôture d'urgence à la fermeture / navigation (fetch keepalive). */
  private onPageHide = (): void => {
    this.stopIntegrityMonitor('interrupted');
    const events = this.integrityBuffer;
    this.integrityBuffer = [];
    if (!this.loadedToken || !events.length) return;
    const token = this.tokenStorage.getToken();
    if (!token) return;
    const payload: AiIntegrityPayload = { events };
    if (this.integrityDevices.camera || this.integrityDevices.microphone) {
      payload.devices = this.integrityDevices;
    }
    try {
      void fetch(`${API_BASE}/entretien-ia/${this.loadedToken}/integrity`, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      }).catch(() => undefined);
    } catch {
      this.integrityBuffer = [...events, ...this.integrityBuffer];
    }
  };

  /** Relance le chargement après une erreur passagère. */
  protected reload(): void {
    if (this.loadedToken) {
      void this.load(this.loadedToken);
    }
  }

  // ─────────────────── Équipement (micro + caméra) ───────────────────

  /** Vérifie le micro et la caméra (permissions + périphériques disponibles). */
  protected async checkDevices(): Promise<void> {
    this.checkingDevices.set(true);
    this.deviceError.set(null);
    try {
      await Promise.all([this.ensureStream(), this.checkService()]);
      this.deviceChecked.set(true);
    } catch (err) {
      this.deviceChecked.set(false);
      this.deviceError.set(this.describeDeviceError(err));
    } finally {
      this.checkingDevices.set(false);
    }
  }

  /** Vérifie que le service d’entretien IA (backend → Python) répond avant de proposer de rejoindre. */
  private async checkService(): Promise<void> {
    try {
      await this.offersApi.checkAiServiceHealth();
      this.serviceOk.set(true);
      this.serviceError.set(null);
    } catch (err) {
      this.serviceOk.set(false);
      this.serviceError.set(
        this.messageOf(
          err,
          'Le service d’entretien IA (Python) est indisponible. Réessayez dans quelques instants.',
        ),
      );
    }
  }

  private async ensureStream(): Promise<void> {
    if (this.stream) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('mediaDevices');
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    this.stream = stream;
    this.micOk.set(stream.getAudioTracks().length > 0);
    this.camOk.set(stream.getVideoTracks().length > 0);
    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];
    if (videoTrack?.label) this.integrityDevices.camera = videoTrack.label;
    if (audioTrack?.label) this.integrityDevices.microphone = audioTrack.label;
    this.attachVideo();
    this.watchTracks();
  }

  private describeDeviceError(err: unknown): string {
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'NotAllowedError') {
      return 'Vous avez refusé l’accès au micro et à la caméra. Autorisez-les dans le navigateur puis réessayez.';
    }
    if (name === 'NotFoundError') {
      return 'Aucun micro ni caméra détecté sur cet appareil. Branchez un périphérique puis réessayez.';
    }
    if (name === 'NotReadableError') {
      return 'Le micro ou la caméra est utilisé par une autre application. Fermez-la puis réessayez.';
    }
    return 'Impossible d’accéder au micro ou à la caméra. Vérifiez votre navigateur et vos permissions.';
  }

  /** Rattaché à chaque rendu : affiche le flux vidéo local (aperçu ou réunion). */
  private attachVideo(): void {
    const el = this.camPreview();
    if (!el || !this.stream) {
      this.videoReady.set(false);
      return;
    }
    const video = el.nativeElement;
    if (video.srcObject !== this.stream) {
      try {
        video.srcObject = this.stream;
      } catch {
        // Environnement sans support des médias (tests jsdom) : on continue.
      }
    }
    try {
      const playResult = video.play();
      if (playResult !== undefined) {
        void playResult.catch(() => undefined);
      }
    } catch {
      // Lecture non autorisée hors navigateur : ignorée.
    }
    const live = this.stream.getVideoTracks().some((track) => track.readyState !== 'ended');
    this.videoReady.set(live);
  }

  // ─────────────────────────── Démarrage ───────────────────────────

  protected async beginInterview(): Promise<void> {
    this.starting.set(true);
    this.actionError.set(null);
    try {
      await this.ensureStream();
      const started = await this.offersApi.startAiInterview(this.loadedToken);
      this.question.set(started.question);
      this.totalQuestions.set(started.total_questions || 8);
      this.answeredCount.set(0);
      this.savedAnswers.set({});
      this.startTimer();
      this.startIntegrityMonitor();
      this.fullscreenRequired = true;
      this.forceFullscreen();
      this.logAi(started.question);
      this.playQuestionAudio(started.audio, started.audio_format);
    } catch (err) {
      this.actionError.set(this.messageOf(err, 'Impossible de démarrer l’entretien. Réessayez.'));
    } finally {
      this.starting.set(false);
    }
  }

  // ─────────────────────────── Audio (TTS) ───────────────────────────

  private playQuestionAudio(base64: string, format: string): void {
    this.stopAudio();
    this.playbackBlocked.set(false);
    if (!base64) {
      this.actionError.set("L'audio de la question est vide. Réessayez ou utilisez « Rejouer ».");
      this.phase.set('recording');
      return;
    }
    this.currentAudio = { base64, format };
    const audio = new Audio();
    const bytes = this.base64ToBytes(base64);
    const audioBytes = new Uint8Array(bytes.byteLength);
    audioBytes.set(bytes);
    const blob = new Blob([audioBytes.buffer as ArrayBuffer], { type: audioMime(format) });
    audio.src = URL.createObjectURL(blob);
    audio.muted = this.soundMuted();
    audio.onended = () => void this.startRecording();
    audio.onerror = () => {
      this.actionError.set('Impossible de lire la question. Réessayez ou utilisez « Rejouer ».');
      this.phase.set('recording');
    };
    console.info('[TTS] playback requested', { format, bytes: base64.length });
    const playResult = audio.play();
    if (playResult !== undefined) {
      playResult
        .then(() => {
          this.playbackBlocked.set(false);
        })
        .catch((err: unknown) => {
          const name = err instanceof DOMException ? err.name : '';
          console.warn('[TTS] lecture bloquée par le navigateur', name);
          if (name === 'NotAllowedError') {
            this.playbackBlocked.set(true);
            this.phase.set('speaking');
          } else {
            this.actionError.set(
              'Impossible de lire la question. Réessayez ou utilisez « Rejouer ».',
            );
            this.phase.set('recording');
          }
        });
    }
    this.audioEl = audio;
    this.phase.set('speaking');
  }

  /** Relance la lecture après déblocage de l'autoplay (geste utilisateur). */
  protected resumePlayback(): void {
    this.playbackBlocked.set(false);
    const audio = this.audioEl;
    if (audio) {
      console.info('[TTS] playback requested (relance manuelle)');
      void audio.play().catch((err: unknown) => {
        console.warn('[TTS] lecture toujours bloquée', err);
        this.playbackBlocked.set(true);
      });
      return;
    }
    if (this.currentAudio) {
      this.playQuestionAudio(this.currentAudio.base64, this.currentAudio.format);
    }
  }

  private base64ToBytes(base64: string): Uint8Array {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  }

  private stopAudio(): void {
    if (this.audioEl) {
      this.audioEl.onended = null;
      this.audioEl.onerror = null;
      this.audioEl.pause();
      this.audioEl.src = '';
      this.audioEl = null;
    }
    if (this.currentAudio) {
      this.currentAudio = null;
    }
  }

  /** « Rejouer » : resynthétise la question (TTS) puis la relit à voix haute. */
  protected async replayQuestion(): Promise<void> {
    const q = this.question();
    if (!q || !this.canReplay()) return;
    this.replaying.set(true);
    this.actionError.set(null);
    this.phase.set('preparing');
    try {
      await this.ensureStream();
      const synth = await this.offersApi.synthesizeAiQuestion(this.loadedToken, q.question);
      this.playQuestionAudio(synth.audio, synth.audio_format);
    } catch (err) {
      this.actionError.set(this.messageOf(err, 'Impossible de rejouer la question.'));
      this.phase.set('recording');
    } finally {
      this.replaying.set(false);
    }
  }

  // ─────────────────────────── Enregistrement ───────────────────────────

  private async startRecording(): Promise<void> {
    if (this.phase() === 'done' || this.suspended()) return;
    try {
      if (!this.stream) {
        await this.ensureStream();
      }
      const track = this.stream!.getAudioTracks()[0];
      if (!track) {
        this.phase.set('recording');
        this.recordingLive.set(false);
        this.actionError.set('Aucun micro détecté. Vérifiez votre équipement.');
        return;
      }

      const MimeType =
        typeof MediaRecorder !== 'undefined'
          ? (RECORDER_MIMES.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? 'audio/webm')
          : 'audio/webm';
      const recorder = new MediaRecorder(new MediaStream([track]), {
        mimeType: MimeType,
      });
      this.recorderMime = MimeType;
      this.recordChunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.recordChunks.push(event.data);
      };
      recorder.onstop = () => void this.onRecordingStop();
      this.recordSeconds.set(0);
      this.silencePolls = 0;
      this.spokeOnce = false;
      this.recordTick = setInterval(() => this.recordSeconds.update((s) => s + 1), 1000);
      this.mediaRecorder = recorder;
      this.actionError.set(null);
      recorder.start();
      this.phase.set('recording');
      this.recordingLive.set(true);
      this.setupAnalyser();
    } catch {
      this.phase.set('recording');
      this.recordingLive.set(false);
      this.actionError.set('Impossible d’enregistrer le micro. Vérifiez votre équipement.');
    }
  }

  /** Bascule micro : lancer l'écoute ou arrêter et envoyer la réponse. */
  protected toggleMic(): void {
    if (this.recordingLive()) {
      this.stopAndSend();
    } else if (this.phase() === 'recording') {
      void this.startRecording();
    }
  }

  protected stopAndSend(): void {
    const recorder = this.mediaRecorder;
    if (!recorder || recorder.state === 'inactive') return;
    this.teardownAnalyser();
    this.phase.set('analyzing');
    this.actionError.set(null);
    try {
      recorder.stop();
    } catch {
      void this.onRecordingStop();
    }
  }

  private async onRecordingStop(): Promise<void> {
    if (this.recordTick) {
      clearInterval(this.recordTick);
      this.recordTick = null;
    }
    this.recordingLive.set(false);
    const blob = new Blob(this.recordChunks, { type: this.recorderMime });
    if (blob.size === 0) {
      this.actionError.set('Aucun son détecté. Réessayez votre réponse.');
      this.phase.set('recording');
      return;
    }
    await this.sendAnswer(blob);
  }

  private async sendAnswer(blob: Blob): Promise<void> {
    const q = this.question();
    const number = q ? q.question_number : 1;
    this.sending.set(true);
    this.actionError.set(null);
    try {
      const result = await this.offersApi.sendAudioAnswer(
        this.loadedToken,
        number,
        blob,
        `reponse-${number}.webm`,
        blob.type || 'audio/webm',
        this.recordSeconds(),
      );

      this.savedAnswers.update((saved) => ({ ...saved, [number]: result.answer_text }));
      this.answeredCount.set(Object.keys(this.savedAnswers()).length);
      this.logCandidate(result.answer_text);

      if (result.done) {
        this.finishing.set(true);
        try {
          const outcome = await this.offersApi.completeAiInterview(this.loadedToken);
          this.finalScore.set(outcome.score ?? null);
        } catch {
          // L'entretien est terminé côté serveur ; on affiche la confirmation.
        }
        this.closeIntegritySession('completed');
        this.stopAll();
        this.completed.set(true);
        this.phase.set('done');
        return;
      }

      if (result.next_question) {
        this.question.set(result.next_question);
        this.logAi(result.next_question);
        this.phase.set('next');
        this.transitionTimer = setTimeout(() => {
          if (result.audio) {
            this.playQuestionAudio(result.audio, result.audio_format ?? 'wav');
          } else {
            this.phase.set('recording');
          }
        }, 1400);
      } else {
        this.phase.set('recording');
      }
    } catch (err) {
      this.actionError.set(this.messageOf(err, 'Impossible d’analyser votre réponse. Réessayez.'));
      this.phase.set('recording');
    } finally {
      this.sending.set(false);
    }
  }

  // ─────────────────────────── Détection de silence ───────────────────────────

  /**
   * Analyse en continu le niveau sonore du micro (AnalyserNode). Ignoré dans
   * les environnements sans AudioContext (tests jsdom) : l'arrêt reste manuel.
   */
  private setupAnalyser(): void {
    this.teardownAnalyser();
    if (typeof AudioContext === 'undefined' || !this.stream) return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      const ctx = new Ctor();
      const source = ctx.createMediaStreamSource(this.stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      this.audioCtx = ctx;
      this.analyser = analyser;
      this.analyserTick = setInterval(() => this.pollLevel(), 250);
    } catch {
      this.teardownAnalyser();
    }
  }

  private pollLevel(): void {
    const analyser = this.analyser;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const norm = (data[i] - 128) / 128;
      sum += norm * norm;
    }
    const rms = Math.sqrt(sum / data.length);

    if (rms < SILENCE_THRESHOLD) {
      this.speakingNow.set(false);
      this.silencePolls++;
      if (
        this.spokeOnce &&
        this.silencePolls >= SILENCE_POLLS &&
        this.recordSeconds() >= MIN_RECORD_SECONDS
      ) {
        this.stopAndSend();
      }
    } else {
      this.speakingNow.set(true);
      this.spokeOnce = true;
      this.silencePolls = 0;
    }
  }

  private teardownAnalyser(): void {
    if (this.analyserTick) {
      clearInterval(this.analyserTick);
      this.analyserTick = null;
    }
    this.analyser = null;
    if (this.audioCtx) {
      void this.audioCtx.close().catch(() => undefined);
      this.audioCtx = null;
    }
  }

  // ─────────────────────── Contrôles de la réunion ───────────────────────

  /** Coupe / réactive la caméra (piste vidéo du flux local). */
  protected toggleCam(): void {
    if (!this.stream) return;
    if (this.camOk()) {
      this.integrityMonitor?.detachTracks(this.stream!.getVideoTracks());
      this.stream.getVideoTracks().forEach((track) => track.stop());
      this.camOk.set(false);
      this.recordEvent('CAMERA_DISABLED');
      this.watchTracks();
    } else {
      void this.enableCam();
    }
  }

  private async enableCam(): Promise<void> {
    try {
      if (!this.stream) await this.ensureStream();
      if (!this.stream!.getVideoTracks().length) {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const track = videoStream.getVideoTracks()[0];
        if (track && this.stream) this.stream.addTrack(track);
      }
      this.camOk.set(true);
      this.attachVideo();
      this.watchTracks();
    } catch {
      this.actionError.set('Impossible de réactiver la caméra.');
    }
  }

  /** Coupe / rétablit le son des questions (TTS). */
  protected toggleSound(): void {
    const muted = !this.soundMuted();
    this.soundMuted.set(muted);
    if (this.audioEl) {
      this.audioEl.muted = muted;
    }
    if (!muted && this.playbackBlocked()) {
      this.resumePlayback();
    }
  }

  /** Ouvre / ferme le panneau de transcription. */
  protected toggleTranscript(): void {
    this.showTranscript.update((v) => !v);
  }

  /** Passe la réunion en plein écran (ou en sort). */
  protected toggleFullscreen(): void {
    const doc = document as Document & {
      exitFullscreen?: () => Promise<void>;
      webkitExitFullscreen?: () => Promise<void>;
    };
    if (this.fullscreenActive()) {
      const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen;
      void exit?.call(doc).catch(() => undefined);
    } else {
      void document.documentElement.requestFullscreen?.().catch(() => undefined);
    }
  }

  private onFullscreenState = (): void => {
    this.fullscreenActive.set(
      Boolean(
        document.fullscreenElement ??
        (document as Document & { webkitFullscreenElement?: Element | null })
          .webkitFullscreenElement,
      ),
    );
  };

  private logAi(question: AiInterviewQuestion): void {
    this.transcript.update((list) => [
      ...list,
      {
        id: ++this.transcriptId,
        speaker: 'ai',
        text: question.question,
        time: this.nowLabel(),
      },
    ]);
  }

  private logCandidate(text: string): void {
    if (!text.trim()) return;
    this.transcript.update((list) => [
      ...list,
      {
        id: ++this.transcriptId,
        speaker: 'candidate',
        text,
        time: this.nowLabel(),
      },
    ]);
  }

  // ─────────────────────────── Fin de l'entretien ───────────────────────────

  /** Termine l'entretien manuellement (au moins une réponse enregistrée). */
  protected async finishInterview(): Promise<void> {
    if (!this.canFinish() || this.finishing()) return;
    this.finishing.set(true);
    this.actionError.set(null);
    try {
      const outcome = await this.offersApi.completeAiInterview(this.loadedToken);
      this.finalScore.set(outcome.score ?? null);
      this.closeIntegritySession('completed');
      this.stopAll();
      this.completed.set(true);
      this.phase.set('done');
    } catch (err) {
      this.actionError.set(this.messageOf(err, 'Impossible de terminer l’entretien.'));
    } finally {
      this.finishing.set(false);
    }
  }

  /** Quitter (depuis la modale de confirmation) : bloque le lien du mail. */
  protected leaveInterview(): void {
    this.confirmQuit.set(false);
    // Best effort : l'entretien passe en ABANDONNE et le lien devient inactif.
    void this.offersApi.quitAiInterview(this.loadedToken).catch(() => undefined);
    this.closeIntegritySession('interrupted');
    this.stopAll();
    void this.router.navigate(['/']);
  }

  private stopAll(): void {
    this.stopIntegrityMonitor('interrupted');
    this.stopIntegrityFlush();
    this.stopFingerprintTracking();
    this.fullscreenRequired = false;
    this.suspended.set(false);
    this.integrityWarning.set(null);
    this.networkWarningActive = false;
    this.fullscreenActive.set(false);
    this.stopAudio();
    this.stopTimer();
    this.teardownAnalyser();
    if (this.recordTick) {
      clearInterval(this.recordTick);
      this.recordTick = null;
    }
    if (this.transitionTimer) {
      clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
    this.mediaRecorder = null;
    this.recordingLive.set(false);
    this.playbackBlocked.set(false);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.micOk.set(false);
    this.camOk.set(false);
    this.videoReady.set(false);
  }

  private startTimer(): void {
    if (this.timer) return;
    this.timerSeconds.set(0);
    this.timer = setInterval(() => this.timerSeconds.update((s) => s + 1), 1000);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  protected fullName(): string {
    const session = this.session();
    if (!session) return '';
    return [session.candidat.prenom, session.candidat.nom].filter(Boolean).join(' ');
  }
}
