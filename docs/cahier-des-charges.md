# Cahier des charges - Mariem's Sweet Kitchen

## Résumé

Plateforme web pour une pâtissière artisanale en Tunisie. Le site sert deux objectifs :
1. **Pour Mariem** : outil de gestion (recettes, commandes, prix) — ne plus oublier d'ingrédients ni de commandes
2. **Pour les clients** : voir les recettes, les ingrédients utilisés et le détail des prix en toute transparence, puis commander

**Concept clé** : le client voit QUOI (ingrédients + machines + prix) mais jamais COMMENT (étapes de préparation). Les recettes restent secrètes.

## Utilisateurs

### Mariem (Admin)
- Pâtissière expérimentée, à l'aise en français
- Gère ses recettes, ingrédients, machines et commandes via une interface simple
- Reçoit les commandes par Telegram
- Contacte les clients par téléphone / WhatsApp

### Client (Visiteur)
- Pas de compte nécessaire — commande avec nom + numéro de téléphone
- Consulte les recettes et prix
- Commande en ligne, paye en cash à la récupération

### Hamdi (Technique)
- Gère le déploiement, la maintenance et les évolutions

## Fonctionnalités

### 1. Gestion des recettes

Mariem crée une recette étape par étape :
1. Nommer la recette, ajouter description + photos
2. Sélectionner les ingrédients un par un avec quantités
3. Sélectionner les machines utilisées avec durée d'utilisation
4. Le prix se calcule automatiquement

**Tailles flexibles** :
- Chaque recette peut avoir ses propres tailles (petit, moyen, grand, 2 étages, par lot de 6/12, etc.)
- Chaque taille a ses propres quantités d'ingrédients et durées de machines
- Ajout d'une taille = copie automatique de la taille précédente, Mariem ajuste seulement les quantités/temps

**Duplication** :
- Mariem peut dupliquer une recette existante et modifier (ex: gâteau chocolat → gâteau vanille)
- Pas de système d'options/variantes complexe

**Secret** :
- Aucune étape de préparation n'est stockée ni affichée — par design
- Le client voit les ingrédients et machines, jamais le processus

### 2. Système de tarification transparent

**Formule** :
```
Prix = Ingrédients + Électricité + Eau + Marge effort (15%)
```

**Ingrédients** :
- Prix unitaire mis à jour manuellement par Mariem (quand elle fait ses courses)
- Prix en DT (Dinar Tunisien)
- Catégories : base, sucrant, produit laitier, arôme, levant, autre

**Électricité** :
- Calculée par machine : Puissance (W) × Temps d'utilisation (h) × Tarif STEG (DT/kWh)
- Tarif STEG configurable dans l'admin (valeur moyenne, ~0.235 DT/kWh)
- Mariem ajoute ses machines une fois (four, batteur, robot, etc.) avec leur puissance

**Eau** :
- Forfait configurable dans l'admin (ex: 0.3 DT petit, 0.5 DT grand)
- L'eau de lavage ne varie pas significativement entre recettes

**Marge effort** :
- 15% du sous-total (ingrédients + électricité + eau)
- Pourcentage configurable dans l'admin

### 3. Système de commande

**Flux** :
1. Client visite le site, choisit une recette et une taille
2. Client commande (nom + téléphone)
3. Mariem reçoit notification Telegram
4. Mariem contacte le client pour discuter les détails
5. Mariem coche les ingrédients que le client ramène → le prix se recalcule
6. Mariem confirme la commande avec le prix final
7. Client ramène ses ingrédients (si applicable)
8. Mariem prépare
9. Mariem marque "Prêt"
10. Client récupère et paye en cash
11. Mariem marque "Payé"

**Ingrédients mixtes** :
- Pas de 2 modes figés (tout ou rien)
- Mariem coche individuellement chaque ingrédient que le client fournit
- Les ingrédients cochés sont retirés du calcul de prix
- Cas typique : le client ramène œufs, farine, chocolat (facile à acheter) mais Mariem fournit le sirop, le glucose, etc. (petites quantités coûteuses à l'unité)

**Statuts** : commandé → confirmé → en préparation → prêt → payé

**Paiement** : cash uniquement, à la récupération

### 4. Notifications

- **Bot Telegram** pour Mariem : nouvelle commande, rappels
- **Lien wa.me/** sur le site pour que le client contacte Mariem directement

### 5. Interface admin (Mariem)

Interface simple en français, pensée pour être utilisée sans aide technique :
- Ajouter/modifier/dupliquer des recettes
- Gérer les ingrédients et leurs prix
- Gérer les machines
- Voir et gérer les commandes (accepter, refuser, cocher ingrédients, changer statut)
- Configurer les paramètres (tarif STEG, forfait eau, marge)

## Contraintes

- **Budget** : limité (VPS)
- **Équipe** : 1 développeur (Hamdi)
- **Langue** : français d'abord, arabe prévu plus tard
- **Paiement** : cash uniquement (pas de paiement en ligne)
- **Simplicité** : toute fonctionnalité doit passer le test "est-ce que Mariem peut l'utiliser seule ?"

## Hors périmètre (pour l'instant)

- Comptes clients
- Paiement en ligne
- Système d'options/variantes sur les recettes
- Traduction arabe
- Autres chefs / multi-vendeur
- Suivi de commande côté client
- Application mobile native
