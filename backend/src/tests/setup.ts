// Jest setup — runs before each test suite
import fs from 'fs';
import path from 'path';

jest.setTimeout(10000);

// Tests d'integration : lire UNIQUEMENT MONGODB_TEST_URI depuis backend/.env
// (charger tout le .env activerait Telegram/IA pendant les tests).
if (!process.env.MONGODB_TEST_URI) {
  const envFile = path.join(__dirname, '../../.env');
  if (fs.existsSync(envFile)) {
    const match = fs.readFileSync(envFile, 'utf8').match(/^MONGODB_TEST_URI=(.+)$/m);
    if (match) {
      process.env.MONGODB_TEST_URI = match[1].trim();
    }
  }
}
