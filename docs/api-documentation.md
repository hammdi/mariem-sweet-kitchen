# Documentation API

## Base URL

```
https://<domain>/api   (production)
http://localhost:3001/api   (développement)
```

## Authentification

Routes protégées par JWT :

```
Authorization: Bearer <jwt_token>
```

Deux rôles : `admin` (Mariem) et `client` (V1). Les routes admin nécessitent explicitement `role === 'admin'`.

## Codes d'erreur standards

| Code | Signification                         |
| ---- | ------------------------------------- |
| 400  | Données invalides                     |
| 401  | Token manquant, invalide ou expiré    |
| 403  | Accès refusé (rôle insuffisant)       |
| 404  | Ressource non trouvée                 |
| 429  | Trop de requêtes (rate-limit atteint) |
| 500  | Erreur serveur                        |

## Rate-limiting

- **Global** : 100 req / 15 min par IP sur `/api/*`.
- **Auth** : 5 tentatives / 15 min par IP sur `/api/auth/*` (anti brute-force, seules les tentatives échouées comptent).

## Pagination standard

Query params : `page` (défaut 1), `limit` (défaut 10 ou 20 selon endpoint). Réponse : `total`, `page`, `totalPages`.

---

## Auth

### POST /auth/register

Créer un **compte client** (rôle `client` forcé).

**Body**

```json
{
  "email": "client@example.com",
  "password": "motdepasse6+",
  "firstName": "Ahmed",
  "lastName": "Ben Ali",
  "phone": "+21612345678"
}
```

**Response 201**

```json
{
  "success": true,
  "data": {
    "user": { "_id": "...", "email": "...", "firstName": "Ahmed", "role": "client" },
    "token": "jwt_token"
  }
}
```

> ⚠️ Cette route ne peut **jamais** créer un admin. Les admins sont provisionnés via le seed.

### POST /auth/login

Connexion (admin ou client).

**Body**

```json
{ "email": "user@example.com", "password": "..." }
```

**Response 200** : même forme que register.

### GET /auth/me

Profil de l'utilisateur connecté. Requiert JWT.

### PUT /auth/profile

Met à jour `firstName`, `lastName`, `phone`. Requiert JWT.

### PUT /auth/password

Change le mot de passe. Requiert JWT.

```json
{ "currentPassword": "...", "newPassword": "..." }
```

---

## Recettes

### GET /recipes

Liste publique des recettes actives.

**Query** : `page`, `limit`, `search`, `category`.

**Response 200**

```json
{
  "success": true,
  "data": {
    "recipes": [
      {
        "_id": "...",
        "name": "Gâteau au chocolat",
        "description": "...",
        "images": ["/uploads/recipes/choc.jpg"],
        "category": "gateau",
        "variants": [
          {
            "sizeName": "Petit",
            "portions": 6,
            "ingredients": [
              {
                "ingredientId": { "name": "Farine", "pricePerUnit": 0.8, "unit": "kg" },
                "quantity": 0.2,
                "unit": "kg"
              }
            ],
            "appliances": [
              { "applianceId": { "name": "Four", "powerConsumption": 2000 }, "duration": 45 }
            ]
          }
        ]
      }
    ],
    "pagination": { "total": 10, "page": 1, "totalPages": 1 }
  }
}
```

### GET /recipes/:id

Détail d'une recette (public).

### POST /recipes (admin)

Créer une recette.

```json
{
  "name": "Gâteau au chocolat",
  "description": "...",
  "category": "gateau",
  "variants": [
    {
      "sizeName": "Petit",
      "portions": 6,
      "ingredients": [{ "ingredientId": "...", "quantity": 0.2, "unit": "kg" }],
      "appliances": [{ "applianceId": "...", "duration": 45 }]
    }
  ]
}
```

### POST /recipes/:id/duplicate (admin)

Duplique avec suffixe " (copie)". Retourne la nouvelle recette.

### PUT /recipes/:id (admin)

Mise à jour partielle (name, description, category, variants, images).

### DELETE /recipes/:id (admin)

Soft delete (`isActive: false`).

---

## Ingrédients

### GET /ingredients

Liste publique.

**Query** : `page`, `limit`, `search`, `category`, `sortBy`, `sortOrder`.

### GET /ingredients/:id

Détail public.

### POST /ingredients (admin)

```json
{ "name": "Farine", "pricePerUnit": 0.8, "unit": "kg", "category": "base" }
```

### PUT /ingredients/bulk-update-prices (admin)

Mise à jour des prix en masse (ex: après les courses).

```json
{
  "priceUpdates": [
    { "ingredientId": "...", "newPrice": 1.2 },
    { "ingredientId": "...", "newPrice": 0.9 }
  ]
}
```

> 🔧 Cette route **doit** être déclarée avant `/:id` pour ne pas être capturée comme paramètre. Fix appliqué le 2026-04-22.

### PUT /ingredients/:id (admin)

Mise à jour d'un ingrédient.

### DELETE /ingredients/:id (admin)

Soft delete.

---

## Machines (appliances)

### GET /appliances

Liste publique.

### POST /appliances (admin)

```json
{ "name": "Four électrique", "powerConsumption": 2000, "unit": "W", "category": "cooking" }
```

### PUT /appliances/:id (admin)

### DELETE /appliances/:id (admin)

---

## Commandes

### POST /orders

Créer une commande (public).

**Body**

```json
{
  "clientName": "Ahmed",
  "clientPhone": "+21612345678",
  "items": [{ "recipeId": "...", "variantIndex": 0, "quantity": 1 }],
  "notes": "Pour samedi svp"
}
```

Le prix est **toujours recalculé côté serveur** — aucun prix envoyé par le client n'est accepté.

Si le header `Authorization` est présent et valide (V1), `clientId` est automatiquement attaché à la commande.

**Response 201** : commande avec `calculatedPrice` par item et `totalPrice` global (arrondi au millime).

### GET /orders (admin)

Liste paginée, filtre par statut.

**Query** : `page`, `limit`, `status`.

### GET /orders/my (client connecté, V1)

Historique des commandes de l'utilisateur authentifié (tri par date décroissante).

### GET /orders/:id (admin)

Détail complet.

### PUT /orders/:id (admin)

Cocher les ingrédients fournis par le client → prix automatiquement recalculé.

**Body**

```json
{
  "items": [{ "index": 0, "clientProvidedIngredients": ["ingredient_id_1", "ingredient_id_2"] }],
  "notes": "Client ramène les œufs et la farine"
}
```

### PUT /orders/:id/status (admin)

Changer le statut.

```json
{ "status": "confirmed" }
```

Transitions possibles : `pending` → `confirmed` → `preparing` → `ready` → `paid` / `cancelled`.

---

## Paramètres

### GET /settings (admin)

Retourne tous les paramètres.

### PUT /settings (admin)

Mise à jour. **Seules les clés whitelistées** sont acceptées :

- `stegTariff` (DT/kWh)
- `waterForfaitSmall` (DT)
- `waterForfaitLarge` (DT)
- `marginPercent` (%)

Toute autre clé → 400. Toute valeur non numérique ou négative → 400.

```json
{ "stegTariff": 0.235, "waterForfaitSmall": 0.3, "waterForfaitLarge": 0.5, "marginPercent": 15 }
```

---

## Calcul de prix

### POST /prices/calculate (public)

Calcule le prix d'un variant, avec option d'ingrédients cochés.

**Body**

```json
{
  "recipeId": "...",
  "variantIndex": 0,
  "clientProvidedIngredients": []
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "ingredientsCost": 4.5,
    "electricityCost": 0.489,
    "waterCost": 0.3,
    "margin": 0.793,
    "total": 6.082,
    "ingredientsDetail": [
      {
        "name": "Farine",
        "quantity": 0.2,
        "unit": "kg",
        "unitPrice": 0.8,
        "cost": 0.16,
        "providedByClient": false
      }
    ],
    "appliancesDetail": [{ "name": "Four", "duration": 45, "powerW": 2000, "cost": 0.352 }]
  }
}
```

> ℹ️ Le détail ingrédient par ingrédient est volontairement exposé sur l'endpoint public — c'est l'essence du concept de transparence du projet. Les **étapes de préparation** restent secrètes (jamais stockées).

---

## Upload

### POST /upload (admin)

Upload d'images pour les recettes. Multipart form-data, champ `image`.

Retourne l'URL relative : `/uploads/recipes/<filename>`.

Contraintes : types autorisés `image/jpeg`, `image/png`, `image/webp`. Taille max 5 MB.

---

## Health

### GET /health

```json
{ "success": true, "message": "API ... operationnelle", "timestamp": "...", "version": "1.0.0" }
```

Pour les sondes de load balancer / monitoring.

---

## Conventions de réponse

Toutes les réponses suivent le format :

```json
{
  "success": true|false,
  "message": "texte optionnel",
  "data": { ... }
}
```

En cas d'erreur :

```json
{ "success": false, "message": "Description de l'erreur" }
```

En mode développement, la réponse d'erreur inclut la stack trace.
