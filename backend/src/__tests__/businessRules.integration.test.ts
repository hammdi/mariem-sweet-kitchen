/**
 * MATRICE MÉTIER — 15 scénarios de bout en bout sur les vraies routes HTTP.
 *
 * Règles validées : la commande ne touche pas le stock ; le manque bloque
 * seulement la préparation ; la préparation consomme (une fois) ; le paiement
 * est indépendant de l'avancement ; l'annulation après préparation demande une
 * raison et ne rend rien automatiquement ; achats / dépenses / caisse cohérents ;
 * opérations sensibles idempotentes.
 *
 * Base dédiée (nom finissant par "_rules_test"), vidée avant et après.
 */
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const BASE_URI = process.env.MONGODB_TEST_URI || '';
const TEST_URI = BASE_URI.replace(/_test(\?|$)/, '_rules_test$1');
const enabled = BASE_URI !== '' && new URL(TEST_URI).pathname.endsWith('_rules_test');
const describeDb = enabled ? describe : describe.skip;

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-de-plus-de-32-caracteres-ok';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = require('../app').default;
import { User } from '../models/User';
import { Ingredient } from '../models/Ingredient';
import { Recipe } from '../models/Recipe';
import { Order } from '../models/Order';
import { Settings } from '../models/Settings';
import { StockHistory } from '../models/StockHistory';
import { PurchaseNeed } from '../models/PurchaseNeed';
import { Counter } from '../models/Counter';
import { CashMovement } from '../models/CashMovement';
import { PurchaseSource } from '../models/PurchaseSource';
import { IngredientPrice } from '../models/IngredientPrice';
import { IdempotencyRecord } from '../models/IdempotencyRecord';
import { Expense } from '../models/Expense';
import { idem } from '../tests/http';

const MODELS = [
  User,
  Ingredient,
  Recipe,
  Order,
  Settings,
  StockHistory,
  PurchaseNeed,
  Counter,
  CashMovement,
  PurchaseSource,
  IngredientPrice,
  IdempotencyRecord,
  Expense,
];
const clearAll = () =>
  Promise.all(MODELS.map((m) => (m as unknown as mongoose.Model<unknown>).deleteMany({})));
const inHours = (h: number) => new Date(Date.now() + h * 3600e3).toISOString();
const NOW = () => ({
  from: new Date(Date.now() - 3600e3).toISOString(),
  to: new Date(Date.now() + 3600e3).toISOString(),
});

describeDb('règles métier validées — matrice de 15 scénarios (intégration)', () => {
  let auth: { Authorization: string };
  const ids: Record<string, string> = {};
  const o: Record<string, any> = {};

  const stockOf = async (name: string) => (await Ingredient.findOne({ name }))!.stockQuantity;
  const setStatus = (id: string, status: string, reason?: string) =>
    request(app).put(`/api/orders/${id}/status`).set(auth).send({ status, reason });
  const createOrder = (clientName: string, quantity: number, date: string) =>
    request(app)
      .post('/api/orders/manual')
      .set(auth)
      .set(idem())
      .send({
        clientName,
        clientPhone: '22123456',
        requestedDate: date,
        items: [{ recipeId: ids.cake, variantIndex: 0, quantity }],
      });
  const purchase = (body: any, key?: string) =>
    request(app).post('/api/orders/shopping-list/purchase').set(auth).set(idem(key)).send(body);
  const pay = (id: string, body: any = {}) =>
    request(app).post(`/api/cash/orders/${id}/payment`).set(auth).set(idem()).send(body);
  const cash = async () =>
    (await request(app).get(`/api/cash?from=${NOW().from}&to=${NOW().to}`).set(auth)).body.data
      .summary;
  const amandes = async () =>
    (await request(app).get('/api/orders/shopping-list').set(auth)).body.data.shoppingList.find(
      (i: any) => i.name === 'Amandes'
    );
  const deductions = (orderId: string) =>
    StockHistory.countDocuments({ orderId, type: 'deduction' });
  const stockNeeds = async (id: string) =>
    (await request(app).get(`/api/orders/${id}/stock-needs`).set(auth)).body.data;

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
      { key: 'marginPercent', value: 15, label: 's' },
      { key: 'actionAlertHours', value: 24, label: 's' },
    ]);
    const [am, farine] = await Ingredient.insertMany([
      { name: 'Amandes', unit: 'kg', pricePerUnit: 20, stockQuantity: 0, category: 'other' },
      { name: 'Farine', unit: 'kg', pricePerUnit: 1, stockQuantity: 10, category: 'base' },
    ]);
    const carrefour = await PurchaseSource.create({ name: 'Carrefour', type: 'supermarket' });
    await IngredientPrice.create({
      ingredientId: am._id,
      sourceId: carrefour._id,
      price: 25,
      unit: 'kg',
      lastCheckedAt: new Date(),
      history: [],
    });
    // 1 lot = 100 g d'amandes + 200 g de farine
    const cake = await Recipe.create({
      name: 'Cake amandes',
      variants: [
        {
          sizeName: 'Moyen',
          portions: 8,
          ingredients: [
            { ingredientId: am._id, quantity: 100, unit: 'g' },
            { ingredientId: farine._id, quantity: 200, unit: 'g' },
          ],
          appliances: [],
        },
      ],
    });
    Object.assign(ids, {
      amandes: am._id.toString(),
      farine: farine._id.toString(),
      carrefour: carrefour._id.toString(),
      cake: cake._id.toString(),
    });
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await clearAll();
      await mongoose.disconnect();
    }
  });

  it('1. commande avec ingrédient manquant : créée, besoin + alerte, stock intact, préparation bloquée', async () => {
    const a = await createOrder('Ahmed', 3, inHours(10)); // 0,3 kg
    const b = await createOrder('Sami', 7, inHours(20)); // 0,7 kg
    const c = await createOrder('Lina', 5, inHours(60)); // 0,5 kg
    expect([a.status, b.status, c.status]).toEqual([201, 201, 201]);
    o.a = a.body.data.order;
    o.b = b.body.data.order;
    o.c = c.body.data.order;
    for (const x of [o.a, o.b, o.c]) {
      expect((await setStatus(x._id, 'confirmed')).status).toBe(200);
    }
    expect(await stockOf('Amandes')).toBe(0);
    expect(await stockOf('Farine')).toBe(10);
    expect(await StockHistory.countDocuments({ type: 'deduction' })).toBe(0);
    expect(await PurchaseNeed.countDocuments({ status: 'open', ingredientId: ids.amandes })).toBe(
      3
    );
    expect((await stockNeeds(o.a._id)).canStartPreparation).toBe(false);
    const action = await request(app).get('/api/orders/action-required').set(auth);
    expect(action.body.data.orders.map((x: any) => x.clientName)).toEqual([
      'Ahmed',
      'Sami',
      'Lina',
    ]);
    // la liste des commandes signale le manque
    const list = await request(app).get('/api/orders?limit=10').set(auth);
    expect(list.body.data.stockAlerts[o.a._id]).toMatchObject({
      missingCount: 1,
      ingredients: ['Amandes'],
    });
  });

  it('2. liste de courses : regroupée par ingrédient, détail par commande, priorité, source, prix, coût', async () => {
    const item = await amandes();
    expect(item).toMatchObject({
      unit: 'kg',
      toBuy: 1.5,
      missing: 1.5,
      needed: 1.5,
      inStock: 0,
      priority: 'urgent', // Ahmed dans 10 h
      priceBasis: 'source', // pas encore d'achat : meilleur prix constaté
      pricePerUnit: 25,
      estimatedCost: 37.5,
      lastPurchase: null,
    });
    expect(item.sources.map((s: any) => [s.name, s.price])).toEqual([['Carrefour', 25]]);
    expect(item.orders.map((x: any) => [x.clientName, x.missingQty])).toEqual([
      ['Ahmed', 0.3],
      ['Sami', 0.7],
      ['Lina', 0.5],
    ]);
  });

  it('3. stock insuffisant : préparation refusée, rien n’est consommé', async () => {
    const r = await setStatus(o.a._id, 'preparing');
    expect(r.status).toBe(400);
    expect(r.body.message).toContain('Amandes');
    expect(await stockOf('Farine')).toBe(10);
    expect((await Order.findById(o.a._id))!.status).toBe('confirmed');
  });

  it('4. achat partiel (1 kg, caisse) : stock +, caisse −, commandes débloquées par date de besoin', async () => {
    const r = await purchase({
      paymentMethod: 'cash_register',
      sourceId: ids.carrefour,
      purchases: [{ ingredientId: ids.amandes, quantity: 1, unitPrice: 25 }],
    });
    expect(r.status).toBe(200);
    expect(await stockOf('Amandes')).toBe(1);
    expect(r.body.data.cashMovement).toMatchObject({ direction: 'out', amount: 25 });
    expect(r.body.data.unblockedOrders.map((u: any) => [u.clientName, u.fully]).sort()).toEqual([
      ['Ahmed', true],
      ['Sami', true],
    ]);
    const item = await amandes();
    expect(item.orders.map((x: any) => [x.clientName, x.missingQty])).toEqual([['Lina', 0.5]]);
    // dernier prix réellement payé → base du coût estimé
    expect(item).toMatchObject({
      priceBasis: 'last_purchase',
      pricePerUnit: 25,
      estimatedCost: 12.5,
    });
    expect(item.lastPurchase).toMatchObject({ unitPrice: 25, sourceName: 'Carrefour' });
    // Lina : le stock réel (1 kg) suffirait, mais il est attribué à Ahmed et Sami (plus proches)
    const lina = await stockNeeds(o.c._id);
    expect(lina.stockNeeds.find((n: any) => n.name === 'Amandes')).toMatchObject({
      status: 'missing',
      missing: 0.5,
    });
    expect(lina.usesReservedStock).toBe(true);
  });

  it('5. idempotence : double clic / renvoi sur un achat → un seul achat, une seule sortie de caisse', async () => {
    const body = {
      paymentMethod: 'cash_register',
      purchases: [{ ingredientId: ids.farine, quantity: 1, unitPrice: 1 }],
    };
    const before = { stock: await stockOf('Farine'), out: (await cash()).totalOut };
    const [r1, r2] = await Promise.all([purchase(body, 'achat-1'), purchase(body, 'achat-1')]);
    expect([
      [200, 200],
      [200, 409],
    ]).toContainEqual([r1.status, r2.status].sort());
    const replay = await purchase(body, 'achat-1');
    expect(replay.status).toBe(200);
    expect(replay.headers['idempotent-replay']).toBe('true');
    expect(await stockOf('Farine')).toBe(before.stock + 1);
    expect((await cash()).totalOut).toBe(before.out + 1);
    // même clé, autre contenu → refus ; sans clé → refus ; rien d'enregistré
    expect(
      (await purchase({ ...body, purchases: [{ ...body.purchases[0], quantity: 9 }] }, 'achat-1'))
        .status
    ).toBe(422);
    const noKey = await request(app)
      .post('/api/orders/shopping-list/purchase')
      .set(auth)
      .send(body);
    expect(noKey.status).toBe(400);
    expect(await stockOf('Farine')).toBe(before.stock + 1);

    // entrée de caisse : même principe
    const entry = { type: 'other_income', amount: 5, description: 'Pourboire' };
    const [e1, e2] = await Promise.all([
      request(app).post('/api/cash').set(auth).set(idem('entree-1')).send(entry),
      request(app).post('/api/cash').set(auth).set(idem('entree-1')).send(entry),
    ]);
    expect([e1.status, e2.status]).toContain(201);
    expect(await CashMovement.countDocuments({ type: 'other_income' })).toBe(1);
  });

  it('6. préparation d’une commande NON payée : autorisée, stock consommé, caisse inchangée', async () => {
    const cashBefore = await cash();
    const forecast = (await stockNeeds(o.a._id)).stockNeeds.find((n: any) => n.name === 'Amandes');
    const r = await setStatus(o.a._id, 'preparing');
    expect(r.status).toBe(200);
    expect(r.body.data.order).toMatchObject({ status: 'preparing', paymentStatus: 'unpaid' });
    // 7. prévision = consommation réelle
    expect(await stockOf('Amandes')).toBe(1 - forecast.needed);
    expect(forecast.needed).toBe(0.3);
    expect(await cash()).toEqual(cashBefore);
  });

  it('7/8. aucune double déduction : allers-retours prête ↔ préparation', async () => {
    for (const st of ['ready', 'preparing', 'ready']) {
      expect((await setStatus(o.a._id, st)).status).toBe(200);
    }
    expect(await deductions(o.a._id)).toBe(2); // 2 ingrédients, une seule fois chacun
    expect(await stockOf('Amandes')).toBe(0.7);
    expect((await setStatus(o.a._id, 'confirmed')).status).toBe(400); // consommé : pas de retour
  });

  it('9. vente non payée : CA = montant, à encaisser = montant, caisse inchangée', async () => {
    const order = (await Order.findById(o.a._id))!;
    const receivables = (await request(app).get('/api/cash/receivables').set(auth)).body.data;
    const line = receivables.orders.find((x: any) => x._id === o.a._id);
    expect(line.remaining).toBe(order.totalPrice);
    expect(await CashMovement.countDocuments({ orderId: o.a._id })).toBe(0);
  });

  it('10. paiement APRÈS préparation : caisse +, à encaisser −, avancement inchangé, puis remise', async () => {
    const before = await cash();
    const total = (await Order.findById(o.a._id))!.totalPrice;
    expect((await pay(o.a._id)).status).toBe(201);
    const after = await cash();
    expect(after.totalIn).toBe(Math.round((before.totalIn + total) * 1000) / 1000);
    expect(after.outstanding).toBe(Math.round((before.outstanding - total) * 1000) / 1000);
    const paid = (await Order.findById(o.a._id))!;
    expect(paid).toMatchObject({ status: 'ready', paymentStatus: 'paid' });
    const delivered = await setStatus(o.a._id, 'delivered');
    expect(delivered.body.data.order.status).toBe('delivered');
    expect(delivered.body.data.order.deliveredAt).toBeTruthy();
  });

  it('11. paiement AVANT préparation : payée + confirmée, puis préparation possible', async () => {
    expect((await pay(o.b._id, { amount: 5 })).status).toBe(201); // acompte
    expect((await Order.findById(o.b._id))!).toMatchObject({
      status: 'confirmed',
      paymentStatus: 'partial',
      amountPaid: 5,
    });
    expect((await setStatus(o.b._id, 'paid')).status).toBe(400); // « Payée » n'est plus une étape
    expect((await setStatus(o.b._id, 'preparing')).status).toBe(200);
    expect(await stockOf('Amandes')).toBe(0);
  });

  it('12. annulation AVANT préparation : besoins libérés, aucun mouvement de stock', async () => {
    const stockBefore = await stockOf('Amandes');
    expect((await setStatus(o.c._id, 'cancelled')).status).toBe(200); // raison facultative
    expect(await amandes()).toBeUndefined();
    expect((await PurchaseNeed.findOne({ orderId: o.c._id }))!.status).toBe('cancelled');
    expect(await stockOf('Amandes')).toBe(stockBefore);
    expect(await StockHistory.countDocuments({ orderId: o.c._id })).toBe(0);
  });

  it('13. annulation APRÈS début de préparation : raison obligatoire, ingrédients non rendus', async () => {
    expect((await setStatus(o.b._id, 'cancelled')).status).toBe(400);
    const r = await setStatus(o.b._id, 'cancelled', 'Client a annule le mariage');
    expect(r.status).toBe(200);
    expect(r.body.data.order).toMatchObject({
      cancellationReason: 'Client a annule le mariage',
      cancelledAfterPreparation: true,
      cancelledBy: 'admin@test.tn',
    });
    expect(await stockOf('Amandes')).toBe(0); // consommés, pas de retour automatique
    // l'acompte reste en caisse jusqu'au remboursement explicite
    expect((await Order.findById(o.b._id))!.amountPaid).toBe(5);
    // remise en stock impossible sur une commande non annulée (remise / en préparation)
    const onDelivered = await request(app)
      .post(`/api/orders/${o.a._id}/restore-stock`)
      .set(auth)
      .set(idem())
      .send({ reason: 'test' });
    expect(onDelivered.status).toBe(400);
    expect((await Order.findById(o.a._id))!.stockDeducted).toBe(true);
    // remise exceptionnelle sur la commande annulée : tracée
    const restored = await request(app)
      .post(`/api/orders/${o.b._id}/restore-stock`)
      .set(auth)
      .set(idem())
      .send({ reason: 'Pate pas encore faite' });
    expect(restored.status).toBe(200);
    expect(await stockOf('Amandes')).toBe(0.7);
    expect(
      await StockHistory.findOne({ orderId: o.b._id, type: 'restore', ingredientName: 'Amandes' })
    ).toMatchObject({ note: 'Pate pas encore faite', stockBefore: 0, stockAfter: 0.7 });
  });

  it('14. dépenses : hors caisse sans toucher la liquidité, caisse avec sortie, annulation tracée', async () => {
    const before = await cash();
    const personal = await request(app)
      .post('/api/expenses')
      .set(auth)
      .set(idem())
      .send({ amount: 12, description: 'Boites a gateaux', paymentMethod: 'personal' });
    expect(personal.status).toBe(201);
    expect(personal.body.data.expense.cashMovementId).toBeNull();
    expect(await cash()).toEqual(before);

    const key = 'depense-gaz';
    const body = { amount: 8, description: 'Bouteille de gaz', paymentMethod: 'cash_register' };
    const [g1, g2] = await Promise.all([
      request(app).post('/api/expenses').set(auth).set(idem(key)).send(body),
      request(app).post('/api/expenses').set(auth).set(idem(key)).send(body),
    ]);
    expect([g1.status, g2.status]).toContain(201);
    expect(await Expense.countDocuments({ description: 'Bouteille de gaz' })).toBe(1);
    expect((await cash()).totalOut).toBe(Math.round((before.totalOut + 8) * 1000) / 1000);

    const gaz = (await Expense.findOne({ description: 'Bouteille de gaz' }))!;
    // la sortie liée ne se corrige pas « à côté » de la dépense
    const fix = await request(app)
      .post(`/api/cash/${gaz.cashMovementId}/correct`)
      .set(auth)
      .set(idem())
      .send({ reason: 'test' });
    expect(fix.status).toBe(400);
    const cancel = await request(app)
      .post(`/api/expenses/${gaz._id}/cancel`)
      .set(auth)
      .set(idem())
      .send({ reason: 'Saisie en double' });
    expect(cancel.status).toBe(200);
    expect((await cash()).totalOut).toBe(before.totalOut);

    const stats = (
      await request(app)
        .get(`/api/statistics?from=${NOW().from}&to=${NOW().to}&tz=Africa/Tunis`)
        .set(auth)
    ).body.data;
    expect(stats.expenses).toEqual({
      total: 12,
      count: 1,
      byMethod: { personal: { total: 12, count: 1 } },
    });
  });

  it('15. correction de stock (perte / casse) : raison obligatoire, tracée, jamais silencieuse', async () => {
    const adjust = (body: any) =>
      request(app)
        .post(`/api/ingredients/${ids.farine}/stock-adjustment`)
        .set(auth)
        .set(idem())
        .send(body);
    const before = await stockOf('Farine');
    expect((await adjust({ newQuantity: before - 1 })).status).toBe(400);
    const r = await adjust({ newQuantity: before - 1, reason: 'breakage', note: 'Sac perce' });
    expect(r.status).toBe(201);
    expect(r.body.data.entry).toMatchObject({
      type: 'adjustment',
      reason: 'breakage',
      stockBefore: before,
      stockAfter: before - 1,
      quantity: -1,
      note: 'Sac perce',
      createdBy: 'admin@test.tn',
    });
    expect(await stockOf('Farine')).toBe(before - 1);
    expect(
      (
        await request(app)
          .put(`/api/ingredients/${ids.farine}`)
          .set(auth)
          .send({ stockQuantity: 50 })
      ).status
    ).toBe(400);
    expect(await stockOf('Farine')).toBe(before - 1);
  });
});
