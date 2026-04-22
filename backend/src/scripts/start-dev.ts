#!/usr/bin/env ts-node

import dotenv from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';

// Charger les variables d'environnement
dotenv.config();

console.log('🚀 Démarrage du serveur de développement...\n');

// Vérifier que MongoDB est disponible
const checkMongoDB = () => {
  return new Promise((resolve, reject) => {
    const mongodb = spawn('mongod', ['--version'], { stdio: 'pipe' });
    
    mongodb.on('close', (code) => {
      if (code === 0) {
        console.log('✅ MongoDB détecté');
        resolve(true);
      } else {
        console.log('❌ MongoDB non trouvé. Veuillez installer MongoDB ou utiliser Docker');
        reject(new Error('MongoDB non disponible'));
      }
    });
    
    mongodb.on('error', (error) => {
      console.log('❌ Erreur lors de la vérification de MongoDB:', error.message);
      reject(error);
    });
  });
};

// Démarrer le serveur
const startServer = async () => {
  try {
    // Vérifier MongoDB
    await checkMongoDB();
    
    // Démarrer le serveur avec nodemon
    const server = spawn('npx', ['nodemon', 'src/index.ts'], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..', '..')
    });
    
    server.on('close', (code) => {
      console.log(`\n🛑 Serveur arrêté avec le code ${code}`);
    });
    
    server.on('error', (error) => {
      console.error('❌ Erreur lors du démarrage du serveur:', error);
    });
    
    // Gestion des signaux de fermeture
    process.on('SIGINT', () => {
      console.log('\n🛑 Arrêt du serveur...');
      server.kill('SIGINT');
    });
    
    process.on('SIGTERM', () => {
      console.log('\n🛑 Arrêt du serveur...');
      server.kill('SIGTERM');
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
};

// Démarrer
startServer();
