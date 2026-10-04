const express = require('express');
const router = express.Router();
const c = require('../controllers/document.controller');
const { authenticateToken: auth } = require('../middlewares/auth.middleware');
const { requireRole: role } = require('../middlewares/role.middleware');
const { withScope, authorizeResource, authorizeStage } = require('../middlewares/authorization.middleware');
const { uploadDocumentValidation } = require('../validators/document.validator');
const documentService = require('../services/document.service');

// Mounted at /api — these routes use different base paths so merged into stage and document paths
// Stage documents
router.post('/stages/:stageId/documents', auth, role('STAGIAIRE', 'ENCADRANT', 'ADMIN'), documentService.uploadMiddleware, uploadDocumentValidation, documentService.validateUpload, c.upload);
router.get('/stages/:stageId/documents', auth, withScope, authorizeStage('stage'), c.getByStage);
router.get('/documents/:id/download', auth, withScope, authorizeResource('document'), c.download);
router.get('/documents/:id/preview', auth, withScope, authorizeResource('document'), c.preview);
router.delete('/documents/:id', auth, role('ENCADRANT', 'ADMIN'), withScope, authorizeResource('document'), c.delete);

module.exports = router;
