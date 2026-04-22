import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI n\'est pas définie dans les variables d\'environnement');
    }

    // Options de connexion MongoDB
    const options = {
      maxPoolSize: 10, // Maintenir jusqu'à 10 connexions socket
      serverSelectionTimeoutMS: 5000, // Garder les connexions ouvertes pendant 5 secondes
      socketTimeoutMS: 45000, // Fermer les sockets après 45 secondes d'inactivité
      bufferCommands: false // Désactiver le buffering mongoose
    };

    await mongoose.connect(mongoUri, options);

    // Événements de connexion
    mongoose.connection.on('connected', () => {
      logger.info('📊 MongoDB connecté avec succès');
    });

    mongoose.connection.on('error', (error) => {
      logger.error('❌ Erreur de connexion MongoDB:', error);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️ MongoDB déconnecté');
    });

    // Gestion de la fermeture propre
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('🔌 Connexion MongoDB fermée proprement');
      process.exit(0);
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la connexion à MongoDB:', error);
    throw error;
  }
};
