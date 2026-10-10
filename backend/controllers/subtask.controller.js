const { asyncHandler } = require('../utils/asyncHandler');
const { sendResponse } = require('../utils/response.util');
const subtaskService = require('../services/subtask.service');

const listByTask = asyncHandler(async (req, res) => {
  const { data, aggregate } = await subtaskService.listSubtasks(req.task.id);
  sendResponse(res, 200, { subtasks: data, aggregate });
});

const create = asyncHandler(async (req, res) => {
  const { titre, description, statut } = req.body;
  const subtask = await subtaskService.createSubtask({
    tache_id: req.task.id,
    titre,
    description,
    statut
  });
  sendResponse(res, 201, { subtask }, 'Sous-tâche créée.');
});

const progress = asyncHandler(async (req, res) => {
  const result = await subtaskService.getProgress(req.task.id);
  sendResponse(res, 200, result);
});

const update = asyncHandler(async (req, res) => {
  const { titre, description, statut } = req.body;
  const subtask = await subtaskService.updateSubtask(req.subtask.id, {
    titre,
    description,
    statut
  });
  sendResponse(res, 200, { subtask }, 'Sous-tâche mise à jour.');
});

const updateStatus = asyncHandler(async (req, res) => {
  const subtask = await subtaskService.updateStatus(req.subtask.id, req.body.statut);
  sendResponse(res, 200, { subtask }, 'Statut mis à jour.');
});

const remove = asyncHandler(async (req, res) => {
  await subtaskService.removeSubtask(req.subtask.id);
  sendResponse(res, 200, null, 'Sous-tâche supprimée.');
});

module.exports = { listByTask, create, progress, update, updateStatus, remove };
