/**
 * Hébergement en ligne : photos enregistrées dans la base (GridFS), copie
 * unique des données locales vers la base en ligne.
 * Vraies routes HTTP + bases MongoDB dédiées (noms finissant par "_test", vidées).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const BASE_URI = process.env.MONGODB_TEST_URI || '';
const TEST_URI = BASE_URI.replace(/_test(\?|$)/, '_hosting_test$1');
const COPY_URI = BASE_URI.replace(/_test(\?|$)/, '_hosting_copy_test$1');
const enabled = BASE_URI !== '' && new URL(TEST_URI).pathname.endsWith('_hosting_test');
const describeDb = enabled ? describe : describe.skip;

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-de-plus-de-32-caracteres-ok';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = require('../app').default;
import { User } from '../models/User';
import { Recipe } from '../models/Recipe';
import { copyDatabase } from '../scripts/copyToAtlas';

// Plus petit PNG valide (1 × 1 pixel)
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const dropAll = async () => {
  await mongoose.connection.db.dropDatabase();
  const copy = await mongoose.createConnection(COPY_URI).asPromise();
  await copy.dropDatabase();
  await copy.close();
};

describeDb('hébergement : photos en base et copie vers Atlas (intégration)', () => {
  let auth: { Authorization: string };

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    await dropAll();
    const admin = await User.create({
      email: 'admin@test.tn',
      password: 'secret123',
      firstName: 'A',
      lastName: 'B',
      phone: '+21612345678',
    });
    auth = { Authorization: `Bearer ${jwt.sign({ userId: admin._id }, process.env.JWT_SECRET!)}` };
  });

  afterAll(async () => {
    await dropAll();
    await mongoose.disconnect();
  });

  it('photo envoyée → enregistrée dans la base → servie publiquement', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set(auth)
      .attach('images', PNG, { filename: 'gateau.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    const url: string = res.body.data.urls[0];
    expect(url).toMatch(/^\/api\/files\/[0-9a-f]{24}$/);

    const img = await request(app).get(url);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect(img.headers['cache-control']).toContain('immutable');
    expect(Buffer.compare(img.body, PNG)).toBe(0);
  });

  it('refuse un faux fichier image, et sans connexion', async () => {
    const fake = await request(app)
      .post('/api/upload')
      .set(auth)
      .attach('images', Buffer.from('<script>alert(1)</script> pas une image'), {
        filename: 'x.png',
        contentType: 'image/png',
      });
    expect(fake.status).toBe(400);
    const anon = await request(app)
      .post('/api/upload')
      .attach('images', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(anon.status).toBe(401);
    expect((await request(app).get('/api/files/pas-un-id')).status).toBe(404);
    expect((await request(app).get(`/api/files/${new mongoose.Types.ObjectId()}`)).status).toBe(
      404
    );
  });

  it('copie vers une autre base : données + photos du disque, source intacte', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-uploads-'));
    fs.mkdirSync(path.join(dir, 'recipes'));
    fs.writeFileSync(path.join(dir, 'recipes', 'cake.png'), PNG);
    const recipe = await Recipe.create({
      name: 'Cake',
      images: ['/uploads/recipes/cake.png', '/uploads/recipes/absente.jpg'],
      variants: [{ sizeName: 'S', portions: 4, ingredients: [], appliances: [] }],
    });
    const logs: string[] = [];

    const dry = await copyDatabase({
      fromUri: TEST_URI,
      toUri: COPY_URI,
      dryRun: true,
      uploadsDir: dir,
      log: (m) => logs.push(m),
    });
    expect(dry.copied).toBe(false);
    expect(logs.join('\n')).not.toMatch(/mongodb:\/\/[^*]/); // adresse masquée

    const res = await copyDatabase({
      fromUri: TEST_URI,
      toUri: COPY_URI,
      uploadsDir: dir,
      log: () => undefined,
    });
    expect(res).toMatchObject({
      copied: true,
      images: 1,
      missing: ['/uploads/recipes/absente.jpg'],
    });

    const copy = await mongoose.createConnection(COPY_URI).asPromise();
    const copied = await copy.collection('recipes').findOne({ name: 'Cake' });
    expect(copied!.images[0]).toMatch(/^\/api\/files\/[0-9a-f]{24}$/);
    expect(copied!.images[1]).toBe('/uploads/recipes/absente.jpg');
    expect(await copy.collection('users').countDocuments()).toBe(1);
    await copy.close();

    // la source n'a pas changé
    expect((await Recipe.findById(recipe._id))!.images[0]).toBe('/uploads/recipes/cake.png');

    // deuxième lancement : refus, la cible n'est pas écrasée
    await expect(
      copyDatabase({ fromUri: TEST_URI, toUri: COPY_URI, uploadsDir: dir, log: () => undefined })
    ).rejects.toThrow(/contient déjà des données/);
    await expect(
      copyDatabase({ fromUri: TEST_URI, toUri: TEST_URI, log: () => undefined })
    ).rejects.toThrow(/identiques/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
