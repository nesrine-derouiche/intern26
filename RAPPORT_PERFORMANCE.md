# Rapport de Performance Backend

**Projet :** Gestion des Stages STEG — `/Users/macbookm4pro/Documents/stage26/backend`
**Date :** 31/07/2026
**Résultat :** 21/21 tests d'intégration passent — aucun contrat API ni JSON existant modifié.

---

## 5. Qualité des repositories (logique métier extraite)

Les repositories doivent contenir **uniquement** de l'accès aux données. Toute règle métier a été déplacée vers les services.

### 5.1 `tache.repository.syncProjectAndStage` → orchestré par `tache.service._syncProjectAndStage`

Avant : le repository calculait l'avancement moyen et **décidait** de clôturer le stage (règle métier « toutes les tâches TERMINEE ⇒ stage TERMINE ») en 3 requêtes.

Après :
- `tache.repository.getProjectSummary(projectId)` — **une seule requête** pure : `LEFT JOIN tache` + `AVG`/`COUNT FILTER`, renvoie `{ stage_id, avg_progress, total_tasks, completed_tasks }` (comportement identique avec 0 tâche : `avg=0`, `total=0`).
- `projet.repository.updateAvancement(projectId, avancement)` — nouveau, SQL pur.
- `stage.repository.complete(stageId)` — nouveau, SQL pur (`statut='TERMINE'`, `date_fin=CURRENT_DATE`, garde `statut != 'TERMINE'`).
- `tache.service._syncProjectAndStage(projectId)` — **règle métier** : arrondi, mise à jour de l'avancement, décision de clôture.

Vérifié en bout en bout : création de 3 tâches via API → terminaison des 3 → `avancement=100` et `stage.statut='TERMINE'`, `date_fin` = date du jour. Idem « 2/3 terminées ⇒ avancement=67, stage EN_COURS ».

### 5.2 `document.repository` ne touche plus au système de fichiers

Avant : `getUploadDir()` + `UPLOAD_DIR` + `require('fs')` dans le repository.

Après : constantes déplacées dans `config/uploads.js` (`UPLOAD_DIR`), consommées par `document.service` (stockage multer, `download/preview/delete`). Comportement identique (même chemin `backend/uploads`).

### 5.3 Déduplication des requêtes « participants d'un stage »

`document.repository.getStageOwner` et `reunion.repository.findStageParticipants` (requêtes strictement identiques) → **une seule méthode** `stage.repository.findParticipants(stageId)`. Appelée par `document.service` et `reunion.service`. Vérifié : upload document + création de réunion fonctionnent via la nouvelle méthode.

### 5.4 Justifications conservées (à ne pas déplacer)

- `offre.repository.decrementPlaces` : la règle « places à 0 ⇒ offre close » est **intentionnellement** dans le SQL `CASE` — elle est atomique et sûre en concurrence (déplacement vers le service = lecture + écriture + course possible).
- `encadrant.repository.create` / `stagiaire.repository.create` / `update` : transactions multi-tables (`BEGIN/COMMIT`) — accès aux données légitime.
- `stage.repository.createWithProject` : écriture transactionnelle unique (stage + projet) au sein de la transaction candidature.

## 6. Optimisation SQL supplémentaire (JSON inchangé)

### 6.1 `stagiaire.findAll` — fusion de 2 sous-requêtes identiques en un seul `LATERAL`

Avant : deux sous-requêtes corrélées **strictement identiques** (même `JOIN tache→projet→stage`) pour `nb_taches` et `nb_taches_terminees` → 2 scans par ligne.

Après : un seul `LEFT JOIN LATERAL (...) ts ON true` avec `COUNT(*)` + `COUNT(*) FILTER (WHERE statut='TERMINEE')`. Types préservés (`int8` → chaînes, exactement comme avant). Vérifié sur `/api/stagiaires?page=1&limit=3` : clés et types JSON identiques, `nb_stages`, `nb_taches`, `nb_taches_terminees` inchangés.

### 6.2 `tache.getProjectSummary` — voir 5.1 (2 requêtes → 1)

---

## Vérifications

- **Tests :** `npm test` → **21/21 pass** (suite complète, aucun échec).
- **Syntaxe :** `node --check` sur les fichiers modifiés → OK.
- **Régression JSON :** vérification par appels réels —
  - endpoints listes sans paramètres → `Array.isArray` = true (comportement antérieur identique) ;
  - avec `page/limit` → `{ data, total, page, pages }` ;
  - clés de lignes identiques sur `taches`, `stages`, `stagiaires`, `evaluations`, `offres`, `candidatures`, `reunions`, `documents`, `notifications`, et les 5 recherches ;
  - `dashboard/stats` → forme `{ ..., notificationsNonLues, departements: [...] }` inchangée ;
  - cycle fonctionnel complet tâche (création → `TERMINEE` → `avancement` projet + clôture du stage) fonctionne ;
  - upload/document : création en base + écriture fichier dans `UPLOAD_DIR` + `download` + suppression (base + fichier) OK ;
  - création de réunion → notifications générées via `stageRepository.findParticipants` OK.

## Recommandations (hors périmètre, non appliquées)

- **Recherche texte (`ILIKE '%…%'`)** : ajouter l'extension `pg_trgm` et des index GIN trigram (`utilisateur(nom,prenom,email)`, `offre_stage(titre,description)`) pour accélérer les recherches non préfixées. Les index btree actuels ne couvrent pas `ILIKE '%…%'`.
- **Tri des listes** : index composites optionnels `stage(date_debut)`, `evaluation(date_evaluation)`, `tache(date_debut)` si les volumes croissent (les ORDER BY sur date passent aujourd'hui par un tri mémoire).
- **Notifications** : index `notification(utilisateur_id, date DESC)` pour éviter le tri systématique des 20 dernières.
- **`check_findAll.js`** : script de debug résiduel à la racine du backend (hors fonctionnalité) — peut être supprimé.
- **`POST /api/stages/:id/documents`** : bug pré-existant — le validateur express-validator (`body('type')`) s'exécute **avant** le middleware multer dans `routes/document.routes.js:12`, donc `req.body.type` est toujours vide sur un multipart ⇒ l'endpoint renvoie systématiquement 400. L'upload n'est pas utilisé par le frontend (lecture uniquement). Correction possible : intervertir `documentService.getUploadMiddleware()` et la validation. **Non corrigé** (changerait le comportement observé de l'endpoint, hors périmètre « sans modification de comportement »).

## Fichiers touchés
- **Nouveaux :** `utils/pagination.util.js`, `database/migrate-indexes.js`, `config/uploads.js`.
- **Repositories (13) :** `auth`, `stagiaire`, `encadrant`, `offre`, `candidature`, `stage`, `tache`, `document`, `reunion`, `evaluation`, `departement`, `notification`, `search`, `dashboard`.
- **Services (11) :** `stagiaire`, `encadrant`, `offre`, `candidature`, `stage`, `tache`, `document`, `reunion`, `evaluation`, `departement`, `notification`.
- **Controllers (11) :** `stagiaire`, `encadrant`, `offre`, `candidature`, `stage`, `tache`, `document`, `reunion`, `evaluation`, `departement`, `notification`.
- **Schéma :** `database/schema.sql` (5 index ajoutés).

## 1. Pagination ajoutée (là où elle manquait)

Nouvel utilitaire `utils/pagination.util.js` : `getPaginationParams(query)` + `buildPaginatedResult(...)`.

- **Contrat rétro-compatible :** sans paramètres `?page=&limit=`, les endpoints renvoient exactement le même JSON (tableau brut) qu'avant.
- **Avec `?page=&limit=` :** retour `{ data, total, page, pages }` (même forme que `/api/search`, déjà paginé).
- Appliqué en SQL (`LIMIT/OFFSET`) + `COUNT(*)` séparé, sans `SELECT *` supplémentaire.
- Valeurs bornées : `page >= 1`, `1 <= limit <= 100`, défaut `limit = 20`.

Endpoints concernés (repositories, services, controllers) :

| Endpoint | Avant | Après |
|---|---|---|
| `GET /api/stagiaires` | aucune limite | pagination optionnelle |
| `GET /api/encadrants` | aucune limite | pagination optionnelle |
| `GET /api/offres` | aucune limite | pagination optionnelle |
| `GET /api/candidatures` | aucune limite | pagination optionnelle |
| `GET /api/stages` | aucune limite | pagination optionnelle |
| `GET /api/taches` | aucune limite | pagination optionnelle |
| `GET /api/taches/mes-taches` | aucune limite | pagination optionnelle |
| `GET /api/stages/:id/documents` | aucune limite | pagination optionnelle |
| `GET /api/reunions` | aucune limite | pagination optionnelle |
| `GET /api/evaluations` | aucune limite | pagination optionnelle |
| `GET /api/departements` | aucune limite | pagination optionnelle |
| `GET /api/notifications` | `LIMIT 20` figé, sans offset | `LIMIT 20` par défaut + `offset`/`total` |

## 2. Suppression des `SELECT *`

Toutes les occurrences de `SELECT *`, `<alias>.*` et `RETURNING *` ont été remplacées par des listes de colonnes explicites (≈ 25 requêtes dans 13 fichiers).

- **Exemples :** `document`, `notification`, `offre_stage`, `reunion`, `evaluation`, `stage`, `tache`, `candidature`, `departement`, et les 5 requêtes `search.*`.
- Les listes explicites reproduisent **exactement** l'ensemble des colonnes retournées (clés JSON identiques, vérifiées sur chaque endpoint).
- Bénéfices : contrat de colonnes stable face aux `ALTER TABLE` futurs, pas de transfert inutile (aucune table concernée ne contenait de blob, mais la forme `t.*` empêchait l'optimiseur d'utiliser des index covering purs).

## 3. Index ajoutés (clés étrangères non indexées)

Migration appliquée : `database/migrate-indexes.js` (idempotente, `CREATE INDEX IF NOT EXISTS`) et intégrée dans `database/schema.sql`.

| Index | Table(colonne) | Clé étrangère |
|---|---|---|
| `idx_stage_offre` | `stage(offre_id)` | → `offre_stage(id)` |
| `idx_tache_createur` | `tache(createur_id)` | → `encadrant(id)` |
| `idx_document_stage` | `document(stage_id)` | → `stage(id)` |
| `idx_evaluation_encadrant` | `evaluation(encadrant_id)` | → `encadrant(id)` |
| `idx_utilisateur_permission_permission` | `utilisateur_permission(permission_id)` | → `permission(id)` |

Vérifié dans `pg_indexes` : les 5 index sont créés. Toutes les autres FKs possédaient déjà un index (PK, UNIQUE ou index dédié).

## 4. Optimisations SQL (JSON inchangé)

### 4.1 `searchStagiaires` — suppression du GROUP BY et de la jointure-explosion
`LEFT JOIN stage` + `GROUP BY` (10 colonnes) + `COUNT(DISTINCT st.id)` remplacés par une sous-requête corrélée indexée. La requête de comptage ne joint plus `stage` (inutile).

**EXPLAIN (ANALYZE)** : plan simplifié (GroupAggregate + Incremental Sort + Merge Join → Nested Loop simple).
- Avant : exécution 0.403 ms, 39 lignes de plan
- Après : exécution 0.315 ms, 27 lignes de plan, aucune jointure de `stage` en tête de plan (à l'échelle, la sous-requête utilise `idx_stage_stagiaire`).

### 4.2 `searchOffres` — suppression du GROUP BY / LEFT JOIN candidature
`LEFT JOIN candidature` + `GROUP BY o.id, d.nom` + `COUNT(c.id)` → sous-requête `(SELECT COUNT(*) FROM candidature c WHERE c.offre_id = o.id)` (indexée par `idx_candidature_offre`).
Exécution : 0.162 ms, plan sans agrégat multi-tables.

### 4.3 `searchCandidatures` — jointure redondante supprimée
`JOIN stagiaire s ON s.id = c.stagiaire_id JOIN utilisateur su ON su.id = s.id` → `JOIN utilisateur su ON su.id = c.stagiaire_id` (la table `stagiaire` est une table-enfant dont la PK = `utilisateur.id` ; la jointure était redondante). Même clés JSON.

### 4.4 `searchTaches` — jointure inutile supprimée dans le COUNT
`JOIN utilisateur su` retiré de la requête de comptage (aucun filtre/colonne n'y faisait référence).

### 4.5 `candidature.findAll` — même jointure redondante supprimée.

### 4.6 `dashboard.getDepartementsStats` — fin de l'explosion cartésienne
`LEFT JOIN encadrant` × `LEFT JOIN stage` + `GROUP BY` + `COUNT(DISTINCT ...)` (produit cartésien encadrants×stages par département) → deux sous-requêtes corrélées (index `idx_encadrant_departement`, `idx_stage_departement`).

**EXPLAIN (ANALYZE)** :
- Avant : 0.384 ms, Hash Join + GroupAggregate, 33 lignes de plan
- Après : 0.306 ms, sous-requêtes via index only scan sur `idx_encadrant_departement`, 24 lignes de plan
- À l'échelle (département avec 5 encadrants × 50 stages), l'ancienne forme générait ~250 lignes intermédiaires à trier/agréger.

### 4.7 `tache.syncProjectAndStage` — 2 requêtes fusionnées en 1
`AVG(progress)` et le comptage `total/completed` étaient deux allers-retours : fusionnés en une seule requête avec `COUNT(*) FILTER (...)`. Comportement strictement identique (vérifié par un cycle complet création → terminaison de tâche → mise à jour `avancement` du projet).

### 4.8 Autres requêtes `JOIN` — elles utilisaient déjà les index FK (conservées, colonnes explicites)
`stage.findAll`, `encadrant.findAll`, `offre.findAll`, `evaluation.findAll`/`findPdfData`, `reunion.findAll`, `departement.findAll`, `stagiaire.findById` : sous-requêtes corrélées déjà indexées, conservées telles quelles.

---

## Vérifications

- **Tests :** `npm test` → **21/21 pass** (suite complète, aucun échec).
- **Syntaxe :** `node --check` sur les 37 fichiers modifiés → OK.
- **Régression JSON :** vérification par appels réels —
  - endpoints listes sans paramètres → `Array.isArray` = true (comportement antérieur identique) ;
  - avec `page/limit` → `{ data, total, page, pages }` ;
  - clés de lignes identiques sur `taches`, `stages`, `stagiaires`, `evaluations`, `offres`, `candidatures`, `reunions`, `documents`, `notifications`, et les 5 recherches ;
  - `dashboard/stats` → forme `{ ..., notificationsNonLues, departements: [...] }` inchangée ;
  - cycle fonctionnel complet tâche (création → `TERMINEE` → `avancement` projet) fonctionne.

## Recommandations (hors périmètre, non appliquées)

- **Recherche texte (`ILIKE '%…%'`)** : ajouter l'extension `pg_trgm` et des index GIN trigram (`utilisateur(nom,prenom,email)`, `offre_stage(titre,description)`) pour accélérer les recherches non préfixées. Les index btree actuels ne couvrent pas `ILIKE '%…%'`.
- **Tri des listes** : index composites optionnels `stage(date_debut)`, `evaluation(date_evaluation)`, `tache(date_debut)` si les volumes croissent (les ORDER BY sur date passent aujourd'hui par un tri mémoire).
- **Notifications** : index `notification(utilisateur_id, date DESC)` pour éviter le tri systématique des 20 dernières.
- **`check_findAll.js`** : script de debug résiduel à la racine du backend (hors fonctionnalité) — peut être supprimé.

## Fichiers touchés
- **Nouveaux :** `utils/pagination.util.js`, `database/migrate-indexes.js`.
- **Repositories (13) :** `auth`, `stagiaire`, `encadrant`, `offre`, `candidature`, `stage`, `tache`, `document`, `reunion`, `evaluation`, `departement`, `notification`, `search`, `dashboard`.
- **Services (11) :** `stagiaire`, `encadrant`, `offre`, `candidature`, `stage`, `tache`, `document`, `reunion`, `evaluation`, `departement`, `notification`.
- **Controllers (11) :** `stagiaire`, `encadrant`, `offre`, `candidature`, `stage`, `tache`, `document`, `reunion`, `evaluation`, `departement`, `notification`.
- **Schéma :** `database/schema.sql` (5 index ajoutés).
