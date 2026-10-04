/**
 * Workflow commande → manque → besoin d'achat → achat → stock → commande approvisionnée.
 * Vraies routes HTTP + vraie base MongoDB (base dédiée, videe, nom finissant par "_test").
 */
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Base propre a ce fichier (les fichiers de test tournent en parallele)
const BASE_URI = process.env.MONGODB_TEST_URI || '';
const TEST_URI = BASE_URI.replace(/_test(\?|$)/, '_needs_test$1');
const enabled = BASE_URI !== '' && new URL(TEST_URI).pathname.endsWith('_needs_test');
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
  IdempotencyRecord,
];
const clearAll = () =>
  Promise.all(MODELS.map((m) => (m as unknown as mongoose.Model<unknown>).deleteMany({})));
const inHours = (h: number) => new Date(Date.now() + h * 3600 * 1000).toISOString();

describeDb('besoins d’achat liés aux commandes (intégration)', () => {
  let auth: { Authorization: string };
  const ids: Record<string, string> = {};
  const orders: Record<string, string> = {};

  const stockOf = async (name: string) => (await Ingredient.findOne({ name }))!.stockQuantity;
  const setStatus = (id: string, status: string) =>
    request(app).put(`/api/orders/${id}/status`).set(auth).send({ status });
  const createOrder = (clientName: string, items: any[], requestedDate?: string) =>
    request(app).post('/api/orders/manual').set(auth).set(idem()).send({
      clientName,
      clientPhone: '22123456',
      requestedDate,
      items,
    });
  const shoppingList = async () =>
    (await request(app).get('/api/orders/shopping-list').set(auth)).body.data;
  const listItem = async (name: string) =>
    (await shoppingList()).shoppingList.find((i: any) => i.name === name);
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
      { key: 'waterForfaitSmall', value: 0.3, label: 's' },
      { key: 'waterForfaitLarge', value: 0.5, label: 's' },
      { key: 'marginPercent', value: 15, label: 's' },
    ]);
    const [sucre, farine, chocolat] = await Ingredient.insertMany([
      { name: 'Sucre', unit: 'kg', pricePerUnit: 1.2, stockQuantity: 0.5, category: 'sweetener' },
      { name: 'Farine', unit: 'kg', pricePerUnit: 0.8, stockQuantity: 10, category: 'base' },
      { name: 'Chocolat', unit: 'kg', pricePerUnit: 20, stockQuantity: 0, category: 'flavoring' },
    ]);
    const recipe = (name: string, ingredients: any[]) =>
      Recipe.create({
        name,
        variants: [{ sizeName: 'Moyen', portions: 8, ingredients, appliances: [] }],
      });
    const cake = await recipe('Cake', [
      { ingredientId: sucre._id, quantity: 500, unit: 'g' },
      { ingredientId: farine._id, quantity: 300, unit: 'g' },
    ]);
    const gateau = await recipe('Gateau', [{ ingredientId: sucre._id, quantity: 350, unit: 'g' }]);
    const tarte = await recipe('Tarte', [
      { ingredientId: sucre._id, quantity: 300, unit: 'g' },
      { ingredientId: chocolat._id, quantity: 200, unit: 'g' },
    ]);
    const pain = await recipe('Pain', [{ ingredientId: farine._id, quantity: 500, unit: 'g' }]);
    Object.assign(ids, {
      sucre: sucre._id.toString(),
      cake: cake._id.toString(),
      gateau: gateau._id.toString(),
      tarte: tarte._id.toString(),
      pain: pain._id.toString(),
    });
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await clearAll();
      await mongoose.disconnect();
    }
  });

  it('1. stock suffisant → commande créée normalement, aucun besoin d’achat', async () => {
    const res = await createOrder(
      'Pain',
      [{ recipeId: ids.pain, variantIndex: 0, quantity: 1 }],
      inHours(30)
    );
    expect(res.status).toBe(201);
    expect(res.body.data.order.orderNumber).toBeGreaterThan(0);
    const needs = await stockNeeds(res.body.data.order._id);
    expect(needs.canStartPreparation).toBe(true);
    expect(needs.stockNeeds.every((n: any) => n.status !== 'missing')).toBe(true);
    expect(await PurchaseNeed.countDocuments({ orderId: res.body.data.order._id })).toBe(0);
    await setStatus(res.body.data.order._id, 'cancelled'); // hors du scenario suivant
  });

  it('2. stock insuffisant → commande créée + manque détecté (préparation impossible)', async () => {
    // CMD-104 : 2 cakes pour dans 20 h → 1 kg de sucre, stock 0,5 kg
    const date = inHours(20);
    const res = await createOrder(
      'Ahmed',
      [{ recipeId: ids.cake, variantIndex: 0, quantity: 2 }],
      date
    );
    expect(res.status).toBe(201);
    orders.ahmed = res.body.data.order._id;

    const needs = await stockNeeds(orders.ahmed);
    expect(needs.canStartPreparation).toBe(false);
    expect(new Date(needs.neededBy).toISOString()).toBe(new Date(date).toISOString());
    expect(needs.stockNeeds.find((n: any) => n.name === 'Sucre')).toMatchObject({
      needed: 1,
      stock: 0.5,
      missing: 0.5,
      status: 'missing',
    });
    expect(needs.stockNeeds.find((n: any) => n.name === 'Farine').status).toBe('ok');
  });

  it('3. commande non payée + ingrédient manquant → besoin d’achat lié à la commande', async () => {
    expect((await Order.findById(orders.ahmed))!.status).toBe('pending');
    const need = await PurchaseNeed.findOne({ orderId: orders.ahmed, ingredientId: ids.sucre });
    expect(need).toMatchObject({
      status: 'open',
      neededQty: 1,
      availableQty: 0.5,
      missingQty: 0.5,
      unit: 'kg',
      clientName: 'Ahmed',
    });
    expect(need!.neededBy).not.toBeNull();
  });

  it('4. plusieurs commandes sur le même ingrédient → besoins regroupés avec le détail', async () => {
    const r2 = await createOrder(
      'Sami',
      [{ recipeId: ids.gateau, variantIndex: 0, quantity: 2 }],
      inHours(72)
    );
    const r3 = await createOrder(
      'Lina',
      [{ recipeId: ids.tarte, variantIndex: 0, quantity: 1 }],
      inHours(120)
    );
    orders.sami = r2.body.data.order._id;
    orders.lina = r3.body.data.order._id;

    const sucre = await listItem('Sucre');
    expect(sucre.toBuy).toBe(1.5); // 0,5 + 0,7 + 0,3
    expect(sucre.unit).toBe('kg');
    expect(sucre.orders.map((o: any) => [o.clientName, o.missingQty])).toEqual([
      ['Ahmed', 0.5],
      ['Sami', 0.7],
      ['Lina', 0.3],
    ]);
    expect(sucre.orders[0].orderRef).toMatch(/^CMD-\d+$/);
    expect(new Date(sucre.neededBy).getTime()).toBeLessThan(new Date(inHours(21)).getTime());
    // priorité (Ahmed dans 20 h ≤ seuil 24 h), pas encore de source ni d'achat : prix de référence
    expect(sucre).toMatchObject({
      priority: 'urgent',
      inStock: 0.5,
      needed: 2, // 1 + 0,7 + 0,3
      missing: 1.5,
      sources: [],
      lastPurchase: null,
      priceBasis: 'reference',
      pricePerUnit: 1.2,
      estimatedCost: 1.8,
    });
    expect((await listItem('Chocolat')).orders).toHaveLength(1);
    expect((await listItem('Chocolat')).priority).toBe('later'); // Lina dans 120 h > 3 × 24 h
    expect(await listItem('Farine')).toBeUndefined(); // stock suffisant : rien à acheter
  });

  it('10. pas de doublon : relire la liste ou modifier la commande ne recrée rien', async () => {
    await shoppingList();
    await shoppingList();
    await request(app).put(`/api/orders/${orders.ahmed}`).set(auth).send({ notes: 'appel ok' });
    await setStatus(orders.ahmed, 'confirmed');
    expect(await PurchaseNeed.countDocuments({ ingredientId: ids.sucre })).toBe(3);
    expect((await listItem('Sucre')).toBuy).toBe(1.5);
  });

  it('9. commande proche avec ingrédient manquant → "Commandes nécessitant une action"', async () => {
    const res = await request(app).get('/api/orders/action-required').set(auth);
    expect(res.status).toBe(200);
    const list = res.body.data.orders;
    expect(list.map((o: any) => o.clientName)).toEqual(['Ahmed', 'Sami', 'Lina']);
    expect(list[0]).toMatchObject({ urgency: 'urgent', status: 'confirmed' });
    expect(list[0].missing[0]).toMatchObject({
      name: 'Sucre',
      missing: 0.5,
      unit: 'kg',
      purchaseStatus: 'a acheter',
    });
    expect(list[0].items[0]).toMatchObject({ recipeName: 'Cake', quantity: 2 });
    expect(list[1].urgency).toBe('upcoming'); // dans 72 h > seuil de 24 h
  });

  it('8. stock toujours insuffisant → passage en préparation bloqué', async () => {
    const r = await setStatus(orders.ahmed, 'preparing');
    expect(r.status).toBe(400);
    expect(r.body.message).toContain('Sucre');
    expect((await Order.findById(orders.ahmed))!.status).toBe('confirmed');
    expect(await stockOf('Sucre')).toBe(0.5);
  });

  it('11/12. annulation : besoins de la commande annulés, ceux des autres commandes conservés', async () => {
    expect((await setStatus(orders.lina, 'cancelled')).status).toBe(200);
    // chocolat : seule Lina en avait besoin → besoin annulé, plus dans la liste
    expect(
      (await PurchaseNeed.findOne({ orderId: orders.lina, ingredientId: { $ne: ids.sucre } }))!
        .status
    ).toBe('cancelled');
    expect(await listItem('Chocolat')).toBeUndefined();
    // sucre : réduit de 0,3 kg, Ahmed et Sami gardent leur besoin
    const sucre = await listItem('Sucre');
    expect(sucre.toBuy).toBe(1.2);
    expect(sucre.orders.map((o: any) => o.clientName)).toEqual(['Ahmed', 'Sami']);
    expect(
      (await PurchaseNeed.findOne({ orderId: orders.lina, ingredientId: ids.sucre }))!.status
    ).toBe('cancelled');
  });

  it('5. achat partiel puis complet → stock augmenté, besoin "partiellement acheté" entre les deux', async () => {
    await request(app)
      .post('/api/orders/shopping-list/purchase')
      .set(auth)
      .set(idem())
      .send({
        paymentMethod: 'cash_register',
        purchases: [{ ingredientId: ids.sucre, quantity: 0.3, unitPrice: 1.2 }],
      });
    expect(await stockOf('Sucre')).toBe(0.8);
    const partial = await listItem('Sucre');
    expect(partial.toBuy).toBe(0.9);
    expect(partial.orders[0]).toMatchObject({
      clientName: 'Ahmed',
      missingQty: 0.2,
      status: 'partiellement achete',
    });

    const full = await request(app)
      .post('/api/orders/shopping-list/purchase')
      .set(auth)
      .set(idem())
      .send({
        paymentMethod: 'cash_register',
        purchases: [{ ingredientId: ids.sucre, quantity: 1.2, unitPrice: 1.25 }],
      });
    expect(await stockOf('Sucre')).toBe(2);
    // synchronisation : l'argent sort de la caisse et l'achat garde les commandes debloquees
    expect(full.body.data.cashMovement).toMatchObject({
      type: 'purchase',
      direction: 'out',
      amount: 1.5,
    });
    expect(full.body.data.cashMovement.stockItems).toEqual([
      { ingredientId: ids.sucre, name: 'Sucre', quantity: 1.2, unit: 'kg' },
    ]);
    expect(full.body.data.unblockedOrders.map((u: any) => [u.clientName, u.fully]).sort()).toEqual([
      ['Ahmed', true],
      ['Sami', true],
    ]);
  });

  it('achat sans prix refusé : rien ne change (stock, caisse)', async () => {
    const r = await request(app)
      .post('/api/orders/shopping-list/purchase')
      .set(auth)
      .set(idem())
      .send({
        paymentMethod: 'cash_register',
        purchases: [{ ingredientId: ids.sucre, quantity: 1 }],
      });
    expect(r.status).toBe(400);
    expect(r.body.message).toContain('prix');
    expect(await stockOf('Sucre')).toBe(2);
  });

  it('6. après augmentation du stock → commandes recalculées, plus de manque', async () => {
    expect(await listItem('Sucre')).toBeUndefined();
    const needs = await stockNeeds(orders.ahmed);
    expect(needs.canStartPreparation).toBe(true);
    expect(needs.stockNeeds.find((n: any) => n.name === 'Sucre')).toMatchObject({
      missing: 0,
      status: 'ok',
    });
    expect(
      (await PurchaseNeed.findOne({ orderId: orders.ahmed, ingredientId: ids.sucre }))!.status
    ).toBe('covered');
    const action = await request(app).get('/api/orders/action-required').set(auth);
    expect(action.body.data.orders).toHaveLength(0);
  });

  it('7. une commande approvisionnée ne passe PAS seule en préparation', async () => {
    expect((await Order.findById(orders.ahmed))!.status).toBe('confirmed');
    expect((await Order.findById(orders.sami))!.status).toBe('pending');
    expect(await stockOf('Sucre')).toBe(2); // rien n'a été déduit
  });

  it('préparation lancée par Rahma → stock déduit, besoin marqué "fulfilled"', async () => {
    expect((await setStatus(orders.ahmed, 'preparing')).status).toBe(200);
    expect(await stockOf('Sucre')).toBe(1);
    expect(
      (await PurchaseNeed.findOne({ orderId: orders.ahmed, ingredientId: ids.sucre }))!.status
    ).toBe('fulfilled');
  });

  it('un besoin couvert redevient ouvert si le stock baisse à nouveau', async () => {
    await request(app)
      .post(`/api/ingredients/${ids.sucre}/stock-adjustment`)
      .set(auth)
      .set(idem())
      .send({ newQuantity: 0.2, reason: 'loss' });
    const need = await PurchaseNeed.findOne({ orderId: orders.sami, ingredientId: ids.sucre });
    expect(need).toMatchObject({ status: 'open', missingQty: 0.5 });
    // le coût estimé utilise maintenant le dernier prix réellement payé (1,25 DT/kg)
    const sucre = await listItem('Sucre');
    expect(sucre).toMatchObject({
      priority: 'soon', // Sami dans 72 h ≤ 3 × 24 h
      priceBasis: 'last_purchase',
      pricePerUnit: 1.25,
      estimatedCost: 0.625,
    });
    expect(sucre.lastPurchase.unitPrice).toBe(1.25);
  });

  it('aperçu de la saisie (devis) : tient compte des commandes déjà prévues', async () => {
    await request(app)
      .post(`/api/ingredients/${ids.sucre}/stock-adjustment`)
      .set(auth)
      .set(idem())
      .send({ newQuantity: 1, reason: 'inventory' });
    const before = await PurchaseNeed.countDocuments();
    // Sami (dans 72 h) a besoin de 0,7 kg : une nouvelle commande pour dans 100 h n'a plus que 0,3 kg
    const quote = await request(app)
      .post('/api/prices/quote')
      .set(auth)
      .send({
        items: [{ recipeId: ids.cake, variantIndex: 0, quantity: 1 }],
        requestedDate: inHours(100),
      });
    expect(quote.body.data.stockNeeds.find((n: any) => n.name === 'Sucre')).toMatchObject({
      stock: 0.3,
      needed: 0.5,
      missing: 0.2,
    });
    expect(await PurchaseNeed.countDocuments()).toBe(before); // le devis ne crée aucun besoin
  });
});
