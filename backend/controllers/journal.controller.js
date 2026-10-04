const { asyncHandler } = require('../utils/asyncHandler');
const journalService = require('../services/journal.service');
const { sendResponse } = require('../utils/response.util');
const { getPaginationParams } = require('../utils/pagination.util');

const getAll = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await journalService.getAllJournals(getPaginationParams(req.query), req.scope));
});

const create = asyncHandler(async (req, res) => {
  const journal = await journalService.createJournal(req.body, req.user);
  sendResponse(res, 201, { journal }, 'Journal hebdomadaire créé.');
});

const update = asyncHandler(async (req, res) => {
  const journal = await journalService.updateJournal(req.params.id, req.body, req.user);
  sendResponse(res, 200, { journal }, 'Journal hebdomadaire mis à jour.');
});

const submit = asyncHandler(async (req, res) => {
  const journal = await journalService.submitJournal(req.params.id, req.user);
  sendResponse(res, 200, { journal }, 'Journal soumis pour validation.');
});

const validate_ = asyncHandler(async (req, res) => {
  const journal = await journalService.validateJournal(req.params.id, req.body.commentaire_encadrant, req.user);
  sendResponse(res, 200, { journal }, 'Journal validé.');
});

const reject_ = asyncHandler(async (req, res) => {
  const journal = await journalService.rejectJournal(req.params.id, req.body.commentaire_encadrant, req.user);
  sendResponse(res, 200, { journal }, 'Journal rejeté.');
});

const delete_ = asyncHandler(async (req, res) => {
  await journalService.deleteJournal(req.params.id, req.user);
  sendResponse(res, 200, null, 'Journal hebdomadaire supprimé.');
});

module.exports = { getAll, create, update, submit, validate: validate_, reject: reject_, delete: delete_ };
