const ApiError = require('../utils/error.util');
const logger = require('../utils/logger');
const aiInterviewRepository = require('../repositories/ai-interview.repository');
const candidatureRepository = require('../repositories/candidature.repository');
const offreRepository = require('../repositories/offre.repository');
const notificationService = require('./notification.service');
const candidatureService = require('./candidature.service');
const voiceService = require('./ai-voice.service');
const questionGenerator = require('./ai/question-generator.service');
const aiProvider = require('./ai/ai-interview.provider.service');
const { validateIntegrityEvents } = require('../utils/integrity.util');
const { computeIntegrityRisk } = require('../utils/anti-cheat.util');

const SPLIT = /[,;\n]+/;

const toList = (value) =>
  value
    ? String(value)
        .split(SPLIT)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

/**
 * WORKFLOW D'ENTRETIEN IA VOCAL (portail candidat).
 *
 * Accès par lien sécurisé (token) : aucun identifiant interne n'est exposé.
 *   - GET  /entretien-ia/:token            → contexte + reprise éventuelle ;
 *   - POST /entretien-ia/:token/commencer  → démarre le moteur Python, renvoie
 *                                            la première question + son audio ;
 *   - POST /entretien-ia/:token/audio      → réponse vocale (multipart) : STT,
 *                                            analyse Python, question suivante,
 *                                            audio de la question suivante ;
 *   - POST /entretien-ia/:token/synthesize → synthèse vocale (reprise/relance) ;
 *   - PUT  /entretien-ia/:token/reponses/:numero → réponse texte (compat) ;
 *   - POST /entretien-ia/:token/terminer   → termine puis évalue.
 *
 * Le moteur de questions ET la voix (STT/TTS) vivent dans le microservice
 * Python (ai-service). Node orchestre, garde la source de vérité locale
 * (questions/réponses/évaluation) et ne transmet jamais les clés API au front.
 */
class AiInterviewService {
  // ───────────────────────── Client HTTP vers Python ─────────────────────────

  async _pythonJson(method, path, body) {
    const base = process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:8001';
    const token = process.env.PYTHON_SERVICE_TOKEN || '';
    const timeoutMs = Number(process.env.PYTHON_AI_TIMEOUT_MS || 8000);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Service-Token': token },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      const raw = await res.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new ApiError(502, 'Authentification du service IA refusée (jeton de service invalide).');
        }
        const detail = data && data.detail;
        const message = Array.isArray(detail)
          ? detail.map((d) => d.msg || JSON.stringify(d)).join(' ; ')
          : detail || 'Le service d\'entretien IA a retourné une erreur.';
        throw new ApiError(res.status, message);
      }
      return data;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err.name === 'AbortError') {
        throw new ApiError(504, 'Le service d\'entretien IA (Python) a mis trop de temps à répondre.');
      }
      logger.warn('[AI-INTERVIEW] Service Python injoignable :', err.message);
      throw new ApiError(503, 'Le service d\'entretien IA (Python) est indisponible. Réessayez dans quelques instants.');
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * État de santé du microservice Python (ping `/health`).
   * Ne lève jamais : retourne `true` si le service répond « ok », `false` sinon.
   * Utilisé pour ne pas présenter l'entretien comme prêt quand l'IA est injoignable.
   */
  async healthCheck() {
    const base = process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:8001';
    const token = process.env.PYTHON_SERVICE_TOKEN || '';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`${base}/health`, {
        method: 'GET',
        headers: { 'X-Service-Token': token },
        signal: controller.signal,
      });
      if (!res.ok) return false;
      const data = await res.json().catch(() => null);
      return Boolean(data && data.status === 'ok');
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  _pythonCreate(candidatureId, offre) {
    return this._pythonJson('POST', '/api/v1/interviews', { candidature_id: candidatureId, offre });
  }

  _pythonStart(sessionId, offre) {
    return this._pythonJson('POST', `/api/v1/interviews/${sessionId}/start`, { offre });
  }

  _pythonAnswer(sessionId, questionNumber, answer) {
    return this._pythonJson('POST', `/api/v1/interviews/${sessionId}/answer`, {
      question_number: questionNumber,
      answer,
    });
  }

  _pythonComplete(sessionId) {
    return this._pythonJson('POST', `/api/v1/interviews/${sessionId}/complete`);
  }

  // ─────────────────────────────── Lecture ───────────────────────────────

  /** Contexte d'un entretien via son token (candidat propriétaire uniquement). */
  async getInterviewByToken(token, currentUser) {
    const { session, candidature } = await this._loadOwnedSession(token, currentUser);

    // 🔒 Lien bloqué : après « terminer » (TERMINE) ou « quitter » (ABANDONNE),
    // le lien du mail ne doit plus redonner accès à l'entretien → 404.
    if (session.statut === 'TERMINE' || session.statut === 'ABANDONNE') {
      throw new ApiError(404, 'Entretien IA introuvable.');
    }

    const context = await this._buildContext({ session, candidature });

    if (session.statut === 'EN_ATTENTE') {
      if (candidature.statut !== 'RH_ACCEPTED') {
        throw new ApiError(404, 'Entretien IA introuvable.');
      }
    }

    if (session.statut === 'EN_COURS') {
      context.questions = await aiInterviewRepository.getQuestions(session.id);
      context.answers = await aiInterviewRepository.getAnswers(session.id);
    }

    return context;
  }

  /**
   * Démarre l'entretien VOCAL : crée la session moteur Python, génère la
   * première question, la persiste et renvoie son audio (TTS).
   * @returns {{ question: object, total_questions: number, audio: Buffer, audio_format: string }}
   */
  async startInterview(token, currentUser) {
    const { session, candidature } = await this._loadOwnedSession(token, currentUser);
    if (session.statut !== 'EN_ATTENTE') {
      throw new ApiError(400, 'Cet entretien a déjà commencé.');
    }
    const offre = await this._offreForEngine(candidature.offre_id);
    if (candidature.statut !== 'RH_ACCEPTED') {
      throw new ApiError(404, 'Entretien IA introuvable.');
    }

    // 1. Session moteur Python (créée une seule fois).
    let pythonSessionId = session.python_session_id;
    if (!pythonSessionId) {
      const created = await this._pythonCreate(candidature.id, offre);
      pythonSessionId = created.session_id;
      await aiInterviewRepository.setPythonSession(session.id, pythonSessionId);
    }

    // 2. Première question du moteur.
    const started = await this._pythonStart(pythonSessionId, offre);
    const first = started.question;

    // 3. Persistance locale (questions/réponses conservées au rechargement).
    await aiInterviewRepository.createQuestions(session.id, [first]);
    await aiInterviewRepository.setStatus(session.id, 'EN_COURS');

    // 4. Audio de la question (TTS).
    const { audio, format, provider } = await voiceService.synthesize(first.question);

    return {
      question: first,
      total_questions: started.total_questions || 1,
      audio,
      audio_format: format,
      audio_provider: provider,
    };
  }

  /**
   * Réponse VOCALE : STT → moteur Python → question suivante (TTS).
   * @returns {{ answer_text: string, question_number: number, next_question: object|null,
   *             done: boolean, audio: Buffer|null, audio_format: string|null }}
   */
  async answerInterviewAudio(token, questionNumber, audioBuffer, filename, mime, currentUser, durationSeconds) {
    const { session } = await this._loadOwnedSession(token, currentUser);
    if (session.statut !== 'EN_COURS') {
      throw new ApiError(400, 'L\'entretien doit être commencé pour enregistrer une réponse.');
    }
    if (!session.python_session_id) {
      throw new ApiError(400, 'Cet entretien n\'est pas un entretien vocal.');
    }
    const number = Number(questionNumber);
    if (!Number.isInteger(number) || number < 1) {
      throw new ApiError(400, 'Numéro de question invalide.');
    }

    // 1. Reconnaissance vocale (STT via Python).
    const answerText = await voiceService.transcribe(audioBuffer, filename, mime);

    // 2. Analyse + question suivante (moteur Python).
    const answered = await this._pythonAnswer(session.python_session_id, number, answerText);
    const { next_question, done } = answered;
    // 3. Persistance locale.
    const questions = await aiInterviewRepository.getQuestions(session.id);
    const question = questions.find((q) => Number(q.question_number) === number);
    await aiInterviewRepository.upsertAnswer(
      session.id,
      number,
      question ? question.question : '',
      answerText,
      this._normalizeDuration(durationSeconds)
    );
    if (next_question) {
      await aiInterviewRepository.createQuestions(session.id, [next_question]);
    }

    // 4. Audio de la question suivante (TTS).
    let audio = null;
    let format = null;
    let provider = null;
    if (next_question) {
      const synth = await voiceService.synthesize(next_question.question);
      audio = synth.audio;
      format = synth.format;
      provider = synth.provider;
    }

    return { answer_text: answerText, question_number: number, next_question, done, audio, audio_format: format, audio_provider: provider };
  }

  /** Synthèse vocale d'un texte (relance / relecture d'une question). */
  async synthesize(token, text, currentUser) {
    await this._loadOwnedSession(token, currentUser);
    const { audio, format, provider } = await voiceService.synthesize(text);
    return { audio, audio_format: format, audio_provider: provider };
  }

  /**
   * Enregistre des événements d'intégrité envoyés par le navigateur.
   *
   * Strictement technique et respectueux de la vie privée : pas de
   * reconnaissance faciale ni d'analyse biométrique, uniquement des faits
   * (onglet/fenêtre quittés, plein écran quitté, caméra/micro coupés ou
   * perdus, réseau interrompu). Le nom des périphériques (facultatif) est un
   * libellé technique.
   *
   * @param {{ events: object[], devices?: { camera?: string, microphone?: string } }} payload
   */
  async reportIntegrity(token, payload, currentUser) {
    const { session } = await this._loadOwnedSession(token, currentUser);
    if (session.statut !== 'EN_COURS' && session.statut !== 'EN_ATTENTE') {
      throw new ApiError(400, 'L\'entretien n\'est plus actif : aucun événement d\'intégrité à enregistrer.');
    }

    const payloadObj = payload && typeof payload === 'object' ? payload : {};
    const events = validateIntegrityEvents(payloadObj.events);

    await aiInterviewRepository.appendIntegrityEvents(session.id, events);

    const devices = payloadObj.devices && typeof payloadObj.devices === 'object'
      ? {
          ...(payloadObj.devices.camera && typeof payloadObj.devices.camera === 'string'
            ? { camera: payloadObj.devices.camera.slice(0, 200) }
            : {}),
          ...(payloadObj.devices.microphone && typeof payloadObj.devices.microphone === 'string'
            ? { microphone: payloadObj.devices.microphone.slice(0, 200) }
            : {}),
        }
      : {};
    if (devices.camera || devices.microphone) {
      await aiInterviewRepository.saveIntegrityDevices(session.id, devices);
    }

    const risk = await this._recomputeIntegrityRisk(session.id);

    return { stored: events.length, risk };
  }

  /**
   * Enregistre l'empreinte d'appareil du navigateur du candidat et la compare
   * à l'empreinte de référence. Un appareil différent en cours d'entretien est
   * consigné (device_fingerprint_changed) et fait grimper le score de risque :
   * c'est le signal anti-triche le plus fort (quelqu'un d'autre qui répond).
   *
   * L'empreinte n'est qu'un condensé technique (canvas, WebGL, navigateur…),
   * elle ne contient AUCUNE donnée biométrique.
   *
   * @returns {{ matched: boolean, first_time: boolean, risk: object }}
   */
  async reportFingerprint(token, fingerprint, currentUser) {
    const { session } = await this._loadOwnedSession(token, currentUser);
    if (session.statut !== 'EN_COURS' && session.statut !== 'EN_ATTENTE') {
      throw new ApiError(400, 'L\'entretien n\'est plus actif : aucune vérification d\'appareil à enregistrer.');
    }

    const fp = this._normalizeFingerprint(fingerprint);
    let firstTime = false;
    let matched = true;

    if (!session.device_fingerprint) {
      firstTime = true;
      await aiInterviewRepository.setDeviceFingerprint(session.id, fp);
    } else {
      matched = session.device_fingerprint === fp;
      await aiInterviewRepository.recordDeviceCheck(session.id, matched);
      if (!matched) {
        await aiInterviewRepository.appendIntegrityEvents(session.id, [
          { event: 'DEVICE_CHANGE', timestamp: new Date().toISOString() },
        ]);
      }
    }

    const risk = await this._recomputeIntegrityRisk(session.id);
    return { matched, first_time: firstTime, risk };
  }

  /** Normalise l'empreinte : chaîne hexadécimale unique, longueur bornée. */
  _normalizeFingerprint(fingerprint) {
    const raw = String(fingerprint || '').trim();
    if (!/^[a-f0-9]{16,512}$/i.test(raw)) {
      throw new ApiError(400, 'Empreinte d\'appareil invalide.');
    }
    return raw.toLowerCase();
  }

  /**
   * Recalcule le risque anti-triche de la session (score, niveau, flags) à
   * partir des faits enregistrés et le persiste. Les données sont relues depuis
   * la base pour refléter les événements tout juste ajoutés.
   * @returns {Promise<{ score: number, level: string, flags: string[] }>}
   */
  async _recomputeIntegrityRisk(sessionId) {
    const session = await aiInterviewRepository.findById(sessionId);
    if (!session) return { score: 0, level: 'LOW', flags: [] };
    const answers = await aiInterviewRepository.getAnswers(sessionId);
    const risk = computeIntegrityRisk({
      events: Array.isArray(session.integrity_events) ? session.integrity_events : [],
      durationSeconds: this._sessionDurationSeconds(session),
      answers,
      deviceChanged: !!session.device_fingerprint_changed,
    });
    await aiInterviewRepository.updateIntegrityRisk(sessionId, risk);
    return risk;
  }

  _sessionDurationSeconds(session) {
    if (!session || !session.started_at) return null;
    const end = session.completed_at || new Date();
    const ms = new Date(end).getTime() - new Date(session.started_at).getTime();
    return ms > 0 ? Math.round(ms / 1000) : 0;
  }

  /** Enregistre (ou met à jour) la réponse d'un candidat — conservée au rechargement. */
  async saveAnswer(token, questionNumber, answer, currentUser, durationSeconds) {
    const { session } = await this._loadOwnedSession(token, currentUser);
    if (session.statut !== 'EN_COURS') {
      throw new ApiError(400, 'L\'entretien doit être commencé pour enregistrer une réponse.');
    }

    const number = Number(questionNumber);
    const questions = await aiInterviewRepository.getQuestions(session.id);
    const question = questions.find((q) => Number(q.question_number) === number);
    if (!question) throw new ApiError(400, 'Question introuvable dans cet entretien.');

    const text = String(answer || '').trim();
    if (!text) throw new ApiError(400, 'La réponse ne peut pas être vide.');
    if (text.length > 5000) throw new ApiError(400, 'La réponse est trop longue (5000 caractères max).');

    // Pour un entretien vocal, on fait avancer le moteur Python aussi.
    if (session.python_session_id) {
      const answered = await this._pythonAnswer(session.python_session_id, number, text);
      if (answered.next_question) {
        await aiInterviewRepository.createQuestions(session.id, [answered.next_question]);
      }
    }

    const saved = await aiInterviewRepository.upsertAnswer(session.id, number, question.question, text, this._normalizeDuration(durationSeconds));
    return { saved: true, question_number: saved.question_number, answer: saved.answer };
  }

  /** Normalise une durée d'enregistrement (secondes) envoyée par le navigateur. */
  _normalizeDuration(durationSeconds) {
    const d = Number(durationSeconds);
    return Number.isFinite(d) && d >= 0 && d <= 3600 ? Math.round(d * 10) / 10 : null;
  }

  /** Termine l'entretien puis déclenche l'évaluation IA (moteur Python pour le vocal). */
  async completeInterview(token, currentUser) {
    const { session, candidature } = await this._loadOwnedSession(token, currentUser);
    if (session.statut !== 'EN_COURS') {
      throw new ApiError(400, 'Cet entretien n\'est pas en cours.');
    }

    const answers = await aiInterviewRepository.getAnswers(session.id);
    if (!answers.length) {
      throw new ApiError(400, 'Répondez au moins à une question avant de terminer l\'entretien.');
    }

    await aiInterviewRepository.setStatus(session.id, 'TERMINE');

    // Entretien vocal : l'évaluation est produite par le moteur Python.
    if (session.python_session_id) {
      return this._completeVocal(session, candidature);
    }

    // Entretien texte (hérité) : fournisseur d'IA Node.
    const context = await this._buildContext({ session, candidature });
    let evaluation;
    try {
      evaluation = await aiProvider.evaluateInterview({
        sessionId: session.id,
        offre: context.offre,
        questions: await aiInterviewRepository.getQuestions(session.id),
        answers,
      });
    } catch (err) {
      await this._markEvaluationUnavailable(session, candidature, err);
      return { statut: 'TERMINE', evaluation_status: 'INDISPONIBLE' };
    }

    await aiInterviewRepository.saveEvaluation(session.id, evaluation, 'EVALUEE');
    await this._recomputeIntegrityRisk(session.id);
    await this._notifyRhAnalysisReady(candidature);
    return { statut: 'TERMINE', evaluation_status: 'EVALUEE', ...this._scoreField(evaluation) };
  }

  /**
   * Évaluation d'un entretien vocal par le moteur Python (rapport + analyse).
   *
   * L'IA produit une ANALYSE (score_global, recommandation…), jamais une
   * décision : le statut de la candidature n'est PAS modifié automatiquement.
   * Le RH décide ensuite (POST /candidatures/:id/entretien-ia/result).
   */
  async _completeVocal(session, candidature) {
    let report;
    try {
      const completed = await this._pythonComplete(session.python_session_id);
      report = completed.report;
    } catch (err) {
      await this._markEvaluationUnavailable(session, candidature, err);
      return { statut: 'TERMINE', evaluation_status: 'INDISPONIBLE' };
    }

    await aiInterviewRepository.saveEvaluation(session.id, report, 'EVALUEE');
    await this._recomputeIntegrityRisk(session.id);
    await this._notifyRhAnalysisReady(candidature);
    logger.info(`[AI-INTERVIEW] Entretien vocal ${session.id} évalué (score ${report && report.score_global != null ? report.score_global : '?'}) — décision RH requise`);
    return { statut: 'TERMINE', evaluation_status: 'EVALUEE', ...this._scoreField(report) };
  }

  /** Bloque le lien : le candidat quitte l'entretien → ABANDONNE (lien inactif). */
  async quitInterview(token, currentUser) {
    const { session } = await this._loadOwnedSession(token, currentUser);
    if (session.statut === 'TERMINE') {
      throw new ApiError(400, 'Cet entretien est déjà terminé.');
    }
    if (session.statut === 'ABANDONNE') {
      return { statut: session.statut };
    }

    await aiInterviewRepository.setStatus(session.id, 'ABANDONNE');
    logger.info(`[AI-INTERVIEW] Entretien ${session.id} abandonné par le candidat : lien bloqué.`);
    return { statut: 'ABANDONNE' };
  }

  /** Champ `score` du résultat (pourcentage 0-100) si l'évaluation en contient un. */
  _scoreField(evaluation) {
    const score = this._scoreOf(evaluation);
    return score == null ? {} : { score };
  }

  /** Pourcentage de réussite (0-100) extrait d'une évaluation IA. */
  _scoreOf(evaluation) {
    if (!evaluation || typeof evaluation !== 'object') return null;
    let numeric = null;
    for (const key of ['score_global', 'score', 'note_globale', 'note']) {
      if (typeof evaluation[key] === 'number' && Number.isFinite(evaluation[key])) {
        numeric = evaluation[key];
        break;
      }
    }
    if (numeric == null) return null;
    return Math.round(Math.max(0, Math.min(100, numeric)));
  }

  async _markEvaluationUnavailable(session, candidature, err) {
    await aiInterviewRepository.saveEvaluation(session.id, {}, 'INDISPONIBLE');
    const statusCode = err && err.statusCode;
    if (statusCode === 503 || statusCode === 504) {
      await this._notifyRhEvaluationUnavailable(candidature);
      logger.warn(`[AI-INTERVIEW] Évaluation indisponible pour ${session.id} : ${err.message}`);
    } else {
      logger.error('[AI-INTERVIEW] Échec de l\'évaluation :', err.message);
    }
  }

  /** Session appartenant au candidat connecté (404 si absente, 403 si autre candidat). */
  async _loadOwnedSession(token, currentUser) {
    const session = await aiInterviewRepository.findByToken(token);
    if (!session) throw new ApiError(404, 'Entretien IA introuvable.');

    const candidature = await candidatureRepository.findByIdWithOffer(session.candidature_id);
    if (!candidature) throw new ApiError(404, 'Entretien IA introuvable.');

    const applicantId = candidature.candidat_id || candidature.stagiaire_id;
    if (!applicantId || applicantId !== currentUser.id) {
      throw new ApiError(403, 'Accès refusé : cet entretien ne vous est pas destiné.');
    }

    return { session, candidature };
  }

  /** Contexte complet (candidat, offre, session) pour le portail candidat. */
  async _buildContext({ session, candidature }) {
    const offre = await offreRepository.findPublicById(candidature.offre_id);
    return {
      id: session.id,
      token: session.token,
      statut: session.statut,
      evaluation_status: session.evaluation_status,
      date_candidature: candidature.date_candidature,
      candidat: {
        prenom: await this._applicantPrenom(candidature),
        nom: await this._applicantNom(candidature),
      },
      offre: {
        id: offre.id,
        titre: offre.titre,
        departement_nom: offre.departement_nom,
        duree: offre.duree,
        competences: toList(offre.competences_demandees),
        technologies: toList(offre.technologies),
      },
      candidature: { id: candidature.id, statut: candidature.statut },
    };
  }

  /** Contexte d'offre transmis au moteur Python (génération des questions). */
  async _offreForEngine(offreId) {
    const offre = await offreRepository.findPublicById(offreId);
    if (!offre) return {};
    return {
      titre: offre.titre,
      description: offre.description,
      missions: offre.missions,
      departement_nom: offre.departement_nom,
      duree: offre.duree,
      niveau: offre.niveau,
      localisation: offre.localisation,
      technologies: toList(offre.technologies),
      competences: toList(offre.competences_demandees),
    };
  }

  async _applicantNom(candidature) {
    try {
      return candidature.candidat_id
        ? (await this._candidatProfile(candidature.candidat_id))?.nom ?? ''
        : (await this._stagiaireProfile(candidature.stagiaire_id))?.nom ?? '';
    } catch {
      return '';
    }
  }

  async _applicantPrenom(candidature) {
    try {
      return candidature.candidat_id
        ? (await this._candidatProfile(candidature.candidat_id))?.prenom ?? ''
        : (await this._stagiaireProfile(candidature.stagiaire_id))?.prenom ?? '';
    } catch {
      return '';
    }
  }

  async _candidatProfile(id) {
    const candidatRepository = require('../repositories/candidat.repository');
    return candidatRepository.getProfile(id);
  }

  async _stagiaireProfile(id) {
    const stagiaireRepository = require('../repositories/stagiaire.repository');
    return stagiaireRepository.findById(id);
  }

  /** Notification best effort aux RH : l'analyse IA est disponible pour décision. */
  async _notifyRhAnalysisReady(candidature) {
    try {
      const nom = await candidatureService.applicantName(candidature);
      await notificationService.notifyRoleBestEffort(
        'RH',
        'Analyse d\'entretien IA disponible',
        `L'entretien IA de ${nom || 'un candidat'} (${candidature.offre_titre}) est terminé. L'analyse est disponible : la décision finale revient au service RH.`,
        'CANDIDATURE',
        `/candidatures/${candidature.id}`
      );
    } catch (err) {
      logger.error('Échec de la notification RH (analyse disponible) :', err.message);
    }
  }

  /** Notification best effort aux RH : évaluation indisponible. */
  async _notifyRhEvaluationUnavailable(candidature) {
    try {
      const nom = await candidatureService.applicantName(candidature);
      await notificationService.notifyRoleBestEffort(
        'RH',
        'Évaluation IA indisponible',
        `L'entretien IA de ${nom || 'un candidat'} (${candidature.offre_titre}) est terminé, mais l'évaluation IA n'a pas pu être générée (fournisseur indisponible).`,
        'CANDIDATURE',
        `/candidatures/${candidature.id}`
      );
    } catch (err) {
      logger.error('Échec de la notification RH (évaluation indisponible) :', err.message);
    }
  }
}

module.exports = new AiInterviewService();
