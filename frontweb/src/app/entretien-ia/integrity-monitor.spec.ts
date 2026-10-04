import { IntegrityMonitor } from './integrity-monitor';
import { AiIntegrityEvent } from '../core/models/landing.models';

function collect() {
  const events: AiIntegrityEvent[] = [];
  const monitor = new IntegrityMonitor((event) => events.push(event));
  return { events, monitor };
}

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  });
}

function setFullscreen(active: boolean): void {
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    value: active ? document.documentElement : null,
  });
}

/** Piste factice compatible MediaStreamTrack (écouteurs d'événements). */
class FakeTrack {
  muted = false;
  readonly label = 'Webcam factice';
  private readonly listeners = new Map<string, Array<() => void>>();
  addEventListener = (type: string, fn: () => void) => {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  };
  removeEventListener = (type: string, fn: () => void) => {
    const list = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      list.filter((f) => f !== fn),
    );
  };
  emit(type: string) {
    (this.listeners.get(type) ?? []).forEach((fn) => fn());
  }
}

class FakeStream {
  readonly video = new FakeTrack();
  readonly audio = new FakeTrack();
  getVideoTracks() {
    return [this.video];
  }
  getAudioTracks() {
    return [this.audio];
  }
}

/** Traite FakeStream comme un MediaStream (stub de test). */
function asStream(s: FakeStream): MediaStream {
  return s as unknown as MediaStream;
}

describe('IntegrityMonitor', () => {
  afterEach(() => {
    setVisibility('visible');
    setFullscreen(false);
  });

  it('émet SESSION_START au démarrage puis SESSION_END à l’arrêt', () => {
    const { events, monitor } = collect();
    monitor.start();
    monitor.stop('completed');
    const names = events.map((e) => e.event);
    expect(names[0]).toBe('SESSION_START');
    expect(names[names.length - 1]).toBe('SESSION_END');
    expect(events[events.length - 1].detail).toBe('completed');
  });

  it('ne consigne plus aucun événement après l’arrêt', () => {
    vi.useFakeTimers();
    try {
      const { events, monitor } = collect();
      monitor.start();
      monitor.stop('interrupted');
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(2500);
      setVisibility('visible');
      document.dispatchEvent(new Event('visibilitychange'));
      const names = events.map((e) => e.event);
      expect(names).toEqual(['SESSION_START', 'SESSION_END']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('consigne TAB_SWITCH avec la durée de l’absence', () => {
    vi.useFakeTimers();
    try {
      const { events, monitor } = collect();
      monitor.start();
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(2000);
      setVisibility('visible');
      document.dispatchEvent(new Event('visibilitychange'));
      const tab = events.find((e) => e.event === 'TAB_SWITCH');
      expect(tab).toBeTruthy();
      expect(tab!.duration).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('consigne WINDOW_BLUR quand la fenêtre perd le focus (onglet visible)', () => {
    vi.useFakeTimers();
    try {
      const { events, monitor } = collect();
      monitor.start();
      window.dispatchEvent(new Event('blur'));
      vi.advanceTimersByTime(2500);
      window.dispatchEvent(new Event('focus'));
      expect(events.some((e) => e.event === 'WINDOW_BLUR')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('consigne FULLSCREEN_EXIT à la sortie du plein écran', () => {
    const { events, monitor } = collect();
    monitor.start();
    setFullscreen(true);
    document.dispatchEvent(new Event('fullscreenchange'));
    setFullscreen(false);
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(events.some((e) => e.event === 'FULLSCREEN_EXIT')).toBe(true);
  });

  it('consigne NETWORK_DOWN puis NETWORK_RECOVERED', () => {
    const { events, monitor } = collect();
    monitor.start();
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
    expect(events.some((e) => e.event === 'NETWORK_DOWN')).toBe(true);
    const recovered = events.find((e) => e.event === 'NETWORK_RECOVERED');
    expect(recovered).toBeTruthy();
    expect(recovered!.duration).toBe(0);
  });

  it('consigne CAMERA_LOST / MIC_LOST quand une piste se termine', () => {
    const { events, monitor } = collect();
    const stream = new FakeStream();
    monitor.start();
    monitor.watchTracks(asStream(stream), 'video');
    monitor.watchTracks(asStream(stream), 'audio');
    stream.video.emit('ended');
    stream.audio.emit('ended');
    expect(events.some((e) => e.event === 'CAMERA_LOST')).toBe(true);
    expect(events.some((e) => e.event === 'MIC_LOST')).toBe(true);
  });

  it('consigne CAMERA_DISABLED quand une piste vidéo est mise en sourdine', () => {
    const { events, monitor } = collect();
    const stream = new FakeStream();
    monitor.start();
    monitor.watchTracks(asStream(stream), 'video');
    stream.video.muted = true;
    stream.video.emit('mute');
    expect(events.some((e) => e.event === 'CAMERA_DISABLED')).toBe(true);
  });

  it('détache la surveillance d’une piste sur demande (arrêt volontaire UI)', () => {
    const { events, monitor } = collect();
    const stream = new FakeStream();
    monitor.start();
    monitor.watchTracks(asStream(stream), 'video');
    monitor.detachTracks(stream.getVideoTracks() as unknown as MediaStreamTrack[]);
    stream.video.emit('ended');
    expect(events.some((e) => e.event === 'CAMERA_LOST')).toBe(false);
  });

  it('consigne DEVTOOLS_DETECTED à la touche F12', () => {
    const { events, monitor } = collect();
    monitor.start();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12' }));
    expect(events.some((e) => e.event === 'DEVTOOLS_DETECTED')).toBe(true);
  });

  it('consigne DEVTOOLS_DETECTED à Ctrl+Maj+I et empêche l’inspection', () => {
    const { events, monitor } = collect();
    monitor.start();
    const event = new KeyboardEvent('keydown', {
      key: 'I',
      ctrlKey: true,
      shiftKey: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
    expect(events.some((e) => e.event === 'DEVTOOLS_DETECTED')).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it('consigne COPY_ATTEMPT sur Ctrl+C et bloque la copie', () => {
    const { events, monitor } = collect();
    monitor.start();
    const event = new KeyboardEvent('keydown', {
      key: 'c',
      ctrlKey: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
    expect(events.some((e) => e.event === 'COPY_ATTEMPT')).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it('consigne PASTE_ATTEMPT à Ctrl+V', () => {
    const { events, monitor } = collect();
    monitor.start();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }));
    expect(events.some((e) => e.event === 'PASTE_ATTEMPT')).toBe(true);
  });

  it('consigne COPY_ATTEMPT à l’événement natif copy et le bloque', () => {
    const { events, monitor } = collect();
    monitor.start();
    const event = new Event('copy', { cancelable: true });
    document.dispatchEvent(event);
    expect(events.some((e) => e.event === 'COPY_ATTEMPT')).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it('neutralise le menu contextuel et la sélection de texte', () => {
    const { monitor } = collect();
    monitor.start();
    const context = new Event('contextmenu', { cancelable: true });
    document.dispatchEvent(context);
    expect(context.defaultPrevented).toBe(true);
    const select = new Event('selectstart', { cancelable: true });
    document.dispatchEvent(select);
    expect(select.defaultPrevented).toBe(true);
  });

  it('détecte une console DevTools ouverte via la dérive de fenêtre', () => {
    vi.useFakeTimers();
    try {
      const { events, monitor } = collect();
      monitor.start();
      Object.defineProperty(window, 'outerWidth', { configurable: true, value: 1920 });
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1400 });
      Object.defineProperty(window, 'outerHeight', { configurable: true, value: 1080 });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
      vi.advanceTimersByTime(2200);
      expect(events.some((e) => e.event === 'DEVTOOLS_DETECTED')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('n’émet pas deux fois DEVTOOLS_DETECTED dans la même fenêtre de 30 s', () => {
    vi.useFakeTimers();
    try {
      const { events, monitor } = collect();
      monitor.start();
      Object.defineProperty(window, 'outerWidth', { configurable: true, value: 1920 });
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1400 });
      vi.advanceTimersByTime(6000);
      const detected = events.filter((e) => e.event === 'DEVTOOLS_DETECTED');
      expect(detected.length).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
