# Features IA — Idées et plan futur

Catalogue exhaustif des features IA envisagées pour le projet, avec alternatives **gratuites ou low-cost** privilégiées. Ce document est la source de vérité pour toute décision IA, à actualiser au fil du temps.

## Principes directeurs

1. **IA utile, pas gadget** — chaque feature doit résoudre un vrai problème utilisateur, pas "faire cool en démo".
2. **Gratuit d'abord** — on utilise les tiers gratuits tant que le volume le permet.
3. **Fallback obligatoire** — si l'IA est indisponible ou dépasse le budget, l'app fonctionne en mode dégradé sans erreur.
4. **Transparence** — quand c'est de l'IA, l'utilisateur le sait (badge "Suggéré par IA").
5. **Budget plafonné** — rate-limit + alerte à X $ dépensés dans le mois, coupure automatique.

## Providers IA gratuits ou low-cost (2026)

Comparaison des options utilisables sans carte bancaire ou avec carte mais **tiers gratuits généreux** :

| Provider                       | Tier gratuit                      | Modèles                             | Cas d'usage                            | Notes                                         |
| ------------------------------ | --------------------------------- | ----------------------------------- | -------------------------------------- | --------------------------------------------- |
| **Google Gemini API**          | 15 req/min, 1M tokens/mois        | Gemini 2.0 Flash, 1.5 Flash         | Texte général, function calling        | Gratuit avec compte Google, carte non requise |
| **Groq**                       | ~14 400 req/jour                  | Llama 3.3 70B, Mixtral, Gemma       | Réponses ultra-rapides (< 500 ms)      | Très généreux pour prototypage                |
| **OpenRouter**                 | ~50 req/jour sur modèles gratuits | Plusieurs modèles OSS               | Tester plusieurs modèles               | Unifie l'accès à 100+ modèles                 |
| **Hugging Face Inference API** | Tier gratuit limité               | Tous les modèles open-source        | Embeddings, classification, traduction | Parfait pour features non-critiques           |
| **Cloudflare Workers AI**      | 10 000 req/jour gratuit           | Llama, Mistral, Whisper, embeddings | Edge inference, latence ultra-basse    | Bien intégré si on est sur Cloudflare         |
| **Cohere**                     | 1 000 req/mois gratuit            | Command, embeddings                 | Embeddings et RAG                      | API stable                                    |
| **Ollama (local)**             | Illimité (CPU/GPU local)          | Llama, Mistral, Phi                 | Dev local, pas de coût cloud           | Nécessite machine, pas pour prod publique     |
| **Anthropic Claude API**       | Pas de tier gratuit               | Opus, Sonnet, Haiku                 | Qualité top + function calling         | Haiku ~0,001 $/appel, pas cher en volume      |
| **OpenAI**                     | Pas de tier gratuit               | GPT-4o, GPT-4o-mini                 | Production mature                      | GPT-4o-mini très bon rapport qualité/prix     |

**Recommandation de stack IA pour ce projet** :

- **Prototype / features non-critiques** : Google Gemini 2.0 Flash (gratuit, suffisant).
- **Production / features qualité** : Groq + Llama 3.3 (gratuit et rapide) ou Claude Haiku (payant mais ultra-fiable).
- **Embeddings (recherche sémantique)** : Hugging Face `all-MiniLM-L6-v2` ou Cohere embed-multilingual (supporte l'arabe).
- **Exécution locale en dev** : Ollama avec Llama 3.2 3B.

## Features IA par bénéficiaire

### Pour Mariem (admin) — Priorité haute

#### AI-1 — Assistant de création de recette ⭐ RECOMMANDÉ V2

**Problème résolu** : Mariem oublie des ingrédients, hésite sur les quantités par taille.

**Ce que ça fait** :

- Détection d'oublis ("tu n'as pas ajouté de levure pour ce gâteau, c'est voulu ?").
- Suggestion de quantités pour les tailles additionnelles ("Pour 'Grand', je propose ×1,8 sur la farine").
- Génération auto de description marketing.
- Catégorisation automatique.
- Détection de similarité avec recettes existantes ("85 % similaire à Gâteau chocolat, dupliquer ?").

**UX** : panneau latéral discret avec badge 💡 qui s'allume quand l'IA a une suggestion. **Pas d'avatar Clippy**.

**Implémentation** : Gemini 2.0 Flash (gratuit) ou Claude Haiku (~0,001 $/appel). Output JSON structuré (`warnings[]`, `suggestions[]`, `autoFill{}`).

**Coût** : ~0 DT/mois en utilisant Gemini free tier (Mariem crée 10 recettes/mois × 3 appels = 30 requêtes, largement dans le tier gratuit).

---

#### AI-2 — Voice-to-recipe ⭐ NOUVELLE IDÉE V3

**Problème résolu** : Mariem n'aime pas taper. Elle préfère parler en cuisinant.

**Ce que ça fait** :

- Mariem enregistre un vocal en darija/français/arabe : "gâteau au chocolat, petit format, 200 g de farine, 150 g de sucre, 4 œufs, four 45 min à 180°".
- L'IA transcrit (Whisper) + extrait les données structurées (LLM) → pré-remplit le formulaire de recette.
- Mariem vérifie et valide.

**Implémentation** :

- **Transcription** : Whisper large-v3 via Groq (gratuit, ultra-rapide) ou Cloudflare Workers AI (10 k req/jour gratuit).
- **Extraction structurée** : Gemini Flash avec function calling.

**Coût** : 0 DT/mois en dev. ~1 DT/mois en prod si Mariem enregistre 50 vocaux/mois.

**Impact** : feature **waouh** pour le portfolio. Et Mariem l'utilisera vraiment (elle parle plus qu'elle ne tape).

---

#### AI-3 — OCR factures fournisseurs ⭐ NOUVELLE IDÉE V3

**Problème résolu** : Mariem met à jour manuellement les prix des ingrédients quand les tarifs changent. Fastidieux, source d'erreurs.

**Ce que ça fait** :

- Mariem photographie la facture de ses courses chez le grossiste.
- L'IA extrait les lignes (ingrédient + quantité + prix unitaire).
- Matching avec les ingrédients existants.
- Proposition de mise à jour des prix : Mariem valide d'un clic.

**Implémentation** : Claude Sonnet (vision) ou Gemini 2.0 Flash (vision, gratuit). Extraction JSON structurée.

**Coût** : ~0 DT/mois (gratuit via Gemini si < 1500 factures/jour, on est très loin).

**Impact** : gain de temps énorme pour Mariem, feature portfolio solide.

---

#### AI-4 — Résumé quotidien Telegram ⭐ RECOMMANDÉ V2

**Problème résolu** : Mariem veut un briefing du matin, pas fouiller dans l'admin.

**Ce que ça fait** : chaque matin à 8h, le bot Telegram envoie :

> « Bonjour Mariem ☀️ Aujourd'hui : 4 commandes à préparer (2 gâteaux chocolat, 1 baklawa, 1 tarte). Total : 180 DT. Il te manque : 500 g de chocolat noir et 2 œufs. »

**Implémentation** : cron backend qui :

1. Récupère les commandes du jour + stock courant.
2. Envoie à Gemini Flash pour génération du résumé en français naturel.
3. Poste sur Telegram.

**Coût** : ~0 DT/mois (gratuit, 1 appel/jour).

---

#### AI-5 — Prédiction de demande hebdomadaire ⭐ NOUVELLE IDÉE V3

**Problème résolu** : anticiper les achats d'ingrédients selon les périodes.

**Ce que ça fait** : chaque dimanche soir, notification :

> « Prévisions semaine prochaine : pic baklawa attendu (Aïd dans 10 jours, +300 % vs semaine type). Commande 2 kg d'amandes et 500 g de pistache en avance. »

**Implémentation** : régression simple sur l'historique + calendrier enrichi (ramadan, Aïd, mariages locaux, météo). **Pas besoin de LLM**, c'est du stats classique (peut se faire en JS pur ou petit script Python).

**Coût** : 0 DT/mois (calcul local).

---

#### AI-6 — Optimiseur de planning du jour 🆕 NOUVELLE IDÉE V3

**Problème résolu** : quand Mariem a 5 commandes le samedi, quel ordre de préparation optimal ?

**Ce que ça fait** : l'app propose un planning :

> « 8h : commencer la baklawa (4h de trempage). 9h : monter les blancs pour le gâteau fraise pendant que la baklawa cuit. 11h : sortie baklawa, enfourner le gâteau chocolat. »

**Implémentation** : algorithme de scheduling (pas forcément IA — un solveur de contraintes suffit). Extension possible avec LLM pour expliquer en langage naturel.

**Coût** : 0 DT/mois.

---

#### AI-7 — Détection d'anomalies prix 🆕 NOUVELLE IDÉE V3

**Problème résolu** : Mariem saisit 120 DT au lieu de 12 DT pour un ingrédient → toutes les recettes deviennent incohérentes.

**Ce que ça fait** : à la saisie d'un prix, si la variation est > 50 % ou la valeur incohérente (vs moyenne du marché), afficher une alerte :

> « ⚠️ Prix de la farine passe de 0,8 DT à 12 DT/kg (+1400 %). Confirmer ? »

**Implémentation** : règle statistique simple (écart-type sur historique). **Pas d'IA**.

**Coût** : 0 DT/mois.

---

### Pour les clients — Priorité moyenne

#### AI-8 — Recommandations similaires (sans IA) ⭐ RECOMMANDÉ V1

**Problème résolu** : aider le client à découvrir d'autres recettes de Mariem.

**Ce que ça fait** :

- Sur chaque page recette : "Similaires : ..."
- Sur l'accueil : "Les plus commandées", "Pour un anniversaire", "Pour 6 à 8 personnes", "Moins de 40 DT".

**Implémentation** : algorithme de similarité par tags + catégories + ingrédients communs (Jaccard coefficient). **Zéro IA, zéro coût, zéro latence**.

Upgrade possible avec embeddings en V2 : sentence-transformers pour similarité sémantique ("léger" ≈ "aérien"). Cohere embed-multilingual (tier gratuit) supporte l'arabe.

**Coût** : 0 DT/mois.

---

#### AI-9 — Chatbot conversationnel multilingue 📅 V3

**Problème résolu** : le client arrive avec une intention vague, les filtres UI ne suffisent pas.

**Ce que ça fait** : chatbot qui comprend FR/AR/darija :

> Client : "Je veux un gâteau pour 10 personnes, pas trop cher, genre pour un goûter d'enfants."
> Bot : "Je te propose : 🎂 Gâteau chocolat grand format (12 parts, 45 DT) ou 🍰 Muffins vanille ×12 (38 DT). Le chocolat plaît plus aux enfants, lequel tu préfères ?"

**Implémentation** :

- **Claude Sonnet** ou **Gemini 2.0 Flash** avec function calling.
- Fonctions exposées : `searchRecipes(query, filters)`, `getRecipeDetails(id)`, `checkPrice(id, variant)`.
- Le LLM ne peut proposer QUE des recettes du catalogue (anti-hallucination).
- Support **darija** = vrai différenciateur en Tunisie.

**Garde-fous obligatoires** :

- Rate-limit : 20 messages/h par IP non authentifiée, 100/h pour compte connecté.
- Budget max mensuel : 50 DT avec coupure automatique.
- Fallback : si IA indisponible, retour au formulaire classique.

**Coût** : 0 DT (Gemini free tier) jusqu'à ~1 000 conversations/mois. Puis 20-50 DT/mois.

**Pourquoi pas en V1** : ajout de complexité (rate-limit agressif, monitoring coûts, gestion abuse). À activer quand le volume justifie.

---

#### AI-10 — Reconnaissance photo → recette 📅 V4

**Problème résolu** : le client a vu un gâteau sur Instagram, ne sait pas comment ça s'appelle.

**Ce que ça fait** : upload photo → l'IA compare visuellement avec le catalogue → propose les 3 recettes les plus similaires.

**Implémentation** : Claude Sonnet vision ou CLIP embeddings (Hugging Face). Calcul de similarité cosinus.

**Coût** : ~0,01-0,02 $ par recherche. À rate-limiter.

**Impact** : énorme effet waouh pour le portfolio. Feature "cherry-on-top" V4.

---

#### AI-11 — Traduction automatique FR ↔ AR 📅 V3

**Problème résolu** : internationalisation pour clients arabophones.

**Ce que ça fait** : tous les contenus (nom recette, description, ingrédients) sont auto-traduits et stockés dans les deux langues. Mariem peut éditer si la traduction IA est bancale.

**Implémentation** : Google Gemini ou NLLB-200 via Hugging Face (spécialisé traduction). Cohere Aya aussi (multilingue, arabe solide).

**Coût** : 0 DT/mois en tier gratuit (volume faible).

---

#### AI-12 — Génération d'images de gâteaux 📅 V3

**Problème résolu** : Mariem n'a pas toujours de belle photo pour chaque recette.

**Ce que ça fait** : bouton "générer une image" → Stable Diffusion ou DALL-E génère un rendu présentable. Mariem peut remplacer quand elle a la vraie photo.

**Implémentation** : Cloudflare Workers AI (Stable Diffusion XL gratuit jusqu'à 10 k req/jour) ou Hugging Face SDXL.

**Coût** : 0 DT/mois.

**Risque** : les images IA sentent parfois le "faux". À utiliser comme placeholder uniquement, jamais comme produit fini affiché sans mention.

---

### Opérations / Business — Priorité variable

#### AI-13 — Analyse de sentiment des notes de commande 📅 V2

**Problème résolu** : repérer les clients mécontents ou les demandes récurrentes.

**Ce que ça fait** : classe automatiquement les notes clients en positif/neutre/négatif + extrait les thèmes ("trop sucré", "portions petites", "merci beaucoup").

**Implémentation** : Gemini Flash en classification. Affichage dans le dashboard admin.

**Coût** : 0 DT/mois.

---

#### AI-14 — Détection de commandes frauduleuses 📅 V2

**Problème résolu** : des plaisantins commandent des gâteaux et ne viennent pas.

**Ce que ça fait** : score de "probabilité de no-show" basé sur patterns (téléphone déjà vu, noms incohérents, heures bizarres). Mariem priorise son appel sur les commandes "suspectes".

**Implémentation** : règles statistiques + LLM optionnel pour cas limite.

**Coût** : 0 DT/mois.

---

#### AI-15 — Chatbot WhatsApp pour Mariem 📅 V3 (idée ambitieuse)

**Problème résolu** : Mariem gère certaines commandes directement sur WhatsApp, l'info ne remonte pas dans le système.

**Ce que ça fait** : quand un client écrit sur WhatsApp Business, un bot IA :

1. Comprend la commande ("je veux 2 baklawas pour samedi").
2. Crée la commande dans l'admin.
3. Répond au client avec un récap et le prix.
4. Notifie Mariem qui valide.

**Implémentation** : WhatsApp Business API + LLM avec function calling.

**Coût** : ~10-30 DT/mois (WhatsApp API + LLM).

**Impact** : Mariem gagne un temps fou. **Différenciateur fort** car intégration profonde.

---

#### AI-16 — Génération automatique des posts réseaux sociaux 🆕 NOUVELLE IDÉE V3

**Problème résolu** : Mariem n'a pas le temps de faire du community management.

**Ce que ça fait** : à chaque nouvelle recette, génère automatiquement :

- Texte Facebook / Instagram.
- Suggestions de hashtags (#patisserietunisie #faitmaison).
- Image stylisée avec overlay texte (prix + nom).

Mariem clique "publier" ou édite. Intégration directe avec Meta Graph API (optionnelle).

**Implémentation** : Gemini + Cloudinary (pour l'image) ou Canva API.

**Coût** : 0 DT/mois.

---

#### AI-17 — Analyse concurrence 🆕 NOUVELLE IDÉE V4

**Problème résolu** : Mariem veut savoir ce que font les autres pâtissiers tunisiens pour s'inspirer / se différencier.

**Ce que ça fait** : crawler mensuel des pages Instagram/Facebook de 20 autres pâtissiers → résumé :

> « Ce mois-ci : 3 concurrents font maintenant des gâteaux personnalisés anniversaire. 2 proposent la livraison. Personne ne fait de baklawa modernisée → opportunité. »

**Implémentation** : scraping (respectueux des ToS) + LLM pour analyse. Attention légal.

**Coût** : ~5-10 DT/mois.

---

## Sémantique / recherche sans LLM

Pour la recherche "intelligente" sans coût LLM, plusieurs options **gratuites** :

| Technique                     | Outil                                     | Usage                                          |
| ----------------------------- | ----------------------------------------- | ---------------------------------------------- |
| **Embeddings locaux**         | `@xenova/transformers` (runs in browser!) | Recherche sémantique côté client, zéro backend |
| **Sentence-transformers**     | Hugging Face `all-MiniLM-L6-v2`           | Qualité standard, rapide                       |
| **Cohere embed-multilingual** | Tier gratuit 1000 req/mois                | Excellent pour l'arabe                         |
| **PostgreSQL pgvector**       | Self-hosted                               | Si on migre de MongoDB à PostgreSQL            |
| **Qdrant free tier**          | Cloud                                     | 1 Go gratuit, parfait pour MVP                 |
| **Weaviate free tier**        | Cloud                                     | 14 jours gratuits, puis à voir                 |
| **Meilisearch**               | Self-hosted ou tier gratuit               | Recherche full-text + typo-tolerante           |
| **Typesense**                 | Self-hosted ou cloud                      | Alternative à Meilisearch, très rapide         |

**Recommandation** : commencer avec `@xenova/transformers` côté client pour la recherche sémantique (zéro coût, zéro latence serveur), upgrader vers Qdrant free tier quand le catalogue grossit.

---

## Roadmap IA synthétique

### V1 (maintenant)

- **AI-8** — Recommandations similaires (algo simple, zéro IA).

### V2 (fidélisation)

- **AI-1** — Assistant création de recette (Gemini free tier).
- **AI-4** — Résumé quotidien Telegram (Gemini free tier).
- **AI-13** — Analyse sentiment des notes (Gemini free tier).
- **AI-14** — Détection fraude (règles + LLM).

### V3 (scale)

- **AI-2** — Voice-to-recipe (Whisper + Gemini).
- **AI-3** — OCR factures (Gemini vision).
- **AI-5** — Prédiction de demande (stats + LLM).
- **AI-6** — Optimiseur planning (solveur + LLM).
- **AI-7** — Détection anomalies prix.
- **AI-9** — Chatbot conversationnel multilingue (Gemini + function calling).
- **AI-11** — Traduction FR ↔ AR (NLLB ou Gemini).
- **AI-12** — Génération images placeholder (Cloudflare SDXL).
- **AI-16** — Génération posts réseaux sociaux.

### V4 (marketplace)

- **AI-10** — Reconnaissance photo → recette (Claude vision / CLIP).
- **AI-15** — Chatbot WhatsApp Business (WhatsApp API + LLM).
- **AI-17** — Analyse concurrence (crawler + LLM).

---

## Infrastructure à prévoir

Pour supporter toutes ces features proprement :

1. **Service unifié `AIGateway`** — abstrait les providers (Gemini, Groq, Claude, etc.). Permet de switcher selon la feature, le budget, la disponibilité.
2. **Rate-limiter IA** — rate-limit dédié par feature et par utilisateur (séparé du rate-limit HTTP global).
3. **Budget tracker** — compteur de coûts par feature, alerte Telegram si > X DT/mois, coupure auto si > Y DT.
4. **Feature flags** — pouvoir désactiver une feature IA à la volée sans redéployer.
5. **Logs structurés** — chaque appel IA logué (provider, modèle, tokens, coût, latence) pour analytics.
6. **Caching** — cache Redis pour les prompts récurrents (économie 80 %+).
7. **Fallback** — chaque feature doit fonctionner (en mode dégradé) si l'IA est down.

---

## Risques transversaux

| Risque                      | Mitigation                                                                    |
| --------------------------- | ----------------------------------------------------------------------------- |
| Coûts qui explosent         | Budget plafonné + alertes + rate-limit agressif                               |
| Hallucinations              | Function calling (catalogue fermé) + validation humaine                       |
| Biais / contenu inapproprié | Modération avant publication (review par Mariem)                              |
| Dépendance provider         | Abstraction `AIGateway`, pouvoir switcher                                     |
| Latence perçue              | Streaming des réponses, skeleton UI                                           |
| Confidentialité             | Jamais envoyer données client à un LLM tiers sans consentement                |
| RGPD                        | Mentionner explicitement l'usage de l'IA dans la politique de confidentialité |
| Dépendance au cloud         | Fallback local (Ollama) pour features critiques                               |

---

## Valorisation carrière

Ces features, même implémentées partiellement, transforment la lecture du projet par un recruteur :

- **Production-ready AI integration** (pas un notebook jupyter) → rare et cher sur le marché.
- **Function calling / tools** → compétence très demandée.
- **Gestion des coûts LLM** → sujet avancé, peu de juniors savent le faire.
- **Vision** (OCR factures, reconnaissance photo) → compétence différenciante.
- **Multi-provider abstraction** → montre la maturité architecturale.
- **Feature flags + observabilité sur IA** → niveau senior.
- **Choix pragmatiques** (algo simple quand IA pas nécessaire) → bon sens ingénieur.

**Argument portfolio** : _"J'ai intégré 5 features IA en production avec budget plafonné à 20 DT/mois, en combinant providers gratuits et payants selon les cas d'usage. Architecture pensée pour switcher de provider sans refactor."_

Un article technique sur ce seul sujet = impact garanti (LinkedIn, dev.to, Medium).
