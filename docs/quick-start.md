# Guide de démarrage rapide

## Prérequis
- Node.js 18+
- MongoDB 6+ (local, Docker ou Atlas)
- Git

## Installation

```bash
git clone <repo-url>
cd mariem-sweet-kitchen
npm install
```

## Configuration

```bash
cp env.example backend/.env
```

Éditer `backend/.env` — **les trois valeurs ci-dessous sont obligatoires** :

```env
MONGODB_URI=mongodb://localhost:27017/mariem_kitchen

# Générer une valeur aléatoire forte (≥ 32 caractères)
# node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=<valeur_aléatoire_forte>

# Mot de passe admin utilisé UNIQUEMENT au seed initial
ADMIN_PASSWORD=<mot_de_passe_fort_pour_mariem>
```

Le backend **refuse de démarrer** si `JWT_SECRET` est manquant ou < 32 caractères. Le seed **refuse de tourner** si `ADMIN_PASSWORD` est manquant ou < 8 caractères. C'est intentionnel, pour éviter les secrets faibles en production.

Frontend : éditer `frontend/.env` si besoin (par défaut `VITE_API_URL=http://localhost:3001/api`).

## Démarrer

```bash
# Tout en une commande (backend + frontend)
npm run dev

# Ou séparément
npm run dev:backend    # http://localhost:3001/api
npm run dev:frontend   # http://localhost:3000
```

## Seed de la base de données

```bash
cd backend && npx ts-node src/scripts/seed.ts
```

Crée :
- Admin (email `admin@mariemkitchen.com`, mot de passe = `$ADMIN_PASSWORD`).
- Ingrédients de base (farine, sucre, œufs, beurre, etc.).
- Machines (four, batteur, robot, micro-ondes, réfrigérateur).
- Paramètres (tarif STEG, forfait eau, marge 15 %).
- 8 recettes d'exemple avec variants.

> Le seed **efface** toutes les collections avant de réinsérer — à utiliser uniquement en dev/test.

## Avec Docker

```bash
docker compose up --build    # MongoDB + Backend + Frontend
docker compose down          # Arrête tout
```

## Accès

| Service | URL |
|---------|-----|
| Frontend client | http://localhost:3000 |
| Admin | http://localhost:3000/admin |
| API | http://localhost:3001/api |
| Health check | http://localhost:3001/api/health |

## Tests

```bash
npm run test:backend               # Jest backend
npm run test:frontend              # Tests frontend
cd backend && npx jest <path>      # Un seul fichier
```

## Lint & Format

```bash
npm run lint:backend
npm run lint:frontend
npm run format                     # Prettier
```

## Dépannage

```bash
# Port déjà utilisé
lsof -i :3000
lsof -i :3001

# MongoDB pas accessible
docker compose logs mongodb
# ou en local
brew services list | grep mongodb

# Réinstaller les dépendances
rm -rf node_modules && npm install

# JWT_SECRET manquant au démarrage
# → le message d'erreur te donne la commande pour en générer un
```
