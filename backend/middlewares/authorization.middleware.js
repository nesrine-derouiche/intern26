const authorizationService = require('../services/authorization.service');
const ApiError = require('../utils/error.util');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const withScope = async (req, res, next) => {
  try {
    req.scope = await authorizationService.resolveScope(req.user);
    next();
  } catch (error) {
    next(error);
  }
};

const assertValidUuid = (value) => {
  if (!value || !UUID_REGEX.test(value)) {
    throw new ApiError(404, 'Ressource introuvable.');
  }
};

const authorizeResource = (resourceType) => async (req, res, next) => {
  try {
    assertValidUuid(req.params.id);
    req.resource = await authorizationService.loadAndAssert(resourceType, req.params.id, req.user, req.scope);
    next();
  } catch (error) {
    next(error);
  }
};

const authorizeStage = (resourceType) => async (req, res, next) => {
  try {
    assertValidUuid(req.params.stageId);
    req.resource = await authorizationService.loadAndAssert(resourceType, req.params.stageId, req.user, req.scope);
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { withScope, authorizeResource, authorizeStage };
