/**
 * Achats de stock : moyen de paiement (caisse / argent personnel / banque / autre).
 * Seuls les achats payés avec la caisse créent une sortie de caisse.
 * Vraies routes HTTP + base MongoDB dédiée (nom finissant par "_test", vidée).
 */
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const BASE_URI = process.env.MONGODB_TEST_URI || '';
const TEST_URI = BASE_URI.replace(/_test(\?|$)/, '_purch_test$1');
const enabled = BASE_URI !== '' && new URL(TEST_URI).pathname.endsWith('_purch_test');
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
import { IdempotencyRecord } from '../models/IdempotencyRecord';
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
  IdempotencyRecord,
];
const clearAll = () =>
  Promise.all(MODELS.map((m) => (m as unknown as mongoose.Model<unknown>).deleteMany({})));
const NOW = () => ({
  from: new Date(Date.now() - 3600e3).toISOString(),
  to: new Date(Date.now() + 3600e3).toISOString(),
});

describeDb('achats de stock et moyen de paiement (intégration)', () => {
  let auth: { Authorization: string };
  const ids: Record<string, string> = {};
  const p: Record<string, any> = {};

  const stock = async () => (await Ingredient.findById(ids.sucre))!.stockQuantity;
  const cash = async () =>
    (await request(app).get(`/api/cash?from=${NOW().from}&to=${NOW().to}`).set(auth)).body.data
      .summary;
  const buy = (body: any) =>
    request(app).post(`/api/ingredients/${ids.sucre}/purchases`).set(auth).set(idem()).send(body);
  const cashMovements = () => CashMovement.countDocuments({ type: 'purchase' });
  const order = async (name: string, qty: number) => {
    const o = (
      await request(app)
        .post('/api/orders/manual')
        .set(auth)
        .set(idem())
        .send({
          clientName: name,
          clientPhone: '22111222',
          requestedDate: new Date(Date.now() + 48 * 3600e3).toISOString(),
          items: [{ recipeId: ids.cake, variantIndex: 0, quantity: qty }],
        })
    ).body.data.order;
    await request(app).put(`/api/orders/${o._id}/status`).set(auth).send({ status: 'confirmed' });
    return o;
  };

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
    const [sucre, farine] = await Ingredient.insertMany([
      { name: 'Sucre', unit: 'kg', pricePerUnit: 1.4, stockQuantity: 0.5, category: 'sweetener' },
      { name: 'Farine', unit: 'kg', pricePerUnit: 0.8, stockQuantity: 0, category: 'base' },
    ]);
    ids.sucre = sucre._id.toString();
    ids.farine = farine._id.toString();
    ids.cake = (
      await Recipe.create({
        name: 'Cake',
        variants: [
          {
            sizeName: 'Moyen',
            portions: 8,
            ingredients: [{ ingredientId: sucre._id, quantity: 1000, unit: 'g' }],
            appliances: [],
          },
        ],
      })
    )._id.toString();
    ids.source = (
      await PurchaseSource.create({ name: 'Carrefour', type: 'supermarket' })
    )._id.toString();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await clearAll();
      await mongoose.disconnect();
    }
  });

  it('4. prix et moyen de paiement obligatoires : refus sans rien changer', async () => {
    expect((await buy({ quantity: 1, paymentMethod: 'cash_register' })).status).toBe(400); // sans prix
    const noMethod = await buy({ quantity: 1, unitPrice: 1.4 });
    expect(noMethod.status).toBe(400);
    expect(noMethod.body.message).toContain('moyen de paiement');
    expect(
      (await buy({ quantity: 1, unitPrice: 1.4, paymentMethod: 'carte_magique' })).status
    ).toBe(400);
    expect(await stock()).toBe(0.5);
    expect(await StockHistory.countDocuments()).toBe(0);
    expect(await CashMovement.countDocuments()).toBe(0);
  });

  it('1/5. achat payé avec la caisse : stock +, caisse −, commande débloquée', async () => {
    o_cmd = await order('Ahmed', 1); // besoin 1 kg, stock 0,5 → manque 0,5
    const res = await buy({
      quantity: 2,
      unitPrice: 1.4,
      paymentMethod: 'cash_register',
      sourceId: ids.source,
    });
    expect(res.status).toBe(201);
    p.cash = res.body.data;
    expect(await stock()).toBe(2.5);
    expect(p.cash.cashMovement).toMatchObject({ type: 'purchase', direction: 'out', amount: 2.8 });
    expect(p.cash.unblockedOrders).toEqual([
      expect.objectContaining({ clientName: 'Ahmed', fully: true }),
    ]);
    const entry = await StockHistory.findById(p.cash.purchase._id);
    expect(entry).toMatchObject({
      paymentMethod: 'cash_register',
      totalPrice: 2.8,
      sourceName: 'Carrefour',
    });
    expect(String(entry!.cashMovementId)).toBe(p.cash.cashMovement._id);
    expect(entry!.unblockedOrders[0]).toMatchObject({ clientName: 'Ahmed', fully: true });
    expect((await cash()).totalOut).toBe(2.8);
  });

  it('2/5. argent personnel : stock +, aucune sortie de caisse, achat tracé avec les commandes débloquées', async () => {
    await order('Sami', 3); // 1 + 3 kg nécessaires, stock 2,5 → manque 1,5
    const before = await cash();
    const res = await buy({ quantity: 1.5, unitPrice: 1.4, paymentMethod: 'personal' });
    p.personal = res.body.data;
    expect(res.status).toBe(201);
    expect(await stock()).toBe(4);
    expect(p.personal.cashMovement).toBeNull();
    expect(await cashMovements()).toBe(1);
    expect(await cash()).toEqual(before); // caisse physique inchangée
    const entry = await StockHistory.findById(p.personal.purchase._id);
    expect(entry).toMatchObject({
      paymentMethod: 'personal',
      totalPrice: 2.1,
      cashMovementId: null,
    });
    expect(entry!.unblockedOrders[0]).toMatchObject({ clientName: 'Sami', fully: true });
  });

  it('3. banque : stock +, caisse inchangée, moyen de paiement tracé', async () => {
    const before = await cash();
    const res = await buy({ quantity: 1, unitPrice: 1.5, paymentMethod: 'bank' });
    p.bank = res.body.data;
    expect(await stock()).toBe(5);
    expect(p.bank.cashMovement).toBeNull();
    expect(await cash()).toEqual(before);
    expect((await StockHistory.findById(p.bank.purchase._id))!.paymentMethod).toBe('bank');
  });

  it('8. plusieurs ingrédients en un achat (liste de courses) : un achat, une seule sortie de caisse', async () => {
    const res = await request(app)
      .post('/api/orders/shopping-list/purchase')
      .set(auth)
      .set(idem())
      .send({
        paymentMethod: 'cash_register',
        purchases: [
          { ingredientId: ids.sucre, quantity: 1, unitPrice: 1.4 },
          { ingredientId: ids.farine, quantity: 2, unitPrice: 0.9 },
        ],
      });
    p.multi = res.body.data;
    expect(res.status).toBe(200);
    expect(p.multi.cashMovement.amount).toBe(3.2);
    expect(await StockHistory.countDocuments({ purchaseId: p.multi.purchaseId })).toBe(2);
    expect(await cashMovements()).toBe(2);
  });

  it('7/6. changer le moyen de paiement : la caisse suit, une seule fois, avec une trace', async () => {
    const before = (await cash()).theoreticalBalance;
    const toPersonal = await request(app)
      .put(`/api/purchases/${p.cash.purchaseId}/payment-method`)
      .set(auth)
      .set(idem())
      .send({ paymentMethod: 'personal' });
    expect(toPersonal.status).toBe(200);
    expect(toPersonal.body.data.changed).toBe(true);
    // sortie de 2,80 annulée par une correction tracée (rien n'est supprimé)
    const reversal = await CashMovement.findOne({ reversalOf: p.cash.cashMovement._id });
    expect(reversal).toMatchObject({ direction: 'in', amount: 2.8 });
    expect(reversal!.correctionReason).toBe(
      'Moyen de paiement modifie : Caisse → Argent personnel'
    );
    expect((await cash()).theoreticalBalance).toBe(Math.round((before + 2.8) * 1000) / 1000);
    expect((await StockHistory.findById(p.cash.purchase._id))!).toMatchObject({
      paymentMethod: 'personal',
      cashMovementId: null,
    });
    expect(await stock()).toBe(6); // le stock ne bouge pas

    // même demande répétée : rien de plus
    const again = await request(app)
      .put(`/api/purchases/${p.cash.purchaseId}/payment-method`)
      .set(auth)
      .set(idem())
      .send({ paymentMethod: 'personal' });
    expect(again.body.data.changed).toBe(false);

    // personnel → caisse, deux demandes simultanées : une seule nouvelle sortie
    const [a, b] = await Promise.all([
      request(app)
        .put(`/api/purchases/${p.personal.purchaseId}/payment-method`)
        .set(auth)
        .set(idem())
        .send({ paymentMethod: 'cash_register' }),
      request(app)
        .put(`/api/purchases/${p.personal.purchaseId}/payment-method`)
        .set(auth)
        .set(idem())
        .send({ paymentMethod: 'cash_register' }),
    ]);
    expect([a.status, b.status].every((s) => s === 200)).toBe(true);
    const outs = await CashMovement.find({
      type: 'purchase',
      stockHistoryIds: p.personal.purchase._id,
      reversalOf: { $exists: false },
    });
    expect(outs).toHaveLength(1);
    expect(outs[0].amount).toBe(2.1);
    expect((await StockHistory.findById(p.personal.purchase._id))!.paymentMethod).toBe(
      'cash_register'
    );
  });

  it('liste des achats : tous moyens de paiement, avec sortie de caisse ou non', async () => {
    const res = await request(app)
      .get(`/api/purchases?from=${NOW().from}&to=${NOW().to}`)
      .set(auth);
    const list = res.body.data.purchases;
    expect(list).toHaveLength(4);
    const byId = (id: string) => list.find((x: any) => x.purchaseId === String(id));
    expect(byId(p.cash.purchaseId)).toMatchObject({
      paymentMethod: 'personal',
      cashOut: 0,
      total: 2.8,
    });
    expect(byId(p.personal.purchaseId)).toMatchObject({
      paymentMethod: 'cash_register',
      cashOut: 2.1,
    });
    expect(byId(p.bank.purchaseId)).toMatchObject({ paymentMethod: 'bank', cashOut: 0 });
    expect(byId(p.multi.purchaseId).items).toHaveLength(2);
    expect(res.body.data.byMethod).toEqual({ personal: 2.8, cash_register: 5.3, bank: 1.5 });
  });

  it('9. statistiques : achats par moyen de paiement, caisse = achats payés avec la caisse', async () => {
    const res = await request(app)
      .get(`/api/statistics?from=${NOW().from}&to=${NOW().to}&tz=Africa/Tunis`)
      .set(auth);
    const s = res.body.data;
    expect(s.purchases.byMethod).toEqual({
      cash_register: { total: 5.3, count: 2 },
      personal: { total: 2.8, count: 1 },
      bank: { total: 1.5, count: 1 },
    });
    expect(s.purchases.total).toBe(9.6);
    expect(s.cash.totalOut).toBe(5.3); // 2,80 annulés : seuls 3,20 + 2,10 sont sortis de la caisse
  });

  it('correction manuelle du stock : raison obligatoire, tracée (avant, après, écart, raison, auteur)', async () => {
    const adjust = (body: any) =>
      request(app)
        .post(`/api/ingredients/${ids.sucre}/stock-adjustment`)
        .set(auth)
        .set(idem())
        .send(body);
    // aucune correction silencieuse : la fiche ingrédient ne change pas le stock
    const silent = await request(app)
      .put(`/api/ingredients/${ids.sucre}`)
      .set(auth)
      .send({ stockQuantity: 5.5 });
    expect(silent.status).toBe(400);
    expect((await adjust({ newQuantity: 5.5 })).status).toBe(400); // sans raison
    expect((await adjust({ newQuantity: 5.5, reason: 'other' })).status).toBe(400); // « autre » sans précision
    expect((await adjust({ newQuantity: 6, reason: 'inventory' })).status).toBe(400); // rien ne change
    expect(await stock()).toBe(6);

    const res = await adjust({ newQuantity: 5.5, reason: 'inventory', note: 'Inventaire du soir' });
    expect(res.status).toBe(201);
    expect(await stock()).toBe(5.5);
    const adj = await StockHistory.findOne({ type: 'adjustment', ingredientId: ids.sucre });
    expect(adj).toMatchObject({
      quantity: -0.5,
      stockBefore: 6,
      stockAfter: 5.5,
      reason: 'inventory',
      note: 'Inventaire du soir',
      createdBy: 'admin@test.tn',
    });
    expect(adj!.createdAt).toBeInstanceOf(Date);
    // modifier autre chose que le stock ne crée pas de correction
    await request(app).put(`/api/ingredients/${ids.sucre}`).set(auth).send({ minStock: 1 });
    expect(await StockHistory.countDocuments({ type: 'adjustment' })).toBe(1);
  });

  it('10. sécurité : achats et moyens de paiement réservés à l admin', async () => {
    expect(
      (await request(app).get(`/api/purchases?from=${NOW().from}&to=${NOW().to}`)).status
    ).toBe(401);
    expect(
      (
        await request(app)
          .put(`/api/purchases/${p.bank.purchaseId}/payment-method`)
          .send({ paymentMethod: 'cash_register' })
      ).status
    ).toBe(401);
    expect(
      (await request(app).post(`/api/ingredients/${ids.sucre}/purchases`).send({})).status
    ).toBe(401);
    expect((await request(app).post('/api/orders/shopping-list/purchase').send({})).status).toBe(
      401
    );
  });
});

let o_cmd: unknown; // eslint-disable-line @typescript-eslint/no-unused-vars
