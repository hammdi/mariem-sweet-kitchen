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

# Lancer le seed puis demarrer
CMD sh -c "node dist/scripts/seed.js 2>/dev/null; node dist/index.js"
