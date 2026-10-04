const ApiError = require('../utils/error.util');
const stagiaireRepository = require('../repositories/stagiaire.repository');
const stageRepository = require('../repositories/stage.repository');
const tacheRepository = require('../repositories/tache.repository');
const documentRepository = require('../repositories/document.repository');
const reunionRepository = require('../repositories/reunion.repository');
const evaluationRepository = require('../repositories/evaluation.repository');
const journalRepository = require('../repositories/journal.repository');
const departementRepository = require('../repositories/departement.repository');
const projetRepository = require('../repositories/projet.repository');
const rapportRepository = require('../repositories/rapport.repository');
const pointageRepository = require('../repositories/pointage.repository');

const FULL_ACCESS_ROLES = ['ADMIN', 'RH'];

const NOT_FOUND_MESSAGES = {
  stage: 'Stage introuvable.',
  stagiaire: 'Stagiaire introuvable.',
  tache: 'Tâche introuvable.',
  projet: 'Projet introuvable.',
  document: 'Document introuvable.',
  reunion: 'Réunion introuvable.',
  evaluation: 'Évaluation introuvable.',
  journal: 'Journal hebdomadaire introuvable.',
  rapport: 'Rapport introuvable.',
  pointage: 'Pointage introuvable.'
};

class AuthorizationService {
  async resolveScope(user) {
    if (FULL_ACCESS_ROLES.includes(user.role)) {
      return { type: 'all', role: user.role };
    }
    if (user.role === 'STAGIAIRE' || user.role === 'ENCADRANT' || user.role === 'CANDIDAT') {
      return { type: 'user', role: user.role, userId: user.id };
    }
    if (user.role === 'CHEF_DEPARTEMENT') {
      const departement = await departementRepository.findByChef(user.id);
      if (!departement) {
        throw new ApiError(403, 'Aucun département n\'est associé à votre compte.');
      }
      return { type: 'department', role: user.role, userId: user.id, departementId: departement.id };
    }
    throw new ApiError(403, 'Accès refusé.');
  }

  async loadAndAssert(resourceType, id, user, scope) {
    const loader = this._loaders[resourceType];
    if (!loader) throw new Error(`Type de ressource inconnu : ${resourceType}`);

    const resource = await loader(id, user, scope);
    if (!resource) throw new ApiError(404, NOT_FOUND_MESSAGES[resourceType]);
    if (!this._canAccess(user, scope, resourceType, resource)) {
      throw new ApiError(403, 'Accès refusé : cette ressource ne vous appartient pas.');
    }
    return resource;
  }

  _loaders = {
    stage: async (id) => stageRepository.findById(id),
    stagiaire: async (id, user, scope) => {
      const stagiaire = await stagiaireRepository.findById(id);
      if (!stagiaire) return null;
      if (user.role === 'ENCADRANT') {
        stagiaire._accessible = await stagiaireRepository.isInternOf(id, user.id);
      } else if (user.role === 'CHEF_DEPARTEMENT') {
        stagiaire._accessible = await stagiaireRepository.isInDepartment(id, scope.departementId);
      }
      return stagiaire;
    },
    tache: async (id) => {
      const tache = await tacheRepository.findById(id);
      if (!tache) return null;
      const stageRow = await projetRepository.findStageIdById(tache.projet_id);
      const stageId = stageRow ? stageRow.stage_id : null;
      tache._stage = stageId ? await stageRepository.findAuthContext(stageId) : null;
      return tache;
    },
    document: async (id) => {
      const document = await documentRepository.findById(id);
      if (!document) return null;
      document._stage = document.stage_id ? await stageRepository.findAuthContext(document.stage_id) : null;
      return document;
    },
    reunion: async (id) => {
      const reunion = await reunionRepository.findById(id);
      if (!reunion) return null;
      reunion._stage = reunion.stage_id ? await stageRepository.findAuthContext(reunion.stage_id) : null;
      return reunion;
    },
    evaluation: async (id) => {
      const evaluation = await evaluationRepository.findById(id);
      if (!evaluation) return null;
      evaluation._stage = evaluation.stage_id ? await stageRepository.findAuthContext(evaluation.stage_id) : null;
      return evaluation;
    },
    journal: async (id) => {
      const journal = await journalRepository.findById(id);
      if (!journal) return null;
      journal._stage = journal.stage_id ? await stageRepository.findAuthContext(journal.stage_id) : null;
      return journal;
    },
    projet: async (id) => {
      const projet = await projetRepository.findAuthContext(id);
      if (!projet) return null;
      projet._stage = projet;
      return projet;
    },
    rapport: async (id) => {
      const rapport = await rapportRepository.findStageContext(id);
      if (!rapport) return null;
      rapport._stage = rapport;
      return rapport;
    },
    pointage: async (id) => {
      const pointage = await pointageRepository.findStageContext(id);
      if (!pointage) return null;
      pointage._stage = pointage;
      return pointage;
    }
  };

  _canAccess(user, scope, resourceType, resource) {
    if (FULL_ACCESS_ROLES.includes(user.role)) return true;

    switch (resourceType) {
      case 'stage':
        if (user.role === 'STAGIAIRE') return resource.stagiaire_id === user.id;
        if (user.role === 'ENCADRANT') return resource.encadrant_id === user.id;
        if (user.role === 'CHEF_DEPARTEMENT') return resource.departement_id === scope.departementId;
        return false;

      case 'stagiaire':
        if (user.role === 'STAGIAIRE') return resource.id === user.id;
        if (user.role === 'ENCADRANT' || user.role === 'CHEF_DEPARTEMENT') return !!resource._accessible;
        return false;

      case 'tache':
        if (user.role === 'STAGIAIRE') return resource.executant_id === user.id;
        if (user.role === 'ENCADRANT') return resource.createur_id === user.id;
        if (user.role === 'CHEF_DEPARTEMENT') return resource._stage && resource._stage.departement_id === scope.departementId;
        return false;

      case 'document':
        if (user.role === 'STAGIAIRE') return resource.stagiaire_id === user.id;
        if (user.role === 'ENCADRANT') return resource._stage && resource._stage.encadrant_id === user.id;
        if (user.role === 'CHEF_DEPARTEMENT') return resource._stage && resource._stage.departement_id === scope.departementId;
        return false;

      case 'reunion':
      case 'evaluation':
      case 'journal':
        if (!resource._stage) return false;
        if (user.role === 'STAGIAIRE') return resource._stage.stagiaire_id === user.id;
        if (user.role === 'ENCADRANT') return resource._stage.encadrant_id === user.id;
        if (user.role === 'CHEF_DEPARTEMENT') return resource._stage.departement_id === scope.departementId;
        return false;

      case 'projet':
        if (!resource._stage) return false;
        if (user.role === 'STAGIAIRE') return resource._stage.stagiaire_id === user.id;
        if (user.role === 'ENCADRANT') return resource._stage.encadrant_id === user.id;
        if (user.role === 'CHEF_DEPARTEMENT') return resource._stage.departement_id === scope.departementId;
        return false;

      case 'rapport':
        if (!resource._stage) return false;
        if (user.role === 'STAGIAIRE') return resource._stage.stagiaire_id === user.id;
        if (user.role === 'ENCADRANT') return resource._stage.encadrant_id === user.id;
        if (user.role === 'CHEF_DEPARTEMENT') return resource._stage.departement_id === scope.departementId;
        return false;

      case 'pointage':
        if (!resource._stage) return false;
        if (user.role === 'STAGIAIRE') return resource._stage.stagiaire_id === user.id;
        if (user.role === 'ENCADRANT') return resource._stage.encadrant_id === user.id;
        if (user.role === 'CHEF_DEPARTEMENT') return resource._stage.departement_id === scope.departementId;
        return false;

      default:
        return false;
    }
  }
}

module.exports = new AuthorizationService();
