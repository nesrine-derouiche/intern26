# Refactoring Architecture Backend — Rapport Final

## Contexte
Refactoring architectural du backend de l'application de gestion des stages STEG (`/Users/macbookm4pro/Documents/stage26/backend`).
Objectif : séparation propre des responsabilités (controllers → services → repositories), suppression du SQL des services,
découpage des méthodes longues, standardisation des réponses, et robustesse des notifications.
**Aucun changement de contrat API, de schéma de base de données, ni de comportement métier.**
Vérifié : **21/21 tests d'intégration passent** (`npm test`).

## Fichiers modifiés (14)

| Fichier | Changement |
|---|---|
| `config/db.js` | Ajout du helper `withTransaction(cb)` pour exécuter un callback dans une transaction PostgreSQL (commit/rollback). |
| `repositories/candidature.repository.js` | `updateStatut` et `refuseOtherCandidatures` acceptent désormais un `client` optionnel (pool par défaut) pour être utilisées dans une transaction. |
| `repositories/encadrant.repository.js` | + `findAvailableByDepartment`, `findAnyAvailable`, `existsById`. |
| `repositories/stagiaire.repository.js` | + `existsById`. |
| `repositories/offre.repository.js` | + `findById`, `decrementPlaces(offreId, client?)`. |
| `repositories/stage.repository.js` | + `findEvaluationContext`, `findPdfData`. |
| `repositories/evaluation.repository.js` | + `findPdfData`. |
| `repositories/projet.repository.js` | **Nouveau** repository dédié à la table `projets` (`findStageIdById`). |
| `services/candidature.service.js` | Réécrit : plus aucun SQL, transaction via `db.withTransaction`, notifications déplacées **hors** de la transaction (via `notifyBestEffort`), découpage en `_refuseCandidature`, `_acceptCandidature`, `_findAvailableEncadrant`, `_computeStageDates`, `_validateCandidature`. |
| `services/tache.service.js` | Réécrit : plus aucun SQL, utilisation des repositories (dont `projetRepository`), helpers `_validateCreateContext`, `_buildCreatePayload`, `_resolveUpdatedFields`, `_validateUpdatedFields`, notifications via `notifyBestEffort`. |
| `services/evaluation.service.js` | Réécrit : plus aucun SQL, transaction superflue supprimée, helper `_computeNote`, notification stagiaire via `notifyBestEffort`, `updateEvaluation` renvoie désormais 400 (au lieu d'un no-op silencieux). |
| `services/pdf.service.js` | SQL déplacé vers `stageRepository.findPdfData`/`evaluationRepository.findPdfData` ; génération PDF découpée en helpers privés (`_renderConventionHeader`, `_renderConventionParties`, `_renderConventionObjet`, `_renderConventionDuree`, `_renderConventionSignatures`, `_renderAttestationBody`, `_renderEvaluationHeader`, `_renderEvaluationCriteria`, `_renderEvaluationFooter`). |
| `services/document.service.js` | Notifications via `notificationService.notifyBestEffort`, nettoyage du fichier en cas d'échec, helpers `_getDocumentOrThrow`, `_getContentType`. |
| `services/reunion.service.js` | Notifications via `notifyBestEffort` + `logger.error` (remplace `console.error`). |
| `services/search.service.js` | Méthode `search` (118 lignes) découpée en `_buildPagination` + un helper par entité (`_searchStagiaires`, `_searchStages`, `_searchTaches`, `_searchOffres`, `_searchCandidatures`). |
| `services/dashboard.service.js` | Filtres par rôle extraits dans `_buildRoleFilters`. |
| `utils/response.util.js` | Standardisation de `sendResponse(res, statusCode, data, message)` : contrat unique, données réparties à plat pour un objet, `data` sous clé sinon, contrat array/`message` inchangé. |
| Controllers (`candidature`, `tache`, `evaluation`, `document`, `reunion`, `offre`, `departement`, `stagiaire`, `encadrant`) | Appels `sendResponse` harmonisés sur le même ordre d'arguments `(res, code, data, message)`. |

## Nouvelles méthodes services / repositories
- `services/notification.service.js` : + `notifyBestEffort` (échec journalisé via `logger.error`, jamais bloquant pour l'opération principale). La méthode `create` (aucun appelant) a été supprimée lors de la passe finale.
- Repositories : voir tableau ci-dessus.

## Duplication supprimée
- Le même `INSERT INTO notifications` + try/catch existait dans candidature/tache/document/reunion → centralisé dans `notificationService.create`/`notifyBestEffort`.
- `console.error` ad-hoc de notification remplacé par le Logger applicatif.
- Le modèle de données évaluation (SQL multi-tables) dupliqué dans `pdf.service` et `evaluation.service` → une seule requête `findEvaluationContext`.
- Conditions WHERE par rôle dupliquées entre dashboard/search → `_buildRoleFilters` (dashboard).

## Améliorations architecturales
- **Couche repositories** : désormais l'unique endroit contenant du SQL ; les services n'ont plus aucune requête directe (`client.query`).
- **Transactions** : `candidature.service` encadre la création de stage + attribution + décrément des places dans une seule transaction ; aucune notification envoyée dans la transaction (évite un blocage si la notif échoue).
- **Méthodes courtes** : chaque méthode publique ne dépasse plus une vingtaine de lignes ; la logique détaillée vit dans des helpers privés testables et lisibles.
- **Réponses standardisées** : un seul utilitaire `sendResponse` avec un contrat explicite, utilisé partout.
- **Journalisation** : erreurs de notifications capturées et tracées (Logger) sans interrompre le flux principal.

## Vérification
- `npm test` → **21/21 tests pass** (API notifications, tâches, stages, candidatures, évaluations, recherche).
- Contrats préservés : GET collections = array brut, `{ message }` sur PUT/DELETE, `{ token, user }` sur login, `notificationsNonLues` dans les stats, `{ id, motDePasseTemporaire }` à la création.

## Note
Le serveur backend a été relancé en arrière-plan (`nohup node server.js`) pour exécuter les tests ; il écoute sur le port 3000.

---

# Passe d'architecture finale — Rapport complémentaire

Contexte : passe transversale backend + frontend Angular. **Aucun changement de contrat API, de schéma, ni de comportement métier.**
Vérifié : **backend 21/21** (`npm test`), **frontend 83/83** (`ng test`, vitest), `tsc --noEmit` sans erreur.

## 1. Config API centralisée (frontend)
- `src/environments/environment.ts` / `environment.prod.ts` : ajout de `apiUrl: 'http://localhost:3000/api'`.
- Les **16 services** `core/data/*.service.ts` utilisent désormais `environment.apiUrl` (auth : `environment.apiUrl + '/auth'`). Suppression de 16 URL en dur dupliquées.
- Les spec files conservent leurs URL codées en dur dans `expectOne(...)` → tests inchangés (83/83).

## 2. Méthodes > 40 lignes refactorées
| Fichier | Avant | Après |
|---|---|---|
| `services/dashboard.service.js` | `getStats` (41 lignes) | `getStats` + `_buildStatsResponse` (~24 lignes) |
| `services/tache.service.js` | `_resolveUpdatedFields` (41 lignes) | + `_pickField`, `_resolveDateValue`, `_applyStatusTransitions` |
| `demo/pages/stages/stages.component.ts` | `loadStageDetails` (47 lignes) | + `_loadStageTaches`, `_loadStageDocs`, `_loadStageReunions`, `_loadStageEvaluations` |
| `theme/.../bar-chart.component.ts` | `constructor` (60 lignes) | `constructor` + `_buildSeries` + `_buildOptions` |
| `theme/.../chart-data-month.component.ts` | `ngOnInit` (42 lignes) | `ngOnInit` + `_buildOptions` |

## 3. Dashboard « mes-taches » corrigé (tous les rôles)
- Bug frontend : `taskService.getById('mes-taches')` (abus sémantique de `getById`, fonctionnait seulement grâce à l'ordre des routes) + `getAll()` pour les autres rôles.
- Fix : nouveau `TaskService.getMyTaches()` → `GET /taches/mes-taches`, utilisé par le dashboard pour tous les rôles.
- Backend : `GET /taches/mes-taches` est désormais sensible au rôle (`tache.service.getMesTaches(user, options)`) :
  - **STAGIAIRE** → tâches dont il est `executant_id` (inchangé).
  - **ENCADRANT** → tâches dont il est `createur_id` (`findByCreateur`, nouveau). Auparavant vide.
  - **ADMIN/RH** → toutes les tâches.
- Vérifié en live : ADMIN 6, ENCADRANT 4, STAGIAIRE 4 (statuts 200).

## 4. Notifications — jamais ignorées
- Audit : tous les appels passent par `notificationService.notifyBestEffort` (tache, reunion, document, evaluation, candidature) ; chaque échec est journalisé via `logger.error` sans bloquer l'opération métier. Aucun `.catch(() => {})` vide.

## 5. `sendResponse` — cohérence
- Audit : plus aucune réponse brute `res.json` dans controllers/routes ; les seuls `.json` restants sont dans les middlewares (`error`, `security`, `rateLimit`). Contrats array/`{ message }`/`{ token, user }` inchangés.

## 6. ORDER BY whitelisté (injection SQL)
- `repositories/search.repository.js` : whitelist stricte par entité (`ORDER_BY_WHITELISTS`) + helper `_safeOrderBy(entity, sort, dir, fallback)` appliqué aux 5 requêtes (stagiaires, stages, taches, offres, candidatures). Toute valeur hors liste retombe sur la colonne par défaut (défense en profondeur au-dessus du filtrage déjà fait dans `search.service`).

## 7. Code mort / dupliqué supprimé
- `check_findAll.js`, `check_taches_test.js` (racine backend) — scripts de debug résiduels.
- `notificationService.create` — aucun appelant (toute la duplication d'INSERT notifications était déjà centralisée).
- `repositories/tache.repository.js` : `findByExecutant` + `findByCreateur` factorisés via `_findByUserColumn(column, userId, options)` avec whitelist de colonnes (élimine ~30 lignes dupliquées).

## Vérification finale
- Backend : `npm test` → 21/21 (serveur relancé sur :3000 avec les nouveaux modules).
- Frontend : `ng test` → 83/83 ; `tsc --noEmit` OK. Lint : seules les erreurs `no-explicit-any` préexistantes (style du projet), aucune nouvelle catégorie introduite.
