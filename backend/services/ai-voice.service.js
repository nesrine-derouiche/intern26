const ApiError = require('../utils/error.util');
const logger = require('../utils/logger');

const PYTHON_BASE = process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:8001';
const TIMEOUT_MS = Number(process.env.PYTHON_AI_TIMEOUT_MS || 15000);
const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // Limite Whisper (OpenAI) : 25 Mo.

/**
 * PONT NODE <-> PYTHON POUR LA VOIX (STT + TTS).
 *
 * Le microservice Python (ai-service) détient les clés API et les fournisseurs
 * de reconnaissance vocale (Speech-to-Text) et de synthèse vocale
 * (Text-to-Speech). Le frontend Angular ne parle jamais directement à Python :
 * il envoie/ reçoit l'audio via Node, qui appelle Python avec le jeton de
 * service (X-Service-Token).
 *
 *   STT : Node reçoit un Blob audio (multipart du navigateur), le transmet à
 *         POST /api/stt/transcribe et renvoie le texte reconnu.
 *   TTS : Node reçoit un texte, appelle POST /api/tts/synthesize et renvoie
 *         l'audio (MP3 via OpenAI, WAV en mode mock) au navigateur.
 *
 * Erreurs normalisées :
 *   - 400 : audio/texte invalide (rejeté par Python) ;
 *   - 502 : jeton de service invalide côté Python ;
 *   - 504 : Python met trop de temps à répondre ;
 *   - 503 : Python indisponible.
 */
class AiVoiceService {
  /** Appel HTTP vers Python avec timeout — renvoie { status, headers, buffer } ou lève ApiError. */
  async _python(path, { method = 'POST', body, headers = {} } = {}) {
    const token = process.env.PYTHON_SERVICE_TOKEN || '';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${PYTHON_BASE}${path}`, {
        method,
        headers: {
          'X-Service-Token': token,
          ...headers,
        },
        body,
        signal: controller.signal,
      });

      const buffer = Buffer.from(await res.arrayBuffer());

      if (!res.ok) {
        let detail = '';
        try {
          const data = JSON.parse(buffer.toString('utf-8'));
          detail = data.detail || data.message || '';
        } catch {
          detail = buffer.toString('utf-8').slice(0, 300);
        }
        if (res.status === 401 || res.status === 403) {
          throw new ApiError(502, 'Authentification du service de voix (Python) refusée.');
        }
        throw new ApiError(res.status, detail || 'Le service de voix (Python) a retourné une erreur.');
      }

      return { status: res.status, headers: res.headers, buffer };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err.name === 'AbortError') {
        throw new ApiError(504, 'Le service de voix (Python) a mis trop de temps à répondre.');
      }
      logger.warn('[AI-VOICE] Service Python injoignable :', err.message);
      throw new ApiError(503, 'Le service de voix (Python) est indisponible. Réessayez dans quelques instants.');
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Transcrit un audio envoyé par le navigateur (STT).
   * @param {Buffer} audioBuffer - octets du fichier audio (webm/opus du MediaRecorder).
   * @param {string} filename - nom du fichier (extension requise par Python).
   * @param {string} mime - type MIME (audio/webm par défaut).
   * @returns {Promise<string>} le texte reconnu.
   */
  async transcribe(audioBuffer, filename, mime) {
    if (!audioBuffer || !audioBuffer.length) {
      throw new ApiError(400, 'Le fichier audio est vide.');
    }
    if (audioBuffer.length > MAX_AUDIO_BYTES) {
      throw new ApiError(400, 'Le fichier audio est trop volumineux (25 Mo max).');
    }

    const form = new FormData();
    form.append('file', new Blob([audioBuffer], { type: mime || 'audio/webm' }), filename || 'reponse.webm');

    const { buffer } = await this._python('/api/stt/transcribe', { body: form });

    let data;
    try {
      data = JSON.parse(buffer.toString('utf-8'));
    } catch {
      throw new ApiError(502, 'Réponse STT illisible du service Python.');
    }
    const text = (data.text || '').trim();
    if (!text) {
      throw new ApiError(502, 'Le service STT n’a rien reconnu dans votre réponse.');
    }
    return text;
  }

  /**
   * Synthétise un texte en voix (TTS).
   * @param {string} text - texte à prononcer.
   * @returns {Promise<{ audio: Buffer, format: string, mime: string, provider: string }>}
   */
  async synthesize(text) {
    const textValue = String(text || '').trim();
    if (!textValue) {
      throw new ApiError(400, 'Le texte à synthétiser est vide.');
    }

    logger.info('[TTS] generating audio…');
    const { headers, buffer } = await this._python('/api/tts/synthesize', {
      body: JSON.stringify({ text: textValue }),
      headers: { 'Content-Type': 'application/json' },
    });

    if (!buffer.length) {
      throw new ApiError(502, 'Le service TTS a renvoyé un audio vide.');
    }

    const format = (headers.get('x-audio-format') || '').toLowerCase() || 'wav';
    const mime = (headers.get('content-type') || '').split(';')[0] || 'audio/wav';
    const provider = headers.get('x-tts-provider') || 'unknown';
    logger.info(
      '[TTS] audio generated (%d bytes, %s, provider=%s)',
      buffer.length,
      mime,
      provider,
    );
    return { audio: buffer, format, mime, provider };
  }
}

module.exports = new AiVoiceService();
