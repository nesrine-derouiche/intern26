const pool = require('../config/db');
const { scopeFilter } = require('../utils/scope.util');

class JournalRepository {
  async findAll(options = null, scope = null) {
    const isPaginated = !!(options && options.enabled);
    const limit = isPaginated ? options.limit : null;
    const offset = isPaginated ? options.offset : null;
    const filter = scopeFilter(scope, 'journals');
    const filterSql = filter.sql;
    const baseParams = filter.params;

    const query = `
      SELECT j.id, j.stage_id, j.semaine, j.travaux, j.difficultes, j.solutions,
             j.competences, j.heures, j.commentaire, j.statut, j.commentaire_encadrant,
             j.date_soumission, j.date_validation, j.created_at, j.updated_at,
             su.nom as stagiaire_nom, su.prenom as stagiaire_prenom,
             eu.nom as encadrant_nom, eu.prenom as encadrant_prenom,
             o.titre as offre_titre
      FROM journal j
      JOIN stage st ON st.id = j.stage_id
      JOIN utilisateur su ON su.id = st.stagiaire_id
      JOIN utilisateur eu ON eu.id = st.encadrant_id
      JOIN offre_stage o ON o.id = st.offre_id
      WHERE 1 = 1${filterSql}
      ORDER BY j.semaine DESC
      ${isPaginated ? `LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}` : ''}
    `;

    const params = isPaginated ? [...baseParams, limit, offset] : baseParams;
    const result = await pool.query(query, params);

    if (!isPaginated) return result.rows;

    const countFilter = scopeFilter(scope, 'journals');
    const countRes = await pool.query(
      'SELECT COUNT(*) as total FROM journal j JOIN stage st ON st.id = j.stage_id WHERE 1 = 1' + countFilter.sql,
      countFilter.params
    );
    return { data: result.rows, total: parseInt(countRes.rows[0].total) };
  }

  async findById(id) {
    const result = await pool.query(
      'SELECT id, stage_id, semaine, travaux, difficultes, solutions, competences, heures, commentaire, statut, commentaire_encadrant, date_soumission, date_validation, created_at, updated_at FROM journal WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findByStageAndWeek(stageId, semaine) {
    const result = await pool.query(
      'SELECT id FROM journal WHERE stage_id = $1 AND semaine = $2',
      [stageId, semaine]
    );
    return result.rows[0] || null;
  }

  async create({ stage_id, semaine, travaux, difficultes, solutions, competences, heures, commentaire }) {
    const result = await pool.query(
      `INSERT INTO journal (stage_id, semaine, travaux, difficultes, solutions, competences, heures, commentaire)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, stage_id, semaine, travaux, difficultes, solutions, competences, heures, commentaire, statut, commentaire_encadrant, date_soumission, date_validation, created_at, updated_at`,
      [stage_id, semaine, travaux, difficultes, solutions, competences, heures, commentaire]
    );
    return result.rows[0];
  }

  async update(id, { travaux, difficultes, solutions, competences, heures, commentaire }) {
    const result = await pool.query(
      `UPDATE journal
       SET travaux = $2, difficultes = $3, solutions = $4, competences = $5,
           heures = $6, commentaire = $7, updated_at = now()
       WHERE id = $1
       RETURNING id, stage_id, semaine, travaux, difficultes, solutions, competences, heures, commentaire, statut, commentaire_encadrant, date_soumission, date_validation, created_at, updated_at`,
      [id, travaux, difficultes, solutions, competences, heures, commentaire]
    );
    return result.rows[0];
  }

  async submit(id) {
    const result = await pool.query(
      `UPDATE journal
       SET statut = 'SOUMIS', date_soumission = now(), updated_at = now()
       WHERE id = $1
       RETURNING id, stage_id, semaine, travaux, difficultes, solutions, competences, heures, commentaire, statut, commentaire_encadrant, date_soumission, date_validation, created_at, updated_at`,
      [id]
    );
    return result.rows[0];
  }

  async validate(id, commentaireEncadrant) {
    const result = await pool.query(
      `UPDATE journal
       SET statut = 'VALIDE', commentaire_encadrant = $2, date_validation = now(), updated_at = now()
       WHERE id = $1
       RETURNING id, stage_id, semaine, travaux, difficultes, solutions, competences, heures, commentaire, statut, commentaire_encadrant, date_soumission, date_validation, created_at, updated_at`,
      [id, commentaireEncadrant]
    );
    return result.rows[0];
  }

  async reject(id, commentaireEncadrant) {
    const result = await pool.query(
      `UPDATE journal
       SET statut = 'REJETE', commentaire_encadrant = $2, date_validation = now(), updated_at = now()
       WHERE id = $1
       RETURNING id, stage_id, semaine, travaux, difficultes, solutions, competences, heures, commentaire, statut, commentaire_encadrant, date_soumission, date_validation, created_at, updated_at`,
      [id, commentaireEncadrant]
    );
    return result.rows[0];
  }

  async delete(id) {
    await pool.query('DELETE FROM journal WHERE id = $1', [id]);
  }
}

module.exports = new JournalRepository();
