/**
 * Tests d'intégration : vraies routes HTTP (supertest) + vraie base MongoDB.
 *
 * Exécutés seulement si MONGODB_TEST_URI est défini ET pointe vers une base
 * dont le nom finit par "_test" (garde-fou : la base est vidée).
 *   MONGODB_TEST_URI=mongodb://admin:***@localhost:27017/mariem_kitchen_test?authSource=admin
 */
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const TEST_URI = process.env.MONGODB_TEST_URI || '';
const dbName = TEST_URI ? new URL(TEST_URI).pathname.slice(1) : '';
const enabled = TEST_URI !== '' && dbName.endsWith('_test');
const describeDb = enabled ? describe : describe.skip;

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-de-plus-de-32-caracteres-ok';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = require('../app').default;
import { User } from '../models/User';
import { Ingredient } from '../models/Ingredient';
import { Appliance } from '../models/Appliance';
import { Recipe } from '../models/Recipe';
import { Order } from '../models/Order';
import { Settings } from '../models/Settings';
import { StockHistory } from '../models/StockHistory';
import { Client } from '../models/Client';
import { PurchaseNeed } from '../models/PurchaseNeed';
import { Counter } from '../models/Counter';
import { CashMovement } from '../models/CashMovement';
import { IdempotencyRecord } from '../models/IdempotencyRecord';
import { deductStockForOrder } from '../services/stockMovementService';
import { idem } from '../tests/http';

const MODELS = [
  User,
  Ingredient,
  Appliance,
  Recipe,
  Order,
  Settings,
  StockHistory,
  Client,
  PurchaseNeed,
  Counter,
  CashMovement,
  IdempotencyRecord,
];
const clearAll = () =>
  Promise.all(MODELS.map((m) => (m as unknown as mongoose.Model<unknown>).deleteMany({})));

describeDb('commandes et stock (intégration)', () => {
  let auth: { Authorization: string };
  let ids: Record<string, string> = {};

  const stockOf = async (name: string) => (await Ingredient.findOne({ name }))!.stockQuantity;
  const deductions = (orderId: string) =>
    StockHistory.countDocuments({ orderId, type: 'deduction' });
  const setStatus = (id: string, status: string, reason?: string) =>
    request(app).put(`/api/orders/${id}/status`).set(auth).send({ status, reason });
  const restore = (id: string, reason = 'Rien n a ete prepare') =>
    request(app).post(`/api/orders/${id}/restore-stock`).set(auth).set(idem()).send({ reason });
  const createOrder = (items: any[]) =>
    request(app).post('/api/orders/manual').set(auth).set(idem()).send({
      clientName: 'Test',
      clientPhone: '22123456',
      items,
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

    await Settings.insertMany([
      { key: 'stegTariff', value: 0.235, label: 's' },
      { key: 'waterForfaitSmall', value: 0.3, label: 's' },
      { key: 'waterForfaitLarge', value: 0.5, label: 's' },
      { key: 'marginPercent', value: 15, label: 's' },
    ]);
    const [farine, oeufs, chocolat] = await Ingredient.insertMany([
      { name: 'Farine', unit: 'kg', pricePerUnit: 0.8, stockQuantity: 2, category: 'base' },
      { name: 'Oeufs', unit: 'piece', pricePerUnit: 0.2, stockQuantity: 12, category: 'dairy' },
      {
        name: 'Chocolat',
        unit: 'kg',
        pricePerUnit: 20,
        stockQuantity: 1,
        category: 'flavoring',
        minStock: 0.5,
      },
    ]);
    const four = await Appliance.create({
      name: 'Four',
      powerConsumption: 2000,
      unit: 'W',
      category: 'cooking',
    });
    const cake = await Recipe.create({
      name: 'Cake',
      variants: [
        {
          sizeName: 'Petit',
          portions: 6,
          ingredients: [
            { ingredientId: farine._id, quantity: 250, unit: 'g' },
            { ingredientId: oeufs._id, quantity: 2, unit: 'piece' },
          ],
          appliances: [{ applianceId: four._id, duration: 45 }],
        },
      ],
    });
    const muffins = await Recipe.create({
      name: 'Muffins',
      variants: [
        {
          sizeName: '6 pieces',
          portions: 6,
          ingredients: [
            { ingredientId: farine._id, quantity: 100, unit: 'g' },
            { ingredientId: chocolat._id, quantity: 50, unit: 'g' },
            { ingredientId: oeufs._id, quantity: 1, unit: 'piece' },
          ],
          appliances: [{ applianceId: four._id, duration: 25 }],
        },
      ],
    });
    ids = {
      farine: farine._id.toString(),
      oeufs: oeufs._id.toString(),
      chocolat: chocolat._id.toString(),
      cake: cake._id.toString(),
      muffins: muffins._id.toString(),
    };
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await clearAll();
      await mongoose.disconnect();
    }
  });

  it('prix : 250 g de farine à 0,80 DT/kg coûtent 0,20 DT', async () => {
    const res = await request(app)
      .post('/api/prices/calculate')
      .send({ recipeId: ids.cake, variantIndex: 0 });
    expect(res.status).toBe(200);
    const farine = res.body.data.ingredientsDetail.find((d: any) => d.name === 'Farine');
    expect(farine.cost).toBe(0.2);
    expect(res.body.data.ingredientsCost).toBe(0.6); // 0,20 + 2 × 0,20
  });

  it('commande simple : 2 kg − 250 g = 1,75 kg, prévision = déduction', async () => {
    const created = await createOrder([{ recipeId: ids.cake, variantIndex: 0, quantity: 1 }]);
    expect(created.status).toBe(201);
    const id = created.body.data.order._id;

    const forecast = await request(app).get(`/api/orders/${id}/stock-needs`).set(auth);
    const farineNeed = forecast.body.data.stockNeeds.find((n: any) => n.name === 'Farine');
    expect(farineNeed).toMatchObject({ unit: 'kg', stock: 2, needed: 0.25, remaining: 1.75 });

    for (const s of ['confirmed', 'preparing']) {
      expect((await setStatus(id, s)).status).toBe(200);
    }
    expect(await stockOf('Farine')).toBe(1.75);
    expect(await stockOf('Farine')).toBe(farineNeed.remaining);
    const entry = await StockHistory.findOne({ orderId: id, ingredientName: 'Farine' });
    expect(entry).toMatchObject({ type: 'deduction', quantity: 0.25, unit: 'kg' });

    // remettre le stock pour les tests suivants (et tester la restauration)
    expect((await setStatus(id, 'cancelled', 'Erreur de saisie')).status).toBe(200);
    const restored = await restore(id);
    expect(restored.status).toBe(200);
    expect(await stockOf('Farine')).toBe(2);
  });

  describe('commande avec plusieurs produits', () => {
    let id: string;
    let expected: Record<string, number>;

    it('création + prévision', async () => {
      const res = await createOrder([
        { recipeId: ids.cake, variantIndex: 0, quantity: 1 },
        { recipeId: ids.muffins, variantIndex: 0, quantity: 2 },
      ]);
      expect(res.status).toBe(201);
      id = res.body.data.order._id;
      expect(await deductions(id)).toBe(0); // la création ne touche pas au stock

      const forecast = await request(app).get(`/api/orders/${id}/stock-needs`).set(auth);
      const needs = forecast.body.data.stockNeeds;
      expected = Object.fromEntries(needs.map((n: any) => [n.name, n.remaining]));
      // Farine 250 g + 2 × 100 g = 0,45 kg ; Oeufs 2 + 2 ; Chocolat 2 × 50 g = 0,1 kg
      expect(needs.find((n: any) => n.name === 'Farine')).toMatchObject({
        needed: 0.45,
        remaining: 1.55,
      });
      expect(needs.find((n: any) => n.name === 'Oeufs')).toMatchObject({ needed: 4, remaining: 8 });
      expect(needs.find((n: any) => n.name === 'Chocolat')).toMatchObject({
        needed: 0.1,
        remaining: 0.9,
      });
    });

    it('changements de statut sans préparation : aucune déduction', async () => {
      expect((await setStatus(id, 'confirmed')).status).toBe(200);
      expect((await setStatus(id, 'pending')).status).toBe(200);
      expect((await setStatus(id, 'confirmed')).status).toBe(200);
      expect(await stockOf('Farine')).toBe(2);
      expect(await deductions(id)).toBe(0);
    });

    it('préparation : stock réel = reste prévu', async () => {
      expect((await setStatus(id, 'preparing')).status).toBe(200);
      for (const [name, remaining] of Object.entries(expected)) {
        expect(await stockOf(name)).toBe(remaining);
      }
      expect((await Order.findById(id))!.stockDeducted).toBe(true);
    });

    it('répétition / retour en arrière : jamais de 2e déduction', async () => {
      const count = await deductions(id);
      for (const st of ['ready', 'preparing', 'ready', 'preparing', 'preparing']) {
        expect([st, (await setStatus(id, st)).status]).toEqual([st, 200]);
      }
      // la préparation a consommé le stock : pas de retour à « Confirmée »
      expect((await setStatus(id, 'confirmed')).status).toBe(400);
      // bouton "Ingrédients prêts" sur une commande déjà déduite
      const ready = await request(app)
        .put(`/api/orders/${id}`)
        .set(auth)
        .send({ ingredientsReady: true });
      expect(ready.status).toBe(200);
      expect(ready.body.data.order.status).toBe('preparing');
      expect(await deductions(id)).toBe(count);
      for (const [name, remaining] of Object.entries(expected)) {
        expect(await stockOf(name)).toBe(remaining);
      }
    });

    it('annulation : pas de remise automatique, remise explicite tracée, une seule fois', async () => {
      // après le début de la préparation, la raison est obligatoire
      const noReason = await setStatus(id, 'cancelled');
      expect(noReason.status).toBe(400);
      expect(noReason.body.message).toContain('raison');
      expect((await setStatus(id, 'cancelled', 'Client injoignable')).status).toBe(200);
      const cancelled = (await Order.findById(id))!;
      expect(cancelled).toMatchObject({
        cancellationReason: 'Client injoignable',
        cancelledAfterPreparation: true,
        stockDeducted: true,
      });
      expect(await stockOf('Farine')).toBe(1.55); // décision métier : pas de remise automatique

      // commande annulée ayant consommé du stock : réactivation refusée
      expect((await setStatus(id, 'pending')).status).toBe(400);

      // remise exceptionnelle : raison obligatoire, tracée, une seule fois
      const noRestoreReason = await request(app)
        .post(`/api/orders/${id}/restore-stock`)
        .set(auth)
        .set(idem())
        .send({});
      expect(noRestoreReason.status).toBe(400);
      const r1 = await restore(id);
      expect(r1.body.data.restored).toHaveLength(3);
      const r2 = await restore(id);
      expect(r2.body.data.restored).toHaveLength(0);
      const trace = await StockHistory.findOne({ orderId: id, type: 'restore' });
      expect(trace).toMatchObject({ note: 'Rien n a ete prepare', createdBy: 'admin@test.tn' });
      expect(await stockOf('Farine')).toBe(2);
      expect(await stockOf('Oeufs')).toBe(12);
      expect(await stockOf('Chocolat')).toBe(1);
      expect(await StockHistory.countDocuments({ orderId: id, type: 'restore' })).toBe(3);
    });

    it('réactivation puis nouvelle préparation : une déduction nette', async () => {
      for (const s of ['pending', 'confirmed', 'preparing']) {
        expect((await setStatus(id, s)).status).toBe(200);
      }
      expect(await stockOf('Farine')).toBe(1.55);
      await setStatus(id, 'cancelled', 'Test de reactivation');
      await restore(id);
      expect(await stockOf('Farine')).toBe(2);
    });
  });

  it('deux déductions simultanées ne déduisent qu’une fois', async () => {
    const res = await createOrder([{ recipeId: ids.cake, variantIndex: 0, quantity: 1 }]);
    const id = res.body.data.order._id;
    const results = await Promise.all([deductStockForOrder(id), deductStockForOrder(id)]);
    expect(results.filter((r) => r.deducted)).toHaveLength(1);
    expect(await stockOf('Farine')).toBe(1.75);
    await setStatus(id, 'cancelled', 'Test simultane');
    await restore(id);
    expect(await stockOf('Farine')).toBe(2);
  });

  it('stock insuffisant : refus sans rien déduire', async () => {
    const res = await createOrder([{ recipeId: ids.muffins, variantIndex: 0, quantity: 30 }]); // 1,5 kg chocolat
    const id = res.body.data.order._id;
    await setStatus(id, 'confirmed');
    const r = await setStatus(id, 'preparing');
    expect(r.status).toBe(400);
    expect(r.body.message).toContain('Chocolat');
    expect(await stockOf('Chocolat')).toBe(1);
    expect(await deductions(id)).toBe(0);
    expect((await Order.findById(id))!.stockDeducted).toBe(false);
  });

  it('liste de courses : quantités dans l’unité du stock', async () => {
    const res = await createOrder([{ recipeId: ids.muffins, variantIndex: 0, quantity: 30 }]);
    const id = res.body.data.order._id;
    await setStatus(id, 'confirmed');
    const list = await request(app).get('/api/orders/shopping-list').set(auth);
    const choco = list.body.data.shoppingList.find((i: any) => i.name === 'Chocolat');
    // 2 commandes confirmées × 30 lots × 50 g = 3 kg ; stock 1 kg → 2 kg à acheter
    expect(choco).toMatchObject({ unit: 'kg', needed: 3, inStock: 1, toBuy: 2, estimatedCost: 40 });
  });

  it("ancienne commande : un changement de prix d'ingrédient ne modifie pas son prix", async () => {
    const res = await createOrder([{ recipeId: ids.cake, variantIndex: 0, quantity: 1 }]);
    const id = res.body.data.order._id;
    const before = res.body.data.order.totalPrice;
    await setStatus(id, 'confirmed');

    await request(app).put(`/api/ingredients/${ids.farine}`).set(auth).send({ pricePerUnit: 1.6 });

    // cocher "le client apporte les œufs" recalcule… avec les prix figés
    const upd = await request(app)
      .put(`/api/orders/${id}`)
      .set(auth)
      .send({ items: [{ index: 0, clientProvidedIngredients: [ids.oeufs] }] });
    const withoutEggs = upd.body.data.order.totalPrice;
    await request(app)
      .put(`/api/orders/${id}`)
      .set(auth)
      .send({ items: [{ index: 0, clientProvidedIngredients: [] }] });
    expect((await Order.findById(id))!.totalPrice).toBe(before);
    // œufs retirés : 2 × 0,20 DT × 1,15 = 0,46 DT de moins, farine toujours à 0,80
    expect(Math.round((before - withoutEggs) * 1000) / 1000).toBe(0.46);

    // une nouvelle commande prend le nouveau prix (+0,20 DT de farine × 1,15)
    const fresh = await createOrder([{ recipeId: ids.cake, variantIndex: 0, quantity: 1 }]);
    expect(Math.round((fresh.body.data.order.totalPrice - before) * 1000) / 1000).toBe(0.23);
    await request(app).put(`/api/ingredients/${ids.farine}`).set(auth).send({ pricePerUnit: 0.8 });
  });

  it('refuse une recette dont l’unité est incompatible', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .set(auth)
      .send({
        name: 'Mauvaise',
        variants: [
          {
            sizeName: 'Petit',
            portions: 6,
            ingredients: [{ ingredientId: ids.oeufs, quantity: 100, unit: 'g' }],
            appliances: [],
          },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Oeufs');
    expect(await Recipe.countDocuments({ name: 'Mauvaise' })).toBe(0);
  });

  it('seuil : alerte seulement si un seuil est défini', async () => {
    // isoler ce cas : les autres commandes actives se reservent sinon le stock
    await Order.updateMany(
      { status: { $in: ['pending', 'confirmed', 'paid'] } },
      { status: 'cancelled' }
    );
    const res = await createOrder([{ recipeId: ids.muffins, variantIndex: 0, quantity: 12 }]); // 600 g chocolat
    const forecast = await request(app)
      .get(`/api/orders/${res.body.data.order._id}/stock-needs`)
      .set(auth);
    const needs = forecast.body.data.stockNeeds;
    expect(needs.find((n: any) => n.name === 'Chocolat').status).toBe('low'); // reste 0,4 < seuil 0,5
    expect(needs.find((n: any) => n.name === 'Farine').status).toBe('ok'); // pas de seuil
    expect(needs.find((n: any) => n.name === 'Oeufs').status).toBe('ok'); // pas de seuil
  });

  it('sécurité : données sensibles réservées à l’admin', async () => {
    for (const url of [
      '/api/ingredients',
      `/api/ingredients/${ids.farine}`,
      '/api/ingredients/price-summary',
      `/api/ingredients/${ids.farine}/prices`,
      '/api/clients',
      '/api/purchase-sources',
      '/api/orders',
      '/api/orders/stock-history',
      '/api/orders/shopping-list',
      '/api/settings',
      '/api/prices/catalog',
    ]) {
      expect([url, (await request(app).get(url)).status]).toEqual([url, 401]);
    }
    expect((await request(app).post('/api/prices/quote').send({ items: [] })).status).toBe(401);
    expect((await request(app).post('/api/auth/register').send({})).status).toBe(401);

    const publicResponses: [string, request.Response][] = [
      ['/api/recipes', await request(app).get('/api/recipes')],
      ['/api/recipes/:id', await request(app).get(`/api/recipes/${ids.cake}`)],
      [
        '/api/prices/calculate',
        await request(app)
          .post('/api/prices/calculate')
          .send({ recipeId: ids.cake, variantIndex: 0 }),
      ],
      ['/api/appliances', await request(app).get('/api/appliances')],
      ['/api/availability/blocks', await request(app).get('/api/availability/blocks')],
    ];
    for (const [url, r] of publicResponses) {
      expect([url, r.status]).toEqual([url, 200]);
      const body = JSON.stringify(r.body);
      for (const secret of [
        'stockQuantity',
        'minStock',
        'supplier',
        'referencePriceHistory',
        'sourceId',
        'clientPhone',
      ]) {
        expect([url, secret, body.includes(`"${secret}"`)]).toEqual([url, secret, false]);
      }
    }
  });
});
