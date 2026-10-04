const pool = require('../config/db');

class SearchRepository {
  static ORDER_BY_WHITELISTS = {
    stagiaires: ['u.nom', 'u.prenom', 'u.email', 'u.created_at', 's.ecole'],
    stages: ['st.date_debut', 'st.date_fin', 'st.statut'],
    taches: ['t.date_debut', 't.date_fin', 't.statut', 't.priorite', 't.titre'],
    offres: ['o.date_limite', 'o.titre', 'o.nombre_places'],
    candidatures: ['c.date_candidature', 'c.statut']
  };

  _safeOrderBy(entity, sort, dir, fallback) {
    const allowed = SearchRepository.ORDER_BY_WHITELISTS[entity];
    const safeSort = allowed.includes(sort) ? sort : fallback;
    return `${safeSort} ${dir}`;
  }

  async searchStagiaires(params, extra, safeSortStag, safeDir, limitNum, offset) {
    const q = await pool.query(`
      SELECT u.id, u.nom, u.prenom, u.email, u.actif, u.created_at,
             s.ecole, s.specialite, s.niveau, s.disponibilite,
             (SELECT COUNT(*) FROM stage st WHERE st.stagiaire_id = u.id) as nb_stages
      FROM utilisateur u
      JOIN stagiaire s ON s.id = u.id
      WHERE u.role = 'STAGIAIRE'
        AND ($1 = '%%' OR u.nom ILIKE $1 OR u.prenom ILIKE $2 OR u.email ILIKE $3 OR s.ecole ILIKE $4)
        ${extra}
      ORDER BY ${this._safeOrderBy('stagiaires', safeSortStag, safeDir, 'u.nom')}
      LIMIT ${limitNum} OFFSET ${offset}
    `, params);

    const countQ = await pool.query(`
      SELECT COUNT(*) as total
      FROM utilisateur u JOIN stagiaire s ON s.id = u.id
      WHERE u.role = 'STAGIAIRE'
        AND ($1 = '%%' OR u.nom ILIKE $1 OR u.prenom ILIKE $2 OR u.email ILIKE $3 OR s.ecole ILIKE $4)
        ${extra}
    `, params);

    return { data: q.rows, total: parseInt(countQ.rows[0].total) };
  }

  async searchStages(params, extra, safeSort, safeDir, limitNum, offset) {
    const q = await pool.query(`
      SELECT st.id, st.candidature_id, st.stagiaire_id, st.encadrant_id, st.departement_id,
             st.offre_id, st.date_debut, st.date_fin, st.statut,
             su.nom as stagiaire_nom, su.prenom as stagiaire_prenom,
             eu.nom as encadrant_nom, eu.prenom as encadrant_prenom,
             d.nom as departement_nom, o.titre as offre_titre
      FROM stage st
      JOIN utilisateur su ON su.id = st.stagiaire_id
      JOIN utilisateur eu ON eu.id = st.encadrant_id
      JOIN departement d ON d.id = st.departement_id
      JOIN offre_stage o ON o.id = st.offre_id
      WHERE ($1 = '%%' OR su.nom ILIKE $1 OR su.prenom ILIKE $2 OR o.titre ILIKE $3)
        ${extra}
      ORDER BY ${this._safeOrderBy('stages', safeSort, safeDir, 'st.date_debut')} NULLS LAST
      LIMIT ${limitNum} OFFSET ${offset}
    `, params);

    const countQ = await pool.query(`
      SELECT COUNT(*) as total
      FROM stage st
      JOIN utilisateur su ON su.id = st.stagiaire_id
      JOIN offre_stage o ON o.id = st.offre_id
      WHERE ($1 = '%%' OR su.nom ILIKE $1 OR su.prenom ILIKE $2 OR o.titre ILIKE $3)
        ${extra}
    `, params);

    return { data: q.rows, total: parseInt(countQ.rows[0].total) };
  }

  async searchTaches(params, extra, safeSort, safeDir, limitNum, offset) {
    const q = await pool.query(`
      SELECT t.id, t.projet_id, t.createur_id, t.executant_id, t.titre, t.description,
             t.priorite, t.date_debut, t.date_fin, t.statut, t.progress, t.created_at,
             t.completion_date, t.estimated_hours, t.spent_hours,
             p.titre as projet_titre,
             eu.nom as createur_nom, eu.prenom as createur_prenom,
             su.nom as executant_nom, su.prenom as executant_prenom
      FROM tache t
      JOIN projet p ON p.id = t.projet_id
      JOIN utilisateur eu ON eu.id = t.createur_id
      JOIN utilisateur su ON su.id = t.executant_id
      WHERE ($1 = '%%' OR t.titre ILIKE $1 OR t.description ILIKE $2)
        ${extra}
      ORDER BY ${this._safeOrderBy('taches', safeSort, safeDir, 't.date_debut')} NULLS LAST
      LIMIT ${limitNum} OFFSET ${offset}
    `, params);

    const countQ = await pool.query(`
      SELECT COUNT(*) as total FROM tache t
      WHERE ($1 = '%%' OR t.titre ILIKE $1 OR t.description ILIKE $2)
        ${extra}
    `, params);

    return { data: q.rows, total: parseInt(countQ.rows[0].total) };
  }

  async searchOffres(params, extra, safeSort, safeDir, limitNum, offset) {
    const q = await pool.query(`
      SELECT o.id, o.departement_id, o.titre, o.description, o.duree,
             o.competences_demandees, o.nombre_places, o.date_limite, o.statut,
             d.nom as departement_nom,
             (SELECT COUNT(*) FROM candidature c WHERE c.offre_id = o.id) as nb_candidatures
      FROM offre_stage o
      JOIN departement d ON d.id = o.departement_id
      WHERE ($1 = '%%' OR o.titre ILIKE $1 OR o.description ILIKE $2)
        ${extra}
      ORDER BY ${this._safeOrderBy('offres', safeSort, safeDir, 'o.date_limite')} NULLS LAST
      LIMIT ${limitNum} OFFSET ${offset}
    `, params);

    const countQ = await pool.query(`
      SELECT COUNT(*) as total FROM offre_stage o
      WHERE ($1 = '%%' OR o.titre ILIKE $1 OR o.description ILIKE $2)
        ${extra}
    `, params);

    return { data: q.rows, total: parseInt(countQ.rows[0].total) };
  }

  async searchCandidatures(params, extra, safeSort, safeDir, limitNum, offset) {
    const q = await pool.query(`
      SELECT c.id, c.stagiaire_id, c.offre_id, c.date_candidature, c.statut, c.deleted_at,
             su.nom as stagiaire_nom, su.prenom as stagiaire_prenom,
             o.titre as offre_titre, d.nom as departement_nom
      FROM candidature c
      JOIN utilisateur su ON su.id = c.stagiaire_id
      JOIN offre_stage o ON o.id = c.offre_id
      JOIN departement d ON d.id = o.departement_id
      WHERE ($1 = '%%' OR su.nom ILIKE $1 OR o.titre ILIKE $2)
        ${extra}
      ORDER BY ${this._safeOrderBy('candidatures', safeSort, safeDir, 'c.date_candidature')}
      LIMIT ${limitNum} OFFSET ${offset}
    `, params);

    const countQ = await pool.query(`
      SELECT COUNT(*) as total
      FROM candidature c
      JOIN utilisateur su ON su.id = c.stagiaire_id
      JOIN offre_stage o ON o.id = c.offre_id
      JOIN departement d ON d.id = o.departement_id
      WHERE ($1 = '%%' OR su.nom ILIKE $1 OR o.titre ILIKE $2)
        ${extra}
    `, params);

    return { data: q.rows, total: parseInt(countQ.rows[0].total) };
  }
}

module.exports = new SearchRepository();
