FROM node:18-alpine

WORKDIR /app

# Installer les dependances
COPY package*.json ./
COPY tsconfig.json ./
RUN npm install

# Copier le code source
COPY src/ ./src/

# Compiler TypeScript
RUN npm run build

# Creer le dossier uploads
RUN mkdir -p uploads/recipes

# Supprimer les devDependencies
RUN npm prune --production

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

# Demarrer le serveur uniquement.
# Le seed N'EST PLUS execute automatiquement : il deletMany() toutes les
# collections avant d'inserer, il ferait perdre les commandes reelles a chaque
# redemarrage du container.
# Lancer manuellement apres le premier deploiement uniquement :
#   docker compose -f docker-compose.prod.yml exec backend node dist/scripts/seed.js
CMD ["node", "dist/index.js"]
