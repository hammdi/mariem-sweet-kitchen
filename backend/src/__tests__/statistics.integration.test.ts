/**
 * Page Statistiques : agrégations cohérentes avec Ventes (CA) et Caisse.
 * Vraies routes HTTP + base MongoDB dédiée (nom finissant par "_test", vidée).
 */
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const BASE_URI = process.env.MONGODB_TEST_URI || '';
const TEST_URI = BASE_URI.replace(/_test(\?|$)/, '_stats_test$1');
const enabled = BASE_URI !== '' && new URL(TEST_URI).pathname.endsWith('_stats_test');
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
import { IdempotencyRecord } from '../models/IdempotencyRecord';
import { Expense } from '../models/Expense';
import { pickBucket } from '../services/statisticsService';
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
  IdempotencyRecord,
  Expense,
];
const clearAll = () =>
  Promise.all(MODELS.map((m) => (m as unknown as mongoose.Model<unknown>).deleteMany({})));

const TZ = 'Africa/Tunis';
// 2 octobre 2026 à Tunis = [01/10 23:00Z, 02/10 23:00Z[
const OCT2 = { from: '2026-10-01T23:00:00.000Z', to: '2026-10-02T23:00:00.000Z' };
const OCT1_7 = { from: '2026-09-30T23:00:00.000Z', to: '2026-10-07T23:00:00.000Z' };

describeDb('statistiques (intégration)', () => {
  let auth: { Authorization: string };
  const ids: Record<string, string> = {};
  const o: Record<string, any> = {};

  const stats = async (range: { from: string; to: string }) => {
    const res = await request(app)
      .get(`/api/statistics?from=${range.from}&to=${range.to}&tz=${encodeURIComponent(TZ)}`)
      .set(auth);
    expect(res.status).toBe(200);
    return res.body.data;
  };
  const setStatus = (id: string, status: string) =>
    request(app).put(`/api/orders/${id}/status`).set(auth).send({ status });
  const pay = (id: string, body: any = {}) =>
    request(app).post(`/api/cash/orders/${id}/payment`).set(auth).set(idem()).send(body);
  const order = async (
    name: string,
    recipe: string,
    qty: number,
    date: string,
    clientId?: string
  ) =>
    (
      await request(app)
        .post('/api/orders/manual')
        .set(auth)
        .set(idem())
        .send({
          ...(clientId
            ? { clientId }
            : { clientName: name, clientPhone: `2200${Math.floor(Math.random() * 9000 + 1000)}` }),
          requestedDate: date,
          items: [{ recipeId: recipe, variantIndex: 0, quantity: qty }],
        })
    ).body.data.order;

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
    const [a, b] = await Ingredient.insertMany([
      { name: 'A', unit: 'kg', pricePerUnit: 40, stockQuantity: 100, category: 'base' },
      { name: 'B', unit: 'kg', pricePerUnit: 10, stockQuantity: 100, category: 'base' },
    ]);
    const recipe = async (name: string, ingredientId: unknown) =>
      (
        await Recipe.create({
          name,
          variants: [
            {
              sizeName: 'Moyen',
              portions: 8,
              ingredients: [{ ingredientId, quantity: 1, unit: 'kg' }],
              appliances: [],
            },
          ],
        })
      )._id.toString();
    ids.cake = await recipe('Cake', a._id); // 40 DT
    ids.muffin = await recipe('Muffins', b._id); // 10 DT
    ids.ing = b._id.toString();
    ids.cafe = (
      await Client.create({ type: 'cafe', name: 'Cafe Bleu', phone: '+21671000001' })
    )._id.toString();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await clearAll();
      await mongoose.disconnect();
    }
  });

  it('8. période sans données : tout à zéro, aucune série', async () => {
    const s = await stats(OCT2);
    expect(s.sales).toMatchObject({
      revenue: 0,
      count: 0,
      collected: 0,
      remaining: 0,
      averageBasket: null,
    });
    expect(s.series.sales).toEqual([]);
    expect(s.topProducts).toEqual([]);
    expect(s.cash.movementsCount).toBe(0);
  });

  it('1/2/3/6/12. plusieurs ventes : CA, encaissé, reste à encaisser, panier moyen', async () => {
    o.a = await order('Ahmed', ids.cake, 1, '2026-10-02T09:00:00.000Z'); // 40, 10:00 Tunis
    o.b = await order('', ids.muffin, 3, '2026-10-02T14:30:00.000Z', ids.cafe); // 30, 15:30 Tunis
    o.c = await order('Sami', ids.cake, 2, '2026-10-05T10:00:00.000Z'); // 80, le 5
    o.pending = await order('Lina', ids.muffin, 1, '2026-10-02T10:00:00.000Z'); // en attente : pas une vente
    for (const x of [o.a, o.b, o.c]) {
      await setStatus(x._id, 'confirmed');
    }
    await pay(o.a._id); // 40 encaissés
    await pay(o.b._id, { amount: 12 });

    const s = await stats(OCT2);
    expect(s.sales).toMatchObject({
      revenue: 70,
      count: 2,
      collected: 52,
      paymentsCount: 2,
      remaining: 18,
      remainingCount: 1,
      averageBasket: 35,
    });
    // le paiement ne change pas l'avancement : CMD a reste « confirmée »
    expect(s.orders.byStatus).toEqual({ confirmed: 2, pending: 1 });
  });

  it('16. fuseau : regroupement par heure locale (Tunis), pas UTC', async () => {
    const s = await stats(OCT2);
    expect(s.period).toMatchObject({ bucket: 'hour', timezone: TZ });
    // 09:00Z = 10:00 à Tunis → créneau commençant à 09:00Z ; 14:30Z = 15:30 → créneau 14:00Z
    expect(s.series.sales).toEqual([
      { bucket: '2026-10-02T09:00:00.000Z', revenue: 40, count: 1 },
      { bucket: '2026-10-02T14:00:00.000Z', revenue: 30, count: 1 },
    ]);
    const week = await stats(OCT1_7);
    expect(week.period.bucket).toBe('day');
    // jours commençant à minuit heure de Tunis (23:00Z la veille)
    expect(week.series.sales.map((x: any) => [x.bucket, x.revenue])).toEqual([
      ['2026-10-01T23:00:00.000Z', 70],
      ['2026-10-04T23:00:00.000Z', 80],
    ]);
  });

  it('7. plusieurs périodes + comparaison avec la période précédente', async () => {
    const week = await stats(OCT1_7);
    expect(week.sales).toMatchObject({ revenue: 150, count: 3 });
    const oct5 = await stats({ from: '2026-10-04T23:00:00.000Z', to: '2026-10-05T23:00:00.000Z' });
    expect(oct5.sales.revenue).toBe(80);
    const oct3 = await stats({ from: '2026-10-02T23:00:00.000Z', to: '2026-10-03T23:00:00.000Z' });
    expect(oct3.sales.previous).toMatchObject({ revenue: 70, count: 2 }); // = le 2 octobre
  });

  it('9. ventes vs encaissements : séries cohérentes avec les totaux', async () => {
    const today = {
      from: new Date(Date.now() - 3600e3).toISOString(),
      to: new Date(Date.now() + 3600e3).toISOString(),
    };
    const s = await stats(today);
    const paid = s.series.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
    expect(paid).toBe(52); // paiements reçus aujourd'hui (date du mouvement)
    expect(s.cash.totalIn).toBe(52);
    const week = await stats(OCT1_7);
    expect(week.series.sales.reduce((sum: number, p: any) => sum + p.revenue, 0)).toBe(
      week.sales.revenue
    );
  });

  it('10/11. paiement répété / statut répété : aucun double mouvement, statistiques stables', async () => {
    expect((await pay(o.a._id)).status).toBe(400); // déjà entièrement payée
    for (const st of ['pending', 'confirmed', 'confirmed']) {
      await setStatus(o.a._id, st);
    }
    expect(await CashMovement.countDocuments({ orderId: o.a._id })).toBe(1);
    expect((await stats(OCT2)).sales.collected).toBe(52);
  });

  it('4/5. caisse et achats : entrées, sorties par catégorie, achats enregistrés', async () => {
    await request(app)
      .post(`/api/ingredients/${ids.ing}/purchases`)
      .set(auth)
      .set(idem())
      .send({ quantity: 2, unitPrice: 5, paymentMethod: 'cash_register' });
    await request(app)
      .post(`/api/ingredients/${ids.ing}/purchases`)
      .set(auth)
      .set(idem())
      .send({ quantity: 1, paymentMethod: 'cash_register' }); // sans prix : refuse
    // dépense payée avec la caisse (sortie de caisse) + dépense payée avec l'argent personnel
    await request(app)
      .post('/api/expenses')
      .set(auth)
      .set(idem())
      .send({ amount: 7, description: 'Gaz', paymentMethod: 'cash_register' });
    await request(app)
      .post('/api/expenses')
      .set(auth)
      .set(idem())
      .send({ amount: 5, description: 'Emballages', paymentMethod: 'personal' });
    const today = {
      from: new Date(Date.now() - 3600e3).toISOString(),
      to: new Date(Date.now() + 3600e3).toISOString(),
    };
    const s = await stats(today);
    expect(s.purchases).toEqual({
      total: 10,
      count: 1,
      unpriced: 0,
      byMethod: { cash_register: { total: 10, count: 1 } },
    });
    expect(s.cash).toMatchObject({
      totalIn: 52,
      totalOut: 17,
      theoreticalBalance: 35,
      movementsCount: 4,
    });
    const byType = Object.fromEntries(
      Object.entries(
        s.series.outflows.reduce(
          (acc: any, x: any) => ({ ...acc, [x.type]: (acc[x.type] || 0) + x.amount }),
          {}
        )
      )
    );
    expect(byType).toEqual({ purchase: 10, expense: 7 });
    // évolution de la caisse : flux net par créneau = entrées − sorties
    const net = s.series.cashNet.reduce((sum: number, x: any) => sum + x.amount, 0);
    expect(Math.round(net * 1000) / 1000).toBe(s.cash.totalIn - s.cash.totalOut);
    // dépenses : toutes comptées, seule celle payée avec la caisse est une sortie de caisse
    expect(s.expenses).toEqual({
      total: 12,
      count: 2,
      byMethod: { cash_register: { total: 7, count: 1 }, personal: { total: 5, count: 1 } },
    });
  });

  it('13. annulation + remboursement : CA et caisse suivent le comportement existant', async () => {
    await setStatus(o.a._id, 'cancelled');
    await request(app)
      .post(`/api/cash/orders/${o.a._id}/refund`)
      .set(auth)
      .set(idem())
      .send({ reason: 'annulee' });
    const s = await stats(OCT2);
    expect(s.sales).toMatchObject({ revenue: 30, count: 1, collected: 12, remaining: 18 });
    expect(s.orders.cancelled).toBe(1);
    const today = {
      from: new Date(Date.now() - 3600e3).toISOString(),
      to: new Date(Date.now() + 3600e3).toISOString(),
    };
    const t = await stats(today);
    expect(t.series.payments.reduce((sum: number, p: any) => sum + p.amount, 0)).toBe(12); // 52 − 40 remboursés
    expect(t.cash.totalOut).toBe(57); // achats 10 + gaz 7 + remboursement 40
  });

  it('produits les plus vendus et activité clients', async () => {
    const s = await stats(OCT1_7);
    expect(s.topProducts.map((p: any) => [p.name, p.quantity, p.revenue])).toEqual([
      ['Cake', 2, 80],
      ['Muffins', 3, 30],
    ]);
    expect(s.clients).toMatchObject({
      active: 2,
      individual: { count: 1, revenue: 80 },
      cafe: { count: 1, revenue: 30 },
    });
    expect(s.clients.top[0]).toMatchObject({ name: 'Sami', count: 1 });
  });

  it('14. recherche historique (ventes) : CMD, client, statut, paiement', async () => {
    const q = async (extra: string) =>
      (await request(app).get(`/api/sales?from=${OCT1_7.from}&to=${OCT1_7.to}${extra}`).set(auth))
        .body.data.sales;
    expect((await q(`&search=CMD-${o.c.orderNumber}`)).map((x: any) => x.clientName)).toEqual([
      'Sami',
    ]);
    expect((await q('&search=cafe')).length).toBe(1);
    expect((await q('&status=confirmed')).length).toBe(2);
    expect((await q('&paymentStatus=partial')).map((x: any) => x._id)).toEqual([o.b._id]);
  });

  it('choix du regroupement selon la durée', () => {
    const d = (days: number) => new Date(Date.UTC(2026, 0, 1) + days * 86400000);
    expect(pickBucket(d(0), d(1))).toBe('hour');
    expect(pickBucket(d(0), d(30))).toBe('day');
    expect(pickBucket(d(0), d(180))).toBe('week');
    expect(pickBucket(d(0), d(800))).toBe('month');
  });

  it('15. sécurité : 401 sans authentification, rien de financier en public', async () => {
    const r = await request(app).get(`/api/statistics?from=${OCT2.from}&to=${OCT2.to}`);
    expect(r.status).toBe(401);
    const bad = await request(app).get('/api/statistics?from=x&to=y').set(auth);
    expect(bad.status).toBe(400);
    const pub = JSON.stringify((await request(app).get('/api/recipes')).body);
    for (const secret of ['revenue', 'amountPaid', 'totalPrice', 'theoreticalBalance']) {
      expect([secret, pub.includes(`"${secret}"`)]).toEqual([secret, false]);
    }
  });
});
