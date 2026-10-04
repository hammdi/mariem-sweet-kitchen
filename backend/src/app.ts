/**
 * Application Express (middlewares + routes), sans démarrage du serveur.
 * Séparée de index.ts pour pouvoir être testée avec supertest.
 */
import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

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
import aiRoutes from './routes/ai';
import availabilityRoutes from './routes/availability';
import clientRoutes from './routes/clients';
import purchaseSourceRoutes from './routes/purchaseSources';
import ingredientPriceRoutes from './routes/ingredientPrices';
import salesRoutes from './routes/sales';
import cashRoutes from './routes/cash';
import dashboardRoutes from './routes/dashboard';
import statisticsRoutes from './routes/statistics';
import purchaseRoutes from './routes/purchases';
import expenseRoutes from './routes/expenses';

const app = express();

// Middleware de sécurité
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  })
);

// Middleware de compression
app.use(compression());

// Middleware de logging
app.use(
  morgan('combined', {
    stream: { write: (message: string) => logger.info(message.trim()) },
  })
);

// Rate limiting global
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'),
  message: {
    success: false,
    message: 'Trop de requêtes, veuillez réessayer plus tard',
  },
});
app.use('/api/', limiter);

// Rate limiting strict pour l'authentification (anti brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Trop de tentatives de connexion, réessayez dans 15 minutes',
  },
});

// Middleware pour parser le JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir les fichiers uploadés (images recettes, etc.)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes de l'API (authLimiter appliqué avant le routeur d'auth)
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/recipes', recipeRoutes);
// ingredientPriceRoutes avant ingredientRoutes : '/price-summary' ne doit pas etre pris pour un '/:id'
app.use('/api/ingredients', ingredientPriceRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/appliances', applianceRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/purchase-sources', purchaseSourceRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/cash', cashRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/expenses', expenseRoutes);

// Route de santé
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: "API Mariem's Sweet Kitchen est opérationnelle",
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
  });
});

// Middleware de gestion d'erreurs
app.use(errorHandler);

export default app;
