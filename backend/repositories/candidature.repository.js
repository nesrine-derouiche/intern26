const pool = require('../config/db');
const { scopeFilter } = require('../utils/scope.util');

class CandidatureRepository {
  async findAll(options = null, scope = null) {
    const isPaginated = !!(options && options.enabled);
    const limit = isPaginated ? options.limit : null;
    const offset = isPaginated ? options.offset : null;
    const filter = scopeFilter(scope, 'candidatures');
    const filterSql = filter.sql;
    const baseParams = filter.params;

    const query = `
      SELECT c.id, c.stagiaire_id, c.candidat_id, c.offre_id, c.date_candidature, c.statut, c.deleted_at,
             c.internship_start_date, c.internship_duration_months, c.internship_details_submitted_at,
             c.internship_period_validated_at, c.internship_period_validated_by, c.internship_modification_requested_at,
             su.nom as stagiaire_nom, su.prenom as stagiaire_prenom,
             cu.nom as candidat_nom, cu.prenom as candidat_prenom,
             o.titre as offre_titre, d.nom as departement_nom
      FROM candidature c
      LEFT JOIN utilisateur su ON su.id = c.stagiaire_id
      LEFT JOIN utilisateur cu ON cu.id = c.candidat_id
      JOIN offre_stage o ON o.id = c.offre_id
      JOIN departement d ON d.id = o.departement_id
      WHERE c.deleted_at IS NULL${filterSql}
      ORDER BY c.date_candidature DESC
      ${isPaginated ? `LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}` : ''}
    `;

    const params = isPaginated ? [...baseParams, limit, offset] : baseParams;
    const result = await pool.query(query, params);

    if (!isPaginated) return result.rows;

    const countFilter = scopeFilter(scope, 'candidatures');
    const countRes = await pool.query(
      'SELECT COUNT(*) as total FROM candidature c WHERE c.deleted_at IS NULL' + countFilter.sql,
      countFilter.params
    );
    return { data: result.rows, total: parseInt(countRes.rows[0].total) };
  }

  async findByIdWithOffer(id) {
    const result = await pool.query(
      `SELECT c.id, c.stagiaire_id, c.candidat_id, c.offre_id, c.date_candidature, c.statut, c.deleted_at,
              c.decision, c.decided_by, c.decided_at,
              c.internship_start_date, c.internship_duration_months, c.internship_details_submitted_at,
              c.internship_period_validated_at, c.internship_period_validated_by, c.internship_modification_requested_at,
              o.departement_id, o.duree, o.titre as offre_titre
       FROM candidature c
       JOIN offre_stage o ON o.id = c.offre_id
       WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [id]
    );
    return result.rows[0];
  }

  /** Infos d'un entretien IA (candidat + offre) pour le portail candidat. */
  async findAiInterviewById(id) {
    const result = await pool.query(
      `SELECT c.id, c.candidat_id, c.statut, c.date_candidature,
              o.id as offre_id, o.titre as offre_titre, d.nom as departement_nom,
              u.nom as candidat_nom, u.prenom as candidat_prenom
       FROM candidature c
       JOIN offre_stage o ON o.id = c.offre_id
       JOIN departement d ON d.id = o.departement_id
       LEFT JOIN utilisateur u ON u.id = c.candidat_id
       WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [id]
    );
    return result.rows[0];
  }

  /** Détails complets d'une candidature (candidat, offre, CV) pour l'examen RH. */
  async findDetailsById(id) {
    const result = await pool.query(
      `SELECT c.id, c.stagiaire_id, c.candidat_id, c.offre_id, c.date_candidature, c.statut,
              c.decision, c.decided_by, c.decided_at,
              c.internship_start_date, c.internship_duration_months, c.internship_details_submitted_at,
              c.internship_period_validated_at, c.internship_period_validated_by, c.internship_modification_requested_at,
              c.mobile_access_prepared_at, c.mobile_access_email_state, c.mobile_access_email_sent_at, c.mobile_access_email_error,
              v.nom as validated_by_nom, v.prenom as validated_by_prenom,
              o.titre as offre_titre, o.departement_id, d.nom as departement_nom,
              su.nom as stagiaire_nom, su.prenom as stagiaire_prenom, su.email as stagiaire_email, su.telephone as stagiaire_telephone,
              cu.nom as candidat_nom, cu.prenom as candidat_prenom, cu.email as candidat_email, cu.telephone as candidat_telephone,
              ca.universite, ca.specialite, ca.niveau, ca.cv_path, ca.cv_original_name, ca.cv_size, ca.cv_uploaded_at
       FROM candidature c
       JOIN offre_stage o ON o.id = c.offre_id
       JOIN departement d ON d.id = o.departement_id
       LEFT JOIN utilisateur su ON su.id = c.stagiaire_id
       LEFT JOIN utilisateur cu ON cu.id = c.candidat_id
       LEFT JOIN candidat ca ON ca.id = c.candidat_id
       LEFT JOIN utilisateur v ON v.id = c.internship_period_validated_by
       WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [id]
    );
    return result.rows[0];
  }

  async findByStagiaireAndOffre(stagiaireId, offreId) {
    const result = await pool.query(
      'SELECT id FROM candidature WHERE stagiaire_id = $1 AND offre_id = $2 AND deleted_at IS NULL',
      [stagiaireId, offreId]
    );
    return result.rows[0];
  }

  async findByCandidatAndOffre(candidatId, offreId) {
    const result = await pool.query(
      'SELECT id FROM candidature WHERE candidat_id = $1 AND offre_id = $2 AND deleted_at IS NULL',
      [candidatId, offreId]
    );
    return result.rows[0];
  }

  async updateStatut(id, statut, client) {
    const q = client || pool;
    await q.query("UPDATE candidature SET statut = $1 WHERE id = $2 AND deleted_at IS NULL", [statut, id]);
  }

  /**
   * Trace la décision finale RH sur la candidature : nouveau statut, décision,
   * décideur et horodatage. Retourne la ligne mise à jour (null si absente).
   */
  async decide(id, { statut, decision, decidedBy }, client) {
    const q = client || pool;
    const result = await q.query(
      `UPDATE candidature
       SET statut = $1, decision = $2, decided_by = $3, decided_at = now()
       WHERE id = $4 AND deleted_at IS NULL
       RETURNING id, statut, decision, decided_by, decided_at`,
      [statut, decision, decidedBy, id]
    );
    return result.rows[0] || null;
  }

  /** Insère une entrée d'historique dans la table d'audit candidature_decisions. */
  async insertDecisionAudit(candidatureId, { decision, decidedBy, previousStatus, newStatus }, client) {
    const q = client || pool;
    const result = await q.query(
      `INSERT INTO candidature_decisions (candidature_id, decision, decided_by, previous_status, new_status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, candidature_id, decision, decided_by, decided_at, previous_status, new_status`,
      [candidatureId, decision, decidedBy, previousStatus, newStatus]
    );
    return result.rows[0];
  }

  /** Insère une entrée d'audit de validation/modification de la période de stage. */
  async insertStagePeriodAudit(candidatureId, { decision, action, decidedBy, previousStatus, newStatus, startDate, durationMonths }, client) {
    const q = client || pool;
    const result = await q.query(
      `INSERT INTO candidature_decisions (candidature_id, decision, action, decided_by, previous_status, new_status, internship_start_date, internship_duration_months)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, candidature_id, decision, action, decided_by, decided_at, previous_status, new_status, internship_start_date, internship_duration_months`,
      [candidatureId, decision, action, decidedBy, previousStatus, newStatus, startDate, durationMonths]
    );
    return result.rows[0];
  }

  /** Insère une entrée d'audit de décision RH sur un document du dossier (candidature_decisions). */
  async insertDocumentDecisionAudit(candidatureId, { documentId, decision, action, decidedBy, previousStatus, newStatus }, client) {
    const q = client || pool;
    const result = await q.query(
      `INSERT INTO candidature_decisions (candidature_id, document_id, decision, action, decided_by, previous_status, new_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, candidature_id, document_id, decision, action, decided_by, decided_at, previous_status, new_status`,
      [candidatureId, documentId, decision, action, decidedBy, previousStatus, newStatus]
    );
    return result.rows[0];
  }

  /** Historique d'audit des décisions d'une candidature (du plus récent au plus ancien). */
  async findDecisionsByCandidature(candidatureId) {
    const result = await pool.query(
      `SELECT cd.id, cd.candidature_id, cd.document_id, cd.decision, cd.action, cd.decided_by, cd.decided_at,
              cd.previous_status, cd.new_status, cd.internship_start_date, cd.internship_duration_months,
              u.nom AS decided_by_nom, u.prenom AS decided_by_prenom
       FROM candidature_decisions cd
       LEFT JOIN utilisateur u ON u.id = cd.decided_by
       WHERE cd.candidature_id = $1
       ORDER BY cd.decided_at DESC`,
      [candidatureId]
    );
    return result.rows;
  }

  async updateStagiaire(id, stagiaireId, client) {
    const q = client || pool;
    await q.query("UPDATE candidature SET stagiaire_id = $1 WHERE id = $2", [stagiaireId, id]);
  }

  /**
   * Enregistre (ou met à jour) les préférences de stage du candidat :
   * date de début souhaitée et durée (mois). Horodaté à chaque soumission.
   * Toute nouvelle soumission efface la demande de modification RH en cours.
   * Retourne la ligne mise à jour (null si absente).
   */
  async updateStagePreferences(id, { startDate, durationMonths }, client) {
    const q = client || pool;
    const result = await q.query(
      `UPDATE candidature
       SET internship_start_date = $1,
           internship_duration_months = $2,
           internship_details_submitted_at = now(),
           internship_modification_requested_at = NULL
       WHERE id = $3 AND deleted_at IS NULL
       RETURNING id, statut, internship_start_date, internship_duration_months, internship_details_submitted_at,
                 internship_period_validated_at, internship_period_validated_by, internship_modification_requested_at`,
      [startDate, durationMonths, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Validation RH de la période de stage : fige la date de début et la durée
   * choisies par le candidat, trace le RH validateur et l'horodatage, et lève
   * toute demande de modification en cours. Retourne la ligne (null si absente).
   */
  async validateStagePreferences(id, validatedBy, client) {
    const q = client || pool;
    const result = await q.query(
      `UPDATE candidature
       SET internship_period_validated_at = now(),
           internship_period_validated_by = $2,
           internship_modification_requested_at = NULL
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, statut, internship_start_date, internship_duration_months, internship_details_submitted_at,
                 internship_period_validated_at, internship_period_validated_by, internship_modification_requested_at`,
      [id, validatedBy]
    );
    return result.rows[0] || null;
  }

  /**
   * Demande RH de modification de la période de stage : marque la période comme
   * devant être modifiée par le candidat (redevient éditable côté portail).
   * Retourne la ligne (null si absente).
   */
  async requestStagePreferencesModification(id, client) {
    const q = client || pool;
    const result = await q.query(
      `UPDATE candidature
       SET internship_modification_requested_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, statut, internship_start_date, internship_duration_months, internship_details_submitted_at,
                 internship_period_validated_at, internship_period_validated_by, internship_modification_requested_at`,
      [id]
    );
    return result.rows[0] || null;
  }

  async refuseOtherCandidatures(stagiaireId, offreId, excludeId, client) {
    const q = client || pool;
    await q.query(
      "UPDATE candidature SET statut = 'REFUSEE' WHERE stagiaire_id = $1 AND offre_id = $2 AND id != $3 AND deleted_at IS NULL",
      [stagiaireId, offreId, excludeId]
    );
  }

  async create(stagiaireId, offreId, candidatId = null) {
    const result = await pool.query(
      `INSERT INTO candidature (stagiaire_id, offre_id, candidat_id, statut)
       VALUES ($1, $2, $3, 'EN_ATTENTE')
       RETURNING id, stagiaire_id, candidat_id, offre_id, date_candidature, statut, deleted_at`,
      [stagiaireId, offreId, candidatId]
    );
    return result.rows[0];
  }

  async delete(id) {
    await pool.query("UPDATE candidature SET deleted_at = now() WHERE id = $1", [id]);
  }

  /** Offres (id) auxquelles un candidat a déjà postulé (candidatures actives). */
  async findOfferIdsByCandidat(candidatId) {
    const result = await pool.query(
      'SELECT offre_id FROM candidature WHERE candidat_id = $1 AND deleted_at IS NULL',
      [candidatId]
    );
    return result.rows.map((row) => row.offre_id);
  }

  /** Candidatures actives d'un candidat (avec le titre de l'offre), du plus récent au plus ancien. */
  async findByCandidat(candidatId) {
    const result = await pool.query(
      `SELECT c.id, c.offre_id, c.date_candidature, c.statut,
              c.internship_start_date, c.internship_duration_months, c.internship_details_submitted_at,
              c.internship_period_validated_at, c.internship_period_validated_by, c.internship_modification_requested_at,
              c.mobile_access_prepared_at, c.mobile_access_email_state, c.mobile_access_email_sent_at,
              o.titre AS offre_titre, d.nom AS departement_nom
       FROM candidature c
       JOIN offre_stage o ON o.id = c.offre_id
       JOIN departement d ON d.id = o.departement_id
       WHERE c.candidat_id = $1 AND c.deleted_at IS NULL
       ORDER BY c.date_candidature DESC`,
      [candidatId]
    );
    return result.rows;
  }

  /**
   * Marque le début de la préparation de l'accès mobile pour une candidature
   * dont la période a été validée. Idempotent (COALESCE) : la préparation n'est
   * jamais réinitialisée par une revalidation éventuelle.
   */
  async prepareMobileAccess(id, client) {
    const q = client || pool;
    const result = await q.query(
      `UPDATE candidature
       SET mobile_access_prepared_at = COALESCE(mobile_access_prepared_at, now())
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * Persiste le mot de passe temporaire CHIFFRÉ (AES-256-GCM) pour l'envoi D-1.
   * Conservé tant que l'email n'a pas été envoyé : les nouvelles tentatives
   * réutilisent le même identifiant. Purge/écrasement si un nouvel essai est
   * généré (normalement jamais : la génération n'a lieu qu'une seule fois).
   */
  async setMobileCredentials(id, encrypted, client) {
    const q = client || pool;
    await q.query(
      `UPDATE candidature
       SET mobile_access_credentials_encrypted = $2,
           mobile_access_email_state = 'PENDING'
       WHERE id = $1`,
      [id, encrypted]
    );
  }

  /** Marque l'échec d'envoi de l'email D-1 (le mot de passe chiffré est conservé). */
  async markMobileEmailError(id, message, client) {
    const q = client || pool;
    await q.query(
      `UPDATE candidature
       SET mobile_access_email_state = 'ERROR',
           mobile_access_email_error = $2
       WHERE id = $1 AND mobile_access_email_sent_at IS NULL`,
      [id, String(message).slice(0, 500)]
    );
  }

  /**
   * Marque l'email D-1 comme envoyé et purge le mot de passe chiffré (le
   * compte garde uniquement le hash bcrypt). Garde atomique `sent_at IS NULL` :
   * si deux passages concurrents du job envoient, un seul peut marquer la ligne.
   * Retourne `true` si la ligne a réellement été marquée.
   */
  async markMobileEmailSent(id, client) {
    const q = client || pool;
    const result = await q.query(
      `UPDATE candidature
       SET mobile_access_email_state = 'SENT',
           mobile_access_email_sent_at = now(),
           mobile_access_email_error = NULL,
           mobile_access_credentials_encrypted = NULL
       WHERE id = $1 AND mobile_access_email_sent_at IS NULL`,
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * Candidatures acceptées (HUMAN_INTERVIEW_ACCEPTED ou STAGIAIRE_CREATED),
   * période validée, arrivées à J-1 (ou au-delà) et dont l'email d'accès n'a
   * pas encore été envoyé. `today` est la date de référence (YYYY-MM-DD)
   * fournie par le job.
   *
   * Le statut STAGIAIRE_CREATED est inclus pour les candidats convertis en
   * stagiaires par le RH : le job D-1 doit pouvoir envoyer l'email d'accès
   * mobile même après la conversion.
   */
  async findCandidatesDueForMobileEmail(today) {
    const result = await pool.query(
      `SELECT c.id AS candidature_id, c.internship_start_date, c.internship_duration_months,
              c.mobile_access_credentials_encrypted, c.mobile_access_email_state,
              COALESCE(cu.email, su.email) AS email,
              COALESCE(cu.prenom, su.prenom) AS prenom,
              COALESCE(cu.nom, su.nom) AS nom,
              u.id AS utilisateur_id,
              o.titre AS offre_titre
       FROM candidature c
       LEFT JOIN utilisateur su ON su.id = c.stagiaire_id
       LEFT JOIN utilisateur cu ON cu.id = c.candidat_id
       LEFT JOIN utilisateur u ON u.id = COALESCE(c.candidat_id, c.stagiaire_id)
       JOIN offre_stage o ON o.id = c.offre_id
       WHERE c.deleted_at IS NULL
         AND c.statut IN ('HUMAN_INTERVIEW_ACCEPTED', 'STAGIAIRE_CREATED')
         AND c.internship_period_validated_at IS NOT NULL
         AND c.internship_start_date IS NOT NULL
         AND c.internship_start_date - INTERVAL '1 day' <= $1::date
         AND c.mobile_access_email_sent_at IS NULL
       ORDER BY c.internship_start_date ASC`,
      [today]
    );
    return result.rows;
  }
}

module.exports = new CandidatureRepository();
