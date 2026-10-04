const pool = require('../config/db');
const { scopeFilter } = require('../utils/scope.util');

class StageRepository {
  async findAll(options = null, scope = null) {
    const isPaginated = !!(options && options.enabled);
    const limit = isPaginated ? options.limit : null;
    const offset = isPaginated ? options.offset : null;
    const filter = scopeFilter(scope, 'stages');
    const filterSql = filter.sql;
    const baseParams = filter.params;

    const query = `
      SELECT st.id, st.candidature_id, st.stagiaire_id, st.encadrant_id, st.departement_id,
             st.offre_id, st.date_debut, st.date_fin, st.statut,
             su.nom as stagiaire_nom, su.prenom as stagiaire_prenom,
             eu.nom as encadrant_nom, eu.prenom as encadrant_prenom,
             d.nom as departement_nom,
             o.titre as offre_titre,
             (SELECT COUNT(*) FROM projet p WHERE p.stage_id = st.id) as nb_projets
      FROM stage st
      JOIN utilisateur su ON su.id = st.stagiaire_id
      JOIN utilisateur eu ON eu.id = st.encadrant_id
      JOIN departement d ON d.id = st.departement_id
      JOIN offre_stage o ON o.id = st.offre_id
      WHERE 1 = 1${filterSql}
      ORDER BY st.date_debut DESC
      ${isPaginated ? `LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}` : ''}
    `;

    const params = isPaginated ? [...baseParams, limit, offset] : baseParams;
    const result = await pool.query(query, params);

    if (!isPaginated) return result.rows;

    const countFilter = scopeFilter(scope, 'stages');
    const countRes = await pool.query(
      'SELECT COUNT(*) as total FROM stage st WHERE 1 = 1' + countFilter.sql,
      countFilter.params
    );
    return { data: result.rows, total: parseInt(countRes.rows[0].total) };
  }

  async findById(id) {
    const result = await pool.query(
      'SELECT id, candidature_id, stagiaire_id, encadrant_id, departement_id, offre_id, date_debut, date_fin, statut FROM stage WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  /** Stage d'une candidature (conversion en stagiaire) avec encadrant/département/offre. */
  async findByCandidatureId(candidatureId) {
    const result = await pool.query(
      `SELECT st.id, st.candidature_id, st.stagiaire_id, st.encadrant_id, st.departement_id,
              st.offre_id, st.date_debut, st.date_fin, st.statut,
              eu.nom as encadrant_nom, eu.prenom as encadrant_prenom,
              d.nom as departement_nom,
              o.titre as offre_titre
       FROM stage st
       LEFT JOIN utilisateur eu ON eu.id = st.encadrant_id
       JOIN departement d ON d.id = st.departement_id
       JOIN offre_stage o ON o.id = st.offre_id
       WHERE st.candidature_id = $1`,
      [candidatureId]
    );
    return result.rows[0] || null;
  }

  async findAuthContext(stageId) {
    const result = await pool.query(
      'SELECT id, stagiaire_id, encadrant_id, departement_id FROM stage WHERE id = $1',
      [stageId]
    );
    return result.rows[0] || null;
  }

  async findEvaluationContext(stageId) {
    const result = await pool.query(
      'SELECT encadrant_id, statut, stagiaire_id FROM stage WHERE id = $1',
      [stageId]
    );
    return result.rows[0];
  }

  async findLatestByStagiaire(stagiaireId) {
    const result = await pool.query(
      `SELECT st.id, st.candidature_id, st.stagiaire_id, st.encadrant_id, st.departement_id,
              st.offre_id, st.date_debut, st.date_fin, st.statut,
              su.nom as stagiaire_nom, su.prenom as stagiaire_prenom,
              eu.nom as encadrant_nom, eu.prenom as encadrant_prenom,
              d.nom as departement_nom,
              o.titre as offre_titre
       FROM stage st
       JOIN utilisateur su ON su.id = st.stagiaire_id
       JOIN utilisateur eu ON eu.id = st.encadrant_id
       JOIN departement d ON d.id = st.departement_id
       JOIN offre_stage o ON o.id = st.offre_id
       WHERE st.stagiaire_id = $1
       ORDER BY st.date_debut DESC
       LIMIT 1`,
      [stagiaireId]
    );
    return result.rows[0] || null;
  }

  async findJournalContext(stageId) {
    const result = await pool.query(
      'SELECT encadrant_id, stagiaire_id, statut, date_debut, date_fin FROM stage WHERE id = $1',
      [stageId]
    );
    return result.rows[0];
  }

  async findParticipants(stageId) {
    const result = await pool.query(
      'SELECT stagiaire_id, encadrant_id FROM stage WHERE id = $1',
      [stageId]
    );
    return result.rows[0];
  }

  async complete(stageId) {
    await pool.query(
      `UPDATE stage SET statut = 'TERMINE', date_fin = CURRENT_DATE WHERE id = $1 AND statut != 'TERMINE'`,
      [stageId]
    );
  }

  async findPdfData(stageId) {
    const result = await pool.query(`
      SELECT st.id, st.candidature_id, st.stagiaire_id, st.encadrant_id, st.departement_id,
             st.offre_id, st.date_debut, st.date_fin, st.statut,
             su.nom as stagiaire_nom, su.prenom as stagiaire_prenom, su.email as stagiaire_email,
             eu.nom as encadrant_nom, eu.prenom as encadrant_prenom, eu.email as encadrant_email,
             d.nom as departement_nom,
             o.titre as offre_titre, o.description as offre_desc
      FROM stage st
      JOIN utilisateur su ON su.id = st.stagiaire_id
      JOIN utilisateur eu ON eu.id = st.encadrant_id
      JOIN departement d ON d.id = st.departement_id
      JOIN offre_stage o ON o.id = st.offre_id
      WHERE st.id = $1
    `, [stageId]);
    return result.rows[0];
  }

  async update(id, statut, dateDebut, dateFin) {
    await pool.query(
      `UPDATE stage SET 
         statut = COALESCE($1, statut),
         date_debut = $2,
         date_fin = $3
       WHERE id = $4`,
      [statut, dateDebut, dateFin, id]
    );
  }

  async delete(id) {
    await pool.query('DELETE FROM stage WHERE id = $1', [id]);
  }

  async createWithProject(candidatureId, stagiaireId, encadrantId, departementId, offreId, dateDebut, dateFin, offreTitre, client) {
    const stageInsert = await client.query(
      `INSERT INTO stage (candidature_id, stagiaire_id, encadrant_id, departement_id, offre_id, date_debut, date_fin, statut)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'EN_COURS') RETURNING id`,
      [candidatureId, stagiaireId, encadrantId, departementId, offreId, dateDebut, dateFin]
    );
    const stageId = stageInsert.rows[0].id;

    await client.query(
      `INSERT INTO projet (stage_id, titre, description, technologies, avancement)
       VALUES ($1, $2, $3, $4, 0)`,
      [stageId, `Projet - ${offreTitre}`, `Projet automatique pour le stage de "${offreTitre}"`, 'A définir']
    );

    return stageId;
  }
}

module.exports = new StageRepository();
