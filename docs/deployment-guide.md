# Guide de déploiement — AWS + Docker

## Architecture cible

```
Internet → AWS EC2 → Nginx (SSL) ──→ Frontend Container (:3000)
                                  └─→ Backend Container (:3001)
                                        ↓
                                  MongoDB Container (:27017)
```

Un seul domaine. Nginx route `/api/*` vers le backend, le reste vers le frontend.

## Prérequis

- Instance AWS EC2 (Ubuntu 22.04, t3.small minimum)
- Nom de domaine pointé vers l'IP de l'instance (A record)
- Ports 22, 80, 443 ouverts dans le Security Group

## 1. Préparer l'instance EC2

```bash
# Se connecter
ssh -i <key.pem> ubuntu@<ip-ec2>

# Mettre à jour
sudo apt update && sudo apt upgrade -y

# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
newgrp docker

# Docker Compose (v2)
sudo apt install docker-compose-plugin -y

# Nginx + Certbot
sudo apt install nginx certbot python3-certbot-nginx -y
```

## 2. Cloner et configurer

```bash
git clone <repo-url> ~/mariem-sweet-kitchen
cd ~/mariem-sweet-kitchen

# Créer le fichier d'environnement
cp env.example .env
```

Éditer `.env` :
```env
NODE_ENV=production
PORT=3001

# MongoDB (interne au réseau Docker)
MONGODB_URI=mongodb://admin:<MOT_DE_PASSE_FORT>@mongodb:27017/mariem_kitchen?authSource=admin
MONGO_PASSWORD=<MOT_DE_PASSE_FORT>

# JWT
JWT_SECRET=<CLÉ_SECRÈTE_LONGUE_ET_ALÉATOIRE>
JWT_EXPIRES_IN=7d

# Telegram
TELEGRAM_BOT_TOKEN=<TOKEN_DU_BOT>
TELEGRAM_CHAT_ID=<CHAT_ID_MARIEM>

# Frontend
VITE_API_URL=https://<DOMAINE>/api

# CORS
CORS_ORIGIN=https://<DOMAINE>
```

## 3. Docker Compose production

```yaml
# docker-compose.yml
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    container_name: mariem-mongodb
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
      MONGO_INITDB_DATABASE: mariem_kitchen
    volumes:
      - mongodb_data:/data/db
      - ./docker/mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    networks:
      - mariem-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: mariem-backend
    restart: unless-stopped
    ports:
      - "3001:3001"
    env_file:
      - .env
    depends_on:
      - mongodb
    networks:
      - mariem-network

  frontend:
    build:
      context: .
      dockerfile: ./frontend/Dockerfile
    container_name: mariem-frontend
    restart: unless-stopped
    ports:
      - "3000:80"
    depends_on:
      - backend
    networks:
      - mariem-network

volumes:
  mongodb_data:

networks:
  mariem-network:
    driver: bridge
```

## 4. Configurer Nginx

```bash
sudo nano /etc/nginx/sites-available/mariem
```

```nginx
server {
    listen 80;
    server_name <DOMAINE>;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name <DOMAINE>;

    ssl_certificate /etc/letsencrypt/live/<DOMAINE>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<DOMAINE>/privkey.pem;

    # Sécurité
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Strict-Transport-Security "max-age=31536000" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    # API → Backend
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Tout le reste → Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/mariem /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## 5. SSL

```bash
# D'abord, commenter le bloc server :443 dans nginx et garder seulement :80 sans redirect
# Puis :
sudo certbot --nginx -d <DOMAINE>
# Certbot va modifier la config nginx automatiquement
sudo systemctl restart nginx
```

## 6. Déployer

```bash
cd ~/mariem-sweet-kitchen
docker compose up --build -d

# Vérifier
docker compose ps
docker compose logs -f backend

# Seed initial (une seule fois)
docker compose exec backend npx ts-node src/scripts/seed.ts
```

## 7. Backup automatique

```bash
cat > ~/backup-mariem.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$HOME/backups"
mkdir -p $BACKUP_DIR

docker exec mariem-mongodb mongodump \
  -u admin -p "${MONGO_PASSWORD}" \
  --authenticationDatabase admin \
  --out /tmp/backup

docker cp mariem-mongodb:/tmp/backup $BACKUP_DIR/mongodb_$DATE
tar -czf $BACKUP_DIR/backup_$DATE.tar.gz -C $BACKUP_DIR mongodb_$DATE
rm -rf $BACKUP_DIR/mongodb_$DATE

# Garder 30 jours
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +30 -delete
EOF

chmod +x ~/backup-mariem.sh

# Cron quotidien à 3h
(crontab -l 2>/dev/null; echo "0 3 * * * $HOME/backup-mariem.sh") | crontab -
```

## 8. Sécurité AWS

### Security Group EC2
| Type | Port | Source |
|------|------|--------|
| SSH | 22 | Votre IP uniquement |
| HTTP | 80 | 0.0.0.0/0 |
| HTTPS | 443 | 0.0.0.0/0 |

### Firewall serveur
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

MongoDB n'est **pas** exposé à l'extérieur — accessible uniquement via le réseau Docker interne.

## Mise à jour

```bash
cd ~/mariem-sweet-kitchen
git pull origin main
docker compose up --build -d
```

## Dépannage

```bash
# Logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mongodb

# Restart
docker compose restart backend

# Rebuild complet
docker compose down
docker compose up --build -d

# État des containers
docker compose ps
docker stats

# SSL
sudo certbot renew --dry-run
```
