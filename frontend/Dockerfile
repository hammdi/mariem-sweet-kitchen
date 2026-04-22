# Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copier package files depuis le contexte racine
COPY frontend/package*.json ./
COPY frontend/tsconfig*.json ./
COPY frontend/vite.config.ts ./
COPY frontend/tailwind.config.js ./
COPY frontend/postcss.config.js ./

RUN npm install

# Copier le source
COPY frontend/src ./src
COPY frontend/public ./public
COPY frontend/index.html ./

# Variable d'env pour le build Vite
ARG VITE_API_URL=http://localhost:3001/api
ENV VITE_API_URL=$VITE_API_URL

# Augmente la heap Node pour eviter OOM sur les instances a faible RAM
# (EC2 t3.small = 2-3 Go). Combiner avec du swap cote hote.
ENV NODE_OPTIONS=--max-old-space-size=2048

RUN npm run build

# Prod — Nginx
FROM nginx:alpine

COPY frontend/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
