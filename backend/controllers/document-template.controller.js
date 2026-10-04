const { asyncHandler } = require('../utils/asyncHandler');
const { sendResponse } = require('../utils/response.util');
const documentTemplateService = require('../services/document-template.service');

const list = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await documentTemplateService.listTemplates(req.query));
});

const getById = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await documentTemplateService.getTemplateById(req.params.id));
});

const create = asyncHandler(async (req, res) => {
  const { nom, type, contenu, variables } = req.body;
  const template = await documentTemplateService.createTemplate({
    nom,
    type,
    contenu,
    variables,
    created_by: req.user.id
  });
  sendResponse(res, 201, { template }, 'Template créé.');
});

const update = asyncHandler(async (req, res) => {
  const { nom, contenu, variables } = req.body;
  const template = await documentTemplateService.updateTemplate(req.params.id, {
    nom,
    contenu,
    variables
  });
  sendResponse(res, 200, { template }, 'Template mis à jour.');
});

const deactivate = asyncHandler(async (req, res) => {
  const template = await documentTemplateService.deactivateTemplate(req.params.id);
  sendResponse(res, 200, { template }, 'Template désactivé.');
});

const preview = asyncHandler(async (req, res) => {
  const preview = await documentTemplateService.previewTemplate(req.params.id, req.body);
  sendResponse(res, 200, { preview });
});

module.exports = { list, getById, create, update, deactivate, preview };
