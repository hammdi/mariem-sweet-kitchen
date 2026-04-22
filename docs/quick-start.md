# Guide de démarrage rapide

## Prérequis
- Node.js 18+
- MongoDB 6+ (local ou Docker)
- Git

## Installation

```bash
# Cloner et installer
git clone <repo-url>
cd mariem-sweet-kitchen
npm run setup

# Configurer
cp env.example backend/.env
# Éditer backend/.env : MONGODB_URI, JWT_SECRET
```

## Démarrer

```bash
# Tout en une commande (backend + frontend)
npm run dev

# Ou séparément
npm run dev:backend    # http://localhost:3001/api
npm run dev:frontend   # http://localhost:3000
```

## Initialiser la base de données

```bash
cd backend && npx ts-node src/scripts/seed.ts
```

Crée :
- Admin : `admin@mariemkitchen.com` / `admin123`
- Ingrédients de base (farine, sucre, œufs, etc.)
- Machines (four, batteur, robot, etc.)
- Quelques recettes exemples

## Avec Docker

```bash
docker-compose up --build    # Démarre MongoDB + Backend + Frontend
docker-compose down          # Arrête tout
```

## Accès

| Service | URL |
|---------|-----|
| Frontend (client) | http://localhost:3000 |
| Admin | http://localhost:3000/admin |
| API | http://localhost:3001/api |
| Health check | http://localhost:3001/api/health |

## Dépannage

```bash
# Port déjà utilisé
lsof -i :3000
lsof -i :3001

# Réinstaller les dépendances
rm -rf node_modules && npm run setup

# Logs Docker
docker-compose logs -f backend
```
