import { AiIntegrityEvent, AiIntegrityEventName } from '../core/models/landing.models';

/**
 * MONITEUR D'INTÉGRITÉ DE L'ENTRETIEN IA.
 *
 * Enregistre UNIQUEMENT des événements techniques :
 *   - changement d'onglet / passage en arrière-plan (TAB_SWITCH) ;
 *   - fenêtre quittée (WINDOW_BLUR) ;
 *   - sortie du plein écran (FULLSCREEN_EXIT) ;
 *   - caméra/micro désactivés (CAMERA_DISABLED / MIC_DISABLED) ;
 *   - caméra/micro perdus — périphérique débranché (CAMERA_LOST / MIC_LOST) ;
 *   - interruption de connexion (NETWORK_DOWN / NETWORK_RECOVERED) ;
 *   - outil de développement détecté (DEVTOOLS_DETECTED) ;
 *   - tentative de copie / collage (COPY_ATTEMPT / PASTE_ATTEMPT) ;
 *   - début / fin de la session surveillée (SESSION_START / SESSION_END).
 *
 * Le plein écran est imposé pendant l'entretien : une sortie est consignée.
 *
 * GARANTIES DE CONFIDENTIALITÉ :
 *   - AUCUNE reconnaissance faciale ;
 *   - AUCUNE analyse biométrique ;
 *   - AUCUN verdict automatique de « triche » : le système ne fait que
 *     consigner des faits, sans juger de l'intention.
 *
 * Chaque événement est transmis au callback `onEvent` dès qu'il est connu :
 * c'est l'appelant qui décide de l'afficher, de suspendre l'entretien et de
 * l'envoyer au backend.
 */
export class IntegrityMonitor {
  private readonly onEvent: (event: AiIntegrityEvent) => void;

  private startedAt: number | null = null;
  private hiddenSince: number | null = null;
  private blurredSince: number | null = null;
  private offlineSince: number | null = null;
  private fullscreenWasActive = false;
  private disposed = false;

  private readonly listeners: Array<[EventTarget, string, EventListener]> = [];
  private readonly watched = new Set<MediaStreamTrack>();
  private readonly trackHandlers = new Map<
    MediaStreamTrack,
    { ended: EventListener; mute: EventListener }
  >();

  /** Contrôle de l'outil de développement ouvert (sondage toutes les 2 s). */
  private devtoolsTimer: ReturnType<typeof setInterval> | null = null;
  private lastDevtoolsEmit = 0;

  constructor(onEvent: (event: AiIntegrityEvent) => void) {
    this.onEvent = onEvent;
  }

  /** Démarre la surveillance et enregistre le début de session. */
  start(): void {
    if (this.startedAt) return;
    this.startedAt = Date.now();
    this.emit('SESSION_START');
    this.bind(window, 'blur', this.onWindowBlur);
    this.bind(window, 'focus', this.onWindowFocus);
    this.bind(document, 'visibilitychange', this.onVisibilityChange);
    this.bind(document, 'fullscreenchange', this.onFullscreenChange);
    this.bind(window, 'offline', this.onOffline);
    this.bind(window, 'online', this.onOnline);
    this.bindLockdown();
    this.startDevtoolsWatch();
  }

  /**
   * Termine la surveillance. `reason` documente l'état final ('completed'
   * entretien terminé normalement, 'interrupted' sinon) — sans jugement.
   */
  stop(reason: 'completed' | 'interrupted'): void {
    if (this.disposed) return;
    const now = Date.now();
    if (this.hiddenSince !== null) {
      this.emit('TAB_SWITCH', Math.max(0, Math.round((now - this.hiddenSince) / 1000)));
      this.hiddenSince = null;
    }
    if (this.blurredSince !== null) {
      this.emit('WINDOW_BLUR', Math.max(0, Math.round((now - this.blurredSince) / 1000)));
      this.blurredSince = null;
    }
    this.emit('SESSION_END', undefined, reason);
    this.dispose();
  }

  /** Enregistre un événement porteur (ex. désactivation caméra décidée par l'UI). */
  record(event: AiIntegrityEventName, detail?: string): void {
    this.emit(event, undefined, detail);
  }

  /**
   * Surveille les pistes du flux local : une fin de piste (débranché, arrêt
   * externe) ou une mise en sourdine (coupe navigateur/OS) est consignée.
   * @param kind 'video' pour la caméra, 'audio' pour le micro.
   */
  watchTracks(stream: MediaStream, kind: 'audio' | 'video'): void {
    const tracks = kind === 'video' ? stream.getVideoTracks() : stream.getAudioTracks();
    for (const track of tracks) {
      if (this.watched.has(track)) continue;
      this.watched.add(track);
      const ended: EventListener = () => {
        this.emit(kind === 'video' ? 'CAMERA_LOST' : 'MIC_LOST');
        this.watched.delete(track);
        this.trackHandlers.delete(track);
      };
      const mute: EventListener = () => {
        if (track.muted && document.visibilityState !== 'hidden') {
          this.emit(kind === 'video' ? 'CAMERA_DISABLED' : 'MIC_DISABLED');
        }
      };
      track.addEventListener('ended', ended);
      track.addEventListener('mute', mute);
      this.trackHandlers.set(track, { ended, mute });
    }
  }

  /** Cesse de surveiller des pistes (avant un arrêt volontaire par l'UI). */
  detachTracks(tracks: MediaStreamTrack[]): void {
    for (const track of tracks) {
      const handlers = this.trackHandlers.get(track);
      if (handlers) {
        track.removeEventListener('ended', handlers.ended);
        track.removeEventListener('mute', handlers.mute);
        this.trackHandlers.delete(track);
      }
      this.watched.delete(track);
    }
  }

  /** Nettoie tous les écouteurs (fin de page / destruction du composant). */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const [target, type, handler] of this.listeners) {
      target.removeEventListener(type, handler);
    }
    this.listeners.length = 0;
    for (const [track, handlers] of this.trackHandlers) {
      track.removeEventListener('ended', handlers.ended);
      track.removeEventListener('mute', handlers.mute);
    }
    this.trackHandlers.clear();
    this.watched.clear();
    if (this.devtoolsTimer) {
      clearInterval(this.devtoolsTimer);
      this.devtoolsTimer = null;
    }
  }

  // ─────────────────── Verrouillage (copier/coller, DevTools) ───────────────────

  private bindLockdown(): void {
    this.bind(window, 'keydown', this.onLockKeydown as EventListener);
    this.bind(document, 'copy', this.onLockCopy);
    this.bind(document, 'cut', this.onLockCopy);
    this.bind(document, 'paste', this.onLockPaste);
    this.bind(document, 'contextmenu', this.onLockContextMenu);
    this.bind(document, 'selectstart', this.onLockSelect);
  }

  private onLockKeydown = (event: KeyboardEvent): void => {
    const mod = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;
    const key = (event.key || '').toUpperCase();

    if (
      event.key === 'F12' ||
      (mod && shift && ['I', 'J', 'C'].includes(key)) ||
      (mod && key === 'U')
    ) {
      event.preventDefault();
      this.emit('DEVTOOLS_DETECTED');
      return;
    }
    if (mod && !shift && key === 'C') {
      event.preventDefault();
      this.emit('COPY_ATTEMPT');
      return;
    }
    if (mod && key === 'V') {
      event.preventDefault();
      this.emit('PASTE_ATTEMPT');
    }
  };

  private onLockCopy = (event: Event): void => {
    event.preventDefault();
    this.emit('COPY_ATTEMPT');
  };

  private onLockPaste = (event: Event): void => {
    event.preventDefault();
    this.emit('PASTE_ATTEMPT');
  };

  /** Menu contextuel et sélection de texte neutralisés (mode verrouillé). */
  private onLockContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  private onLockSelect = (event: Event): void => {
    event.preventDefault();
  };

  /** Sondage : une console d'outils de développement ouverte élargit la fenêtre. */
  private startDevtoolsWatch(): void {
    if (this.devtoolsTimer) return;
    this.devtoolsTimer = setInterval(() => {
      const widthDrift = (window.outerWidth || 0) - (window.innerWidth || 0);
      const heightDrift = (window.outerHeight || 0) - (window.innerHeight || 0);
      if (widthDrift > 160 || heightDrift > 160) {
        const now = Date.now();
        if (now - this.lastDevtoolsEmit > 30_000) {
          this.lastDevtoolsEmit = now;
          this.emit('DEVTOOLS_DETECTED');
        }
      }
    }, 2000);
  }

  // ─────────────────────────── Événements ───────────────────────────

  private emit(event: AiIntegrityEventName, duration?: number, detail?: string): void {
    if (this.disposed) return;
    const payload: AiIntegrityEvent = { event, timestamp: new Date().toISOString() };
    if (duration !== undefined && duration >= 0) payload.duration = duration;
    if (detail) payload.detail = detail;
    this.onEvent(payload);
  }

  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      if (this.hiddenSince === null) this.hiddenSince = Date.now();
      return;
    }
    if (this.hiddenSince !== null) {
      const duration = Math.max(0, Math.round((Date.now() - this.hiddenSince) / 1000));
      this.hiddenSince = null;
      if (duration > 0) this.emit('TAB_SWITCH', duration);
    }
  };

  private onWindowBlur = (): void => {
    // Le passage en arrière-plan est déjà couvert par `visibilitychange`.
    if (document.visibilityState === 'hidden') return;
    if (this.blurredSince === null) this.blurredSince = Date.now();
  };

  private onWindowFocus = (): void => {
    if (this.blurredSince !== null) {
      const duration = Math.max(0, Math.round((Date.now() - this.blurredSince) / 1000));
      this.blurredSince = null;
      if (duration > 0) this.emit('WINDOW_BLUR', duration);
    }
  };

  private onFullscreenChange = (): void => {
    const isFullscreen = Boolean(
      document.fullscreenElement ??
      (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement,
    );
    if (this.fullscreenWasActive && !isFullscreen) {
      this.emit('FULLSCREEN_EXIT');
    }
    this.fullscreenWasActive = isFullscreen;
  };

  private onOffline = (): void => {
    if (this.offlineSince === null) {
      this.offlineSince = Date.now();
      this.emit('NETWORK_DOWN');
    }
  };

  private onOnline = (): void => {
    if (this.offlineSince !== null) {
      const duration = Math.max(0, Math.round((Date.now() - this.offlineSince) / 1000));
      this.offlineSince = null;
      this.emit('NETWORK_RECOVERED', duration);
    }
  };

  private bind(target: EventTarget, type: string, handler: EventListener): void {
    target.addEventListener(type, handler);
    this.listeners.push([target, type, handler]);
  }
}
