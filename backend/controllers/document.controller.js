const { asyncHandler } = require('../utils/asyncHandler');
const documentService = require('../services/document.service');
const { sendResponse } = require('../utils/response.util');
const { getPaginationParams } = require('../utils/pagination.util');

const upload = asyncHandler(async (req, res) => {
  const document = await documentService.uploadDocument(req, req.params.stageId);
  sendResponse(res, 201, { document }, 'Document mis en ligne avec succès.');
});

const getByStage = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await documentService.getDocumentsByStage(req.params.stageId, getPaginationParams(req.query)));
});

const download = asyncHandler(async (req, res) => {
  const { filePath, nom } = await documentService.downloadDocument(req.params.id);
  res.download(filePath, nom);
});

const preview = asyncHandler(async (req, res) => {
  const { filePath, nom, contentType } = await documentService.previewDocument(req.params.id);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', 'inline; filename="' + encodeURIComponent(nom) + '"');
  res.sendFile(filePath);
});

const delete_ = asyncHandler(async (req, res) => {
  await documentService.deleteDocument(req.params.id);
  sendResponse(res, 200, null, 'Document supprimé avec succès.');
});

module.exports = { upload, getByStage, download, preview, delete: delete_ };
