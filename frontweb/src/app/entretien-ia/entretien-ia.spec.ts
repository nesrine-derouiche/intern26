import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterOutlet, provideRouter, withComponentInputBinding } from '@angular/router';
import { EntretienIa } from './entretien-ia';
import { OffersApiService } from '../core/services/offers-api.service';
import { AuthService } from '../core/services/auth.service';
import { ApiError } from '../core/services/api.service';
import {
  AiInterviewAnswer,
  AiInterviewAnswerResult,
  AiInterviewQuestion,
  AiInterviewSession,
  AiInterviewStarted,
  AiInterviewStatut,
} from '../core/models/landing.models';

const TOKEN = 'tok-123';

const QUESTIONS: AiInterviewQuestion[] = Array.from({ length: 8 }, (_, i) => ({
  id: `q-${i + 1}`,
  question_number: i + 1,
  categorie: 'MOTIVATION',
  question: `Question numéro ${i + 1} ?`,
}));

const AUDIO_B64 = 'V0FW';

function makeContext(
  statut: AiInterviewStatut,
  answers: AiInterviewAnswer[] = [],
  questions: AiInterviewQuestion[] = QUESTIONS,
): AiInterviewSession {
  return {
    id: 'session-1',
    token: TOKEN,
    statut,
    evaluation_status: statut === 'TERMINE' ? 'EVALUEE' : null,
    date_candidature: '2026-08-05T10:00:00.000Z',
    candidat: { prenom: 'Marwa', nom: 'Sassi' },
    offre: {
      id: 'offre-1',
      titre: 'Développeur Web Fullstack',
      departement_nom: 'DSI',
      duree: 24,
      competences: ['Angular'],
      technologies: ['TypeScript'],
    },
    candidature: {
      id: 'cand-1',
      statut: statut === 'TERMINE' ? 'AI_INTERVIEW_PASSED' : 'RH_ACCEPTED',
    },
    ...(statut === 'EN_COURS' ? { questions, answers } : {}),
  };
}

interface StubOptions {
  context?: AiInterviewSession | (() => Promise<AiInterviewSession>);
  health?: () => Promise<{ ok: boolean }>;
  start?: () => Promise<AiInterviewStarted>;
  answer?: (q: number) => Promise<AiInterviewAnswerResult>;
  complete?: () => Promise<{ statut: string; evaluation_status: string; score?: number | null }>;
  user?: { role: string } | null;
  fingerprint?: () => Promise<{
    matched: boolean;
    first_time: boolean;
    risk: {
      score: number;
      level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
      flags: string[];
      computed_at: string | null;
    };
  }>;
}

class FakeTrack {
  stop = () => {};
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
  readonly audio = new FakeTrack();
  readonly video = new FakeTrack();
  readonly tracks: FakeTrack[] = [this.audio, this.video];
  getAudioTracks() {
    return [this.audio];
  }
  getVideoTracks() {
    return [this.video];
  }
  getTracks() {
    return this.tracks;
  }
  addTrack(track: FakeTrack) {
    this.tracks.push(track);
  }
}

class FakeMediaStream {
  getTracks() {
    return [];
  }
}

class FakeMediaRecorder {
  static isTypeSupported = () => true;
  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['fake-audio'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

const audioEls: FakeAudio[] = [];

/** Quand vrai, les lectures audio échouent avec NotAllowedError (autoplay bloqué). */
let blockAutoplay = false;

class FakeAudio {
  src = '';
  muted = false;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = () =>
    blockAutoplay
      ? Promise.reject(new DOMException('Lecture automatique bloquée', 'NotAllowedError'))
      : Promise.resolve();
  pause = () => {};
  constructor() {
    audioEls.push(this);
  }
}

function lastAudio(): FakeAudio {
  return audioEls[audioEls.length - 1];
}

function installBrowserStubs(): void {
  vi.stubGlobal('MediaStream', FakeMediaStream);
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  vi.stubGlobal('Audio', FakeAudio);
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: () => 'blob:fake',
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: () => Promise.resolve(new FakeStream()) },
  });
}

@Component({
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
class Host {}

function authStub(user: { role: string } | null) {
  return {
    isAuthenticated: () => !!user,
    isCandidat: () => user?.role === 'CANDIDAT',
    user: () => user,
    fullName: () => '',
    refreshUser: () => Promise.resolve(null),
    logout: () => {},
  };
}

/** Normalise les apostrophes (droites / typographiques) pour des assertions robustes. */
function norm(t: string): string {
  return t.replace(/['’]/g, "'");
}

async function settle(fixture: ReturnType<typeof TestBed.createComponent>): Promise<void> {
  await fixture.whenStable();
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }
}

const DEFAULT_START: () => Promise<AiInterviewStarted> = async () => ({
  question: QUESTIONS[0],
  total_questions: 8,
  audio: AUDIO_B64,
  audio_format: 'wav',
});

const DEFAULT_ANSWER = async (_token: string, q: number): Promise<AiInterviewAnswerResult> => ({
  answer_text: `Réponse ${q}`,
  question_number: q,
  next_question: q < 8 ? QUESTIONS[q] : null,
  done: q >= 8,
  audio: q < 8 ? AUDIO_B64 : null,
  audio_format: q < 8 ? 'wav' : null,
});

async function renderRoute(opts: StubOptions = {}) {
  installBrowserStubs();
  audioEls.length = 0;

  const ctx = opts.context ?? makeContext('EN_ATTENTE');
  const offersApi = {
    getAiInterviewByToken: vi.fn((t: string) => {
      const p = typeof ctx === 'function' ? ctx() : Promise.resolve(ctx);
      return p.then((s) => (s.token === t ? s : Promise.reject(new ApiError(404, 'x'))));
    }),
    startAiInterview: vi.fn(opts.start ?? DEFAULT_START),
    checkAiServiceHealth: vi.fn(
      opts.health ?? (() => Promise.resolve({ ok: true })),
    ),
    sendAudioAnswer: vi.fn(opts.answer ?? DEFAULT_ANSWER),
    synthesizeAiQuestion: vi.fn(() => Promise.resolve({ audio: AUDIO_B64, audio_format: 'wav' })),
    completeAiInterview: vi.fn(
      opts.complete ?? (() => Promise.resolve({ statut: 'TERMINE', evaluation_status: 'EVALUEE' })),
    ),
    quitAiInterview: vi.fn(() => Promise.resolve({ statut: 'ABANDONNE' })),
    reportAiIntegrity: vi.fn(() => Promise.resolve({ stored: 0 })),
    reportAiFingerprint: vi.fn(
      opts.fingerprint ??
        (() =>
          Promise.resolve({
            matched: true,
            first_time: false,
            risk: { score: 0, level: 'LOW', flags: [], computed_at: null },
          })),
    ),
  };
  const auth = authStub(opts.user ?? { role: 'CANDIDAT' });

  await TestBed.configureTestingModule({
    imports: [EntretienIa],
    providers: [
      provideRouter(
        [{ path: 'entretien-ia/:token', component: EntretienIa }],
        withComponentInputBinding(),
      ),
      { provide: OffersApiService, useValue: offersApi },
      { provide: AuthService, useValue: auth },
    ],
  }).compileComponents();

  const router = TestBed.inject(Router);
  await router.navigate(['/entretien-ia', TOKEN]);
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  await settle(fixture);
  const root = fixture.nativeElement as HTMLElement;

  return {
    fixture,
    offersApi,
    root,
    text: () => norm(root.textContent ?? ''),
    click: async (selector: string) => {
      const el = root.querySelector<HTMLButtonElement>(selector);
      if (!el) return;
      el.dispatchEvent(new MouseEvent('click'));
      fixture.detectChanges();
      await settle(fixture);
    },
  };
}

describe('EntretienIa visioconférence (route par token)', () => {
  afterEach(() => {
    blockAutoplay = false;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('affiche la salle d’attente quand l’entretien est en attente', async () => {
    const { text } = await renderRoute();
    expect(text()).toContain('Entretien IA');
    expect(text()).toContain('Marwa Sassi');
    expect(text()).toContain('Développeur Web Fullstack');
    expect(text()).toContain("Rejoindre l'entretien");
    expect(text()).toContain('Vérifier mon équipement');
  });

  it('le bouton rejoindre est désactivé avant la vérification de l’équipement', async () => {
    const { root } = await renderRoute();
    const begin = root.querySelector<HTMLButtonElement>('.begin-btn');
    expect(begin?.disabled).toBe(true);
  });

  it('vérifie le micro et la caméra puis active le bouton rejoindre', async () => {
    const { text, root, click } = await renderRoute();
    expect(text()).toContain('À vérifier');
    await click('.check-btn');
    expect(text()).toContain('Micro Détecté');
    expect(text()).toContain('Caméra Détectée');
    expect(root.querySelector<HTMLButtonElement>('.begin-btn')?.disabled).toBe(false);
  });

  it('démarre l’entretien : l’IA pose la première question (audio)', async () => {
    const { text, click, offersApi } = await renderRoute();
    await click('.check-btn');
    await click('.begin-btn');
    expect(offersApi.startAiInterview).toHaveBeenCalledWith(TOKEN);
    expect(text()).toContain('Question 1 / 8');
    expect(text()).toContain('Question numéro 1 ?');
    expect(text()).toContain('IA parle');
    expect(audioEls.length).toBe(1);
  });

  it('demande l’activation du son quand le navigateur bloque l’autoplay', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    blockAutoplay = true;
    const { text, click } = await renderRoute();
    await click('.check-btn');
    await click('.begin-btn');
    expect(info).toHaveBeenCalledWith('[TTS] playback requested', expect.anything());
    expect(text()).toContain('Activer le son');
    expect(text()).toContain('Le navigateur a bloqué le son');
    blockAutoplay = false;
    await click('.sound-unlock-btn');
    expect(text()).not.toContain('Activer le son');
    expect(text()).toContain('IA parle');
  });

  it('écoute la réponse au micro, l’envoie et passe à la question suivante', async () => {
    const { fixture, text, click, offersApi } = await renderRoute();
    await click('.check-btn');
    await click('.begin-btn');

    lastAudio().onended?.();
    fixture.detectChanges();
    await settle(fixture);
    expect(text()).toContain('À vous de répondre');
    expect(text()).toContain('Arrêter');

    await click('.mic-btn');
    expect(offersApi.sendAudioAnswer).toHaveBeenCalledWith(
      TOKEN,
      1,
      expect.any(Blob),
      expect.stringContaining('reponse-1'),
      expect.stringMatching(/^audio\//),
      expect.any(Number),
    );
    expect(text()).toContain("L'IA prépare la question suivante");
    expect(text()).toContain('Question 2 / 8');
    expect(text()).toContain('Question numéro 2 ?');
  });

  it('termine l’entretien quand la réponse finale est analysée', async () => {
    const { fixture, click, offersApi } = await renderRoute({
      answer: () =>
        Promise.resolve({
          answer_text: 'Dernière réponse',
          question_number: 1,
          next_question: null,
          done: true,
          audio: null,
          audio_format: null,
        }),
    });
    await click('.check-btn');
    await click('.begin-btn');
    lastAudio().onended?.();
    fixture.detectChanges();
    await settle(fixture);
    await click('.mic-btn');
    expect(offersApi.completeAiInterview).toHaveBeenCalledWith(TOKEN);
  });

  it('reprend un entretien en cours à la première question sans réponse', async () => {
    const answers: AiInterviewAnswer[] = [1, 2, 3].map((n) => ({
      id: `a-${n}`,
      question_number: n,
      question: `Question numéro ${n} ?`,
      answer: `Réponse ${n}`,
    }));
    const { text } = await renderRoute({ context: makeContext('EN_COURS', answers) });
    expect(text()).toContain('Question 4 / 8');
    expect(text()).toContain('Question numéro 4 ?');
    expect(text()).toContain('À vous de répondre');
  });

  it('affiche l’écran de fin pour un entretien déjà terminé', async () => {
    const { text } = await renderRoute({ context: makeContext('TERMINE') });
    expect(text()).toContain('Entretien terminé');
  });

  it('propose de terminer manuellement quand au moins une réponse est enregistrée', async () => {
    const answers: AiInterviewAnswer[] = [
      { id: 'a-1', question_number: 1, question: 'Question numéro 1 ?', answer: 'Réponse 1' },
    ];
    const { text, click, offersApi } = await renderRoute({
      context: makeContext('EN_COURS', answers),
    });
    expect(text()).toContain('Terminer');
    await click('.finish-btn');
    expect(offersApi.completeAiInterview).toHaveBeenCalledWith(TOKEN);
  });

  it('affiche le pourcentage de réussite après avoir terminé', async () => {
    const answers: AiInterviewAnswer[] = [
      { id: 'a-1', question_number: 1, question: 'Question numéro 1 ?', answer: 'Réponse 1' },
    ];
    const { text, click } = await renderRoute({
      context: makeContext('EN_COURS', answers),
      complete: async () => ({ statut: 'TERMINE', evaluation_status: 'EVALUEE', score: 85 }),
    });
    await click('.finish-btn');
    expect(text()).toContain('85%');
    expect(text()).toContain('Entretien terminé');
  });

  it('confirme avant de quitter puis revient à l’accueil (lien bloqué)', async () => {
    const { text, click, offersApi } = await renderRoute({ context: makeContext('EN_COURS') });
    const navigate = vi.spyOn(Router.prototype, 'navigate').mockResolvedValue(true);
    await click('.quit-btn');
    expect(text()).toContain("Quitter l'entretien ?");
    await click('.quit-confirm-btn');
    expect(offersApi.quitAiInterview).toHaveBeenCalledWith(TOKEN);
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('affiche la transcription quand le panneau est ouvert', async () => {
    const { root, click } = await renderRoute();
    await click('.check-btn');
    await click('.begin-btn');
    expect(root.querySelector('.meeting__transcript')).toBeFalsy();
    await click('.transcript-btn');
    const panel = root.querySelector('.meeting__transcript');
    expect(panel).toBeTruthy();
    expect(norm(panel?.textContent ?? '')).toContain('Assistant RH IA');
    expect(norm(panel?.textContent ?? '')).toContain('Question numéro 1 ?');
    await click('.transcript-btn');
    expect(root.querySelector('.meeting__transcript')).toBeFalsy();
  });

  it('coupe puis réactive la caméra depuis la barre de contrôle', async () => {
    const { text, click } = await renderRoute();
    await click('.check-btn');
    await click('.begin-btn');
    expect(text()).toContain('Caméra');
    await click('.cam-btn');
    expect(text()).toContain('Caméra coupée');
    await click('.cam-btn');
    expect(text()).toContain('Caméra');
  });

  it('coupe puis rétablit le son des questions', async () => {
    const { click } = await renderRoute();
    await click('.check-btn');
    await click('.begin-btn');
    expect(lastAudio().muted).toBe(false);
    await click('.sound-btn');
    expect(lastAudio().muted).toBe(true);
    await click('.sound-btn');
    expect(lastAudio().muted).toBe(false);
  });

  it('couper la caméra suspend l’entretien, le bouton « Reprendre » le relance', async () => {
    const { text, click } = await renderRoute();
    await click('.check-btn');
    await click('.begin-btn');
    expect(text()).not.toContain('Entretien temporairement suspendu');
    await click('.cam-btn');
    expect(text()).toContain('Entretien temporairement suspendu');
    expect(text()).toContain('caméra a été désactivée');
    expect(text()).toContain('Caméra coupée');
    await click('.resume-btn');
    expect(text()).not.toContain('Entretien temporairement suspendu');
  });

  it('la coupure du réseau suspend l’entretien puis le rétablit au retour', async () => {
    const { text, click, fixture } = await renderRoute();
    await click('.check-btn');
    await click('.begin-btn');
    window.dispatchEvent(new Event('offline'));
    fixture.detectChanges();
    expect(text()).toContain('Entretien temporairement suspendu');
    expect(text()).toContain('Connexion interrompue');
    window.dispatchEvent(new Event('online'));
    fixture.detectChanges();
    expect(text()).not.toContain('Entretien temporairement suspendu');
  });

  it('remonte les événements d’intégrité quand la dernière réponse est envoyée', async () => {
    const { fixture, click, offersApi } = await renderRoute({
      answer: () =>
        Promise.resolve({
          answer_text: 'Dernière réponse',
          question_number: 1,
          next_question: null,
          done: true,
          audio: null,
          audio_format: null,
        }),
    });
    await click('.check-btn');
    await click('.begin-btn');
    lastAudio().onended?.();
    fixture.detectChanges();
    await settle(fixture);
    await click('.mic-btn');
    expect(offersApi.completeAiInterview).toHaveBeenCalledWith(TOKEN);
    await settle(fixture);
    expect(offersApi.reportAiIntegrity).toHaveBeenCalledWith(
      TOKEN,
      expect.objectContaining({ events: expect.any(Array) }),
    );
  });

  it('affiche 403 Forbidden quand le candidat connecté n’est pas le propriétaire', async () => {
    const { text } = await renderRoute({
      context: () => Promise.reject(new ApiError(403, 'Accès refusé')),
    });
    expect(text()).toContain('403 Forbidden');
  });

  it('affiche 404 Not Found quand le lien est inconnu', async () => {
    const { text } = await renderRoute({
      context: () => Promise.reject(new ApiError(404, 'Entretien IA introuvable')),
    });
    expect(text()).toContain('404 Not Found');
  });

  it('affiche une erreur générique et un bouton réessayer en cas de panne', async () => {
    const { text } = await renderRoute({
      context: () => Promise.reject(new ApiError(0, 'Réseau indisponible')),
    });
    expect(text()).toContain("Impossible de charger l'entretien");
    expect(text()).toContain('Réseau indisponible');
    expect(text()).toContain('Réessayer');
  });

  it('affiche une erreur si le démarrage échoue', async () => {
    const { text, click } = await renderRoute({
      start: () => Promise.reject(new ApiError(503, 'Service IA indisponible')),
    });
    await click('.check-btn');
    await click('.begin-btn');
    expect(text()).toContain('Service IA indisponible');
  });

  it('vérifie l’état du service IA pendant la vérification de l’équipement', async () => {
    const { click, offersApi } = await renderRoute();
    await click('.check-btn');
    expect(offersApi.checkAiServiceHealth).toHaveBeenCalled();
  });

  it('garde le bouton rejoindre désactivé et affiche une erreur si le service IA est indisponible', async () => {
    const { text, root, click } = await renderRoute({
      health: () =>
        Promise.reject(
          new ApiError(
            503,
            "Le service d'entretien IA (Python) est indisponible. Réessayez dans quelques instants.",
          ),
        ),
    });
    await click('.check-btn');
    expect(text()).toContain("Le service d'entretien IA (Python) est indisponible.");
    expect(text()).toContain("L'entretien IA est momentanément indisponible.");
    expect(root.querySelector<HTMLButtonElement>('.begin-btn')?.disabled).toBe(true);
  });

  it('affiche l’aperçu caméra une fois l’équipement vérifié', async () => {
    const { root, click } = await renderRoute();
    expect(root.querySelector('.devices__preview')).toBeFalsy();
    await click('.check-btn');
    const preview = root.querySelector<HTMLVideoElement>('.devices__preview');
    expect(preview).toBeTruthy();
  });

  it('signale l’empreinte de l’appareil au démarrage de l’entretien', async () => {
    const { click, offersApi } = await renderRoute();
    await click('.check-btn');
    await click('.begin-btn');
    expect(offersApi.reportAiFingerprint).toHaveBeenCalledWith(
      TOKEN,
      expect.stringMatching(/^[a-f0-9]{16,64}$/),
    );
  });

  it('suspend l’entretien quand le serveur signale un changement d’appareil', async () => {
    const { text, click } = await renderRoute({
      fingerprint: () =>
        Promise.resolve({
          matched: false,
          first_time: false,
          risk: { score: 60, level: 'HIGH', flags: ['DEVICE_CHANGE'], computed_at: null },
        }),
    });
    await click('.check-btn');
    await click('.begin-btn');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(text()).toContain('Entretien temporairement suspendu');
    expect(text()).toContain("changement d'appareil");
  });

  it('suspend l’entretien quand les outils de développement sont détectés (F12)', async () => {
    const { text, click, fixture } = await renderRoute();
    await click('.check-btn');
    await click('.begin-btn');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12' }));
    fixture.detectChanges();
    expect(text()).toContain('Entretien temporairement suspendu');
    expect(text()).toContain('outils de développement');
  });

  it('suspend l’entretien lors d’une tentative de copie', async () => {
    const { text, click, fixture } = await renderRoute();
    await click('.check-btn');
    await click('.begin-btn');
    document.dispatchEvent(new Event('copy'));
    fixture.detectChanges();
    expect(text()).toContain('Entretien temporairement suspendu');
    expect(text()).toContain('copie');
  });
});
