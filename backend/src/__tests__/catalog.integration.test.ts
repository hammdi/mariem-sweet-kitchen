/**
 * Catalogue client (public) : vitrine sans composition.
 * Vraies routes HTTP + base MongoDB dédiée (nom finissant par "_test", vidée).
 */
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const BASE_URI = process.env.MONGODB_TEST_URI || '';
const TEST_URI = BASE_URI.replace(/_test(\?|$)/, '_catalog_test$1');
const enabled = BASE_URI !== '' && new URL(TEST_URI).pathname.endsWith('_catalog_test');
const describeDb = enabled ? describe : describe.skip;

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-de-plus-de-32-caracteres-ok';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = require('../app').default;
import { User } from '../models/User';
import { Ingredient } from '../models/Ingredient';
import { Recipe } from '../models/Recipe';
import { Settings } from '../models/Settings';

import { Order } from '../models/Order';
import { Counter } from '../models/Counter';
import { PurchaseNeed } from '../models/PurchaseNeed';
import { IdempotencyRecord } from '../models/IdempotencyRecord';
import { Client } from '../models/Client';

const MODELS = [
  User,
  Ingredient,
  Recipe,
  Settings,
  Order,
  Counter,
  PurchaseNeed,
  IdempotencyRecord,
  Client,
];
const clearAll = () =>
  Promise.all(MODELS.map((m) => (m as unknown as mongoose.Model<unknown>).deleteMany({})));

describeDb('catalogue client (intégration)', () => {
  let auth: { Authorization: string };
  let cakeId: string;

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    await clearAll();
    const admin = await User.create({
      email: 'admin@test.tn',
      password: 'secret123',
      firstName: 'A',
      lastName: 'B',
      phone: '+21612345678',
    });
    auth = { Authorization: `Bearer ${jwt.sign({ userId: admin._id }, process.env.JWT_SECRET!)}` };
    await Settings.insertMany(
      ['stegTariff', 'waterForfaitSmall', 'waterForfaitLarge', 'marginPercent'].map((key) => ({
        key,
        value: 0,
        label: key,
      }))
    );
    const cacao = await Ingredient.create({
      name: 'Cacao secret',
      unit: 'kg',
      pricePerUnit: 40,
      category: 'flavoring',
    });
    const res = await request(app)
      .post('/api/recipes')
      .set(auth)
      .send({
        name: 'Cloudy Cake',
        description: 'Ultra-léger et fondant.',
        images: ['/uploads/recipes/cloudy.jpg'],
        categories: ['gateau'],
        recommendations: ['  À conserver au frais  ', '', 'Idéal avec un café'],
        variants: [
          {
            sizeName: 'Petit',
            portions: 8,
            weightGrams: 900,
            dimensions: 'Ø 20 cm',
            saleMode: 'À la pièce',
            ingredients: [{ ingredientId: cacao._id, quantity: 100, unit: 'g' }],
            appliances: [],
          },
        ],
      });
    expect(res.status).toBe(201);
    cakeId = res.body.data.recipe._id;
    await Recipe.create({
      name: 'Ancienne recette',
      isActive: false,
      variants: [{ sizeName: 'S', portions: 1, ingredients: [], appliances: [] }],
    });
  });

  afterAll(async () => {
    await clearAll();
    await mongoose.disconnect();
  });

  it('liste publique : photos, description, tailles, prix — sans composition', async () => {
    const res = await request(app).get('/api/catalog');
    expect(res.status).toBe(200);
    expect(res.body.data.showPrices).toBe(true);
    expect(res.body.data.categories).toEqual(['gateau']);
    expect(res.body.data.items).toHaveLength(1); // recette inactive exclue
    const item = res.body.data.items[0];
    expect(item).toMatchObject({
      name: 'Cloudy Cake',
      description: 'Ultra-léger et fondant.',
      images: ['/uploads/recipes/cloudy.jpg'],
      recommendations: ['À conserver au frais', 'Idéal avec un café'],
    });
    expect(item.variants[0]).toEqual({
      sizeName: 'Petit',
      portions: 8,
      weightGrams: 900,
      dimensions: 'Ø 20 cm',
      saleMode: 'À la pièce',
      price: 4, // 0,1 kg × 40 DT
    });
    const body = JSON.stringify(res.body);
    for (const secret of ['Cacao secret', 'ingredient', 'pricePerUnit', 'appliance', 'margin']) {
      expect([secret, body.toLowerCase().includes(secret.toLowerCase())]).toEqual([secret, false]);
    }
  });

  it('détail public et recherche', async () => {
    const one = await request(app).get(`/api/catalog/${cakeId}`);
    expect(one.status).toBe(200);
    expect(one.body.data.item.name).toBe('Cloudy Cake');
    expect(JSON.stringify(one.body)).not.toContain('Cacao');
    expect((await request(app).get('/api/catalog/pas-un-id')).status).toBe(404);
    const inactive = await Recipe.findOne({ name: 'Ancienne recette' });
    expect((await request(app).get(`/api/catalog/${inactive!._id}`)).status).toBe(404);
    const search = await request(app).get('/api/catalog?search=cloudy');
    expect(search.body.data.items).toHaveLength(1);
    const none = await request(app).get('/api/catalog?search=(tarte');
    expect(none.status).toBe(200); // caractère spécial sans erreur
    expect(none.body.data.items).toHaveLength(0);
  });

  it('prix masqués si l’atelier le décide (Paramètres)', async () => {
    const put = await request(app).put('/api/settings').set(auth).send({ catalogShowPrices: 0 });
    expect(put.status).toBe(200);
    const res = await request(app).get('/api/catalog');
    expect(res.body.data.showPrices).toBe(false);
    expect(res.body.data.items[0].variants[0].price).toBeNull();
    await request(app).put('/api/settings').set(auth).send({ catalogShowPrices: 1 });
  });

  it('commande publique : la réponse est un résumé, sans composition', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        clientName: 'Sana',
        clientPhone: '22333444',
        items: [{ recipeId: cakeId, variantIndex: 0, quantity: 2 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.order).toMatchObject({
      totalPrice: 8,
      items: [{ name: 'Cloudy Cake', sizeName: 'Petit', quantity: 2, price: 4 }],
    });
    const body = JSON.stringify(res.body);
    for (const secret of ['Cacao', 'priceSnapshot', 'ingredientsCost', 'margin', 'clientPhone']) {
      expect([secret, body.includes(secret)]).toEqual([secret, false]);
    }
  });

  it('composition et détail du calcul réservés à l’admin', async () => {
    expect((await request(app).get('/api/recipes')).status).toBe(401);
    expect((await request(app).get(`/api/recipes/${cakeId}`)).status).toBe(401);
    const admin = await request(app).get(`/api/recipes/${cakeId}`).set(auth);
    expect(admin.status).toBe(200);
    expect(admin.body.data.recipe.variants[0].ingredients).toHaveLength(1);
  });

  it('modifier la présentation sans toucher la composition ; duplication la garde', async () => {
    const res = await request(app)
      .put(`/api/recipes/${cakeId}`)
      .set(auth)
      .send({ recommendations: ['Se garde 3 jours'] });
    expect(res.status).toBe(200);
    expect(res.body.data.recipe.recommendations).toEqual(['Se garde 3 jours']);
    const dup = await request(app).post(`/api/recipes/${cakeId}/duplicate`).set(auth);
    const copy = await Recipe.findById(dup.body.data.recipe._id);
    expect(copy!.recommendations).toEqual(['Se garde 3 jours']);
    expect(copy!.variants[0]).toMatchObject({ weightGrams: 900, dimensions: 'Ø 20 cm' });
  });
});
