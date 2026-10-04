const scopeFilter = (scope, resourceType) => {
  if (!scope || scope.type === 'all') return { sql: '', params: [] };

  const params = [];
  const push = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  const byUser = (alias, column) => ({ sql: ` AND ${alias}.${column} = ${push(scope.userId)}`, params });
  const byDepartment = (alias, column) => ({ sql: ` AND ${alias}.${column} = ${push(scope.departementId)}`, params });
  const byStageDepartment = () => ({
    sql: ` AND u.id IN (SELECT st.stagiaire_id FROM stage st WHERE st.departement_id = ${push(scope.departementId)})`,
    params
  });

  switch (resourceType) {
    case 'stagiaires': {
      if (scope.role === 'STAGIAIRE') return byUser('u', 'id');
      if (scope.role === 'ENCADRANT') {
        return {
          sql: ` AND u.id IN (SELECT st.stagiaire_id FROM stage st WHERE st.encadrant_id = ${push(scope.userId)})`,
          params
        };
      }
      if (scope.role === 'CHEF_DEPARTEMENT') return byStageDepartment();
      break;
    }
    case 'stages':
      if (scope.role === 'STAGIAIRE') return byUser('st', 'stagiaire_id');
      if (scope.role === 'ENCADRANT') return byUser('st', 'encadrant_id');
      if (scope.role === 'CHEF_DEPARTEMENT') return byDepartment('st', 'departement_id');
      break;
    case 'reunions':
    case 'evaluations':
    case 'documents':
    case 'rapports':
    case 'journals':
    case 'presences':
      if (scope.role === 'STAGIAIRE') return byUser('st', 'stagiaire_id');
      if (scope.role === 'ENCADRANT') return byUser('st', 'encadrant_id');
      if (scope.role === 'CHEF_DEPARTEMENT') return byDepartment('st', 'departement_id');
      break;
    case 'taches':
      if (scope.role === 'STAGIAIRE') return byUser('t', 'executant_id');
      if (scope.role === 'ENCADRANT') return byUser('t', 'createur_id');
      if (scope.role === 'CHEF_DEPARTEMENT') {
        return {
          sql: ` AND t.projet_id IN (SELECT p.id FROM projet p JOIN stage st ON st.id = p.stage_id WHERE st.departement_id = ${push(scope.departementId)})`,
          params
        };
      }
      break;
    case 'candidatures':
      if (scope.role === 'STAGIAIRE') return byUser('c', 'stagiaire_id');
      if (scope.role === 'CANDIDAT') return byUser('c', 'candidat_id');
      if (scope.role === 'CHEF_DEPARTEMENT') {
        return {
          sql: ` AND c.offre_id IN (SELECT id FROM offre_stage WHERE departement_id = ${push(scope.departementId)})`,
          params
        };
      }
      break;
    case 'offres':
      if (scope.role === 'STAGIAIRE' || scope.role === 'CANDIDAT') return { sql: " AND o.statut = 'OUVERTE'", params };
      if (scope.role === 'CHEF_DEPARTEMENT') return byDepartment('o', 'departement_id');
      break;
    case 'encadrants':
      if (scope.role === 'CHEF_DEPARTEMENT') return byDepartment('e', 'departement_id');
      break;
    case 'departements':
      if (scope.role === 'CHEF_DEPARTEMENT') return byDepartment('d', 'id');
      break;
    default:
      break;
  }

  // Deny-safe : rôle non reconnu ou non géré pour ce type de ressource → aucune donnée.
  // Sans ce filtre, le « fall-through » retournait `{ sql: '', params: [] }` (= aucun
  // filtre) ce qui laissait l'utilisateur accéder à TOUTES les données de la ressource.
  return { sql: ' AND FALSE', params: [] };
};

module.exports = { scopeFilter };
