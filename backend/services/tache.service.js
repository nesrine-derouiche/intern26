const tacheRepository = require('../repositories/tache.repository');
const projetRepository = require('../repositories/projet.repository');
const stageRepository = require('../repositories/stage.repository');
const encadrantRepository = require('../repositories/encadrant.repository');
const stagiaireRepository = require('../repositories/stagiaire.repository');
const notificationService = require('./notification.service');
const { buildPaginatedResult } = require('../utils/pagination.util');
const ApiError = require('../utils/error.util');

class TacheService {
  async getAllTaches(options = null, scope = null) {
    const rows = await tacheRepository.findAll(options, scope);
    if (options && options.enabled) return buildPaginatedResult(rows.data, rows.total, options.page, options.limit);
    return rows;
  }

  async getMesTaches(user, options = null) {
    let rows;
    if (user.role === 'ENCADRANT') {
      rows = await tacheRepository.findByCreateur(user.id, options);
    } else if (user.role === 'ADMIN' || user.role === 'RH') {
      rows = await tacheRepository.findAll(options);
    } else {
      rows = await tacheRepository.findByExecutant(user.id, options);
    }
    if (options && options.enabled) return buildPaginatedResult(rows.data, rows.total, options.page, options.limit);
    return rows;
  }

  async createTache(body, currentUser) {
    await this._validateCreateContext(body, currentUser);
    const data = this._buildCreatePayload(body, currentUser);

    const tache = await tacheRepository.create(data);
    await this._syncProjectAndStage(data.projet_id);

    await notificationService.notifyBestEffort(
      data.executant_id,
      'Nouvelle tâche assignée 📋',
      `Une nouvelle tâche "${data.titre}" vous a été assignée par votre encadrant.`,
      'TACHE'
    );

    return tache;
  }

  async _validateCreateContext(body, currentUser) {
    const { projet_id, executant_id, date_debut, date_fin, estimated_hours, spent_hours } = body;

    const projet = await projetRepository.findStageIdById(projet_id);
    if (!projet) throw new ApiError(400, 'Le projet spécifié n\'existe pas.');
    if (!projet.stage_id) throw new ApiError(400, 'Le projet doit être associé à un Stage.');

    const isEncadrant = await encadrantRepository.existsById(currentUser.id);
    if (!isEncadrant) throw new ApiError(403, 'Seul un encadrant peut créer une tâche.');

    const isStagiaire = await stagiaireRepository.existsById(executant_id);
    if (!isStagiaire) throw new ApiError(400, 'La tâche doit être assignée à un stagiaire.');

    if (date_debut && date_fin && new Date(date_debut) > new Date(date_fin)) {
      throw new ApiError(400, 'La date de début doit être inférieure ou égale à la date de fin.');
    }

    const estHours = estimated_hours !== undefined ? estimated_hours : 1;
    if (estHours <= 0) throw new ApiError(400, 'Les heures estimées doivent être strictement supérieures à 0.');

    const sptHours = spent_hours !== undefined ? spent_hours : 0;
    if (sptHours > estHours) throw new ApiError(400, 'Les heures passées ne peuvent pas dépasser les heures estimées.');
  }

  _buildCreatePayload(body, currentUser) {
    const { projet_id, executant_id, titre, description, priorite, date_debut, date_fin, estimated_hours, spent_hours } = body;

    return {
      projet_id,
      createur_id: currentUser.id,
      executant_id,
      titre,
      description,
      priorite: priorite || 'MOYENNE',
      date_debut: date_debut === '' ? null : date_debut,
      date_fin: date_fin === '' ? null : date_fin,
      progress: 0,
      estimated_hours: estimated_hours !== undefined ? estimated_hours : 1,
      spent_hours: spent_hours !== undefined ? spent_hours : 0,
      created_at: new Date(),
      completion_date: null,
      statut: 'A_FAIRE'
    };
  }

  async updateTache(id, body) {
    const task = await tacheRepository.findById(id);
    if (!task) throw new ApiError(404, 'Tâche introuvable.');
    if (task.statut === 'TERMINEE') throw new ApiError(400, 'Une tâche terminée ne peut plus être modifiée.');

    const fields = this._resolveUpdatedFields(task, body);
    this._validateUpdatedFields(fields);

    await tacheRepository.update(id, fields);
    await this._syncProjectAndStage(task.projet_id);

    if (fields.statut === 'TERMINEE' && task.statut !== 'TERMINEE') {
      await notificationService.notifyBestEffort(
        task.createur_id,
        'Tâche complétée ✅',
        `La tâche "${fields.titre}" a été marquée comme terminée.`,
        'TACHE'
      );
    }
  }

  _resolveUpdatedFields(task, body) {
    const fields = {
      titre: this._pickField(body, task, 'titre'),
      description: this._pickField(body, task, 'description'),
      priorite: this._pickField(body, task, 'priorite'),
      statut: this._pickField(body, task, 'statut'),
      date_debut: this._resolveDateValue(body.date_debut, task.date_debut),
      date_fin: this._resolveDateValue(body.date_fin, task.date_fin),
      progress: this._pickField(body, task, 'progress'),
      estimated_hours: this._pickField(body, task, 'estimated_hours'),
      spent_hours: this._pickField(body, task, 'spent_hours'),
      completion_date: task.completion_date
    };
    return this._applyStatusTransitions(fields);
  }

  _pickField(body, task, key) {
    return body[key] !== undefined ? body[key] : task[key];
  }

  _resolveDateValue(value, fallback) {
    return (value !== undefined ? value : fallback) || null;
  }

  _applyStatusTransitions(fields) {
    const { statut, progress, completion_date, ...rest } = fields;
    let newStatut = statut;
    let newProgress = progress;
    let newCompletionDate = completion_date;

    if (newProgress === 100) {
      newStatut = 'TERMINEE';
      newCompletionDate = new Date();
    } else if (newStatut === 'TERMINEE' && newProgress < 100) {
      newProgress = 100;
      newCompletionDate = new Date();
    } else {
      newCompletionDate = null;
      if (newStatut === 'TERMINEE') newStatut = 'EN_COURS';
    }

    return { ...rest, statut: newStatut, progress: newProgress, completion_date: newCompletionDate };
  }

  _validateUpdatedFields(fields) {
    if (fields.date_debut && fields.date_fin && new Date(fields.date_debut) > new Date(fields.date_fin)) {
      throw new ApiError(400, 'La date de début doit être inférieure ou égale à la date de fin.');
    }
    if (fields.spent_hours > fields.estimated_hours) {
      throw new ApiError(400, 'Les heures passées ne peuvent pas dépasser les heures estimées.');
    }
  }

  async _syncProjectAndStage(projectId) {
    const summary = await tacheRepository.getProjectSummary(projectId);
    if (!summary) return;

    const avg = Math.round(parseFloat(summary.avg_progress));
    await projetRepository.updateAvancement(projectId, avg);

    if (parseInt(summary.total_tasks) > 0 && parseInt(summary.total_tasks) === parseInt(summary.completed_tasks)) {
      await stageRepository.complete(summary.stage_id);
    }
  }

  async deleteTache(id) {
    const projetId = await tacheRepository.delete(id);
    if (projetId) await this._syncProjectAndStage(projetId);
  }
}

module.exports = new TacheService();
