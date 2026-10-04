const searchRepository = require('../repositories/search.repository');

class SearchService {
  async search(query, user, scope) {
    const { q = '', type } = query;
    const pagination = this._buildPagination(query);
    const ctx = {
      role: user.role,
      userId: user.id,
      keyword: `%${q.trim()}%`,
      ownDepartementId: scope ? scope.departementId : null,
      departement_id: query.departement_id,
      encadrant_id: query.encadrant_id,
      stagiaire_id: query.stagiaire_id,
      statut: query.statut,
      priorite: query.priorite,
      date_debut: query.date_debut,
      date_fin: query.date_fin,
      ...pagination
    };

    const results = {};

    if (!type || type === 'stagiaires') await this._searchStagiaires(ctx, results);
    if (!type || type === 'stages') await this._searchStages(ctx, results);
    if (!type || type === 'taches') await this._searchTaches(ctx, results);
    if (!type || type === 'offres') await this._searchOffres(ctx, results);
    if (!type || type === 'candidatures') await this._searchCandidatures(ctx, results);

    return {
      query: {
        q,
        type,
        page: pagination.pageNum,
        limit: pagination.limitNum,
        sort_by: pagination.sortBy,
        sort_dir: pagination.safeDir
      },
      results
    };
  }

  _buildPagination({ page = '1', limit = '20', sort_by = 'created_at', sort_dir = 'DESC' }) {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    return {
      pageNum,
      limitNum,
      offset: (pageNum - 1) * limitNum,
      safeDir: sort_dir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
      sortBy: sort_by
    };
  }

  async _searchStagiaires(ctx, results) {
    if (!['ADMIN', 'RH', 'CHEF_DEPARTEMENT'].includes(ctx.role)) return;

    let params = [ctx.keyword, ctx.keyword, ctx.keyword, ctx.keyword];
    let idx = 5;
    let extra = '';

    if (ctx.role === 'CHEF_DEPARTEMENT') { extra += ` AND st.departement_id = $${idx++}`; params.push(ctx.ownDepartementId); }
    if (ctx.departement_id) { extra += ` AND st.departement_id = $${idx++}`; params.push(ctx.departement_id); }
    if (ctx.encadrant_id) { extra += ` AND st.encadrant_id = $${idx++}`; params.push(ctx.encadrant_id); }
    if (ctx.statut) { extra += ` AND u.actif = $${idx++}`; params.push(ctx.statut === 'actif'); }

    const safeSort = ['nom', 'prenom', 'email', 'created_at', 'ecole'].includes(ctx.sortBy) ? `u.${ctx.sortBy}` : 'u.nom';

    const { data, total } = await searchRepository.searchStagiaires(params, extra, safeSort, ctx.safeDir, ctx.limitNum, ctx.offset);
    results.stagiaires = { data, total, page: ctx.pageNum, pages: Math.ceil(total / ctx.limitNum) };
  }

  async _searchStages(ctx, results) {
    let params = [ctx.keyword, ctx.keyword, ctx.keyword];
    let idx = 4;
    let extra = '';

    if (ctx.role === 'STAGIAIRE') { extra += ` AND st.stagiaire_id = $${idx++}`; params.push(ctx.userId); }
    if (ctx.role === 'ENCADRANT') { extra += ` AND st.encadrant_id = $${idx++}`; params.push(ctx.userId); }
    if (ctx.role === 'CHEF_DEPARTEMENT') { extra += ` AND st.departement_id = $${idx++}`; params.push(ctx.ownDepartementId); }

    if (ctx.departement_id) { extra += ` AND st.departement_id = $${idx++}`; params.push(ctx.departement_id); }
    if (ctx.encadrant_id) { extra += ` AND st.encadrant_id = $${idx++}`; params.push(ctx.encadrant_id); }
    if (ctx.stagiaire_id && ['ADMIN', 'RH', 'ENCADRANT'].includes(ctx.role)) { extra += ` AND st.stagiaire_id = $${idx++}`; params.push(ctx.stagiaire_id); }
    if (ctx.statut) { extra += ` AND st.statut = $${idx++}`; params.push(ctx.statut); }
    if (ctx.date_debut) { extra += ` AND st.date_debut >= $${idx++}`; params.push(ctx.date_debut); }
    if (ctx.date_fin) { extra += ` AND st.date_fin <= $${idx++}`; params.push(ctx.date_fin); }

    const safeSort = ['date_debut', 'date_fin', 'statut'].includes(ctx.sortBy) ? `st.${ctx.sortBy}` : 'st.date_debut';

    const { data, total } = await searchRepository.searchStages(params, extra, safeSort, ctx.safeDir, ctx.limitNum, ctx.offset);
    results.stages = { data, total, page: ctx.pageNum, pages: Math.ceil(total / ctx.limitNum) };
  }

  async _searchTaches(ctx, results) {
    let params = [ctx.keyword, ctx.keyword];
    let idx = 3;
    let extra = '';

    if (ctx.role === 'STAGIAIRE') { extra += ` AND t.executant_id = $${idx++}`; params.push(ctx.userId); }
    if (ctx.role === 'ENCADRANT') { extra += ` AND t.createur_id = $${idx++}`; params.push(ctx.userId); }
    if (ctx.role === 'CHEF_DEPARTEMENT') {
      extra += ` AND t.projet_id IN (SELECT p.id FROM projet p JOIN stage st ON st.id = p.stage_id WHERE st.departement_id = $${idx++})`;
      params.push(ctx.ownDepartementId);
    }

    if (ctx.stagiaire_id && ['ADMIN', 'RH', 'ENCADRANT'].includes(ctx.role)) { extra += ` AND t.executant_id = $${idx++}`; params.push(ctx.stagiaire_id); }
    if (ctx.statut) { extra += ` AND t.statut = $${idx++}`; params.push(ctx.statut); }
    if (ctx.priorite) { extra += ` AND t.priorite = $${idx++}`; params.push(ctx.priorite); }
    if (ctx.date_debut) { extra += ` AND t.date_debut >= $${idx++}`; params.push(ctx.date_debut); }
    if (ctx.date_fin) { extra += ` AND t.date_fin <= $${idx++}`; params.push(ctx.date_fin); }

    const safeSort = ['date_debut', 'date_fin', 'statut', 'priorite', 'titre'].includes(ctx.sortBy) ? `t.${ctx.sortBy}` : 't.date_debut';

    const { data, total } = await searchRepository.searchTaches(params, extra, safeSort, ctx.safeDir, ctx.limitNum, ctx.offset);
    results.taches = { data, total, page: ctx.pageNum, pages: Math.ceil(total / ctx.limitNum) };
  }

  async _searchOffres(ctx, results) {
    let params = [ctx.keyword, ctx.keyword];
    let idx = 3;
    let extra = ctx.role === 'STAGIAIRE' ? " AND o.statut = 'OUVERTE'" : '';
    if (ctx.role === 'CHEF_DEPARTEMENT') { extra += ` AND o.departement_id = $${idx++}`; params.push(ctx.ownDepartementId); }

    if (ctx.departement_id) { extra += ` AND o.departement_id = $${idx++}`; params.push(ctx.departement_id); }
    if (ctx.statut && ctx.role !== 'STAGIAIRE') { extra += ` AND o.statut = $${idx++}`; params.push(ctx.statut); }

    const safeSort = ['date_limite', 'titre', 'nombre_places'].includes(ctx.sortBy) ? `o.${ctx.sortBy}` : 'o.date_limite';

    const { data, total } = await searchRepository.searchOffres(params, extra, safeSort, ctx.safeDir, ctx.limitNum, ctx.offset);
    results.offres = { data, total, page: ctx.pageNum, pages: Math.ceil(total / ctx.limitNum) };
  }

  async _searchCandidatures(ctx, results) {
    let params = [ctx.keyword, ctx.keyword];
    let idx = 3;
    let extra = '';

    if (ctx.role === 'STAGIAIRE') { extra += ` AND c.stagiaire_id = $${idx++}`; params.push(ctx.userId); }
    if (ctx.role === 'CHEF_DEPARTEMENT') { extra += ` AND d.id = $${idx++}`; params.push(ctx.ownDepartementId); }
    if (ctx.departement_id) { extra += ` AND d.id = $${idx++}`; params.push(ctx.departement_id); }
    if (ctx.stagiaire_id && ctx.role !== 'STAGIAIRE') { extra += ` AND c.stagiaire_id = $${idx++}`; params.push(ctx.stagiaire_id); }
    if (ctx.statut) { extra += ` AND c.statut = $${idx++}`; params.push(ctx.statut); }
    if (ctx.date_debut) { extra += ` AND c.date_candidature >= $${idx++}`; params.push(ctx.date_debut); }
    if (ctx.date_fin) { extra += ` AND c.date_candidature <= $${idx++}`; params.push(ctx.date_fin); }

    const safeSort = ['date_candidature', 'statut'].includes(ctx.sortBy) ? `c.${ctx.sortBy}` : 'c.date_candidature';

    const { data, total } = await searchRepository.searchCandidatures(params, extra, safeSort, ctx.safeDir, ctx.limitNum, ctx.offset);
    results.candidatures = { data, total, page: ctx.pageNum, pages: Math.ceil(total / ctx.limitNum) };
  }
}

module.exports = new SearchService();
