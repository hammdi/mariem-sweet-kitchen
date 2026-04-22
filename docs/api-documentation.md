# Documentation API

## Base URL
```
http://localhost:3001/api
```

## Authentification
Routes admin protégées par JWT :
```
Authorization: Bearer <jwt_token>
```

---

## Auth

### POST /auth/login
Connexion admin.

**Body:**
```json
{
  "email": "admin@mariemkitchen.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { "_id": "...", "email": "...", "firstName": "Mariem", "role": "admin" },
    "token": "jwt_token"
  }
}
```

---

## Recettes

### GET /recipes
Liste des recettes actives (public).

**Query:** `page`, `limit`, `search`, `category`

**Response:**
```json
{
  "success": true,
  "data": {
    "recipes": [
      {
        "_id": "...",
        "name": "Gâteau au chocolat",
        "description": "...",
        "images": ["photo1.jpg"],
        "category": "gâteau",
        "variants": [
          {
            "sizeName": "Petit",
            "portions": 6,
            "ingredients": [
              { "ingredientId": { "name": "Farine", "pricePerUnit": 0.8, "unit": "kg" }, "quantity": 200, "unit": "g" }
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
Détail d'une recette avec prix calculé par variant (public).

### POST /recipes (Admin)
Créer une recette.

**Body:**
```json
{
  "name": "Gâteau au chocolat",
  "description": "Un délicieux gâteau moelleux",
  "category": "gâteau",
  "variants": [
    {
      "sizeName": "Petit",
      "portions": 6,
      "ingredients": [
        { "ingredientId": "ingredient_id", "quantity": 200, "unit": "g" }
      ],
      "appliances": [
        { "applianceId": "appliance_id", "duration": 45 }
      ]
    }
  ]
}
```

### POST /recipes/:id/duplicate (Admin)
Dupliquer une recette. Retourne la nouvelle recette avec nom suffixé " (copie)".

### PUT /recipes/:id (Admin)
Modifier une recette.

### DELETE /recipes/:id (Admin)
Désactiver une recette (soft delete).

---

## Ingrédients

### GET /ingredients
Liste de tous les ingrédients actifs (public — utilisé pour l'affichage des prix).

### POST /ingredients (Admin)
Créer un ingrédient.

**Body:**
```json
{
  "name": "Farine",
  "pricePerUnit": 0.8,
  "unit": "kg",
  "category": "base"
}
```

### PUT /ingredients/:id (Admin)
Modifier un ingrédient (notamment le prix).

### DELETE /ingredients/:id (Admin)
Désactiver un ingrédient (soft delete).

---

## Machines (Appliances)

### GET /appliances
Liste des machines actives.

### POST /appliances (Admin)
Créer une machine.

**Body:**
```json
{
  "name": "Four électrique",
  "powerConsumption": 2000,
  "category": "cooking"
}
```

### PUT /appliances/:id (Admin)
Modifier une machine.

### DELETE /appliances/:id (Admin)
Désactiver une machine (soft delete).

---

## Commandes

### POST /orders
Créer une commande (public — pas besoin d'auth).

**Body:**
```json
{
  "clientName": "Ahmed",
  "clientPhone": "+21612345678",
  "items": [
    {
      "recipeId": "recipe_id",
      "variantIndex": 0,
      "quantity": 1
    }
  ],
  "notes": "Pour samedi svp"
}
```

### GET /orders (Admin)
Liste des commandes avec filtres.

**Query:** `status`, `page`, `limit`

### GET /orders/:id (Admin)
Détail d'une commande.

### PUT /orders/:id (Admin)
Modifier une commande : cocher les ingrédients fournis par le client, changer le statut, ajouter des notes.

**Body (cocher ingrédients) :**
```json
{
  "items": [
    {
      "index": 0,
      "clientProvidedIngredients": ["ingredient_id_1", "ingredient_id_2"]
    }
  ]
}
```
Le prix est automatiquement recalculé côté serveur.

### PUT /orders/:id/status (Admin)
Changer le statut d'une commande.

**Body:**
```json
{
  "status": "confirmed"
}
```

Statuts possibles : `pending` → `confirmed` → `preparing` → `ready` → `paid` / `cancelled`

---

## Paramètres

### GET /settings (Admin)
Récupérer les paramètres configurables.

### PUT /settings (Admin)
Modifier les paramètres.

**Body:**
```json
{
  "stegTariff": 0.235,
  "waterForfaitSmall": 0.3,
  "waterForfaitLarge": 0.5,
  "marginPercent": 15
}
```

---

## Calcul de prix

### POST /prices/calculate
Calculer le prix d'une recette pour un variant donné, avec éventuellement des ingrédients cochés (public).

**Body:**
```json
{
  "recipeId": "recipe_id",
  "variantIndex": 0,
  "clientProvidedIngredients": []
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ingredientsCost": 4.50,
    "electricityCost": 0.49,
    "waterCost": 0.50,
    "margin": 0.82,
    "total": 6.31,
    "breakdown": {
      "ingredients": [
        { "name": "Farine", "quantity": 200, "unit": "g", "unitPrice": 0.8, "cost": 0.16, "providedByClient": false }
      ],
      "appliances": [
        { "name": "Four", "duration": 45, "cost": 0.35 }
      ]
    }
  }
}
```

---

## Codes d'erreur

| Code | Signification |
|------|---------------|
| 400 | Données invalides |
| 401 | Token manquant ou invalide |
| 403 | Accès refusé (pas admin) |
| 404 | Ressource non trouvée |
| 429 | Trop de requêtes (rate limit) |
| 500 | Erreur serveur |

## Rate Limiting
100 requêtes par 15 minutes par IP.

## Pagination
`page` (défaut: 1), `limit` (défaut: 10, max: 100). Réponse inclut `total` et `totalPages`.
