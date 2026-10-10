const subtaskRepository = require('../repositories/subtask.repository');
const ApiError = require('../utils/error.util');
const logger = require('../utils/logger');

/**
 * P2-TASK2 — Sous-tâches hiérarchiques (un seul niveau).
 *
 * Valeurs métier exactes : TODO = 0 %, IN_PROGRESS = 50 %, DONE = 100 %.
 * La progression du parent est la moyenne arithmétique des valeurs de ses
 * sous-tâches, arrondie à l'entier : elle est toujours recalculée depuis
 * les états persistés, jamais acceptée depuis le client.
 *
 * Les contrôles d'autorisation (propriété de la tâche parente) sont
 * effectués par les middlewares de `routes/subtask.routes.js` via
 * `authorizationService.loadAndAssert('tache', ...)` : ce service ne fait
 * que la validation métier et la persistance.
 */
const PROGRESS_VALUES = {
  TODO: 0,
  IN_PROGRESS: 50,
  DONE: 100
};

const STATUSES = Object.keys(PROGRESS_VALUES);
const MAX_TITRE_LENGTH = 200;

function mapDatabaseError(err) {
  switch (err && err.code) {
    case '22P02':
      return new ApiError(404, 'Sous-tâche introuvable.');
    case '23503':
      return new ApiError(422, 'Tâche parente introuvable.');
    case '23502':
      return new ApiError(400, 'Un champ obligatoire est manquant.');
    default:
      logger.error('[SUBTASK] Erreur base de données :', err && err.code, err && err.message);
      return new ApiError(500, 'Opération impossible sur les sous-tâches.');
  }
}

async function execute(operation) {
  try {
    return await operation();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw mapDatabaseError(err);
  }
}

function assertTitre(titre, { required = true } = {}) {
  if (titre === undefined || titre === null) {
    if (required) throw new ApiError(400, 'Le champ « titre » est requis.');
    return;
  }
  if (typeof titre !== 'string' || titre.trim() === '') {
    throw new ApiError(400, 'Le champ « titre » est requis.');
  }
  if (titre.length > MAX_TITRE_LENGTH) {
    throw new ApiError(400, `Le champ « titre » ne doit pas dépasser ${MAX_TITRE_LENGTH} caractères.`);
  }
}

function assertStatut(statut) {
  if (statut === undefined || statut === null || statut === '') {
    throw new ApiError(400, 'Le champ « statut » est requis.');
  }
  if (!STATUSES.includes(statut)) {
    throw new ApiError(422, `Statut de sous-tâche invalide : « ${statut} ». Valeurs autorisées : ${STATUSES.join(', ')}.`);
  }
}

/**
 * Agrégat explicite, jamais NaN/Infinity : sans sous-tâche, `progress`
 * vaut null et `empty` vaut true.
 */
function buildAggregate(rows) {
  const counts = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
  for (const row of rows || []) {
    if (Object.prototype.hasOwnProperty.call(counts, row.statut)) {
      counts[row.statut] += Number(row.n !== undefined ? row.n : 1);
    }
  }
  const total = counts.TODO + counts.IN_PROGRESS + counts.DONE;
  if (total === 0) {
    return { total: 0, todo: 0, in_progress: 0, done: 0, progress: null, empty: true };
  }
  const sum =
    counts.TODO * PROGRESS_VALUES.TODO +
    counts.IN_PROGRESS * PROGRESS_VALUES.IN_PROGRESS +
    counts.DONE * PROGRESS_VALUES.DONE;
  return {
    total,
    todo: counts.TODO,
    in_progress: counts.IN_PROGRESS,
    done: counts.DONE,
    progress: Math.round(sum / total),
    empty: false
  };
}

class SubtaskService {
  async createSubtask(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new ApiError(400, 'Les données de la sous-tâche doivent être un objet.');
    }
    const { tache_id, titre, description, statut } = data;
    if (!tache_id) throw new ApiError(400, 'L\'identifiant de la tâche parente est requis.');
    assertTitre(titre);
    if (description !== undefined && description !== null && typeof description !== 'string') {
      throw new ApiError(400, 'Le champ « description » doit être une chaîne.');
    }
    const finalStatut = statut === undefined || statut === null ? 'TODO' : (assertStatut(statut), statut);
    return execute(() => subtaskRepository.create({ tache_id, titre: titre.trim(), description, statut: finalStatut }));
  }

  async listSubtasks(tacheId) {
    if (!tacheId) throw new ApiError(400, 'L\'identifiant de la tâche parente est requis.');
    const rows = await execute(() => subtaskRepository.findByTaskId(tacheId));
    return { data: rows, aggregate: buildAggregate(rows) };
  }

  async getSubtask(id) {
    if (id === undefined || id === null || id === '') {
      throw new ApiError(400, 'L\'identifiant de la sous-tâche est requis.');
    }
    const subtask = await execute(() => subtaskRepository.findById(id));
    if (!subtask) throw new ApiError(404, 'Sous-tâche introuvable.');
    return subtask;
  }

  async updateSubtask(id, data) {
    const current = await this.getSubtask(id);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new ApiError(400, 'Les données de mise à jour doivent être un objet.');
    }
    const { titre, description, statut } = data;
    if (titre === undefined && description === undefined && statut === undefined) {
      throw new ApiError(400, 'Aucun champ modifiable fourni : titre, description ou statut attendu.');
    }
    assertTitre(titre, { required: false });
    if (description !== undefined && description !== null && typeof description !== 'string') {
      throw new ApiError(400, 'Le champ « description » doit être une chaîne.');
    }
    if (statut !== undefined) assertStatut(statut);
    const updated = await execute(() => subtaskRepository.update(current.id, {
      titre: titre === undefined ? undefined : titre.trim(),
      description,
      statut
    }));
    if (!updated) throw new ApiError(404, 'Sous-tâche introuvable.');
    return updated;
  }

  async updateStatus(id, statut) {
    assertStatut(statut);
    const current = await this.getSubtask(id);
    const updated = await execute(() => subtaskRepository.update(current.id, { statut }));
    if (!updated) throw new ApiError(404, 'Sous-tâche introuvable.');
    return updated;
  }

  async removeSubtask(id) {
    await this.getSubtask(id);
    const removed = await execute(() => subtaskRepository.remove(id));
    if (!removed) throw new ApiError(404, 'Sous-tâche introuvable.');
    return true;
  }

  async getProgress(tacheId) {
    if (!tacheId) throw new ApiError(400, 'L\'identifiant de la tâche parente est requis.');
    const counts = await execute(() => subtaskRepository.countByStatus(tacheId));
    return { tache_id: tacheId, aggregate: buildAggregate(counts) };
  }
}

module.exports = new SubtaskService();
module.exports.PROGRESS_VALUES = PROGRESS_VALUES;
module.exports.STATUSES = STATUSES;
