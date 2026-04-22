# Audit & Corrections — 2026-04-22

Document de suivi des problèmes identifiés lors de l'audit complet du projet et des corrections appliquées.

---

## Problèmes critiques

### 1. Types partagés désynchronisés

- **Fichier** : `shared/types/index.ts`
- **Problème** : Le schéma Recipe utilisait une structure plate (`ingredients: RecipeIngredient[]`) alors que le backend utilise des `variants[]` avec ingredients/appliances imbriqués. Order avait un `userId` inexistant côté backend. Champs fantômes : `prepTime`, `servings`, `sizes`.
- **Impact** : Le frontend compilait contre des contrats faux.
- **Correction** : Réécriture complète de `shared/types/index.ts` avec enums partagés (`ORDER_STATUSES`, `INGREDIENT_UNITS`, etc.), types `RecipeVariant`, `VariantIngredient`, `VariantAppliance`, et `Order` avec `clientName`/`clientPhone` au lieu de `userId`.
- **Statut** : [x] Corrigé

### 2. Zéro tests

- **Problème** : Jest configuré, mais aucun fichier de test. Le setup file `src/tests/setup.ts` n'existait pas. `moduleNameMapping` mal orthographié dans jest.config.js.
- **Impact** : Aucune protection contre les régressions, surtout sur le calcul de prix (coeur métier).
- **Correction** : Créé `src/tests/setup.ts`, corrigé `moduleNameMapper` dans jest.config.js, écrit 13 tests unitaires pour `PriceCalculationService` couvrant : calcul standard, ingrédients client, forfaits eau, settings custom, appareils kW, arrondis, erreurs, cas limites.
- **Statut** : [x] Corrigé (13/13 tests passent)

### 3. Race condition sur le stock

- **Fichier** : `backend/src/routes/orders.ts`
- **Problème** : La déduction de stock lors du changement de statut n'était pas dans une transaction MongoDB. Échec partiel possible.
- **Correction** : Wrappé dans `mongoose.startSession()` + `session.withTransaction()`. Les opérations `Ingredient.findByIdAndUpdate` et `StockHistory.create` passent la session.
- **Statut** : [x] Corrigé

### 4. Pas de route guards admin (frontend)

- **Problème** : Les pages `/admin/*` étaient accessibles sans vérification d'authentification côté routing React.
- **Correction** : Créé `ProtectedRoute.tsx` qui vérifie `isAuthenticated` du Redux store. Toutes les routes `/admin/*` sont maintenant wrappées dans `<Route element={<ProtectedRoute />}>`. Redirect vers `/auth/login` si non authentifié.
- **Statut** : [x] Corrigé

---

## Problèmes majeurs

### 5. TypeScript strict désactivé (backend)

- **Fichier** : `backend/tsconfig.json`
- **Problème** : `noImplicitAny: false`, `strictNullChecks: false`, `strictFunctionTypes: false`, `noImplicitReturns: false` — annulait la valeur de `strict: true`.
- **Correction** : Activé tous les flags strict. Typé tous les handlers de routes (7 fichiers) avec `Request`/`Response` d'Express. Compilation clean avec 0 erreurs.
- **Statut** : [x] Corrigé

### 6. Transitions de statut commande non validées

- **Problème** : Aucune validation des transitions (pouvait sauter de `pending` à `ready` directement).
- **Correction** : Ajouté `ALLOWED_TRANSITIONS` state machine dans `orders.ts` : `pending→confirmed/cancelled`, `confirmed→preparing/cancelled`, `preparing→ready/cancelled`, `ready→paid`. Message d'erreur explicite sur transition invalide.
- **Statut** : [x] Corrigé

### 7. Pas de pagination réelle

- **Problème** : Recipes chargées avec `limit=50` côté public sans composant de pagination.
- **Correction** : Ajouté `Pagination` MUI sur `RecipesPage.tsx` avec `PAGE_SIZE=12`, reset page sur changement de filtre/recherche, scroll to top au changement de page.
- **Statut** : [x] Corrigé

### 8. Redux sous-utilisé + dépendances inutilisées

- **Problème** : `cartSlice` vide, `recipeSlice` ignoré. react-query, formik, yup, react-hook-form, lodash, react-helmet-async, react-intersection-observer installés mais jamais utilisés.
- **Correction** : Supprimé 7 dépendances inutilisées (28 packages retirés). Nettoyé `main.tsx` des wrappers `QueryClientProvider` et `HelmetProvider` morts.
- **Statut** : [x] Corrigé

### 9. CI/CD manquant

- **Problème** : Aucun pipeline. Pas de lint/build/test automatisé.
- **Correction** : Créé `.github/workflows/ci.yml` avec 2 jobs : `lint-and-build` (lint backend, build backend+frontend) et `test` (jest avec coverage, upload artifact).
- **Statut** : [x] Corrigé

### 10. Secrets hardcodés dans docker-compose.yml

- **Fichier** : `docker-compose.yml`
- **Problème** : `password123`, `admin123`, JWT secret en clair dans le fichier versionné.
- **Correction** : Remplacé tous les secrets par des variables `${VAR}` avec `?` pour les valeurs requises. Créé `.env.docker.example` comme template. Ajouté `.env.docker` au `.gitignore`.
- **Statut** : [x] Corrigé

---

## Problèmes mineurs

### 11. WhatsApp hardcodé

- **Problème** : `21612345678` hardcodé à 4 endroits dans le frontend.
- **Correction** : Remplacé par `import.meta.env.VITE_WHATSAPP_NUMBER` avec fallback. Ajouté la variable dans `frontend/.env`. Créé `vite-env.d.ts` pour le typage.
- **Statut** : [x] Corrigé

### 12. Husky non initialisé

- **Problème** : `husky` dans devDependencies mais `.husky/` n'existait pas.
- **Correction** : `npx husky install` + pre-commit hook qui lance `lint:backend` et `format --check`.
- **Statut** : [x] Corrigé

### 13. Pas de .prettierrc

- **Problème** : Prettier installé mais aucune config.
- **Correction** : Créé `.prettierrc` à la racine (semi, singleQuote, tabWidth 2, trailingComma es5, printWidth 100).
- **Statut** : [x] Corrigé

---

## Résumé

| #   | Problème                      | Sévérité | Statut                        |
| --- | ----------------------------- | -------- | ----------------------------- |
| 1   | Types partagés désynchronisés | Critique | Corrigé                       |
| 2   | Zéro tests                    | Critique | Corrigé (13 tests)            |
| 3   | Race condition stock          | Critique | Corrigé                       |
| 4   | Pas de route guards admin     | Critique | Corrigé                       |
| 5   | TypeScript strict désactivé   | Majeur   | Corrigé                       |
| 6   | Transitions statut invalides  | Majeur   | Corrigé                       |
| 7   | Pas de pagination             | Majeur   | Corrigé                       |
| 8   | Dépendances inutilisées       | Majeur   | Corrigé (7 deps, 28 packages) |
| 9   | CI/CD manquant                | Majeur   | Corrigé                       |
| 10  | Secrets docker-compose        | Majeur   | Corrigé                       |
| 11  | WhatsApp hardcodé             | Mineur   | Corrigé                       |
| 12  | Husky non initialisé          | Mineur   | Corrigé                       |
| 13  | Pas de .prettierrc            | Mineur   | Corrigé                       |

**13/13 corrigés** — tous les problèmes identifiés lors de l'audit sont résolus.
