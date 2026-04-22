# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mariem's Sweet Kitchen — pastry e-commerce for a Tunisian artisan. Two purposes:

1. **For Mariem (admin)**: manage recipes, ingredients, machines, orders — stop forgetting things
2. **For clients (visitors)**: see recipes with transparent pricing, order with name + phone, pay cash

**Core concept**: clients see WHAT (ingredients + machines + prices) but never HOW (preparation steps). Recipes stay secret.

## Commands

### Development

```bash
npm run dev              # Start both backend and frontend concurrently
npm run dev:backend      # Backend only (nodemon, port 3001)
npm run dev:frontend     # Frontend only (Vite, port 3000)
```

### Build

```bash
npm run build            # Build both
npm run build:backend    # tsc (outputs to backend/dist/)
npm run build:frontend   # tsc + vite build
```

### Test & Lint

```bash
npm run test:backend     # Jest (backend/jest.config.js)
npm run test:frontend    # Frontend tests
cd backend && npx jest path/to/file.test.ts  # Single test file
npm run lint:backend     # ESLint on backend/src/**/*.ts
npm run lint:frontend    # ESLint on frontend/src (ts,tsx)
npm run format           # Prettier on all ts/tsx/json/md files
```

### Database

```bash
cd backend && npx ts-node src/scripts/seed.ts   # Seed DB (clears all data first)
```

### Docker

```bash
docker-compose up --build    # Build and start all services
docker-compose down          # Stop all services
```

## Architecture

**Monorepo with npm workspaces** (`frontend/`, `backend/`, `shared/`). TypeScript throughout.

### Backend (Express + Mongoose)

- Entry: `backend/src/index.ts`
- Routes: `backend/src/routes/` (inline handlers, no controllers)
- Models: `Recipe`, `Ingredient`, `Appliance`, `Order`, `User` in `backend/src/models/`
- Auth: JWT — `authenticate` middleware for admin, `authorize('admin')` for role check
- Price logic: `PriceCalculationService` in `backend/src/services/priceCalculationService.ts`
- Error handling: `createError()` + `asyncHandler()` from `backend/src/middleware/errorHandler.ts`
- Soft deletes via `isActive` flag

### Frontend (React 18 + Vite)

- Entry: `frontend/src/main.tsx` → `App.tsx`
- State: Redux Toolkit (auth, cart, recipes slices)
- UI: Material-UI v5 (primary: #f1770a) + Tailwind CSS
- API client: Axios in `frontend/src/services/api.ts` (Bearer token from localStorage)
- Admin pages under `/admin/*` routes (same app, not separate)
- Client pages: `/`, `/recipes`, `/recipes/:id`

### Shared Types

- `shared/types/index.ts` — interfaces for both frontend and backend

## Key Domain Concepts

**Recipe structure**: each recipe has multiple `variants` (sizes). Each variant has its own ingredients with quantities and appliances with durations. No fixed multiplier — Mariem sets exact quantities per size.

**Order flow**: client orders → Mariem gets Telegram notification → discusses with client → checks off ingredients client will bring → price recalculates → confirms → prepares → marks ready → client pays cash.

**Price formula**:

```
ingredientsCost = Σ ingredients NOT provided by client
electricityCost = Σ (machine power × duration × STEG tariff)
waterCost       = configurable forfait
margin          = (ingredients + electricity + water) × 15%
total           = ingredientsCost + electricityCost + waterCost + margin
```

**No client accounts** — visitors order with name + phone.
**No preparation steps stored** — by design (Mariem's secret).
**Duplication** instead of variant/options system for recipe variations.
**Cash only** — no payment integration.

## Environment

Copy `env.example` to `backend/.env`. Key vars:

- `MONGODB_URI` — default: `mongodb://localhost:27017/mariem_kitchen`
- `JWT_SECRET` — for admin auth
- `PORT` — backend port (default: 3001)
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — for order notifications
- Frontend uses `VITE_API_URL` in `frontend/.env`

## Seed Users (dev)

- Admin: `admin@mariemkitchen.com` / `admin123`
