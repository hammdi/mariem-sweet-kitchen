// IMPORTANT: dotenv doit etre charge AVANT tout autre import.
// Les modules telegramService, geminiProvider, groqProvider lisent process.env
// au "module scope" (a l'import). Si dotenv.config() s'execute apres leurs
// imports, les variables sont undefined et les services se desactivent
// silencieusement.
import 'dotenv/config';

import http from 'http';
import mongoose from 'mongoose';

import app from './app';
import { connectDatabase } from './config/database';
import { logger } from './utils/logger';

// Fail-fast: refuser de démarrer sans un JWT_SECRET fort.
// Sans ça, n'importe qui peut forger un token si la valeur d'exemple reste en place.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  // eslint-disable-next-line no-console
  console.error(
    'JWT_SECRET manquant ou trop court (min 32 caracteres). ' +
      'Definissez-le dans backend/.env. ' +
      "Genere une valeur forte: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
  );
  process.exit(1);
}

const PORT = process.env.PORT || 3001;

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
        server!.close((err) => (err ? reject(err) : resolve()));
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
