const { asyncHandler } = require('../utils/asyncHandler');
const { sendResponse } = require('../utils/response.util');
const certificationService = require('../services/certification.service');

const getState = asyncHandler(async (req, res) => {
  const state = await certificationService.getState(req.resource, req.user);
  sendResponse(res, 200, state);
});

const upload = asyncHandler(async (req, res) => {
  const doc = await certificationService.uploadDocument(
    req.resource,
    req.user,
    req.params.kind,
    req.file,
    req.file && req.file.originalname
  );
  sendResponse(res, 201, { document: doc }, 'Document déposé.');
});

const submit = asyncHandler(async (req, res) => {
  const certification = await certificationService.submit(req.resource, req.user);
  sendResponse(res, 200, { certification }, 'Dossier soumis pour relecture.');
});

const validate = asyncHandler(async (req, res) => {
  const certification = await certificationService.validate(req.resource, req.user);
  sendResponse(res, 200, { certification }, 'Dossier validé.');
});

const deny = asyncHandler(async (req, res) => {
  const certification = await certificationService.deny(req.resource, req.user, req.body.reason);
  sendResponse(res, 200, { certification }, 'Dossier refusé.');
});

const requestRedo = asyncHandler(async (req, res) => {
  const certification = await certificationService.requestRedo(
    req.resource,
    req.user,
    req.body.reason,
    req.body.document_concerne
  );
  sendResponse(res, 200, { certification }, 'Reprise demandée.');
});

const download = asyncHandler(async (req, res) => {
  const { filePath, nom } = await certificationService.downloadDocument(
    req.resource,
    req.user,
    req.params.docId
  );
  res.download(filePath, nom);
});

const list = asyncHandler(async (req, res) => {
  const { search, statut, page, limit } = req.query;
  const result = await certificationService.listCertifications(req.user, req.scope, {
    search,
    statut,
    page,
    limit
  });
  sendResponse(res, 200, result);
});

const generateAttestation = asyncHandler(async (req, res) => {
  const attestation = await certificationService.generateAttestation(req.resource, req.user);
  sendResponse(res, 200, { attestation }, 'Attestation générée.');
});

const downloadAttestation = asyncHandler(async (req, res) => {
  const { filePath, nom } = await certificationService.downloadAttestation(req.resource, req.user);
  res.download(filePath, nom);
});

module.exports = { getState, upload, submit, validate, deny, requestRedo, download, list, generateAttestation, downloadAttestation };
