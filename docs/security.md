# Sécurité

Note de sécurité du projet. Documente les mesures en place, les menaces identifiées et les évolutions prévues.

## Principe directeur

**Minimiser la surface d'attaque.** Chaque fonctionnalité ajoute des routes, donc des vecteurs. On ne garde que ce qui est utilisé.

## Modèle de menaces

### Acteurs

| Acteur                   | Motivation                                      | Vecteur                               |
| ------------------------ | ----------------------------------------------- | ------------------------------------- |
| Script kiddie automatisé | Défigurer le site / rançonner                   | Fuzz sur endpoints communs, injection |
| Concurrent local         | Voler les recettes de Mariem                    | Scraping, API discovery               |
| Client malveillant       | Commander sans payer / faire perdre de l'argent | Manipulation prix, commandes bidon    |
| Employé interne futur    | Accès privilégié mal géré                       | Élévation de privilège                |

### Biens à protéger

1. **Secret des recettes** : les étapes de préparation ne sont **jamais** stockées — impossibilité structurelle de les extraire.
2. **Données clients** : nom, téléphone, email. Volume faible, à protéger pour RGPD.
3. **Identifiants admin** : compromettre le compte de Mariem = contrôle total.
4. **Intégrité des prix** : un attaquant ne doit pas pouvoir créer une commande à 0 DT.

## Mesures en place (V1)

### Authentification et autorisation

- **JWT** signé HS256, secret ≥ 32 caractères obligatoire (fail-fast au démarrage).
- **bcrypt** 12 rounds pour les mots de passe.
- **Middleware `authenticate`** : vérifie signature + existence utilisateur + `isActive`.
- **Middleware `authorize('admin')`** sur toutes les routes admin.
- **Rôle `client` forcé à l'inscription** : impossible de créer un admin via l'API.
- **Rate-limit** dédié `/api/auth/*` : 5 tentatives/15 min (anti brute-force).

### Intégrité des données

- **Prix recalculé côté serveur** systématiquement. Aucun prix envoyé par le client n'est accepté — même si un attaquant forge un body avec `total: 0`, le serveur recalcule.
- **Whitelist** des clés dans `PUT /api/settings` — impossible d'ajouter des paramètres bidon.
- **Validation Mongoose** : formats téléphone tunisien, email, longueurs max, valeurs min/max.
- **Soft delete** sur recettes/ingrédients — pas de perte de données, audit possible.

### Protection réseau

- **HTTPS obligatoire** en production (Let's Encrypt).
- **Helmet** pour en-têtes sécurisés (HSTS, X-Frame-Options, CSP basique, nosniff).
- **CORS restrictif** : seuls les domaines déclarés dans `CORS_ORIGIN` sont acceptés.
- **Rate-limit global** `/api/*` : 100 req/15 min par IP.
- **Request body size** limité à 10 MB.

### Logging et audit

- **Winston** capture toutes les erreurs avec URL, méthode, IP, user-agent.
- **Morgan** log les requêtes HTTP.
- **Logs d'audit** sur mutations admin (`logger.info` avec user email).

### Configuration

- Aucune valeur secrète dans `env.example` (mot de passe, clé JWT vidés).
- `.env` dans `.gitignore`.
- Seed refuse de tourner sans `ADMIN_PASSWORD` fort (≥ 8 caractères).
- Backend refuse de démarrer sans `JWT_SECRET` fort (≥ 32 caractères).

### Résilience

- **Arrêt gracieux** : fermeture ordonnée sur SIGTERM/SIGINT (HTTP puis Mongo), timeout de sécurité 10 s.
- **Error handler** centralisé : jamais de stack trace exposée en production.

## Vulnérabilités historiquement corrigées

Voir [etude-existant.md](./etude-existant.md) pour le détail de l'audit d'avril 2026.

En résumé :

- 🔴 Inscription admin publique (permettait à n'importe qui d'obtenir les droits admin).
- 🔴 Route `/bulk-update-prices` shadowée par `/:id` (silencieusement cassée).
- 🟠 `optionalAuth` avalait les erreurs JWT sans log.
- 🟠 Absence de rate-limit spécifique auth.
- 🟠 Arrêt non gracieux.

## Menaces acceptées (et pourquoi)

### Pas de refresh token rotation

**Risque** : si un token est volé, il reste valide 7 jours.
**Acceptation** : population utilisateurs = Mariem + quelques clients. Volume faible, HTTPS obligatoire, pas de stockage XSS trivial côté client. Migration vers refresh token prévue en V2.

### Pas de CSRF token

**Risque** : Cross-Site Request Forgery sur les endpoints authentifiés.
**Acceptation** : le JWT est lu depuis `Authorization: Bearer`, pas depuis un cookie. Les attaques CSRF classiques (via cookie implicite) ne fonctionnent pas.

### Détail des prix exposé au public

**Risque** : un concurrent peut scraper les ingrédients et quantités exactes des recettes.
**Acceptation** : c'est le concept produit — la transparence est un argument commercial. Les étapes de préparation (le vrai savoir-faire) ne sont jamais stockées donc jamais exposées.

### Pas de 2FA admin

**Risque** : si le mot de passe de Mariem fuit, accès total.
**Acceptation** : complexité d'usage pour Mariem > valeur en V1. À mettre en V2 (TOTP) quand le volume financier le justifie.

## Roadmap sécurité

### V2

- [ ] Refresh token rotation (access 15 min + refresh 30 j en httpOnly cookie).
- [ ] 2FA TOTP pour les comptes admin.
- [ ] Reset mot de passe par email (token temporaire).
- [ ] Audit log dédié pour les actions admin (consultable dans une page dédiée).
- [ ] Intégration Sentry (alerte sur erreurs 5xx répétées).

### V3

- [ ] Content Security Policy stricte (nonce par requête).
- [ ] Suppression RGPD en 1 clic (client peut supprimer son compte + ses commandes).
- [ ] Politique de rétention : commandes > 2 ans purgées (hors obligation fiscale).
- [ ] Scanner de dépendances (Dependabot + Snyk dans le CI).
- [ ] Pentest externe (après mise en prod stable).

### V4

- [ ] WAF (Cloudflare ou équivalent).
- [ ] Bug bounty (HackerOne ou programme interne).
- [ ] Chiffrement au repos MongoDB (encryption-at-rest).

## Checklist avant mise en production

- [ ] `JWT_SECRET` généré avec `crypto.randomBytes(48)` et stocké hors du repo.
- [ ] `ADMIN_PASSWORD` ≥ 16 caractères, stocké dans un gestionnaire de mots de passe.
- [ ] `MONGODB_URI` avec authentification (user + password fort).
- [ ] HTTPS avec certificat valide (Let's Encrypt).
- [ ] `CORS_ORIGIN` limité au domaine de production.
- [ ] `NODE_ENV=production` (supprime les stack traces des réponses).
- [ ] Firewall UFW actif, MongoDB non exposé publiquement.
- [ ] Backup MongoDB configuré (cron quotidien + rétention 30 j).
- [ ] Monitoring minimum : alerte si le site tombe (UptimeRobot ou équivalent).
- [ ] Logs applicatifs écrits sur disque + rotation (logrotate).
- [ ] Test de restauration backup réussi au moins une fois.

## Conformité RGPD (client européen potentiel)

Même si la cible principale est tunisienne, autant être conforme :

- Données collectées minimales (nom, téléphone, email facultatif).
- Finalité claire : gestion des commandes uniquement.
- Durée de conservation documentée (2 ans pour commandes, jusqu'à demande pour comptes).
- Droit à l'effacement : à implémenter (bouton "supprimer mon compte") en V3.
- Politique de confidentialité à rédiger et lier depuis le footer.

## Reporting

Vulnérabilité découverte ? Contacter Hamdi directement (hamdikbaier8@gmail.com). Pas de programme de bug bounty en V1 — ça viendra.
