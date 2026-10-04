const { asyncHandler } = require('../utils/asyncHandler');
const pointageService = require('../services/pointage.service');
const horaireRepository = require('../repositories/horaire.repository');
const { sendResponse } = require('../utils/response.util');
const { getPaginationParams } = require('../utils/pagination.util');
const ApiError = require('../utils/error.util');

const getAll = asyncHandler(async (req, res) => {
  const filters = {};
  if (req.query.stage_id) filters.stage_id = req.query.stage_id;
  if (req.query.statut) filters.statut = req.query.statut;
  if (req.query.date_debut) filters.date_debut = req.query.date_debut;
  if (req.query.date_fin) filters.date_fin = req.query.date_fin;
  sendResponse(res, 200, await pointageService.getAllPointages(getPaginationParams(req.query), req.scope, filters));
});

const getMesPresences = asyncHandler(async (req, res) => {
  const filters = {};
  if (req.query.date_debut) filters.date_debut = req.query.date_debut;
  if (req.query.date_fin) filters.date_fin = req.query.date_fin;
  sendResponse(res, 200, await pointageService.getMesPresences(req.user.id, getPaginationParams(req.query), filters));
});

const getByStage = asyncHandler(async (req, res) => {
  const filters = {};
  if (req.query.statut) filters.statut = req.query.statut;
  if (req.query.date_debut) filters.date_debut = req.query.date_debut;
  if (req.query.date_fin) filters.date_fin = req.query.date_fin;
  sendResponse(res, 200, await pointageService.getPresencesByStage(req.params.id, getPaginationParams(req.query), req.scope, filters));
});

const pointerEntree = asyncHandler(async (req, res) => {
  const { stage_id } = req.body;
  const pointage = await pointageService.pointerEntree(stage_id, req.user);
  sendResponse(res, 201, { pointage }, 'Entrée enregistrée.');
});

const pointerSortie = asyncHandler(async (req, res) => {
  const { stage_id } = req.body;
  const pointage = await pointageService.pointerSortie(stage_id, req.user);
  sendResponse(res, 200, { pointage }, 'Sortie enregistrée.');
});

const getRetards = asyncHandler(async (req, res) => {
  const filters = {};
  if (req.query.date_debut) filters.date_debut = req.query.date_debut;
  if (req.query.date_fin) filters.date_fin = req.query.date_fin;
  sendResponse(res, 200, await pointageService.getRetards(req.scope, getPaginationParams(req.query), filters));
});

const corriger = asyncHandler(async (req, res) => {
  const pointage = await pointageService.corriger(req.params.id, req.body, req.user);
  sendResponse(res, 200, { pointage }, 'Pointage corrigé.');
});

const getStats = asyncHandler(async (req, res) => {
  const stats = await pointageService.getStats(req.params.id, req.query.date_debut, req.query.date_fin);
  sendResponse(res, 200, stats);
});

const getHoraire = asyncHandler(async (req, res) => {
  const horaire = await horaireRepository.findByStageId(req.params.id);
  if (!horaire) {
    sendResponse(res, 200, { heure_debut: '09:00', heure_fin: '17:00', duree_pause_minutes: 60 });
    return;
  }
  sendResponse(res, 200, horaire);
});

const upsertHoraire = asyncHandler(async (req, res) => {
  const horaire = await horaireRepository.upsert({ stage_id: req.params.id, ...req.body });
  sendResponse(res, 200, { horaire }, 'Horaires mis à jour.');
});

module.exports = { getAll, getMesPresences, getByStage, pointerEntree, pointerSortie, getRetards, corriger, getStats, getHoraire, upsertHoraire };
