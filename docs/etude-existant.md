# Étude de l'existant — Analyse du code actuel

## Résumé

Le code actuel fournit une bonne infrastructure (Express, React, Docker, auth) mais le modèle de données et la logique métier ne correspondent pas aux besoins réels définis. Cette étude identifie ce qu'on garde, ce qu'on modifie et ce qu'on supprime.

---

## Backend

### À GARDER tel quel

| Fichier | Raison |
|---------|--------|
| `backend/src/index.ts` | Setup Express solide : helmet, cors, compression, morgan, rate-limit. Juste retirer la route `POST /api/seed` (dangereux). |
| `backend/src/config/database.ts` | Connexion MongoDB — fonctionne |
| `backend/src/utils/logger.ts` | Winston logger — fonctionne |
| `backend/src/middleware/errorHandler.ts` | `createError()` + `asyncHandler()` — bon pattern |
| `backend/src/middleware/auth.ts` | `authenticate`, `authorize`, `optionalAuth` — garder tel quel |
| `backend/jest.config.js` | Config Jest — garder |
| `backend/.eslintrc.js` | Config ESLint — garder |
| `backend/tsconfig.json` | Config TypeScript — garder |
| `backend/package.json` | Dépendances — garder (ajouter `node-telegram-bot-api`) |

### À MODIFIER en profondeur

| Fichier | Changements nécessaires |
|---------|------------------------|
| **`backend/src/models/Recipe.ts`** | Remplacer le schéma actuel (ingredients plats + sizes fixes + multiplicateur x2) par le nouveau modèle `variants[]` où chaque taille a ses propres ingrédients et machines avec durées |
| **`backend/src/models/Order.ts`** | Remplacer `userId` par `clientName` + `clientPhone`. Remplacer le champ `mode` (full/preparation/ingredients) par `clientProvidedIngredients[]` par item. Ajouter `calculatedPrice` par item. Nouveau statut `paid`. |
| **`backend/src/models/Appliance.ts`** | Retirer le champ `unit` (toujours en Watts). Le reste est bon. |
| **`backend/src/services/priceCalculationService.ts`** | Réécrire complètement. Nouveaux paramètres : variant (pas size), clientProvidedIngredients (pas mode). Lire tarifs depuis collection `settings` au lieu de constantes en dur. |
| **`backend/src/routes/recipes.ts`** | Adapter au nouveau modèle Recipe (variants). Ajouter route `POST /:id/duplicate`. Filtrer `req.body` dans le PUT (ne plus faire `Object.assign(recipe, req.body)`). |
| **`backend/src/routes/orders.ts`** | Adapter au nouveau modèle Order (clientName/Phone, clientProvidedIngredients). Pas besoin d'auth pour `POST /orders`. Ajouter route pour cocher les ingrédients. Intégrer notification Telegram. |
| **`backend/src/routes/prices.ts`** | Adapter au nouveau calcul (variantIndex au lieu de size/mode). |
| **`backend/src/scripts/seed.ts`** | Réécrire avec le nouveau modèle (variants, pas de test user). Ajouter seed pour `settings`. Ajouter guard `NODE_ENV !== 'production'`. |

### À CRÉER

| Fichier | Description |
|---------|-------------|
| `backend/src/models/Settings.ts` | Modèle Mongoose pour les paramètres configurables (tarif STEG, forfait eau, marge) |
| `backend/src/routes/settings.ts` | CRUD paramètres (admin uniquement) |
| `backend/src/services/telegramService.ts` | Bot Telegram — envoyer notifications à Mariem quand une commande arrive |

### À SUPPRIMER

| Fichier / Code | Raison |
|----------------|--------|
| Route `POST /api/seed` dans `index.ts` | Dangereuse — le seed ne doit pas être accessible via API |
| `backend/src/scripts/start-dev.ts` | Inutile — `nodemon` fait le travail |
| `backend/src/models/User.ts` champs `phone`, `role: 'user'` | Plus de comptes client — garder seulement le nécessaire pour admin |

---

## Frontend

### À GARDER tel quel

| Fichier | Raison |
|---------|--------|
| `frontend/src/main.tsx` | Point d'entrée React — ok |
| `frontend/src/services/api.ts` | Client Axios avec intercepteurs — bon |
| `frontend/src/store/store.ts` | Config Redux Toolkit — garder |
| `frontend/src/store/slices/authSlice.ts` | Auth pour admin — garder |
| `frontend/src/components/layout/MainLayout.tsx` | Layout principal — garder, adapter |
| `frontend/src/components/layout/Header.tsx` | Header — adapter (retirer login client) |
| `frontend/src/components/layout/Footer.tsx` | Footer — garder |
| `frontend/src/components/common/LoadingSpinner.tsx` | Utilitaire — garder |
| `frontend/package.json` | Dépendances — ok |
| `frontend/tailwind.config.js` | Config Tailwind — ok |
| `frontend/tsconfig.json` | Config TS — ok |

### À MODIFIER en profondeur

| Fichier | Changements |
|---------|-------------|
| **`frontend/src/App.tsx`** | Refaire le routing : pages publiques (/, /recipes, /recipes/:id) + pages admin (/admin/*) + login (/auth/login). Supprimer /auth/register, /profile, /cart. |
| **`frontend/src/pages/RecipesPage.tsx`** | Adapter à la nouvelle API (variants au lieu de sizes fixes) |
| **`frontend/src/pages/RecipeDetailPage.tsx`** | Afficher variants (tailles), prix par variant, formulaire de commande (nom + tél), pas de panier complexe |
| **`frontend/src/components/recipes/RecipeCard.tsx`** | Adapter à la nouvelle structure |
| **`frontend/src/store/slices/recipeSlice.ts`** | Adapter aux nouveaux types |
| **`frontend/src/services/recipeService.ts`** | Adapter aux nouveaux endpoints |

### À CRÉER

| Fichier | Description |
|---------|-------------|
| Pages admin (`/admin/*`) | Dashboard, gestion recettes, ingrédients, machines, commandes, paramètres |
| `frontend/src/pages/admin/RecipeFormPage.tsx` | Formulaire création/édition recette (étape par étape : infos → ingrédients → machines → tailles) |
| `frontend/src/pages/admin/OrderDetailPage.tsx` | Détail commande avec checkbox ingrédients |
| `frontend/src/pages/admin/SettingsPage.tsx` | Paramètres (tarif STEG, forfait eau, marge) |
| `frontend/src/components/OrderForm.tsx` | Formulaire commande public (nom + téléphone + notes) |

### À SUPPRIMER

| Fichier | Raison |
|---------|--------|
| `frontend/src/pages/RegisterPage.tsx` | Plus d'inscription client |
| `frontend/src/pages/ProfilePage.tsx` | Plus de profil client |
| `frontend/src/pages/CartPage.tsx` | Plus de panier complexe — commande directe depuis la recette |
| `frontend/src/pages/LoginPage.tsx` | Garder mais déplacer vers /auth/login (admin uniquement) |
| `frontend/src/components/cart/CartDrawer.tsx` | Plus de panier |
| `frontend/src/store/slices/cartSlice.ts` | Plus de panier client côté frontend |
| `frontend/src/components/layout/AuthLayout.tsx` | Simplifier — un seul layout pour le login admin |
| `frontend/src/components/home/Testimonials.tsx` | Pas prioritaire |
| `frontend/src/shared/types/index.ts` | Doublon de `shared/types/index.ts` à la racine |

---

## Shared

### À MODIFIER

| Fichier | Changements |
|---------|-------------|
| `shared/types/index.ts` | Réécrire complètement selon les nouveaux modèles (Recipe avec variants, Order avec clientName/Phone/clientProvidedIngredients, Settings, etc.). Supprimer les types obsolètes (CartItem, RegisterForm, OrderForm avec modes, etc.) |

---

## Docker

### À MODIFIER

| Fichier | Changements |
|---------|-------------|
| `docker-compose.yml` | Retirer le service `admin` séparé (intégré dans frontend). Adapter pour AWS. Variable d'env Telegram. |
| `docker/mongo-init.js` | Vérifier qu'il correspond aux nouvelles collections |

---

## Racine

### À MODIFIER

| Fichier | Changements |
|---------|-------------|
| `package.json` | Retirer le workspace `admin` (n'existe pas). Retirer scripts `dev:admin`. |
| `env.example` | Ajouter `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Retirer `WHATSAPP_*`, `ADMIN_PASSWORD`. Changer `REACT_APP_*` en `VITE_*`. |
| `test-system.sh` | Adapter aux nouveaux endpoints |

---

## Résumé quantitatif

| Action | Backend | Frontend | Shared | Config |
|--------|---------|----------|--------|--------|
| **Garder** | 8 fichiers | 10 fichiers | 0 | 4 fichiers |
| **Modifier** | 8 fichiers | 6 fichiers | 1 fichier | 3 fichiers |
| **Créer** | 3 fichiers | ~10 fichiers | 0 | 0 |
| **Supprimer** | 2 fichiers/code | 7 fichiers | 1 doublon | 0 |

## Ordre d'implémentation recommandé

1. **Modèles** — Recipe, Order, Settings (le reste dépend d'eux)
2. **PriceCalculationService** — cœur métier
3. **Routes backend** — recipes, orders, settings, prices
4. **Shared types** — refléter les nouveaux modèles
5. **Frontend public** — recettes, détail, commande
6. **Frontend admin** — gestion recettes (formulaire étape par étape), commandes, paramètres
7. **Telegram bot** — notifications
8. **Seed** — données de test
9. **Docker** — adapter pour AWS
