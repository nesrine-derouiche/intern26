const ApiError = require('../utils/error.util');
const { onboardingAccessService } = require('../services/onboarding-access.service');

/**
 * Garde d'accès au stage (côté serveur).
 *
 * Complète le verrou d'interface : un candidat dont le dossier de candidature
 * n'est pas complet et vérifié ne peut pas contourner l'application mobile en
 * appelant directement les API du stage (403). Seuls les candidats en fenêtre
 * d'onboarding sont concernés ; les autres rôles ne sont jamais affectés.
 */
const enforceOnboardingAccess = async (req, res, next) => {
  try {
    const allowed = await onboardingAccessService.hasInternshipAccess(req.user);
    if (!allowed) {
      return next(
        new ApiError(
          403,
          'Accès refusé : votre dossier de candidature doit être complet et vérifié avant d\'accéder à votre espace.'
        )
      );
    }
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { enforceOnboardingAccess };
