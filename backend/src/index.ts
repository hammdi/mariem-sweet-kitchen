import express from 'express';
import http from 'http';
import path from 'path';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { connectDatabase } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

// Routes
import authRoutes from './routes/auth';
import recipeRoutes from './routes/recipes';
import ingredientRoutes from './routes/ingredients';
import orderRoutes from './routes/orders';
import applianceRoutes from './routes/appliances';
import priceRoutes from './routes/prices';
import settingsRoutes from './routes/settings';
import uploadRoutes from './routes/upload';

// Charger les variables d'environnement
dotenv.config();

// Fail-fast: refuser de démarrer sans un JWT_SECRET fort.
// Sans ça, n'importe qui peut forger un token si la valeur d'exemple reste en place.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  // eslint-disable-next-line no-console
  console.error(
    'JWT_SECRET manquant ou trop court (min 32 caracteres). ' +
    'Definissez-le dans backend/.env. ' +
    'Genere une valeur forte: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
  );
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de sécurité
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Middleware de compression
app.use(compression());

// Middleware de logging
app.use(morgan('combined', {
  stream: { write: (message: string) => logger.info(message.trim()) }
}));

// Rate limiting global
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'),
  message: {
    success: false,
    message: 'Trop de requêtes, veuillez réessayer plus tard'
  }
});
app.use('/api/', limiter);

// Rate limiting strict pour l'authentification (anti brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Trop de tentatives de connexion, réessayez dans 15 minutes'
  }
});

// Middleware pour parser le JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir les fichiers uploadés (images recettes, etc.)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes de l'API (authLimiter appliqué avant le routeur d'auth)
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/appliances', applianceRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);

// Route de santé
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API Mariem\'s Sweet Kitchen est opérationnelle',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée'
  });
});

// Middleware de gestion d'erreurs
app.use(errorHandler);

let server: http.Server | null = null;

// Fonction de démarrage du serveur
async function startServer() {
  try {
    await connectDatabase();
    logger.info('✅ Connexion à la base de données établie');

    server = app.listen(PORT, () => {
      logger.info(`🚀 Serveur démarré sur le port ${PORT}`);
      logger.info(`📱 API disponible sur http://localhost:${PORT}/api`);
      logger.info(`🏥 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    logger.error('❌ Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
}

// Arrêt gracieux : on laisse les requêtes en cours se terminer avant de fermer Mongo.
async function gracefulShutdown(signal: string) {
  logger.info(`🛑 ${signal} reçu, fermeture gracieuse...`);

  // Timeout de sécurité : si on dépasse 10s, on force l'arrêt
  const forceExit = setTimeout(() => {
    logger.error('Fermeture forcée après timeout');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close(err => (err ? reject(err) : resolve()));
      });
      logger.info('Serveur HTTP fermé');
    }
    await mongoose.connection.close();
    logger.info('Connexion MongoDB fermée');
    process.exit(0);
  } catch (error) {
    logger.error('Erreur pendant la fermeture:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Démarrer le serveur
startServer();
