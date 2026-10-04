const path = require('path');
const stageRepository = require('../repositories/stage.repository');
const evaluationRepository = require('../repositories/evaluation.repository');
const documentTemplateRepository = require('../repositories/document-template.repository');
const documentTemplateService = require('./document-template.service');
const { UPLOAD_DIR } = require('../config/uploads');
const ApiError = require('../utils/error.util');
const logger = require('../utils/logger');

/**
 * P1-3A-5 — Génération d'un document à partir d'un template actif.
 *
 * Chaîne imposée : template → documentTemplateService.renderTemplate() →
 * contenu rendu → mécanisme PDF existant (pdf.service.js).
 *
 * `pdf.service.js` streamme actuellement vers la réponse HTTP
 * (`generateConvention/generateAttestation/generateEvaluation(stageId, res)`)
 * et ne peut pas recevoir un contenu rendu sans modification : ce service
 * prépare donc intégralement le document (données, variables, rendu,
 * historisation) et isole le point d'intégration, branché en P1-3A-6.
 *
 * `EVALUATION` n'existe pas dans l'enum `type_document` (database/schema.sql) :
 * aucun template ne peut lui être associé sans modifier le schéma (interdit à
 * cette étape). Les données d'évaluation sont chargées, le motif
 * `NO_TEMPLATE_TYPE` est retourné et la route PDF historique reste inchangée.
 */
const DOCUMENT_TYPES = {
  CONVENTION: { source: 'stage', templateType: 'CONVENTION' },
  ATTESTATION: { source: 'stage', templateType: 'ATTESTATION' },
  EVALUATION: { source: 'evaluation', templateType: null }
};

class DocumentGenerationService {
  async generate(options = {}) {
    const { stageId, type, dataOverride } = options || {};

    if (!stageId) throw new ApiError(400, 'L\'identifiant du stage est requis.');

    const spec = DOCUMENT_TYPES[type];
    if (!spec) {
      throw new ApiError(
        422,
        `Type de document non pris en charge : « ${type} ». Types disponibles : ${Object.keys(DOCUMENT_TYPES).join(', ')}.`
      );
    }

    if (dataOverride !== undefined && dataOverride !== null) {
      if (typeof dataOverride !== 'object' || Array.isArray(dataOverride)) {
        throw new ApiError(400, 'dataOverride doit être un objet.');
      }
    }

    const sourceData = await this._loadData(spec.source, stageId);

    if (!spec.templateType) {
      logger.warn(
        `[DOC-GENERATION] Type « ${type} » sans correspondance dans type_document : rendu reporté (P1-3A-6).`
      );
      return { generated: false, reason: 'NO_TEMPLATE_TYPE', type, stage_id: stageId };
    }

    const template = await this._selectActiveTemplate(spec.templateType);
    if (!template) {
      logger.warn(`[DOC-GENERATION] Aucun template actif de type « ${spec.templateType} ».`);
      return { generated: false, reason: 'NO_ACTIVE_TEMPLATE', type, stage_id: stageId };
    }

    const variables = this._buildVariables(sourceData, dataOverride);
    const rendered = documentTemplateService.renderTemplate(template, variables);
    const chemin = this._buildChemin();

    const generated = await this._createGenerated({
      template_id: template.id,
      template_version: template.version,
      stage_id: stageId,
      variables,
      chemin
    });

    logger.info(
      `[DOC-GENERATION] Document « ${type} » préparé (template ${template.id} v${template.version}, stage ${stageId}).`
    );

    return {
      generated: true,
      reason: null,
      id: generated.id,
      template_id: template.id,
      template_version: template.version,
      stage_id: stageId,
      type,
      variables,
      rendered,
      chemin,
      path: path.join(UPLOAD_DIR, chemin),
      pdf: {
        written: false,
        delegate: 'pdf.service'
      }
    };
  }

  async _loadData(source, stageId) {
    const isStage = source === 'stage';
    const notFoundMessage = isStage
      ? 'Stage introuvable.'
      : 'Aucune évaluation trouvée pour ce stage.';

    try {
      const data = isStage
        ? await stageRepository.findPdfData(stageId)
        : await evaluationRepository.findPdfData(stageId);

      if (!data) throw new ApiError(404, notFoundMessage);
      return data;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err && err.code === '22P02') throw new ApiError(404, notFoundMessage);
      logger.error('[DOC-GENERATION] chargement des données :', err && err.code, err && err.message);
      throw new ApiError(500, 'Génération du document impossible.');
    }
  }

  /**
   * Version active la plus élevée, choisie explicitement (le repository peut
   * retourner plusieurs versions actives) : sélection déterministe, jamais
   * dépendante de l'ordre de restitution.
   */
  async _selectActiveTemplate(type) {
    try {
      const rows = await documentTemplateRepository.findActiveByType(type);
      if (!rows || rows.length === 0) return null;
      return rows.reduce((best, row) => (row.version > best.version ? row : best), rows[0]);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      logger.error('[DOC-GENERATION] recherche du template :', err && err.code, err && err.message);
      throw new ApiError(500, 'Génération du document impossible.');
    }
  }

  _buildVariables(sourceData, dataOverride) {
    const variables = {};

    for (const [key, value] of Object.entries(sourceData || {})) {
      if (value === null || value === undefined) continue;
      if (typeof value === 'object' && !(value instanceof Date)) continue;
      variables[key] = value;
    }

    return { ...variables, ...(dataOverride || {}) };
  }

  /** Convention de nommage du stockage existant (multer, document.service). */
  _buildChemin() {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    return `${uniqueSuffix}.pdf`;
  }

  async _createGenerated(payload) {
    try {
      return await documentTemplateRepository.createGenerated(payload);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      logger.error('[DOC-GENERATION] historisation :', err && err.code, err && err.message);
      throw new ApiError(500, 'Génération du document impossible.');
    }
  }
}

module.exports = new DocumentGenerationService();
