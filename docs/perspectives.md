# Perspectives et vision long-terme

Document d'idées pour faire évoluer le projet et en valoriser la portée. Certaines deviendront des features, d'autres resteront des pistes inspirantes.

## Axe 1 — Du site au produit SaaS

**Thèse** : Mariem n'est pas seule. La Tunisie compte des centaines d'artisans pâtissiers qui ont les mêmes problèmes (oubli d'ingrédients, pricing opaque, commandes sur WhatsApp chaotiques). Le code écrit pour Mariem peut, sans refonte majeure, servir d'autres artisans.

### Modèle économique possible
| Modèle | Revenus | Difficulté |
|--------|---------|------------|
| Abonnement mensuel | 30-100 DT/mois par artisan | Faible (pas de paiement à intégrer) |
| Commission par commande | 2-5 % | Moyenne (comptabilité complexe) |
| Freemium | Gratuit jusqu'à X commandes, puis payant | Élevée (balance conversion/revenu) |

### Ce qui changerait techniquement
- Introduction de la notion de `tenant` (artisan) dans tous les modèles.
- Sous-domaines personnalisés (`mariem.gateaux.tn`).
- Branding personnalisable (couleurs, logo).
- Onboarding self-service (création de compte pro, paramétrage initial, import Excel des ingrédients).

### Bénéfice pour la carrière
Faire la démo d'un SaaS de A à Z (product thinking + tech + go-to-market) est **nettement plus valorisant** qu'un site sur mesure. Argument recruteur : *"j'ai conçu, développé et lancé un SaaS B2B avec N utilisateurs payants."*

---

## Axe 1.5 — Mobile (reporté à V4 minimum)

**Décision prise le 2026-04-22** : on reste 100 % web jusqu'à V3 au moins.

### Pourquoi on ne fait pas d'app mobile maintenant
- Hamdi n'a pas d'expérience mobile et n'a pas d'abonnement App Store (99 $/an Apple) ni Google Play (25 $ unique).
- Le scope web V1 n'est pas encore livré — ajouter mobile = retard produit.
- Une app native double la charge de maintenance pour un gain marginal sur ce marché.
- Les notifications transactionnelles passent très bien par Telegram (admin) et WhatsApp/SMS (client).

### Quand revisiter la question
- **V3** : si le volume justifie la présence App Store pour crédibilité → **Capacitor** (wrap le site web, 100 % réutilisable, ~3-5 jours de dev, frais store seulement).
- **V4** : si pivot marketplace multi-artisans → **React Native + Expo** (vraie app native, OTA updates via Expo Push API gratuit, ~3-4 semaines pour un MVP).

### Piste intermédiaire — PWA
La Progressive Web App reste une option intéressante même en V2 : installable sur écran d'accueil Android + iOS, push notifications natives, zéro store fee, réutilise 100 % du code React existant. Effort estimé : **1-2 jours** (manifest + service worker + notifications web push). À considérer quand le trafic justifie.

## Axe 2 — Intelligence artificielle pragmatique

Pas de hype. Utiliser l'IA uniquement si elle résout un vrai problème utilisateur. **Tier gratuit privilégié** (Gemini, Groq, Cloudflare Workers AI, Hugging Face).

Le catalogue exhaustif de **17 features IA** avec priorités, coûts estimés et choix de providers est dans [ai-features.md](./ai-features.md).

### Highlights — features les plus valorisantes
- **Assistant création de recette** pour Mariem (détection oublis, suggestions quantités) — V2, gratuit via Gemini.
- **Voice-to-recipe** : Mariem dicte, l'IA structure — V3, waouh garanti en démo.
- **OCR factures fournisseurs** : photo → mise à jour auto des prix ingrédients — V3.
- **Chatbot multilingue FR/AR/darija** avec function calling sur le catalogue — V3.
- **Reconnaissance photo → recette** : client upload photo Insta, match avec le catalogue — V4.

### Bénéfice pour la carrière
Savoir **intégrer** un LLM à une app réelle (prompt engineering, coûts, latence, fallback, multi-provider) est une compétence rare et payée. Bonus : tu ne fais pas "un chatbot de plus", tu résous des problèmes concrets d'une TPE. Argument portfolio solide : *"5 features IA en production, budget plafonné à 20 DT/mois, architecture multi-provider."*

---

## Axe 3 — Excellence technique visible

Ces améliorations ne changent pas le produit mais changent **comment tu peux le présenter**.

### DevOps / Infrastructure as Code
- **Terraform** pour provisionner l'infra AWS (EC2 + Route53 + backups S3).
- **Ansible** pour la configuration du VPS.
- **GitHub Actions** avec déploiement automatique sur tag Git.
- **Blue/green deployment** avec Nginx.

Argument portfolio : *"je sais déployer une app de prod sans ssh manuel"*.

### Observabilité
- **OpenTelemetry** (traces + métriques).
- **Grafana** dashboards publics pour les métriques business (nombre de commandes, revenu, etc.).
- **Sentry** pour les erreurs applicatives.
- **Uptime monitoring** (UptimeRobot, gratuit).

Argument portfolio : *"je monitore ce que je déploie"*.

### Qualité
- **Couverture de tests** ≥ 80 % affichée dans le README (badge).
- **Lighthouse score** 95+ affiché.
- **Tests de charge** documentés (tient X req/s à N utilisateurs concurrents).
- **Audit de sécurité** documenté ([security.md](./security.md)) — montre la maturité.

---

## Axe 4 — Ouverture communauté

### Open-source partiel
Le cœur métier (modèle de données, calcul de prix) peut rester fermé. Mais certains modules peuvent devenir des librairies open-source :
- **`steg-price-calculator`** : calcul du coût électrique selon le tarif STEG tunisien (utile à d'autres apps tunisiennes).
- **`tunisian-phone-validator`** : validation des numéros tunisiens avec messages d'erreur en FR/AR.

### Article technique
Un blog post sur l'architecture du projet + l'audit de sécurité = backlink SEO + crédibilité technique. Dev.to, Medium, ou blog perso.

Thème possible : *"How I built a multi-tenant bakery SaaS for the Tunisian market with React, Express and MongoDB"*.

### Présentation / talk
PFE, meetup Node.js Tunis, ou conférence GDG. Le projet coche toutes les cases intéressantes : produit réel, archi moderne, enjeux sécurité, use case IA.

---

## Axe 5 — Internationalisation

### Marchés cibles potentiels
| Marché | Pourquoi | Effort |
|--------|----------|--------|
| Tunisie | Marché naturel | Zéro (déjà en FR) |
| Maghreb (Maroc, Algérie) | Culture pâtissière similaire, langue FR + AR | Faible (adapter devise, tarifs électriques) |
| France / Belgique (diaspora) | Artisans maghrébins à l'étranger | Moyen (RGPD stricte, plusieurs devises) |
| Moyen-Orient (Dubaï, Arabie) | Demande pâtisserie haut de gamme | Élevé (RTL, arabe natif) |

### Implications techniques
- `react-i18next` pour l'UI.
- Devise multi (`DT`, `MAD`, `EUR`, `USD`).
- Tarifs énergie par pays (équivalent STEG pour chaque pays).
- Time zones par tenant.

---

## Axe 6 — Angle "impact social"

Faire passer un message dans le pitch du projet :
> "Je valorise l'artisanat local, en permettant à des pâtissières autodidactes de professionnaliser leur activité sans savoir coder. Le modèle est scalable : toute TPE de l'alimentaire peut utiliser le même outil."

Arguments différenciateurs :
- **Économie informelle → formelle** : factures, suivi comptable automatique.
- **Femmes entrepreneures** : Mariem est représentative d'un segment sous-servi par la tech.
- **Achat local** : la plateforme valorise les petits producteurs vs les grandes chaînes.

Angle recruteur : travailler sur des sujets qui ont du sens = narration forte en entretien.

---

## Axe 7 — Carrière de Hamdi

Ce projet, s'il est bien présenté, ouvre plusieurs voies :

### Voie 1 — Développeur full-stack senior
- Argument : "j'ai conçu et livré seul une app de prod de bout en bout".
- Portfolio : lien vers le site, repo GitHub, docs techniques.
- Cible : startups, scale-ups (Tunisie, France remote, Europe).

### Voie 2 — Product Engineer / Tech Lead
- Argument : "je prends des décisions produit ET techniques, je discute avec les utilisateurs".
- Preuves : ce document de perspectives, la roadmap, le cahier des charges, l'audit sécurité.
- Cible : rôles plus seniors, entreprises produit (pas agences).

### Voie 3 — Fondateur SaaS
- Si tu pivotes vers le multi-tenant (axe 1), tu deviens fondateur de facto.
- Programmes Y Combinator, Station F, Techstars (Afrique du Nord).
- Levée de fonds ou bootstrap.

### Voie 4 — Consultant indépendant
- Spécialisation : "je digitalise les artisans alimentaires".
- Tarif : clients TPE (300-1500 €/projet) ou un SaaS produit.
- Avantage : indépendance, apprentissage large.

---

## Priorités recommandées

Si Hamdi doit choisir 3 choses à ajouter **maintenant** pour maximiser l'impact :

1. **Tests solides sur le calcul de prix** + CI GitHub Actions visible (badge). Montre la rigueur.
2. **1 feature IA concrète** (génération de description de recettes). Différenciateur fort, coût technique faible.
3. **Rédiger 1 article technique** sur le projet (l'audit de sécurité est un angle génial). SEO + crédibilité.

Si les 3 sont faits, le projet passe de *"projet étudiant"* à *"projet portfolio professionnel sérieux"* dans la perception d'un recruteur.

---

## Références inspirantes

- **Glovo / Jumia Food** : UX guest + compte, flow commande mobile-first.
- **Squarespace / Shopify** : multi-tenant avec branding personnalisé.
- **Toast** : SaaS restauration US, valorisé $7B. Même problème, plus gros segment.
- **Lemonade** : UX IA bien intégrée, sans être gadget.
