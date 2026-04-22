# Stratégie de tests

Approche testing du projet. Objectif : confiance dans les refactors, pas couverture-pour-le-chiffre.

## Pyramide des tests

```
          ╱╲
         ╱E2╲          Playwright — parcours complets (3-5 scénarios critiques)
        ╱────╲
       ╱Integ ╲        Supertest — routes Express avec DB mémoire
      ╱────────╲
     ╱  Unit    ╲      Jest — logique pure (calcul prix, utils)
    ╱────────────╲
```

Proportion cible : ~70 % unit, 20 % integration, 10 % E2E.

## Priorités

### Priorité 1 — `priceCalculationService`

C'est le **cœur métier**. Toute modification sans tests casse la confiance dans les prix affichés aux clients.

Tests à écrire (~30 lignes) :

```ts
describe('PriceCalculationService', () => {
  it('calcule correctement un petit gâteau sans ingrédient fourni');
  it('applique la marge de 15% sur le sous-total');
  it("remet à 0 le coût d'un ingrédient fourni par le client");
  it("calcule correctement l'électricité : power(W)/1000 * duration(min)/60 * tariff");
  it('applique le forfait eau petit pour portions ≤ 8, grand sinon');
  it('lève une erreur si le variantIndex est hors plage');
  it("lève une erreur si la recette n'existe pas");
  it('lit les settings depuis la DB (pas de hardcode)');
});
```

### Priorité 2 — Flux de commande (intégration)

```ts
describe('POST /api/orders', () => {
  it('crée une commande guest sans auth');
  it('refuse une commande sans nom ou téléphone');
  it('refuse une commande avec items vides');
  it('recalcule le prix côté serveur même si le client envoie un total');
  it('attache clientId si token valide présent');
});

describe('PUT /api/orders/:id (admin)', () => {
  it("refuse l'accès sans JWT admin");
  it('coche des ingrédients → recalcul automatique du prix');
  it('retire des ingrédients cochés → prix remonte');
});
```

### Priorité 3 — Sécurité et permissions

```ts
describe('Auth & permissions', () => {
  it('register ne peut jamais créer un admin');
  it('rate-limit auth bloque après 5 échecs');
  it('routes admin renvoient 403 pour un client');
  it('PUT /settings rejette les clés non whitelistées');
});
```

### Priorité 4 — E2E (Playwright)

Scénarios critiques du parcours utilisateur :

1. **Visiteur commande** : accueil → détail recette → formulaire → confirmation.
2. **Client connecté** : login → mes commandes → re-commander.
3. **Admin cycle complet** : login → voir commande → cocher ingrédients → changer statut → marquer payé.

Pas de test E2E des CRUD admin (cher à maintenir, peu de valeur — couvert par les tests d'intégration).

## Outillage

| Couche              | Outil                             | Pourquoi                           |
| ------------------- | --------------------------------- | ---------------------------------- |
| Unit backend        | Jest + ts-jest                    | Déjà configuré, standard TS/Node   |
| Intégration backend | Supertest + mongodb-memory-server | Pas besoin de DB réelle en CI      |
| Unit frontend       | Vitest                            | Plus rapide que Jest sur Vite      |
| Composants          | React Testing Library             | Tests orientés usage utilisateur   |
| E2E                 | Playwright                        | Multi-navigateurs, debug excellent |
| Charge              | k6 (V3)                           | Avant scaling                      |
| Mutation            | Stryker (si temps)                | Détecter les tests "faux positifs" |

## Règles de qualité

### Ce qu'on teste

- ✅ Logique métier (calcul prix, validation règles).
- ✅ Contrats d'API (entrées/sorties des endpoints).
- ✅ Permissions et sécurité.
- ✅ Parcours utilisateur critiques.

### Ce qu'on **ne** teste **pas** (ou peu)

- ❌ Le code des libs externes (axios, mongoose, bcrypt).
- ❌ Les mappings triviaux (`res.json({ data })`).
- ❌ Le rendu pixel-perfect (c'est le job du design, pas des tests).
- ❌ Les classes CSS / Tailwind.

### Test smell à éviter

- **Tests fragiles** (cassent au moindre refactor de structure) → tester le comportement, pas l'implémentation.
- **Mocks excessifs** → si on mock tout, on teste le mock pas le code.
- **Tests lents** (> 100 ms par unit test) → quelque chose accède à l'I/O, à isoler.
- **Tests sans assertion** (erreur classique : `await expect(...)` oublié).

## Données de test

- **Unit** : factories simples en TS (`createTestRecipe()`, `createTestIngredient()`).
- **Intégration** : `mongodb-memory-server` → DB fraîche par suite de tests, pas de pollution.
- **E2E** : seed dédié (`seed-e2e.ts`) avec compte admin stable et 3 recettes prévisibles.

## Intégration continue (prévue)

```yaml
# .github/workflows/ci.yml (à créer)
on: [push, pull_request]
jobs:
  test:
    steps:
      - lint (eslint)
      - typecheck (tsc --noEmit)
      - unit + integration (jest)
      - e2e (playwright, headless)
      - audit (npm audit --audit-level=high)
```

Objectif : PR bloquée si un test échoue. Pas de merge sans verte.

## Couverture cible par phase

| Phase | Couverture globale | Couverture `priceCalculationService` |
| ----- | ------------------ | ------------------------------------ |
| V1    | 50 %               | 95 %                                 |
| V2    | 70 %               | 100 %                                |
| V3    | 80 %               | 100 %                                |

## Commandes

```bash
# Backend
npm run test:backend                       # Tous les tests
cd backend && npx jest prices.test.ts     # Un fichier
cd backend && npx jest --coverage          # Avec rapport de couverture
cd backend && npx jest --watch             # Mode watch (dev)

# Frontend (à configurer)
npm run test:frontend
npm run test:frontend -- --coverage

# E2E (à configurer)
npx playwright test
npx playwright test --ui                  # Debug interactif
```

## Références

- [Kent C. Dodds — Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
- [Martin Fowler — Unit Test](https://martinfowler.com/bliki/UnitTest.html)
