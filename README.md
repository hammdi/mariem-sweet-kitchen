# Mariem's Sweet Kitchen

Plateforme web pour une pâtissière artisanale en Tunisie.

## Concept

Mariem vend ses pâtisseries avec une **transparence totale des prix** : le client voit chaque ingrédient, chaque machine utilisée et le détail du coût. Les étapes de préparation restent secrètes — c'est le savoir-faire de Mariem.

Le site sert aussi d'**outil de gestion** pour Mariem : ne plus oublier de recettes, d'ingrédients ou de commandes.

## Fonctionnalités principales

- **Recettes avec prix transparents** : ingrédients + électricité + eau + marge (15%)
- **Tailles flexibles** par recette (petit, moyen, grand, 2 étages, par lot...)
- **Commande en visiteur** : nom + téléphone, pas besoin de compte
- **Ingrédients mixtes** : Mariem coche ce que le client ramène, le prix se recalcule
- **Cash uniquement** : le client paye à la récupération
- **Admin simple** pour Mariem : gestion recettes, commandes, prix
- **Bot Telegram** : Mariem reçoit les commandes instantanément
- **Duplication de recettes** : chocolat → copier → modifier en vanille

## Stack technique

|                 | Technologie                                                          |
| --------------- | -------------------------------------------------------------------- |
| Frontend        | React 18, TypeScript, Vite, Material-UI, Tailwind CSS, Redux Toolkit |
| Backend         | Node.js, Express, TypeScript, Mongoose                               |
| Base de données | MongoDB                                                              |
| Auth            | JWT (admin uniquement)                                               |
| Notifications   | Telegram Bot API                                                     |
| Déploiement     | Docker, Nginx                                                        |

## Démarrage rapide

```bash
npm run setup              # Installer les dépendances
cp env.example backend/.env  # Configurer
npm run dev                # Démarrer (backend :3001 + frontend :3000)
```

Seed la base de données :

```bash
cd backend && npx ts-node src/scripts/seed.ts
```

Avec Docker :

```bash
docker-compose up --build
```

## Documentation

- [Cahier des charges](docs/cahier-des-charges.md)
- [Architecture technique](docs/architecture.md)
- [Documentation API](docs/api-documentation.md)
- [Guide de démarrage](docs/quick-start.md)
- [Guide de déploiement](docs/deployment-guide.md)

## Formule de prix

```
Prix = Ingrédients (non fournis par le client)
     + Électricité (puissance × temps × tarif STEG)
     + Eau (forfait configurable)
     + Marge effort (15% configurable)
```
