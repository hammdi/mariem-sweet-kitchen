# Roadmap du projet

Vision phasée pour Mariem's Sweet Kitchen. Chaque phase est livrable indépendamment et apporte une valeur métier claire.

## V1 — MVP production (en cours)

**Objectif** : premier client réel servi end-to-end via la plateforme.

### Backend
- [x] CRUD recettes avec variants flexibles.
- [x] CRUD ingrédients, machines, paramètres.
- [x] Service de calcul de prix transparent (ingrédients + électricité + eau + marge).
- [x] Commande publique (nom + tél, sans compte).
- [x] Admin JWT, rôles `admin` / `client`.
- [x] Rate-limit anti brute-force, arrêt gracieux, fail-fast sur secrets.
- [x] Upload d'images.
- [ ] Bot Telegram (notifications).
- [ ] Suivi de commande guest (par téléphone + ID).
- [ ] Route `/orders/my` pour client connecté.

### Frontend
- [x] Pages publiques (accueil, catalogue, détail recette).
- [x] Interface admin (dashboard, recettes, ingrédients, machines, commandes, paramètres).
- [ ] Formulaire recette multi-étapes (wizard 4 pages).
- [ ] Page `/mes-commandes` pour client connecté.
- [ ] Page `/order/:id` pour suivi guest.
- [ ] Adaptation mobile (80 % du trafic attendu).

### Qualité
- [ ] Tests unitaires `priceCalculationService`.
- [ ] Tests d'intégration sur les flux de commande.
- [ ] CI GitHub Actions (lint + build + tests).
- [ ] Lighthouse score > 90 sur les pages publiques.

### Déploiement
- [ ] VPS configuré (Nginx + SSL + Docker).
- [ ] Backups MongoDB quotidiens automatisés.
- [ ] Monitoring basique (logs Winston → fichier + retention).

**Critère de sortie V1** : Mariem prend une commande, la prépare, la marque payée, sans intervention de Hamdi.

---

## V2 — Fidélisation et analytics

**Objectif** : transformer les acheteurs ponctuels en clients récurrents.

### Features client
- [ ] Favoris sur les recettes (ajout/retrait).
- [ ] Page "recommander" (re-commande en 1 clic à partir de l'historique).
- [ ] Programme fidélité simple (5ᵉ commande = -10 % automatique).
- [ ] Notifications email au changement de statut (Nodemailer + SendGrid ou Resend).
- [ ] Profil : allergies, préférences (sans sucre, sans gluten) — Mariem les voit quand elle prépare.

### Features admin
- [ ] Dashboard analytics :
  - Revenu quotidien / hebdomadaire / mensuel.
  - Top 5 recettes les plus commandées.
  - Top clients (fréquence, panier moyen).
  - Taux de conversion (visites → commandes).
- [ ] Export PDF de facturation pour la comptabilité.
- [ ] Vue calendrier des commandes à venir.
- [ ] Mise à jour prix en masse depuis Excel/CSV.

### Qualité
- [ ] Tests E2E avec Playwright (parcours commande complet).
- [ ] Sentry pour monitoring d'erreurs.
- [ ] Couverture tests ≥ 70 %.

---

## V3 — Scale et ouverture

**Objectif** : préparer la croissance.

### Paiement
- [ ] Intégration **Konnect** ou **Paymee** (passerelles tunisiennes).
- [ ] Paiement en ligne optionnel — le cash reste disponible.
- [ ] Gestion acompte (ex: 30 % en ligne, solde en cash).

### Logistique
- [ ] Intégration **Glovo** ou équivalent (API partenaire) pour la livraison.
- [ ] Calcul frais de livraison selon zone.
- [ ] Option click-and-collect vs livraison.

### Stock et approvisionnement
- [ ] Suivi du stock des ingrédients (décrément à la confirmation de commande).
- [ ] Alertes rupture (Telegram à Mariem).
- [ ] Suggestions d'achat hebdomadaires basées sur les commandes de la semaine.

### Internationalisation
- [ ] Traduction arabe complète (i18n avec `react-i18next`).
- [ ] Arabisation de la DB (noms recettes, ingrédients en AR et FR).

### Progressive Web App
- [ ] Service worker + manifest.
- [ ] Installation sur écran d'accueil mobile.
- [ ] Mode hors ligne pour le catalogue.

### Qualité
- [ ] Documentation OpenAPI/Swagger auto-générée.
- [ ] Tests de charge (Artillery ou k6) avant scaling.
- [ ] Observabilité complète : OpenTelemetry, Grafana, Prometheus.

---

## V4 — Plateforme marketplace (vision)

**Objectif** : pivoter de "site Mariem" à "plateforme pour artisans pâtissiers tunisiens".

- [ ] Onboarding multi-vendeur : chaque artisan a son sous-espace.
- [ ] Modèle économique : commission par commande ou abonnement mensuel.
- [ ] Système de notation et avis clients.
- [ ] Recherche géolocalisée : "pâtissiers près de moi".
- [ ] Application mobile native (React Native) pour clients et artisans.
- [ ] API publique pour intégrations tierces.

### Features IA (différenciation)
- [ ] **Suggestions de recettes** personnalisées par client (filtrage collaboratif).
- [ ] **Génération de descriptions** de recettes (OpenAI ou Claude) depuis les ingrédients.
- [ ] **Reconnaissance d'image** : client upload photo d'un gâteau → suggestions de recettes similaires chez les artisans.
- [ ] **Chatbot** de commande en langage naturel (FR/AR/darija).
- [ ] **Prédiction de demande** pour aider les artisans à anticiper la production.

---

## Hors scope permanent

- Suivi GPS de livraison en temps réel (hors scope V4 inclus, cher et peu utile).
- Cryptomonnaies / NFTs (non pertinent pour la cible).
- Réseau social intégré.

---

## Indicateurs de succès par phase

| Phase | KPI principal | Objectif |
|-------|---------------|----------|
| V1 | Commandes servies/mois via le site | ≥ 20 |
| V2 | Taux de clients récurrents | ≥ 30 % |
| V3 | Revenu mensuel Mariem | x2 vs pré-site |
| V4 | Nombre d'artisans inscrits | ≥ 10 |

---

## Méthodologie

- Développement itératif, chaque feature en branche avec PR.
- Review par Mariem avant merge des features user-facing (elle est la "product owner").
- Pas de déploiement le samedi (jour de gros volume — risque minimum).
- Communication des changements via Telegram au groupe Hamdi ↔ Mariem.
