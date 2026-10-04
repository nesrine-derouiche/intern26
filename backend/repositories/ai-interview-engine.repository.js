const pool = require('../config/db');

const COLUMNS = `
  id, candidature_id, python_session_id, statut,
  questions, report, error_message,
  created_at, started_at, completed_at, updated_at
`;

/**
 * Repository des entretiens IA vocaux (moteur Python).
 *
 * Table `ai_interviews` : chaque ligne correspond à un entretien orchestré
 * par le backend Node et exécuté par le microservice Python (ai-service).
 * Le backend reste la source de vérité : questions et rapport sont dupliqués
 * localement pour un accès hors-ligne et pour les rapports RH.
 */
class AiInterviewEngineRepository {
  async create(candidatureId, pythonSessionId) {
    const result = await pool.query(
      `INSERT INTO ai_interviews (candidature_id, python_session_id)
       VALUES ($1, $2)
       RETURNING ${COLUMNS}`,
      [candidatureId, pythonSessionId]
    );
    return result.rows[0];
  }

  async findById(id) {
    const result = await pool.query(
      `SELECT ${COLUMNS} FROM ai_interviews WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findActiveByCandidature(candidatureId) {
    const result = await pool.query(
      `SELECT ${COLUMNS} FROM ai_interviews
       WHERE candidature_id = $1 AND statut IN ('CREATED', 'STARTED')`,
      [candidatureId]
    );
    return result.rows[0] || null;
  }

  async markStarted(id) {
    const result = await pool.query(
      `UPDATE ai_interviews SET
         statut = 'STARTED',
         questions = '[]',
         started_at = COALESCE(started_at, now()),
         updated_at = now()
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [id]
    );
    return result.rows[0] || null;
  }

  /** Ajoute une question en fin de file (retourne la liste mise à jour). */
  async appendQuestion(id, question) {
    if (!question) return null;
    const result = await pool.query(
      `UPDATE ai_interviews SET
         questions = COALESCE(questions, '[]'::jsonb) || $2::jsonb,
         updated_at = now()
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [id, JSON.stringify(question)]
    );
    return result.rows[0] || null;
  }

  async markCompleted(id, report) {
    const result = await pool.query(
      `UPDATE ai_interviews SET
         statut = 'COMPLETED',
         report = $2,
         completed_at = COALESCE(completed_at, now()),
         updated_at = now()
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [id, JSON.stringify(report)]
    );
    return result.rows[0] || null;
  }
}

module.exports = new AiInterviewEngineRepository();
