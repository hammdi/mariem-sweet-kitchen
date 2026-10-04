# Production et stock de produits finis — architecture cible

Statut : **documenté, pas implémenté** (phase suivante). L'interface affiche « Production — À venir » sans lien actif.

## Pourquoi ne pas l'implémenter maintenant

Aujourd'hui, tout part d'une **commande** :

- la commande prévoit la consommation (besoins d'achat) ;
- « En préparation » consomme réellement les ingrédients (`deductStockForOrder`, verrou `Order.stockDeducted`) ;
- « Prête » → « Remise » termine la vente ; le paiement est suivi à part.

Une production interne (« je fais 10 muffins pour la vitrine ») change trois choses à la fois : la consommation n'est plus liée à une commande, un nouveau stock apparaît (produits finis), et une vente peut puiser dans ce stock sans consommer d'ingrédients. Le faire à moitié créerait exactement le risque à éviter : **consommer deux fois les mêmes ingrédients**. Le workflow actuel n'est donc pas touché.

## Modèle cible

### `Production` (lot produit)

| Champ | Rôle |
|---|---|
| `recipeId`, `variantIndex` | ce qui est produit |
| `quantity` | nombre d'unités produites (ex : 10 muffins) |
| `producedAt`, `createdBy` | quand / qui |
| `status` | `planned` → `in_progress` → `done` / `cancelled` |
| `stockDeducted`, `stockDeductedAt` | même verrou atomique que les commandes |
| `consumption` | instantané des quantités consommées (traçabilité) |
| `orderId?` | si la production sert une commande précise |
| `loss` | unités ratées / jetées (raison obligatoire) |

### `FinishedProduct` (stock de produits finis)

Un document par (recette, taille) : `quantityOnHand`, `unitCost` (coût de revient du dernier lot), `expiresAt?` (fraîcheur).

### `FinishedStockMovement` (journal, jamais modifié)

`type` : `production` (+), `sale` (−), `loss` (−), `adjustment` (±, raison obligatoire), `return` (+) ; `quantity`, `productionId?`, `orderId?`, `before`, `after`, `reason`, `createdBy`.

Le stock de produits finis est **un stock séparé** : il ne réutilise jamais `Ingredient.stockQuantity` ni `StockHistory`.

## Flux

```
Production interne : Muffin ×10
  1. démarrage → consommation des ingrédients (computeConsumption, une seule fois)
       Farine −, Sucre −, Œufs −          (StockHistory "deduction", productionId)
  2. fin       → Muffins +10              (FinishedStockMovement "production")

Vente de 4 muffins (commande servie depuis la vitrine)
  3. la ligne de commande est marquée "fromFinishedStock"
       Muffins 10 → 6                     (FinishedStockMovement "sale", orderId)
  4. AUCUNE déduction d'ingrédients pour cette ligne
```

## Règles à garantir

1. **Une seule consommation** : une ligne de commande servie depuis le stock fini a `fromFinishedStock = true` ; `computeConsumption` l'ignore (pas de besoin d'achat, pas de déduction). Tests : vente depuis la vitrine → aucune ligne `StockHistory` "deduction".
2. **Même calcul** : la production utilise `computeConsumption` comme les commandes (unités converties, ingrédients fournis exclus).
3. **Verrou** : `Production.stockDeducted` (mise à jour conditionnelle), comme `Order.stockDeducted`.
4. **Pas de retour automatique** : annuler une production commencée demande une raison ; les ingrédients ne reviennent pas seuls.
5. **Idempotence** : création / démarrage / vente via le middleware `idempotent()` existant.
6. **Statistiques** : la valeur du stock fini = `quantityOnHand × unitCost` ; une vente depuis la vitrine compte dans le CA comme toute vente ; les pertes de produits finis sont un indicateur séparé.

## Points d'intégration dans le code existant

- `stockForecastService.computeConsumption` : ignorer les lignes `fromFinishedStock`.
- `stockMovementService` : extraire la déduction commune (commande ou production) avec le même verrou.
- `purchaseNeedService.loadActiveOrders` : inclure les productions planifiées dans l'attribution du stock.
- Interface : page « Production » (lots planifiés / en cours / terminés), colonne « En vitrine » sur la page Stock, choix « depuis la vitrine » dans la saisie de commande.

## Décisions à valider avec Rahma avant de construire

- Les produits finis ont-ils une date limite (gâteaux du jour) ? Que faire des invendus (perte, prix réduit) ?
- Une commande peut-elle mélanger lignes « vitrine » et lignes « à préparer » ?
- Le coût de revient d'un lot inclut-il électricité et eau comme le prix des commandes ?
