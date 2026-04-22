# Guide de déploiement — AWS EC2 + Docker + Atlas

Guide spécifique pour le déploiement sur `mariem.hamdikbaier.dev`.
Coexiste avec le projet `evalpro` déjà en place sur la même machine.

## Architecture cible

```
Internet (HTTPS)
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  Nginx (hôte EC2, hors Docker)                       │
│  mariem.hamdikbaier.dev  ──►  localhost:3000         │
│  (autre domaine evalpro)  ──► ports 5173/5001        │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌─── Docker Compose (docker-compose.prod.yml) ─────────┐
│                                                       │
│  frontend container (:3000, Nginx + React build)     │
│    └─► /api/* proxie vers backend:3001 (réseau Docker) │
│                                                       │
│  backend container (:3001, Express)                  │
│    └─► MongoDB Atlas (cloud, hors de l'hôte)         │
└───────────────────────────────────────────────────────┘
```

MongoDB est sur **Atlas M0** (cloud), pas sur l'EC2 — backups gérés par MongoDB.

## Ports utilisés

| Service | Port hôte | Port container | Notes |
|---------|-----------|----------------|-------|
| `mariem-frontend` | 3000 | 80 (nginx) | Sert le SPA + proxy `/api/*` vers backend |
| `mariem-backend` | 3001 | 3001 (Express) | Exposé uniquement pour debug/health check |
| `evalpro` (autre projet) | 5173, 5001, 5432 | — | Pas de conflit |

## Prérequis (déjà en place côté Hamdi)

- ✅ Instance EC2 Ubuntu avec IP `35.181.245.57`
- ✅ Docker + Docker Compose installés
- ✅ Nginx installé (pour l'autre projet)
- ✅ Git installé
- ✅ Sous-domaine `mariem.hamdikbaier.dev` → A record vers `35.181.245.57`
- ✅ Projet `evalpro` tourne déjà (sur des ports différents)

À vérifier :
- Certbot installé (sinon `sudo apt install certbot python3-certbot-nginx`)
- MongoDB Atlas : cluster créé, IP `35.181.245.57` whitelistée dans Network Access

## Étape 1 — Préparer MongoDB Atlas

1. Dans Atlas → **Network Access** → ajouter l'IP `35.181.245.57` (ou `0.0.0.0/0` pour autoriser de partout, moins sûr).
2. Dans Atlas → **Database Access** → créer ou vérifier l'utilisateur `mariem` avec mot de passe **fort**.
3. ⚠️ Si le mot de passe contient `@ : / ?`, il faut l'**URL-encoder** dans la connection string :
   - `@` → `%40`, `:` → `%3A`, `/` → `%2F`, `?` → `%3F`
4. Récupérer la connection string : **Connect → Drivers → Node.js**.

## Étape 2 — Sur l'EC2 : cloner ou mettre à jour le projet

```bash
# Première fois
cd ~
git clone <repo-url> mariem-sweet-kitchen
cd mariem-sweet-kitchen

# Mises à jour suivantes
cd ~/mariem-sweet-kitchen
git pull origin main
```

## Étape 3 — Créer `backend/.env.production`

```bash
cp backend/.env.production.example backend/.env.production
nano backend/.env.production
```

**Commandes pour générer les secrets forts :**

```bash
# JWT_SECRET (48 bytes hex, ~96 caractères)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# ADMIN_PASSWORD (~20 caractères base64)
openssl rand -base64 20
```

Pour les API keys (Gemini, Groq, Telegram) : depuis leurs consoles respectives.

## Étape 4 — Build et démarrage des containers

```bash
cd ~/mariem-sweet-kitchen
docker compose -f docker-compose.prod.yml up -d --build

# Vérifier que tout tourne
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```

Tu dois voir dans les logs backend :
```
✅ Connexion à la base de données établie
🚀 Serveur démarré sur le port 3001
```

Si ça plante : voir section **Dépannage** en bas.

## Étape 5 — Seed initial (UNE SEULE FOIS)

⚠️ **Le seed efface toutes les collections avant de réinsérer.** À n'exécuter qu'une fois lors du premier déploiement.

```bash
docker compose -f docker-compose.prod.yml exec backend node dist/scripts/seed.js
```

Si tu veux tester sans toucher la DB Atlas : saute cette étape, crée l'admin manuellement depuis Mongo Compass ou crée-le via un script one-shot.

## Étape 6 — Health check avant SSL

```bash
# Depuis l'EC2 directement
curl http://localhost:3001/api/health
curl http://localhost:3000/

# Depuis ton laptop (après DNS propagé)
curl http://mariem.hamdikbaier.dev
```

Doit renvoyer le HTML React. Si tu as une erreur ici, corrige avant de faire du SSL.

## Étape 7 — Configurer Nginx (hôte EC2)

```bash
# Copier le snippet fourni dans le repo
sudo cp ~/mariem-sweet-kitchen/docs/nginx-mariem.conf /etc/nginx/sites-available/mariem

# Activer le site
sudo ln -s /etc/nginx/sites-available/mariem /etc/nginx/sites-enabled/mariem

# Vérifier la syntaxe (ne doit pas casser evalpro)
sudo nginx -t

# Recharger si OK
sudo systemctl reload nginx
```

## Étape 8 — SSL avec Let's Encrypt

```bash
sudo certbot --nginx -d mariem.hamdikbaier.dev
```

Certbot va :
1. Vérifier que le domaine pointe bien vers cette IP.
2. Créer le certificat.
3. Modifier `/etc/nginx/sites-available/mariem` pour ajouter le bloc HTTPS + redirection HTTP → HTTPS.
4. Recharger Nginx.

Vérifier le renouvellement automatique :
```bash
sudo certbot renew --dry-run
```

## Étape 9 — Vérifications finales

Dans le navigateur :
- ✅ `https://mariem.hamdikbaier.dev` → site React s'affiche
- ✅ `https://mariem.hamdikbaier.dev/api/health` → `{"success":true,...}`
- ✅ Badge cadenas dans l'URL (HTTPS valide)
- ✅ Login admin fonctionne
- ✅ Commande test → Mariem reçoit la notif Telegram

## Mises à jour

```bash
cd ~/mariem-sweet-kitchen
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

## Dépannage

### Le backend crash au démarrage
```bash
docker compose -f docker-compose.prod.yml logs backend
```

Causes fréquentes :
- `JWT_SECRET manquant ou trop court` → ajouter dans `.env.production`.
- `MongooseError: bad auth` ou `timeout` → URL-encoder le mot de passe Atlas + vérifier l'IP whitelist Atlas.
- `ENOTFOUND` sur l'URI Atlas → problème DNS, vérifier l'URI.

### Le frontend affiche mais pas d'API
```bash
docker compose -f docker-compose.prod.yml logs frontend
```

Le nginx du container frontend proxy `/api/*` vers `http://backend:3001`. Si ça ne marche pas :
- Vérifier que les deux containers sont sur le même réseau Docker (`mariem-network`).
- Vérifier que le backend écoute bien sur `0.0.0.0:3001`, pas `127.0.0.1`.

### "site can't be reached" sur le domaine
- Vérifier que l'enregistrement A est bien actif : `dig mariem.hamdikbaier.dev +short` → doit retourner `35.181.245.57`.
- Vérifier que nginx écoute : `sudo ss -tlnp | grep :80`.
- Vérifier les Security Groups EC2 : ports 80 et 443 ouverts en inbound.

### Telegram ne notifie pas
- Vérifier que `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID` sont bien dans `.env.production`.
- Vérifier que Mariem a fait `/start` sur le bot au moins une fois.
- Tester manuellement :
  ```bash
  curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
    -d "chat_id=<CHAT_ID>&text=test"
  ```

### L'IA ne répond pas (Gemini / Groq)
- Vérifier les clés dans `.env.production`.
- Consulter les logs backend : `docker compose -f docker-compose.prod.yml logs backend | grep -i "ai"`.
- Le fallback Gemini → Groq est automatique. Si les deux échouent, vérifier que les tiers gratuits ne sont pas épuisés.

## Backup MongoDB Atlas

Sur **M0 (gratuit), pas de backup automatique**. Pour en faire un manuel :

```bash
mongodump --uri "<MONGODB_URI>" --out ./backup-$(date +%Y%m%d)
```

Recommandation : passer en M10 (~$57/mois) dès que le volume justifie — backups continus + snapshots.

## Rollback d'urgence

Si une mise à jour casse la prod :

```bash
cd ~/mariem-sweet-kitchen
git log --oneline  # repérer le dernier commit stable
git checkout <hash_stable>
docker compose -f docker-compose.prod.yml up -d --build
```

## Sécurité post-déploiement

- Security Group EC2 : ne garder ouverts que 22 (SSH depuis ton IP), 80, 443.
- `ufw` actif sur l'EC2 : `sudo ufw status`.
- Le port 3001 (backend) **ne doit PAS** être exposé publiquement. Vérifier : `curl http://35.181.245.57:3001` depuis ton laptop → **doit échouer**.
- `fail2ban` pour bloquer les tentatives SSH : `sudo apt install fail2ban`.
- Rotation périodique des secrets (3 mois) : JWT_SECRET, mots de passe.
- Monitoring : UptimeRobot gratuit sur `https://mariem.hamdikbaier.dev/api/health`.

## Nettoyage si désinstallation

```bash
cd ~/mariem-sweet-kitchen
docker compose -f docker-compose.prod.yml down -v
sudo rm /etc/nginx/sites-enabled/mariem /etc/nginx/sites-available/mariem
sudo systemctl reload nginx
sudo certbot delete --cert-name mariem.hamdikbaier.dev
```
