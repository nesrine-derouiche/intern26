const pool = require('../config/db');

const COLS = 'id, candidature_id, date, heure, duree, interviewer, interviewer_email, lien_visio, statut, human_interview_reminder_sent, completed_at, completed_by, created_at, updated_at';

class HumanInterviewRepository {
  async create({ candidatureId, date, heure, duree, interviewer, interviewer_email, lien_visio }, client) {
    const q = client || pool;
    const result = await q.query(
      `INSERT INTO human_interviews (candidature_id, date, heure, duree, interviewer, interviewer_email, lien_visio)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${COLS}`,
      [candidatureId, date, heure, duree, interviewer, interviewer_email || null, lien_visio || null]
    );
    return result.rows[0];
  }

  async findById(id) {
    const result = await pool.query(
      `SELECT ${COLS} FROM human_interviews WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByCandidatureId(candidatureId) {
    const result = await pool.query(
      `SELECT ${COLS} FROM human_interviews WHERE candidature_id = $1`,
      [candidatureId]
    );
    return result.rows[0] || null;
  }

  async update(id, { date, heure, duree, interviewer, interviewer_email, lien_visio }, client) {
    const q = client || pool;
    const result = await q.query(
      `UPDATE human_interviews
       SET date = $1, heure = $2, duree = $3, interviewer = $4, interviewer_email = $5,
           lien_visio = $6, statut = 'PLANIFIE', updated_at = now()
       WHERE id = $7
       RETURNING ${COLS}`,
      [date, heure, duree, interviewer, interviewer_email || null, lien_visio || null, id]
    );
    return result.rows[0] || null;
  }

  async setStatus(id, statut, client) {
    const q = client || pool;
    await q.query(
      'UPDATE human_interviews SET statut = $1, updated_at = now() WHERE id = $2',
      [statut, id]
    );
  }

  /**
   * Marque l'entretien humain comme réalisé par le RH : passe le statut à
   * HUMAN_INTERVIEW_COMPLETED et trace qui l'a complété et à quel moment.
   */
  async markCompleted(id, completedBy, client) {
    const q = client || pool;
    const result = await q.query(
      `UPDATE human_interviews
       SET statut = 'HUMAN_INTERVIEW_COMPLETED',
           completed_at = now(),
           completed_by = $1,
           updated_at = now()
       WHERE id = $2
       RETURNING ${COLS}`,
      [completedBy, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Entretiens humains PLANIFIE à la date donnée dont le rappel n'a pas encore
   * été envoyé, avec les informations du candidat (email, prénom) et de l'offre
   * (titre) nécessaires au rappel du jour J.
   */
  async findScheduledForDate(date) {
    const result = await pool.query(
      `SELECT h.id AS interview_id, h.candidature_id, h.date, h.heure, h.duree,
              h.interviewer, h.lien_visio,
              COALESCE(cu.email, su.email) AS candidat_email,
              COALESCE(cu.prenom, su.prenom) AS candidat_prenom,
              COALESCE(cu.nom, su.nom) AS candidat_nom,
              o.titre AS offre_titre
       FROM human_interviews h
       JOIN candidature c ON c.id = h.candidature_id AND c.deleted_at IS NULL
       LEFT JOIN utilisateur su ON su.id = c.stagiaire_id
       LEFT JOIN utilisateur cu ON cu.id = c.candidat_id
       JOIN offre_stage o ON o.id = c.offre_id
       WHERE h.statut = 'PLANIFIE'
         AND h.date = $1
         AND h.human_interview_reminder_sent = false`,
      [date]
    );
    return result.rows;
  }

  /**
   * Marque le rappel comme envoyé (uniquement s'il ne l'est pas déjà) afin de
   * garantir qu'aucun rappel en double ne soit jamais émis.
   */
  async markReminderSent(id) {
    const result = await pool.query(
      `UPDATE human_interviews
       SET human_interview_reminder_sent = true, updated_at = now()
       WHERE id = $1 AND human_interview_reminder_sent = false`,
      [id]
    );
    return result.rowCount > 0;
  }
}

module.exports = new HumanInterviewRepository();
