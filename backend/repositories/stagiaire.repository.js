const pool = require('../config/db');
const { scopeFilter } = require('../utils/scope.util');

class StagiaireRepository {
  async findAll(options = null, scope = null) {
    const isPaginated = !!(options && options.enabled);
    const limit = isPaginated ? options.limit : null;
    const offset = isPaginated ? options.offset : null;
    const filter = scopeFilter(scope, 'stagiaires');
    const filterSql = filter.sql;
    const baseParams = filter.params;

    const query = `
      SELECT u.id, u.nom, u.prenom, u.email, u.telephone, u.actif, u.created_at,
             s.ecole, s.specialite, s.niveau, s.competences, s.disponibilite,
             (SELECT COUNT(*) FROM stage st WHERE st.stagiaire_id = u.id) as nb_stages,
             COALESCE(ts.total_taches, 0) as nb_taches,
             COALESCE(ts.total_terminees, 0) as nb_taches_terminees
      FROM utilisateur u
      JOIN stagiaire s ON s.id = u.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as total_taches,
               COUNT(*) FILTER (WHERE t.statut = 'TERMINEE') as total_terminees
        FROM tache t
        JOIN projet p ON p.id = t.projet_id
        JOIN stage st ON st.id = p.stage_id
        WHERE st.stagiaire_id = u.id
      ) ts ON true
      WHERE u.role = 'STAGIAIRE'${filterSql}
      ORDER BY u.nom, u.prenom
      ${isPaginated ? `LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}` : ''}
    `;

    const params = isPaginated ? [...baseParams, limit, offset] : baseParams;
    const result = await pool.query(query, params);

    if (!isPaginated) return result.rows;

    const countFilter = scopeFilter(scope, 'stagiaires');
    const countRes = await pool.query(
      'SELECT COUNT(*) as total FROM utilisateur u JOIN stagiaire s ON s.id = u.id WHERE u.role = $1' + countFilter.sql,
      ['STAGIAIRE', ...countFilter.params]
    );
    return { data: result.rows, total: parseInt(countRes.rows[0].total) };
  }

  async findById(id) {
    const result = await pool.query(`
      SELECT u.id, u.nom, u.prenom, u.email, u.telephone, u.actif, u.created_at,
             s.ecole, s.specialite, s.niveau, s.competences, s.disponibilite
      FROM utilisateur u
      JOIN stagiaire s ON s.id = u.id
      WHERE u.id = $1
    `, [id]);
    if (result.rows.length === 0) return null;

    const stagesRes = await pool.query(`
      SELECT st.id, st.candidature_id, st.stagiaire_id, st.encadrant_id, st.departement_id,
             st.offre_id, st.date_debut, st.date_fin, st.statut,
             d.nom as departement_nom, enc.nom as encadrant_nom, enc.prenom as encadrant_prenom
      FROM stage st
      JOIN departement d ON d.id = st.departement_id
      JOIN utilisateur enc ON enc.id = st.encadrant_id
      WHERE st.stagiaire_id = $1
    `, [id]);

    return { ...result.rows[0], stages: stagesRes.rows };
  }

  async isInternOf(stagiaireId, encadrantId) {
    const result = await pool.query(
      'SELECT 1 FROM stage WHERE stagiaire_id = $1 AND encadrant_id = $2 LIMIT 1',
      [stagiaireId, encadrantId]
    );
    return result.rows.length > 0;
  }

  async isInDepartment(stagiaireId, departementId) {
    const result = await pool.query(
      'SELECT 1 FROM stage WHERE stagiaire_id = $1 AND departement_id = $2 LIMIT 1',
      [stagiaireId, departementId]
    );
    return result.rows.length > 0;
  }

  async existsById(id) {
    const result = await pool.query('SELECT id FROM stagiaire WHERE id = $1', [id]);
    return result.rows[0];
  }

  async create(stagiaire, hashedPwd) {
    const { nom, prenom, email, telephone, ecole, specialite, niveau, competences } = stagiaire;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const uRes = await client.query(
        `INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone, role)
         VALUES ($1, $2, $3, $4, $5, 'STAGIAIRE') RETURNING id`,
        [nom.trim(), prenom.trim(), email.toLowerCase().trim(), hashedPwd, telephone || null]
      );
      await client.query(
        `INSERT INTO stagiaire (id, ecole, specialite, niveau, competences)
         VALUES ($1, $2, $3, $4, $5)`,
        [uRes.rows[0].id, ecole || null, specialite || null, niveau || null, competences || null]
      );
      await client.query('COMMIT');
      return uRes.rows[0].id;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async update(id, stagiaire) {
    const { nom, prenom, email, telephone, ecole, specialite, niveau, competences, disponibilite } = stagiaire;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE utilisateur SET nom = COALESCE($1, nom), prenom = COALESCE($2, prenom), email = COALESCE($3, email), telephone = COALESCE($4, telephone) WHERE id = $5`,
        [nom, prenom, email, telephone, id]
      );
      await client.query(
        `UPDATE stagiaire SET ecole = COALESCE($1, ecole), specialite = COALESCE($2, specialite), niveau = COALESCE($3, niveau), competences = COALESCE($4, competences), disponibilite = COALESCE($5, disponibilite) WHERE id = $6`,
        [ecole, specialite, niveau, competences, disponibilite, id]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async deactivate(id) {
    await pool.query('UPDATE utilisateur SET actif = false WHERE id = $1', [id]);
  }
}

module.exports = new StagiaireRepository();
