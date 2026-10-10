const { asyncHandler } = require('../utils/asyncHandler');
const { sendResponse } = require('../utils/response.util');
const noteService = require('../services/note.service');

const list = asyncHandler(async (req, res) => {
  const notes = await noteService.listNotes(req.user);
  sendResponse(res, 200, notes);
});

const create = asyncHandler(async (req, res) => {
  const { titre, contenu, pinned, client_key } = req.body;
  const { note, deduplicated } = await noteService.createNote(
    { titre, contenu, pinned, client_key },
    req.user
  );
  if (deduplicated) {
    sendResponse(res, 200, { note }, 'Note déjà créée.');
    return;
  }
  sendResponse(res, 201, { note }, 'Note créée.');
});

const update = asyncHandler(async (req, res) => {
  const { titre, contenu, pinned } = req.body;
  const note = await noteService.updateNote(req.params.id, { titre, contenu, pinned }, req.user);
  sendResponse(res, 200, { note }, 'Note mise à jour.');
});

const remove = asyncHandler(async (req, res) => {
  await noteService.removeNote(req.params.id, req.user);
  sendResponse(res, 200, null, 'Note supprimée.');
});

module.exports = { list, create, update, remove };
