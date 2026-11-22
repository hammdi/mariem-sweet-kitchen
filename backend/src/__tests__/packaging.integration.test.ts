/**
 * Emballages : gérés comme des ingrédients (sources, prix moyen, stock, achats)
 * mais choisis par article dans la commande, jamais dans une recette.
 * Vraies routes HTTP + base MongoDB dédiée (nom finissant par "_test", vidée).
 */
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const BASE_URI = process.env.MONGODB_TEST_URI || '';
const TEST_URI = BASE_URI.replace(/_test(\?|$)/, '_pack_test$1');
const enabled = BASE_URI !== '' && new URL(TEST_URI).pathname.endsWith('_pack_test');
const describeDb = enabled ? describe : describe.skip;

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-de-plus-de-32-caracteres-ok';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = require('../app').default;
import { User } from '../models/User';
import { Ingredient } from '../models/Ingredient';
import { IngredientPrice } from '../models/IngredientPrice';
import { Recipe } from '../models/Recipe';
import { Order } from '../models/Order';
import { Settings } from '../models/Settings';
import { StockHistory } from '../models/StockHistory';
import { PurchaseNeed } from '../models/PurchaseNeed';
import { Counter } from '../models/Counter';
import { CashMovement } from '../models/CashMovement';
import { PurchaseSource } from '../models/PurchaseSource';
import { IdempotencyRecord } from '../models/IdempotencyRecord';
import { idem } from '../tests/http';

const MODELS = [
  User,
  Ingredient,
  IngredientPrice,
  Recipe,
  Order,
  Settings,
  StockHistory,
  PurchaseNeed,
  Counter,
  CashMovement,
  PurchaseSource,
  IdempotencyRecord,
];
const clearAll = () =>
  Promise.all(MODELS.map((m) => (m as unknown as mongoose.Model<unknown>).deleteMany({})));

describeDb('emballages (intégration)', () => {
  let auth: { Authorization: string };
  const ids: Record<string, string> = {};
  let orderId: string;

  const createOrder = (packaging: unknown, quantity = 2) =>
    request(app)
      .post('/api/orders/manual')
      .set(auth)
      .set(idem())
      .send({
        clientName: 'Amira',
        clientPhone: '22111222',
        items: [{ recipeId: ids.cake, variantIndex: 0, quantity, packaging }],
      });

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
    ids.source = (
      await PurchaseSource.create({ name: 'Grossiste', type: 'supplier' })
    )._id.toString();
    const farine = await Ingredient.create({
      name: 'Farine',
      unit: 'kg',
      pricePerUnit: 2,
      stockQuantity: 10,
      category: 'base',
    });
    ids.farine = farine._id.toString();
    ids.cake = (
      await Recipe.create({
        name: 'Cake',
        variants: [
          {
            sizeName: '8 parts',
            portions: 8,
            ingredients: [{ ingredientId: farine._id, quantity: 500, unit: 'g' }],
            appliances: [],
          },
        ],
      })
    )._id.toString();
  });

  afterAll(async () => {
    await clearAll();
    await mongoose.disconnect();
  });

  it('crée un emballage avec sa source : compté à la pièce, prix = prix de la source', async () => {
    const res = await request(app).post('/api/ingredients').set(auth).send({
      name: 'Caissette',
      kind: 'packaging',
      packagingType: 'case',
      packagingUse: 'per_portion',
      unit: 'kg', // ignoré : un emballage se compte à la pièce
      category: 'other',
      sourceId: ids.source,
      sourcePrice: 0.5,
    });
    expect(res.status).toBe(201);
    const p = res.body.data.ingredient;
    expect(p).toMatchObject({
      kind: 'packaging',
      unit: 'piece',
      packagingUse: 'per_portion',
      priceBasis: 'sources',
      pricePerUnit: 0.5,
    });
    ids.caissette = p._id;
    await Ingredient.updateOne({ _id: ids.caissette }, { $set: { stockQuantity: 20 } });

    const box = await request(app).post('/api/ingredients').set(auth).send({
      name: 'Boîte à gâteau',
      kind: 'packaging',
      packagingType: 'box',
      category: 'other',
      pricePerUnit: 1.2,
    });
    expect(box.status).toBe(201);
    expect(box.body.data.ingredient.packagingUse).toBe('per_item');
    ids.box = box.body.data.ingredient._id;
  });

  it('refuse un type d’emballage inconnu', async () => {
    const res = await request(app)
      .post('/api/ingredients')
      .set(auth)
      .send({ name: 'Truc', kind: 'packaging', packagingType: 'fusée', pricePerUnit: 1 });
    expect(res.status).toBe(400);
  });

  it('listes séparées : ingrédients / emballages', async () => {
    const pack = await request(app).get('/api/ingredients?kind=packaging').set(auth);
    expect(pack.body.data.ingredients.map((i: any) => i.name).sort()).toEqual([
      'Boîte à gâteau',
      'Caissette',
    ]);
    const ing = await request(app).get('/api/ingredients?kind=ingredient').set(auth);
    expect(ing.body.data.ingredients.map((i: any) => i.name)).toEqual(['Farine']);
  });

  it('un emballage ne peut pas entrer dans une recette', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .set(auth)
      .send({
        name: 'Cake emballé',
        variants: [
          {
            sizeName: 'Std',
            portions: 1,
            ingredients: [{ ingredientId: ids.caissette, quantity: 1, unit: 'piece' }],
          },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/emballage/);
  });

  it('devis : 8 caissettes × 0,5 DT = 4 DT par cake, hors prix du produit', async () => {
    const res = await request(app)
      .post('/api/prices/quote')
      .set(auth)
      .send({
        items: [
          {
            recipeId: ids.cake,
            variantIndex: 0,
            quantity: 2,
            packaging: [{ packagingId: ids.caissette, quantity: 8 }],
          },
        ],
      });
    expect(res.status).toBe(200);
    const line = res.body.data.lines[0];
    expect(line.unitPrice).toBe(1); // 0,5 kg × 2 DT : le produit seul
    expect(line.packagingUnitCost).toBe(4);
    expect(line.portions).toBe(8);
    expect(line.lineTotal).toBe(10); // (1 + 4) × 2
    expect(res.body.data).toMatchObject({ productsTotal: 2, packagingTotal: 8, total: 10 });
    const need = res.body.data.stockNeeds.find((n: any) => n.ingredientId === ids.caissette);
    expect(need).toMatchObject({ needed: 16, stock: 20 });
  });

  it('commande : emballage figé sur l’article, total = produits + emballage', async () => {
    const bad = await createOrder([{ packagingId: ids.farine, quantity: 1 }]);
    expect(bad.status).toBe(400); // la farine n'est pas un emballage
    expect(await Order.countDocuments()).toBe(0);

    const res = await createOrder([{ packagingId: ids.caissette, quantity: 8 }]);
    expect(res.status).toBe(201);
    orderId = res.body.data.order._id;
    const order = (await Order.findById(orderId))!;
    expect(order.items[0].packaging).toEqual([
      expect.objectContaining({ name: 'Caissette', quantity: 8, unitPrice: 0.5 }),
    ]);
    expect(order.totalPrice).toBe(10);
  });

  it('le prix d’un emballage change : la commande garde son prix', async () => {
    const offer = await IngredientPrice.findOne({ ingredientId: ids.caissette });
    await request(app)
      .put(`/api/ingredients/${ids.caissette}/prices/${offer!._id}`)
      .set(auth)
      .send({ price: 0.6 });
    expect((await Ingredient.findById(ids.caissette))!.pricePerUnit).toBe(0.6);

    // quantité modifiée : prix figé conservé ; boîte ajoutée : prix actuel
    const res = await request(app)
      .put(`/api/orders/${orderId}/packaging`)
      .set(auth)
      .send({
        items: [
          {
            index: 0,
            packaging: [
              { packagingId: ids.caissette, quantity: 4 },
              { packagingId: ids.box, quantity: 1 },
            ],
          },
        ],
      });
    expect(res.status).toBe(200);
    const order = (await Order.findById(orderId))!;
    expect(order.items[0].packaging.map((p) => [p.name, p.quantity, p.unitPrice])).toEqual([
      ['Caissette', 4, 0.5],
      ['Boîte à gâteau', 1, 1.2],
    ]);
    // (1 + 4 × 0,5 + 1,2) × 2 = 8,4
    expect(order.totalPrice).toBeCloseTo(8.4, 3);
  });

  it('emballage manquant → liste de courses ; préparation → stock déduit', async () => {
    // pas de boîte en stock : elle doit apparaître dans les besoins d'achat
    const needs = await PurchaseNeed.find({ orderId, status: 'open' });
    expect(needs.map((n) => n.ingredientName)).toContain('Boîte à gâteau');

    await Ingredient.updateOne({ _id: ids.box }, { $set: { stockQuantity: 5 } });
    await request(app).put(`/api/orders/${orderId}/status`).set(auth).send({ status: 'confirmed' });
    const prep = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set(auth)
      .send({ status: 'preparing' });
    expect(prep.status).toBe(200);
    expect((await Ingredient.findById(ids.caissette))!.stockQuantity).toBe(12); // 20 − 4 × 2
    expect((await Ingredient.findById(ids.box))!.stockQuantity).toBe(3); // 5 − 1 × 2
  });

  it('préparation commencée : l’emballage n’est plus modifiable', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}/packaging`)
      .set(auth)
      .send({ items: [{ index: 0, packaging: [] }] });
    expect(res.status).toBe(400);
  });

  it('refuse un emballage en double ou une quantité invalide', async () => {
    const dup = await createOrder([
      { packagingId: ids.box, quantity: 1 },
      { packagingId: ids.box, quantity: 2 },
    ]);
    expect(dup.status).toBe(400);
    const zero = await createOrder([{ packagingId: ids.box, quantity: 0 }]);
    expect(zero.status).toBe(400);
  });
});
