# Audit technique — État du projet

> Cette note documente l'audit technique réalisé le 2026-04-22 sur la base existante, les problèmes identifiés, les correctifs appliqués, et les décisions d'architecture en cours. Elle remplace l'ancien document de plan de refonte (obsolète — la refonte a été effectuée).

## Résumé exécutif

Le code est fonctionnel et bien structuré sur le plan architectural. L'audit a identifié **1 vulnérabilité critique**, **1 bug fonctionnel silencieux** et plusieurs points de dette technique à corriger avant la mise en production.

Tous les problèmes critiques et majeurs ont été traités dans le commit d'audit.

## Vulnérabilités et bugs corrigés

### 🔴 Critique — Inscription admin publique

**Symptôme** : `POST /api/auth/register` était public, et le schéma `User` définissait `role` avec `enum: ['admin'], default: 'admin'`. N'importe quel visiteur sur Internet pouvait donc créer un compte admin et accéder à **toutes** les routes protégées (lire les commandes = fuite RGPD, modifier prix, supprimer recettes).

**Correctif** : ajout du rôle `client` dans le schéma. L'endpoint `/register` force désormais `role = 'client'` côté serveur. Impossible de créer un admin via l'API.

### 🔴 Critique — Route `/bulk-update-prices` morte

**Symptôme** : la route `PUT /api/ingredients/bulk-update-prices` était déclarée après `PUT /api/ingredients/:id`. Express matche dans l'ordre → l'URL était capturée avec `id = "bulk-update-prices"`. La mise à jour en masse ne fonctionnait jamais.

**Correctif** : la route bulk est désormais déclarée avant `/:id`.

### 🟠 Majeur — Pas de fail-fast sur JWT_SECRET

**Symptôme** : si `JWT_SECRET` était absent ou faible, le serveur démarrait quand même. Risque de forge de tokens.

**Correctif** : refus de démarrage si `JWT_SECRET` manquant ou < 32 caractères, avec message explicite indiquant comment générer une valeur forte.

### 🟠 Majeur — `optionalAuth` avalait les erreurs JWT

**Symptôme** : les tokens invalides étaient ignorés silencieusement sans log. Piège pour le debug futur.

**Correctif** : le middleware log l'erreur en `warn` avant de continuer sans utilisateur.

### 🟠 Majeur — Rate-limit trop laxe sur `/api/auth/*`

**Symptôme** : rate-limit global 100/15 min couvrait aussi `/auth/login`. Brute-force possible.

**Correctif** : limiter strict dédié (5 tentatives/15 min, seules les tentatives échouées comptent) en plus du rate-limit global.

### 🟠 Majeur — Pas d'arrêt gracieux

**Symptôme** : `process.exit(0)` direct sur SIGTERM sans fermer HTTP ni Mongo → requêtes en cours perdues, connexions Mongo mal fermées.

**Correctif** : fermeture séquentielle du serveur HTTP puis de Mongo, avec timeout de sécurité de 10 s.

### 🟠 Majeur — `PUT /api/settings` sans whitelist

**Symptôme** : accepter n'importe quelle clé permettait de polluer la collection avec des entrées bidon.

**Correctif** : whitelist explicite des 4 clés autorisées + validation des valeurs (nombre fini, ≥ 0).

### 🟡 Mineur — `totalPrice` sans arrondi final

**Symptôme** : les prix par item étaient arrondis au millime, mais leur somme pouvait dériver (flottants JS).

**Correctif** : arrondi `Math.round(raw * 1000) / 1000` après la somme dans le pre-save hook de `Order`.

### 🟡 Mineur — Seed avec mot de passe en dur

**Symptôme** : `admin123` directement dans le script de seed. Risque de reprise en prod si oubli.

**Correctif** : le seed refuse de tourner si `ADMIN_PASSWORD` n'est pas défini ou < 8 caractères.

### 🟡 Mineur — `env.example` exposait des secrets d'exemple

**Symptôme** : valeurs par défaut pour `JWT_SECRET` et `ADMIN_PASSWORD` qui pouvaient être commitées en prod si oubli.

**Correctif** : valeurs vidées, commentaires explicites sur comment générer des valeurs fortes. Suppression de la dead config (email, WhatsApp, backup) non implémentée.

## Points de vigilance non corrigés (délibérément)

### Détail de prix exposé sur endpoint public

`POST /api/prices/calculate` retourne `ingredientsDetail` avec le prix unitaire de chaque ingrédient. C'est **délibéré** — la transparence est l'essence du concept produit. Les étapes de préparation (recette) ne sont jamais stockées, donc jamais exposées.

### Devise en `number` (flottant)

Les prix sont en `number` plutôt qu'en entiers (millimes). Théoriquement exposé aux imprécisions flottantes, mais atténué par l'arrondi systématique à 3 décimales et la nature des valeurs (ingrédients en DT avec 3 décimales max). Refonte en entiers possible si volume justifie.

### Pas de refresh token

JWT à 7 jours sans rotation. Si compromis, on repose sur l'expiration. Acceptable pour V1, à revoir en V2.

### Pas de tests automatisés

Jest configuré, dossier `__tests__` vide. Plan : écrire des tests sur `priceCalculationService` avant toute refonte de la logique prix. Voir [testing-strategy.md](./testing-strategy.md).

## Décisions d'architecture prises pendant l'audit

### Ajout du rôle `client` (hybride Glovo-like)

**Avant** : un seul rôle `admin`, pas de comptes clients.
**Après** : `admin` + `client`. Le modèle reste guest-first (commande sans compte possible), mais un compte optionnel déverrouille l'historique, le suivi temps réel et la re-commande.

**Raison** : conserve la friction minimale du guest checkout tout en apportant de la valeur aux clients récurrents, sans coût de développement prohibitif.

### Pas de model `Client` séparé

Extension de `User` avec `role: 'admin' | 'client'` plutôt qu'un model distinct. Simple, réutilise l'infra JWT. Séparation possible plus tard si la logique diverge vraiment.

### Commande liée au compte par `clientId` optionnel

Le champ `clientName` + `clientPhone` reste requis même pour un client connecté (traçabilité + cohérence avec les commandes guest). L'ajout de `clientId` optionnel permet le lien avec l'historique sans casser le flux guest.

## Arborescence de référence

```
mariem-sweet-kitchen/
├── backend/
│   ├── src/
│   │   ├── config/database.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts          (authenticate, authorize, optionalAuth)
│   │   │   └── errorHandler.ts  (createError, asyncHandler)
│   │   ├── models/
│   │   │   ├── User.ts          (rôle admin|client)
│   │   │   ├── Recipe.ts        (variants flexibles)
│   │   │   ├── Ingredient.ts
│   │   │   ├── Appliance.ts
│   │   │   ├── Order.ts         (clientId optionnel)
│   │   │   └── Settings.ts
│   │   ├── routes/
│   │   │   ├── auth.ts          (login, register client, me, profile, password)
│   │   │   ├── recipes.ts       (+ /duplicate)
│   │   │   ├── ingredients.ts   (+ /bulk-update-prices)
│   │   │   ├── appliances.ts
│   │   │   ├── orders.ts        (+ /my, /status)
│   │   │   ├── prices.ts        (/calculate public)
│   │   │   ├── settings.ts      (whitelist clés)
│   │   │   └── upload.ts
│   │   ├── services/
│   │   │   └── priceCalculationService.ts
│   │   ├── scripts/seed.ts      (requiert ADMIN_PASSWORD env)
│   │   ├── utils/logger.ts
│   │   └── index.ts             (fail-fast JWT, graceful shutdown)
├── frontend/  (React 18 + Vite + Material-UI + Tailwind)
├── shared/types/
├── docs/
└── docker-compose.yml
```

## Prochaines priorités

1. **Tests** sur `priceCalculationService` (cœur métier — à sécuriser avant toute refonte).
2. **V1 comptes clients** : route `/orders/my`, page `/mes-commandes`, lien `clientId` à la commande.
3. **Frontend suivi commande** pour guest (par téléphone + ID).
4. **Bot Telegram** : notifications nouvelle commande et changement de statut.
5. **CI/CD** : GitHub Actions pour lint + build + tests.

Voir [roadmap.md](./roadmap.md) pour le plan de développement complet.
