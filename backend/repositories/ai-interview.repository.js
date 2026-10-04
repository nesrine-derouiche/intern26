const pool = require('../config/db');

const COLUMNS = `
  id, candidature_id, token, python_session_id, statut,
  started_at, completed_at, evaluation_status, evaluation,
  integrity_events, integrity_devices,
  device_fingerprint, device_checks, device_fingerprint_changed,
  integrity_risk_score, integrity_risk_level, integrity_flags, integrity_computed_at
`;

class AiInterviewRepository {
  async create(candidatureId, token) {
    const result = await pool.query(
      `INSERT INTO ai_interview_sessions (candidature_id, token)
       VALUES ($1, $2)
       RETURNING ${COLUMNS}`,
      [candidatureId, token]
    );
    return result.rows[0];
  }

  async findByToken(token) {
    const result = await pool.query(
      `SELECT ${COLUMNS}
       FROM ai_interview_sessions WHERE token = $1`,
      [token]
    );
    return result.rows[0] || null;
  }

  async findByCandidatureId(candidatureId) {
    const result = await pool.query(
      `SELECT ${COLUMNS}
       FROM ai_interview_sessions WHERE candidature_id = $1`,
      [candidatureId]
    );
    return result.rows[0] || null;
  }

  /** Recharge une session (données fraîches d'intégrité/risque). */
  async findById(id) {
    const result = await pool.query(
      `SELECT ${COLUMNS}
       FROM ai_interview_sessions WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /** Enregistre l'identifiant de session moteur Python lié à cette session. */
  async setPythonSession(id, pythonSessionId) {
    const result = await pool.query(
      `UPDATE ai_interview_sessions SET
         python_session_id = $2,
         updated_at = now()
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [id, pythonSessionId]
    );
    return result.rows[0] || null;
  }

  async setStatus(id, statut, client) {
    const q = client || pool;
    const startedAt = statut === 'EN_COURS' ? 'now()' : null;
    const completedAt = statut === 'TERMINE' ? 'now()' : null;
    const result = await q.query(
      `UPDATE ai_interview_sessions SET
         statut = $1,
         started_at = COALESCE($2, started_at),
         completed_at = COALESCE($3, completed_at),
         updated_at = now()
       WHERE id = $4
       RETURNING ${COLUMNS}`,
      [statut, startedAt, completedAt, id]
    );
    return result.rows[0] || null;
  }

  async saveEvaluation(id, evaluation, evaluationStatus) {
    await pool.query(
      `UPDATE ai_interview_sessions SET
         evaluation = $2,
         evaluation_status = $3,
         updated_at = now()
       WHERE id = $1`,
      [id, JSON.stringify(evaluation), evaluationStatus]
    );
  }

  async createQuestions(sessionId, questions) {
    const values = [];
    const params = [];
    questions.forEach((q) => {
      params.push(sessionId, q.question_number, q.categorie, q.question);
      values.push(`($${params.length - 3}, $${params.length - 2}, $${params.length - 1}, $${params.length})`);
    });
    if (!values.length) return [];
    const result = await pool.query(
      `INSERT INTO ai_interview_questions (session_id, question_number, categorie, question)
       VALUES ${values.join(', ')}
       RETURNING id, session_id, question_number, categorie, question`,
      params
    );
    return result.rows;
  }

  async getQuestions(sessionId) {
    const result = await pool.query(
      `SELECT id, session_id, question_number, categorie, question
       FROM ai_interview_questions
       WHERE session_id = $1
       ORDER BY question_number ASC`,
      [sessionId]
    );
    return result.rows;
  }

  async upsertAnswer(sessionId, questionNumber, question, answer, durationSeconds) {
    const result = await pool.query(
      `INSERT INTO ai_interview_answers (session_id, question_number, question, answer, duration_seconds)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (session_id, question_number)
       DO UPDATE SET answer = EXCLUDED.answer, duration_seconds = EXCLUDED.duration_seconds, updated_at = now()
       RETURNING id, session_id, question_number, question, answer, duration_seconds, updated_at`,
      [sessionId, questionNumber, question, answer, durationSeconds ?? null]
    );
    return result.rows[0];
  }

  async getAnswers(sessionId) {
    const result = await pool.query(
      `SELECT id, session_id, question_number, question, answer, duration_seconds, updated_at
       FROM ai_interview_answers
       WHERE session_id = $1
       ORDER BY question_number ASC`,
      [sessionId]
    );
    return result.rows;
  }

  async countAnswers(sessionId) {
    const result = await pool.query(
      'SELECT COUNT(*)::int as n FROM ai_interview_answers WHERE session_id = $1',
      [sessionId]
    );
    return result.rows[0].n;
  }

  /** Ajoute des événements d'intégrité (JSONB) à la session. */
  async appendIntegrityEvents(id, events) {
    const result = await pool.query(
      `UPDATE ai_interview_sessions SET
         integrity_events = integrity_events || $2::jsonb,
         updated_at = now()
       WHERE id = $1
       RETURNING integrity_events`,
      [id, JSON.stringify(events)]
    );
    return result.rows[0] ? result.rows[0].integrity_events : null;
  }

  /** Enregistre les périphériques utilisés (noms caméra / micro, sans données biométriques). */
  async saveIntegrityDevices(id, devices) {
    const result = await pool.query(
      `UPDATE ai_interview_sessions SET
         integrity_devices = COALESCE(integrity_devices, '{}'::jsonb) || $2::jsonb,
         updated_at = now()
       WHERE id = $1
       RETURNING integrity_devices`,
      [id, JSON.stringify(devices)]
    );
    return result.rows[0] ? result.rows[0].integrity_devices : null;
  }

  /** Première empreinte d'appareil enregistrée pour cette session (device_checks = 1). */
  async setDeviceFingerprint(id, fingerprint) {
    const result = await pool.query(
      `UPDATE ai_interview_sessions SET
         device_fingerprint = $2,
         device_checks = 1,
         updated_at = now()
       WHERE id = $1
       RETURNING device_fingerprint, device_checks, device_fingerprint_changed`,
      [id, fingerprint]
    );
    return result.rows[0] || null;
  }

  /**
   * Enregistre une vérification d'empreinte supplémentaire.
   * Une différence d'empreinte (appareil différent en cours d'entretien) est
   * un signal fort : elle est consignée dans device_fingerprint_changed.
   */
  async recordDeviceCheck(id, matched) {
    const result = await pool.query(
      `UPDATE ai_interview_sessions SET
         device_checks = device_checks + 1,
         device_fingerprint_changed = device_fingerprint_changed OR $2::boolean,
         updated_at = now()
       WHERE id = $1
       RETURNING device_checks, device_fingerprint_changed`,
      [id, !matched]
    );
    return result.rows[0] || null;
  }

  /** Persiste le résultat du moteur de risque (score, niveau, flags). */
  async updateIntegrityRisk(id, { score, level, flags }) {
    await pool.query(
      `UPDATE ai_interview_sessions SET
         integrity_risk_score = $2,
         integrity_risk_level = $3,
         integrity_flags = $4::jsonb,
         integrity_computed_at = now(),
         updated_at = now()
       WHERE id = $1`,
      [id, score, level, JSON.stringify(flags)]
    );
  }
}

module.exports = new AiInterviewRepository();
