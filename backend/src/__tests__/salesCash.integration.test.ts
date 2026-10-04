/**
 * Ventes (CA) / Caisse (argent réel) / historique des commandes.
 * Vraies routes HTTP + base MongoDB dédiée (nom finissant par "_test", vidée).
 */
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const BASE_URI = process.env.MONGODB_TEST_URI || '';
const TEST_URI = BASE_URI.replace(/_test(\?|$)/, '_sales_test$1');
const enabled = BASE_URI !== '' && new URL(TEST_URI).pathname.endsWith('_sales_test');
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
import { Client } from '../models/Client';
import { PurchaseSource } from '../models/PurchaseSource';
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
  Client,
  PurchaseSource,
  IdempotencyRecord,
  Expense,
];
const clearAll = () =>
  Promise.all(MODELS.map((m) => (m as unknown as mongoose.Model<unknown>).deleteMany({})));

// Journée du 2 octobre 2026 à Tunis (UTC+1) = [01/10 23:00Z, 02/10 23:00Z[
const OCT2 = { from: '2026-10-01T23:00:00.000Z', to: '2026-10-02T23:00:00.000Z' };
const OCTOBER = { from: '2026-09-30T23:00:00.000Z', to: '2026-10-31T23:00:00.000Z' };

describeDb('ventes et caisse (intégration)', () => {
  let auth: { Authorization: string };
  const ids: Record<string, string> = {};
  const o: Record<string, any> = {};

  const setStatus = (id: string, status: string) =>
    request(app).put(`/api/orders/${id}/status`).set(auth).send({ status });
  const createOrder = (body: any) =>
    request(app).post('/api/orders/manual').set(auth).set(idem()).send(body);
  // Encaisser = action explicite, indépendante de l'avancement de la commande
  const pay = (id: string, body: any = {}, key?: string) =>
    request(app).post(`/api/cash/orders/${id}/payment`).set(auth).set(idem(key)).send(body);
  const sales = async (range: { from: string; to: string }, extra = '') =>
    (await request(app).get(`/api/sales?from=${range.from}&to=${range.to}${extra}`).set(auth)).body
      .data;
  const nowRange = () => ({
    from: new Date(Date.now() - 3600e3).toISOString(),
    to: new Date(Date.now() + 3600e3).toISOString(),
  });
  const cash = async (range = nowRange()) =>
    (await request(app).get(`/api/cash?from=${range.from}&to=${range.to}`).set(auth)).body.data;
  const payments = (orderId: string) =>
    CashMovement.countDocuments({ orderId, type: 'order_payment' });

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
    // Prix = coût des ingrédients (pas d'eau, d'électricité ni de marge) → montants exacts
    await Settings.insertMany(
      ['stegTariff', 'waterForfaitSmall', 'waterForfaitLarge', 'marginPercent'].map((key) => ({
        key,
        value: 0,
        label: key,
      }))
    );
    const [a, b, farine] = await Ingredient.insertMany([
      {
        name: 'Ingredient A',
        unit: 'kg',
        pricePerUnit: 43.6,
        stockQuantity: 100,
        category: 'base',
      },
      { name: 'Ingredient B', unit: 'kg', pricePerUnit: 25, stockQuantity: 100, category: 'base' },
      { name: 'Farine', unit: 'kg', pricePerUnit: 0.8, stockQuantity: 0, category: 'base' },
    ]);
    const recipe = (name: string, ingredientId: unknown) =>
      Recipe.create({
        name,
        variants: [
          {
            sizeName: 'Moyen',
            portions: 8,
            ingredients: [{ ingredientId, quantity: 1, unit: 'kg' }],
            appliances: [],
          },
        ],
      });
    ids.cake43 = (await recipe('Cake 43', a._id))._id.toString();
    ids.cake25 = (await recipe('Cake 25', b._id))._id.toString();
    ids.farine = farine._id.toString();
    const cafe = await Client.create({ type: 'cafe', name: 'Cafe du Port', phone: '+21671000000' });
    ids.cafe = cafe._id.toString();
    ids.source = (
      await PurchaseSource.create({ name: 'Grossiste', type: 'supplier' })
    )._id.toString();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await clearAll();
      await mongoose.disconnect();
    }
  });

  it('10. fuseau horaire : la date envoyée en ISO est stockée sans décalage', async () => {
    const res = await createOrder({
      clientName: 'Ahmed',
      clientPhone: '22123456',
      requestedDate: '2026-10-02T14:00:00.000Z', // 15:00 à Tunis
      items: [{ recipeId: ids.cake43, variantIndex: 0, quantity: 1 }],
    });
    expect(res.status).toBe(201);
    o.c21 = res.body.data.order;
    expect(new Date(o.c21.requestedDate).toISOString()).toBe('2026-10-02T14:00:00.000Z');
    expect(o.c21.totalPrice).toBe(43.6);
  });

  it('1/2/5. CMD-21 payée 43,60 + CMD-22 confirmée non payée 25 : CA ≠ caisse', async () => {
    o.c22 = (
      await createOrder({
        clientId: ids.cafe,
        requestedDate: '2026-10-02T16:00:00.000Z',
        items: [{ recipeId: ids.cake25, variantIndex: 0, quantity: 1 }],
      })
    ).body.data.order;

    // pas encore de vente : les deux sont "en attente"
    expect((await sales(OCT2)).summary.revenue).toBe(0);

    await setStatus(o.c21._id, 'confirmed');
    expect((await pay(o.c21._id)).status).toBe(201); // encaissement du reste dû
    await setStatus(o.c22._id, 'confirmed');

    const s = await sales(OCT2);
    expect(s.summary).toMatchObject({ count: 2, revenue: 68.6, collected: 43.6, remaining: 25 });
    const c22 = s.sales.find((x: any) => x._id === o.c22._id);
    expect(c22).toMatchObject({ paymentStatus: 'unpaid', remaining: 25, clientType: 'cafe' });
    const c21 = s.sales.find((x: any) => x._id === o.c21._id);
    expect(c21).toMatchObject({ paymentStatus: 'paid', paymentMethod: 'cash', amountPaid: 43.6 });

    const c = await cash();
    expect(c.summary.totalIn).toBe(43.6); // la caisse ne contient que l'argent reçu
    expect(c.movements.filter((m: any) => m.orderId === o.c22._id)).toHaveLength(0);
  });

  it('3. paiement → entrée de caisse tracée (type, montant, référence, utilisateur)', async () => {
    const m = await CashMovement.findOne({ orderId: o.c21._id });
    expect(m).toMatchObject({
      type: 'order_payment',
      direction: 'in',
      amount: 43.6,
      method: 'cash',
    });
    expect(m!.orderNumber).toBe(o.c21.orderNumber);
    expect(m!.createdBy.email).toBe('admin@test.tn');
  });

  it('12/13. paiement : jamais de double encaissement', async () => {
    // « Payée » n'est plus une étape de la commande : le paiement est une action à part
    expect((await setStatus(o.c21._id, 'paid')).status).toBe(400);
    expect(await payments(o.c21._id)).toBe(1);
    // sans clé d'idempotence : refusé, rien n'est enregistré
    const noKey = await request(app)
      .post(`/api/cash/orders/${o.c22._id}/payment`)
      .set(auth)
      .send({ amount: 10 });
    expect(noKey.status).toBe(400);
    // double clic sur "Encaisser" (même opération, requêtes simultanées) : un seul paiement
    const [r1, r2] = await Promise.all([
      pay(o.c22._id, { amount: 10 }, 'pay-c22'),
      pay(o.c22._id, { amount: 10 }, 'pay-c22'),
    ]);
    // le 2e reçoit soit la réponse du 1er (201, rejouée), soit « déjà en cours » (409)
    expect([
      [201, 201],
      [201, 409],
    ]).toContainEqual([r1.status, r2.status].sort());
    // renvoi de la même opération après coup : même réponse, rien de nouveau
    const replay = await pay(o.c22._id, { amount: 10 }, 'pay-c22');
    expect(replay.status).toBe(201);
    expect(replay.headers['idempotent-replay']).toBe('true');
    expect(await payments(o.c22._id)).toBe(1);
    expect((await Order.findById(o.c22._id))!).toMatchObject({
      amountPaid: 10,
      paymentStatus: 'partial',
    });
    // un montant supérieur au reste dû est refusé
    const over = await request(app)
      .post(`/api/cash/orders/${o.c22._id}/payment`)
      .set(auth)
      .send({ amount: 20 });
    expect(over.status).toBe(400);
  });

  it('6/7. plusieurs ventes et plusieurs périodes', async () => {
    const late = await createOrder({
      clientName: 'Sami',
      clientPhone: '22000001',
      requestedDate: '2026-10-02T23:30:00.000Z', // 3 octobre 00:30 à Tunis
      items: [{ recipeId: ids.cake25, variantIndex: 0, quantity: 2 }],
    });
    const nov = await createOrder({
      clientName: 'Lina',
      clientPhone: '22000002',
      requestedDate: '2026-11-05T10:00:00.000Z',
      items: [{ recipeId: ids.cake43, variantIndex: 0, quantity: 1 }],
    });
    o.late = late.body.data.order;
    o.nov = nov.body.data.order;
    await setStatus(o.late._id, 'confirmed');
    await setStatus(o.nov._id, 'confirmed');

    expect((await sales(OCT2)).summary.revenue).toBe(68.6); // 00:30 le 3/10 n'est pas le 2/10
    expect((await sales({ from: OCT2.to, to: '2026-10-03T23:00:00.000Z' })).summary.revenue).toBe(
      50
    );
    expect((await sales(OCTOBER)).summary).toMatchObject({ count: 3, revenue: 118.6 });
    expect(
      (await sales({ from: '2026-10-31T23:00:00.000Z', to: '2026-11-30T23:00:00.000Z' })).summary
        .revenue
    ).toBe(43.6);
    // filtres : café, recherche client, recherche CMD
    expect((await sales(OCTOBER, '&clientType=cafe')).summary.revenue).toBe(25);
    expect((await sales(OCTOBER, '&search=sam')).sales.map((x: any) => x.clientName)).toEqual([
      'Sami',
    ]);
    expect((await sales(OCTOBER, `&search=CMD-${o.c21.orderNumber}`)).sales).toHaveLength(1);
  });

  it('4. achat payé depuis la caisse → stock + prix réel + source + sortie de caisse', async () => {
    const before = (await cash()).summary.totalOut;
    const res = await request(app)
      .post(`/api/ingredients/${ids.farine}/purchases`)
      .set(auth)
      .set(idem())
      .send({
        paymentMethod: 'cash_register',
        quantity: 5,
        unitPrice: 0.9,
        sourceId: ids.source,
      });
    expect(res.status).toBe(201);
    expect((await Ingredient.findById(ids.farine))!.stockQuantity).toBe(5);
    expect(res.body.data.purchase).toMatchObject({
      unitPrice: 0.9,
      totalPrice: 4.5,
      sourceName: 'Grossiste',
    });
    expect(res.body.data.cashMovement).toMatchObject({
      type: 'purchase',
      direction: 'out',
      amount: 4.5,
    });
    expect(res.body.data.cashMovement.stockHistoryIds).toEqual([res.body.data.purchase._id]);

    // liste de courses : prix par ligne + une sortie pour le lot
    const batch = await request(app)
      .post('/api/orders/shopping-list/purchase')
      .set(auth)
      .set(idem())
      .send({
        paymentMethod: 'cash_register',
        sourceId: ids.source,
        purchases: [
          { ingredientId: ids.farine, quantity: 2, unitPrice: 1, name: 'Farine', unit: 'kg' },
        ],
      });
    expect(batch.body.data.cashMovement).toMatchObject({ amount: 2, sourceName: 'Grossiste' });
    // sans "payé depuis la caisse" : pas de mouvement
    // sans prix : refuse, l'argent du stock sort toujours de la caisse
    const noPrice = await request(app)
      .post(`/api/ingredients/${ids.farine}/purchases`)
      .set(auth)
      .set(idem())
      .send({ quantity: 1, paymentMethod: 'cash_register' });
    expect(noPrice.status).toBe(400);
    expect((await Ingredient.findById(ids.farine))!.stockQuantity).toBe(7);
    expect((await cash()).summary.totalOut).toBe(before + 6.5);
  });

  it('8. annulation puis remboursement explicite', async () => {
    await setStatus(o.c21._id, 'cancelled');
    let s = await sales(OCT2);
    expect(s.summary.revenue).toBe(25); // CMD-21 n'est plus une vente
    expect(s.summary.cancelledWithPayment).toEqual({ count: 1, amount: 43.6 }); // argent pas encore rendu
    const balanceBefore = (await cash()).summary.theoreticalBalance;

    const refund = await request(app)
      .post(`/api/cash/orders/${o.c21._id}/refund`)
      .set(auth)
      .set(idem())
      .send({ reason: 'Commande annulee par le client' });
    expect(refund.status).toBe(201);
    expect((await Order.findById(o.c21._id))!).toMatchObject({
      amountPaid: 0,
      paymentStatus: 'unpaid',
    });
    expect((await cash()).summary.theoreticalBalance).toBe(
      Math.round((balanceBefore - 43.6) * 1000) / 1000
    );
    s = await sales(OCT2);
    expect(s.summary.cancelledWithPayment.count).toBe(0);
    const again = await request(app)
      .post(`/api/cash/orders/${o.c21._id}/refund`)
      .set(auth)
      .set(idem())
      .send({});
    expect(again.status).toBe(400);
  });

  it('correction tracée : annulation + nouvelle valeur, jamais deux fois', async () => {
    const inc = await request(app)
      .post('/api/cash')
      .set(auth)
      .set(idem())
      .send({ type: 'other_income', amount: 10, description: 'Vente de pots' });
    const id = inc.body.data.movement._id;
    const inBefore = (await cash()).summary.totalIn;

    const fix = await request(app)
      .post(`/api/cash/${id}/correct`)
      .set(auth)
      .set(idem())
      .send({ amount: 12, reason: 'Erreur de saisie' });
    expect(fix.status).toBe(201);
    expect(fix.body.data.reversal).toMatchObject({ direction: 'out', amount: 10, reversalOf: id });
    expect(fix.body.data.replacement).toMatchObject({
      direction: 'in',
      amount: 12,
      replacementOf: id,
    });
    // entrées nettes : 10 annulés, 12 comptés
    expect((await cash()).summary.totalIn).toBe(Math.round((inBefore + 2) * 1000) / 1000);
    expect(
      (
        await request(app)
          .post(`/api/cash/${id}/correct`)
          .set(auth)
          .set(idem())
          .send({ reason: 'x' })
      ).status
    ).toBe(409);
    expect(await CashMovement.countDocuments()).toBeGreaterThan(0); // rien n'a été supprimé
  });

  it('solde : initial + entrées − sorties', async () => {
    const all = await cash({ from: '2000-01-01T00:00:00.000Z', to: '2100-01-01T00:00:00.000Z' });
    const { openingBalance, totalIn, totalOut, theoreticalBalance } = all.summary;
    expect(openingBalance).toBe(0);
    expect(theoreticalBalance).toBe(Math.round((totalIn - totalOut) * 1000) / 1000);
    const later = await cash({
      from: new Date(Date.now() + 2 * 3600e3).toISOString(),
      to: '2100-01-01T00:00:00.000Z',
    });
    expect(later.summary.openingBalance).toBe(theoreticalBalance); // solde initial = solde d'avant
  });

  it('9. historique des commandes : recherche CMD, client, statut, paiement, café, dates', async () => {
    const list = async (q: string) =>
      (await request(app).get(`/api/orders?limit=100${q}`).set(auth)).body.data;
    expect((await list(`&search=CMD-${o.nov.orderNumber}`)).orders.map((x: any) => x._id)).toEqual([
      o.nov._id,
    ]);
    expect((await list(`&search=${o.nov.orderNumber}`)).orders).toHaveLength(1);
    expect((await list('&search=lin')).orders.map((x: any) => x.clientName)).toEqual(['Lina']);
    expect((await list('&status=cancelled')).orders.map((x: any) => x._id)).toEqual([o.c21._id]);
    expect((await list('&paymentStatus=partial')).orders.map((x: any) => x._id)).toEqual([
      o.c22._id,
    ]);
    expect((await list('&clientType=cafe')).orders.map((x: any) => x.clientName)).toEqual([
      'Cafe du Port',
    ]);
    const byDate = await list(`&dateField=scheduled&from=${OCT2.from}&to=${OCT2.to}`);
    expect(byDate.orders).toHaveLength(2);
    expect(byDate.counts).toEqual({ cancelled: 1, confirmed: 1 });
  });

  it('11. sécurité : 401 sans authentification', async () => {
    for (const [method, url] of [
      ['get', `/api/sales?from=${OCT2.from}&to=${OCT2.to}`],
      ['get', `/api/cash?from=${OCT2.from}&to=${OCT2.to}`],
      ['post', '/api/cash'],
      ['get', `/api/cash/orders/${o.c22._id}`],
      ['post', `/api/cash/orders/${o.c22._id}/payment`],
      ['post', `/api/cash/orders/${o.c22._id}/refund`],
      ['get', `/api/dashboard/summary?from=${OCT2.from}&to=${OCT2.to}`],
      ['get', '/api/orders?search=Ahmed'],
    ] as const) {
      const r = await (request(app) as any)[method](url).send({});
      expect([url, r.status]).toEqual([url, 401]);
    }
    const pub = JSON.stringify((await request(app).get('/api/recipes')).body);
    for (const secret of [
      'amountPaid',
      'paymentStatus',
      'unitPrice',
      'totalPrice',
      'stockQuantity',
    ]) {
      expect([secret, pub.includes(`"${secret}"`)]).toEqual([secret, false]);
    }
  });

  it('tableau de bord : indicateurs du jour', async () => {
    const from = new Date(Date.now() - 12 * 3600e3).toISOString();
    const to = new Date(Date.now() + 12 * 3600e3).toISOString();
    const res = await request(app).get(`/api/dashboard/summary?from=${from}&to=${to}`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data.today.collected).toBe(10); // 43,60 encaissés puis remboursés + 10 de CMD-22
    expect(res.body.data.outstanding).toBe(15 + 50 + 43.6); // CMD-22 reste 15, Sami 50, Lina 43,60
    expect(res.body.data.cashBalance).toBe((await cash()).summary.theoreticalBalance);
  });
});
