const documentTemplateRepository = require('../repositories/document-template.repository');
const { getPaginationParams, buildPaginatedResult } = require('../utils/pagination.util');
const ApiError = require('../utils/error.util');
const logger = require('../utils/logger');

const DOCUMENT_TYPES = ['CV', 'CONVENTION', 'ASSURANCE', 'RAPPORT', 'ATTESTATION'];
const VARIABLE_NAME = /^[a-zA-Z0-9_]+$/;
const FORBIDDEN_VARIABLES = ['__proto__', 'constructor', 'prototype'];
const UPDATABLE_FIELDS = ['nom', 'contenu', 'variables'];
const MAX_NOM_LENGTH = 120;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
  ));
}

function mapDatabaseError(err) {
  switch (err && err.code) {
    case '23505':
      return new ApiError(409, 'Une version de ce type existe déjà : choisissez une autre version.');
    case '23514':
      return new ApiError(422, 'Version invalide : elle doit être un entier supérieur ou égal à 1.');
    case '23503':
      return new ApiError(422, 'Référence invalide : created_by ne correspond à aucun utilisateur.');
    case '23502':
      return new ApiError(400, 'Un champ obligatoire est manquant.');
    case '22P02':
      return new ApiError(404, 'Template introuvable.');
    default:
      logger.error('[DOC-TEMPLATE] Erreur base de données :', err && err.code, err && err.message);
      return new ApiError(500, 'Opération impossible sur les templates de documents.');
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

function assertIdentifier(id) {
  if (id === undefined || id === null || id === '') {
    throw new ApiError(400, 'L\'identifiant du template est requis.');
  }
}

function assertNom(nom) {
  if (typeof nom !== 'string' || nom.trim() === '') {
    throw new ApiError(400, 'Le champ « nom » est requis.');
  }
  if (nom.length > MAX_NOM_LENGTH) {
    throw new ApiError(400, `Le champ « nom » ne doit pas dépasser ${MAX_NOM_LENGTH} caractères.`);
  }
}

function assertContenu(contenu) {
  if (typeof contenu !== 'string' || contenu.trim() === '') {
    throw new ApiError(400, 'Le champ « contenu » est requis.');
  }
}

function assertType(type) {
  if (type === undefined || type === null || type === '') {
    throw new ApiError(400, 'Le champ « type » est requis.');
  }
  if (!DOCUMENT_TYPES.includes(type)) {
    throw new ApiError(422, `Type de document inconnu : « ${type} ». Types autorisés : ${DOCUMENT_TYPES.join(', ')}.`);
  }
}

function normalizeVariables(variables) {
  if (!Array.isArray(variables)) {
    throw new ApiError(422, 'Le champ « variables » doit être un tableau de noms.');
  }
  const normalized = [];
  for (const entry of variables) {
    if (typeof entry !== 'string' || !VARIABLE_NAME.test(entry)) {
      const label = typeof entry === 'string' ? `« ${entry} »` : `(${typeof entry})`;
      throw new ApiError(422, `Nom de variable invalide ${label} : seuls les identifiants [a-zA-Z0-9_] sont acceptés.`);
    }
    if (FORBIDDEN_VARIABLES.includes(entry)) {
      throw new ApiError(422, `Nom de variable réservé : « ${entry} ».`);
    }
    if (!normalized.includes(entry)) normalized.push(entry);
  }
  return normalized;
}

function extractPlaceholders(contenu) {
  const found = [];
  const rest = contenu.replace(/\{\{([^{}]*)\}\}/g, (match, name) => {
    if (!VARIABLE_NAME.test(name) || FORBIDDEN_VARIABLES.includes(name)) {
      throw new ApiError(422, `Construction de variable invalide : « ${match} ». Utilisez {{nom_variable}}.`);
    }
    if (!found.includes(name)) found.push(name);
    return '';
  });
  if (rest.includes('{{') || rest.includes('}}')) {
    throw new ApiError(422, 'Construction de variable invalide dans le contenu (accolades non refermées ou imbriquées).');
  }
  return found;
}

function validateVariablesAgainstContent(declared, contenu) {
  const used = extractPlaceholders(contenu);
  const declaredSet = new Set(declared);
  for (const name of used) {
    if (!declaredSet.has(name)) {
      throw new ApiError(422, `La variable « ${name} » est utilisée dans le contenu mais n\'est pas déclarée dans « variables ».`);
    }
  }
  for (const name of declared) {
    if (!used.includes(name)) {
      logger.warn(`[DOC-TEMPLATE] Variable « ${name} » déclarée mais jamais utilisée dans le contenu.`);
    }
  }
  return used;
}

class DocumentTemplateService {
  async createTemplate(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new ApiError(400, 'Les données du template doivent être un objet.');
    }

    const { nom, type, contenu, variables, actif, version, created_by } = data;
    assertNom(nom);
    assertType(type);
    assertContenu(contenu);

    const declared = normalizeVariables(variables === undefined || variables === null ? [] : variables);
    validateVariablesAgainstContent(declared, contenu);

    if (actif !== undefined && typeof actif !== 'boolean') {
      throw new ApiError(400, 'Le champ « actif » doit être un booléen.');
    }
    if (created_by !== undefined && created_by !== null && typeof created_by !== 'string') {
      throw new ApiError(400, 'Le champ « created_by » doit être un identifiant.');
    }

    let nextVersion = version;
    if (nextVersion === undefined || nextVersion === null) {
      const latest = await execute(() => documentTemplateRepository.findLatestByType(type));
      nextVersion = latest ? latest.version + 1 : 1;
    } else if (!Number.isInteger(nextVersion) || nextVersion < 1) {
      throw new ApiError(422, 'La version doit être un entier supérieur ou égal à 1.');
    }

    return execute(() => documentTemplateRepository.create({
      nom,
      type,
      contenu,
      variables: declared,
      actif: actif === undefined ? true : actif,
      version: nextVersion,
      created_by: created_by === undefined ? null : created_by
    }));
  }

  async getTemplateById(id) {
    assertIdentifier(id);
    const template = await execute(() => documentTemplateRepository.findById(id));
    if (!template) throw new ApiError(404, 'Template introuvable.');
    return template;
  }

  async listTemplates(filters = {}) {
    if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
      throw new ApiError(400, 'Les filtres doivent être un objet.');
    }

    const hasType = filters.type !== undefined && filters.type !== null && filters.type !== '';
    if (hasType && !DOCUMENT_TYPES.includes(filters.type)) {
      throw new ApiError(422, `Type de document inconnu : « ${filters.type} ».`);
    }

    let actif;
    if (filters.actif !== undefined && filters.actif !== null && filters.actif !== '') {
      if (filters.actif === true || filters.actif === 'true') actif = true;
      else if (filters.actif === false || filters.actif === 'false') actif = false;
      else throw new ApiError(422, 'Le filtre « actif » doit être true ou false.');
    }

    const pagination = getPaginationParams(filters);
    const rows = await execute(() => documentTemplateRepository.findAll({
      type: hasType ? filters.type : undefined,
      actif,
      ...pagination
    }));

    if (!pagination.enabled) return rows;
    return buildPaginatedResult(rows.data, rows.total, pagination.page, pagination.limit);
  }

  async updateTemplate(id, data) {
    assertIdentifier(id);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new ApiError(400, 'Les données de mise à jour doivent être un objet.');
    }

    const current = await this.getTemplateById(id);

    const patch = {};
    for (const field of UPDATABLE_FIELDS) {
      if (data[field] !== undefined) patch[field] = data[field];
    }
    if (Object.keys(patch).length === 0) {
      throw new ApiError(400, 'Aucun champ modifiable fourni : nom, contenu ou variables attendu.');
    }

    const nextNom = patch.nom !== undefined ? patch.nom : current.nom;
    const nextContenu = patch.contenu !== undefined ? patch.contenu : current.contenu;
    const nextVariables = patch.variables !== undefined ? patch.variables : current.variables;

    assertNom(nextNom);
    assertContenu(nextContenu);
    const declared = normalizeVariables(nextVariables === undefined || nextVariables === null ? [] : nextVariables);
    validateVariablesAgainstContent(declared, nextContenu);

    const updated = await execute(() => documentTemplateRepository.update(id, patch));
    if (!updated) throw new ApiError(404, 'Template introuvable.');
    return updated;
  }

  async deactivateTemplate(id) {
    assertIdentifier(id);
    const template = await execute(() => documentTemplateRepository.deactivate(id));
    if (!template) throw new ApiError(404, 'Template introuvable.');
    return template;
  }

  renderTemplate(template, data) {
    if (!template || typeof template !== 'object' || typeof template.contenu !== 'string') {
      throw new ApiError(404, 'Template introuvable.');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new ApiError(400, 'Les données de rendu doivent être un objet.');
    }

    const declared = normalizeVariables(
      template.variables === undefined || template.variables === null ? [] : template.variables
    );
    const used = validateVariablesAgainstContent(declared, template.contenu);

    for (const name of used) {
      if (!Object.prototype.hasOwnProperty.call(data, name) || data[name] === undefined || data[name] === null) {
        throw new ApiError(422, `La variable « ${name} » est absente des données fournies.`);
      }
      const value = data[name];
      const valueType = typeof value;
      if (valueType === 'function' || valueType === 'symbol' || (valueType === 'object' && !(value instanceof Date))) {
        throw new ApiError(422, `La valeur de la variable « ${name} » doit être un texte, un nombre ou une date.`);
      }
    }

    return template.contenu.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, name) => escapeHtml(String(data[name])));
  }

  async previewTemplate(id, data) {
    const template = await this.getTemplateById(id);
    return this.renderTemplate(template, data);
  }
}

module.exports = new DocumentTemplateService();
