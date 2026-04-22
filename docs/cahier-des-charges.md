# Cahier des charges — Mariem's Sweet Kitchen

## Résumé

Plateforme web pour une pâtissière artisanale en Tunisie. Le site sert deux publics :

1. **Mariem (admin)** : outil de gestion (recettes, commandes, prix) — ne plus oublier d'ingrédients ni de commandes.
2. **Clients (visiteurs et comptes optionnels)** : voir les recettes, les ingrédients utilisés et le détail des prix en toute transparence, commander, suivre leurs commandes.

**Concept clé** : le client voit QUOI (ingrédients + machines + prix) mais jamais COMMENT (étapes de préparation). Les recettes restent secrètes.

## Utilisateurs

### Mariem (Admin)

- Pâtissière expérimentée, à l'aise en français.
- Gère ses recettes, ingrédients, machines et commandes via une interface simple.
- Reçoit les commandes par Telegram.
- Contacte les clients par téléphone / WhatsApp.

### Client invité

- Pas de compte requis — commande avec nom + numéro de téléphone.
- Consulte les recettes et prix.
- Commande en ligne, paie en cash à la récupération.
- Peut retrouver sa commande par son numéro de téléphone (sans login).

### Client avec compte (optionnel)

- Création proposée **au moment du checkout** (case à cocher), jamais obligatoire.
- Déverrouille : historique de commandes, suivi temps réel du statut, pré-remplissage nom + téléphone, re-commande en 1 clic.
- Inspiré du modèle Glovo (guest checkout + compte optionnel pour le confort).

### Hamdi (technique)

- Développement, déploiement, maintenance et évolutions.

## Fonctionnalités V1 — MVP

### 1. Gestion des recettes (admin)

Mariem crée une recette en 4 étapes :

1. Nom, description, photos.
2. Ingrédients (via bibliothèque partagée) avec quantités.
3. Machines utilisées avec durée.
4. Le prix se calcule automatiquement par variant (taille).

**Tailles flexibles** : chaque recette a ses propres tailles (petit, moyen, grand, 2 étages, lot de 12…). Chaque taille a ses propres ingrédients et durées. L'ajout d'une taille copie la précédente pour accélérer la saisie.

**Duplication** : Mariem duplique une recette pour en créer une variante (gâteau chocolat → gâteau vanille).

**Secret** : aucune étape de préparation n'est stockée — par design.

### 2. Tarification transparente

```
total = ingrédients + électricité + eau + marge effort (15 %)
```

- **Ingrédients** : prix unitaire en DT, mis à jour par Mariem quand elle fait ses courses. Catégories : base, sucrant, produit laitier, arôme, levant, autre.
- **Électricité** : `Puissance (W) × Temps (h) × Tarif STEG`. Tarif STEG configurable (~0,235 DT/kWh).
- **Eau** : forfait configurable (petit / grand).
- **Marge effort** : 15 % du sous-total, **configurable**.

### 3. Commande

**Flux** :

1. Client choisit recette + taille.
2. Commande avec nom + téléphone (+ création de compte facultative).
3. Mariem reçoit notification Telegram.
4. Mariem appelle le client → discussion des ingrédients.
5. Mariem coche les ingrédients que le client ramène → prix recalculé.
6. Mariem confirme, prépare, marque "prêt".
7. Client récupère, paie cash, Mariem marque "payé".

**Ingrédients mixtes** : Mariem coche individuellement les ingrédients apportés par le client. Pas de mode figé.

**Statuts** : `pending` → `confirmed` → `preparing` → `ready` → `paid` / `cancelled`.

**Paiement** : cash uniquement à la récupération.

### 4. Compte client (optionnel)

- Inscription en 1 clic depuis le checkout (nom, téléphone, email, mot de passe).
- Connexion sur `/auth/login`.
- Page `Mes commandes` : historique, statut temps réel, re-commander.
- Lien entre commande guest et compte _a posteriori_ par numéro de téléphone.
- Rôle `client` distinct du rôle `admin` — isolation des permissions.

### 5. Notifications

- **Bot Telegram** pour Mariem : nouvelle commande, changement de statut.
- **Lien wa.me/** sur le site pour contact direct Mariem ↔ client.

### 6. Interface admin (Mariem)

Interface en français, pensée pour utilisation sans aide technique :

- Dashboard commandes (filtres par statut).
- CRUD recettes avec duplication.
- CRUD ingrédients (et mise à jour prix en masse).
- CRUD machines.
- Configuration paramètres (tarif STEG, forfait eau, marge).
- Upload d'images pour les recettes.

## Contraintes

- **Budget** : limité — VPS unique (AWS EC2 t3.small ou équivalent).
- **Équipe** : 1 développeur (Hamdi) + 1 utilisatrice (Mariem).
- **Langue** : français d'abord, arabe en V3.
- **Paiement** : cash uniquement en V1 (pas de paiement en ligne).
- **Critère de simplicité** : toute fonctionnalité doit passer le test _"Mariem peut l'utiliser seule après 5 min de démo"_.

## Exigences non-fonctionnelles

| Domaine       | Exigence                                                                        |
| ------------- | ------------------------------------------------------------------------------- |
| Performance   | Page recette < 1,5 s sur 4G tunisienne                                          |
| Disponibilité | ≥ 99 % — le site ne doit pas tomber les samedis (gros volume)                   |
| Sécurité      | HTTPS obligatoire, JWT fort, rate-limit, logs d'accès                           |
| RGPD          | Données clients minimales (nom, tél, email facultatif), suppression sur demande |
| Accessibilité | Respect WCAG 2.1 niveau AA (contrastes, navigation clavier)                     |
| SEO           | Recettes indexables Google, meta tags, sitemap                                  |
| Responsive    | Mobile first (80 % du trafic attendu sur mobile)                                |

## Phases

### V1 — MVP (en cours)

Cahier ci-dessus. Objectif : premier client réel servi end-to-end via la plateforme.

### V2 — Fidélisation

Favoris, programme fidélité (5ᵉ commande offerte), notifications email/SMS au changement de statut, tableau de bord analytics pour Mariem (revenu mensuel, recettes les plus commandées).

### V3 — Scale

Paiement en ligne (Konnect / Paymee), version arabe, Progressive Web App (installable), intégration livraison (contact Glovo), gestion de stock, facturation PDF.

### V4 — Pivot marketplace (vision)

Ouvrir la plateforme à d'autres artisans, application mobile native, suggestions IA (personnalisation, reconnaissance photo gâteau → recette similaire).

Voir [roadmap.md](./roadmap.md) pour le détail des phases.

## Hors périmètre V1

- Paiement en ligne (→ V3).
- Application mobile native (→ V4).
- Traduction arabe (→ V3).
- Multi-vendeur (→ V4).
- Notifications SMS/push (→ V2, pour l'instant Telegram côté admin uniquement).
- Programme fidélité et favoris (→ V2).
