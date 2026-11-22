/**
 * Prix utilisé d'un ingrédient = moyenne des prix de ses sources d'achat
 * + frais supplémentaires d'une commande modifiables après création.
 * Vraies routes HTTP + base MongoDB dédiée (nom finissant par "_test", vidée).
 */
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const BASE_URI = process.env.MONGODB_TEST_URI || '';
const TEST_URI = BASE_URI.replace(/_test(\?|$)/, '_pricing_test$1');
const enabled = BASE_URI !== '' && new URL(TEST_URI).pathname.endsWith('_pricing_test');
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
import { syncAllIngredientPrices } from '../services/ingredientPriceService';
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

describeDb('prix = moyenne des sources, frais de commande (intégration)', () => {
  let auth: { Authorization: string };
  const ids: Record<string, string> = {};

  const ingredient = async (id: string) => (await Ingredient.findById(id))!;
  const addOffer = (ingredientId: string, sourceId: string, price: number) =>
    request(app)
      .post(`/api/ingredients/${ingredientId}/prices`)
      .set(auth)
      .send({ sourceId, price });

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
    const [magasin, marche, grossiste] = await PurchaseSource.insertMany([
      { name: 'Magasin', type: 'supermarket' },
      { name: 'Marché', type: 'other' },
      { name: 'Grossiste', type: 'supplier' },
    ]);
    ids.magasin = magasin._id.toString();
    ids.marche = marche._id.toString();
    ids.grossiste = grossiste._id.toString();
  });

  afterAll(async () => {
    await clearAll();
    await mongoose.disconnect();
  });

  it('création avec une source : le prix de la source devient le prix utilisé', async () => {
    const res = await request(app).post('/api/ingredients').set(auth).send({
      name: 'Crème fraîche',
      unit: 'l',
      category: 'dairy',
      sourceId: ids.magasin,
      sourcePrice: 16,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.ingredient.priceBasis).toBe('sources');
    expect(res.body.data.ingredient.pricePerUnit).toBe(16);
    ids.creme = res.body.data.ingredient._id;
    expect(await IngredientPrice.countDocuments({ ingredientId: ids.creme })).toBe(1);
  });

  it('création sans source : prix saisi conservé (manuel)', async () => {
    const res = await request(app)
      .post('/api/ingredients')
      .set(auth)
      .send({ name: 'Sucre', unit: 'kg', category: 'sweetener', pricePerUnit: 1.4 });
    expect(res.status).toBe(201);
    expect(res.body.data.ingredient.priceBasis).toBe('manual');
    expect(res.body.data.ingredient.pricePerUnit).toBe(1.4);
    ids.sucre = res.body.data.ingredient._id;
  });

  it('refuse un prix de source invalide à la création', async () => {
    const res = await request(app).post('/api/ingredients').set(auth).send({
      name: 'Beurre',
      unit: 'kg',
      category: 'dairy',
      sourceId: ids.magasin,
      sourcePrice: 0,
    });
    expect(res.status).toBe(400);
    expect(await Ingredient.countDocuments({ name: 'Beurre' })).toBe(0);
  });

  it('deux sources : prix utilisé = (16 + 8,5) / 2 = 12,25', async () => {
    expect((await addOffer(ids.creme, ids.marche, 8.5)).status).toBe(201);
    const ing = await ingredient(ids.creme);
    expect(ing.pricePerUnit).toBe(12.25);
    expect(ing.priceBasis).toBe('sources');
    expect(ing.referencePriceHistory.at(-1)!.reason).toBe('moyenne de 2 source(s)');
  });

  it('le prix d’une recette utilise la moyenne (250 ml × 12,25 DT/l = 3,0625)', async () => {
    const recipe = await Recipe.create({
      name: 'Chantilly',
      variants: [
        {
          sizeName: 'Bol',
          portions: 4,
          ingredients: [{ ingredientId: ids.creme, quantity: 250, unit: 'ml' }],
          appliances: [],
        },
      ],
    });
    ids.recipe = recipe._id.toString();
    const res = await request(app)
      .post('/api/prices/calculate')
      .set(auth)
      .send({ recipeId: ids.recipe, variantIndex: 0 });
    expect(res.status).toBe(200);
    expect(res.body.data.ingredientsCost).toBeCloseTo(3.0625, 2); // arrondi au millime
  });

  it('le prix ne se modifie pas à la main quand il vient des sources', async () => {
    const res = await request(app)
      .put(`/api/ingredients/${ids.creme}`)
      .set(auth)
      .send({ pricePerUnit: 99, description: 'Crème 35 %' });
    expect(res.status).toBe(200);
    const ing = await ingredient(ids.creme);
    expect(ing.pricePerUnit).toBe(12.25);
    expect(ing.description).toBe('Crème 35 %');
  });

  it('modifier le prix d’une source recalcule la moyenne', async () => {
    const offer = await IngredientPrice.findOne({ ingredientId: ids.creme, sourceId: ids.marche });
    const res = await request(app)
      .put(`/api/ingredients/${ids.creme}/prices/${offer!._id}`)
      .set(auth)
      .send({ price: 10 });
    expect(res.status).toBe(200);
    expect((await ingredient(ids.creme)).pricePerUnit).toBe(13);
  });

  it('un achat chez une source met à jour son prix (par défaut)', async () => {
    const res = await request(app)
      .post(`/api/ingredients/${ids.creme}/purchases`)
      .set(auth)
      .set(idem())
      .send({ quantity: 1, unitPrice: 14, sourceId: ids.marche, paymentMethod: 'personal' });
    expect(res.status).toBe(201);
    // (16 + 14) / 2
    expect((await ingredient(ids.creme)).pricePerUnit).toBe(15);
  });

  it('un achat en promotion ne change pas le prix de la source', async () => {
    const res = await request(app)
      .post(`/api/ingredients/${ids.creme}/purchases`)
      .set(auth)
      .set(idem())
      .send({
        quantity: 1,
        unitPrice: 5,
        sourceId: ids.marche,
        paymentMethod: 'personal',
        promotion: true,
      });
    expect(res.status).toBe(201);
    expect((await ingredient(ids.creme)).pricePerUnit).toBe(15);
    const offer = await IngredientPrice.findOne({ ingredientId: ids.creme, sourceId: ids.marche });
    expect(offer!.price).toBe(14);
  });

  it('un prix non revérifié depuis plus de 3 mois est signalé', async () => {
    await IngredientPrice.updateOne(
      { ingredientId: ids.creme, sourceId: ids.magasin },
      { $set: { lastCheckedAt: new Date(Date.now() - 100 * 24 * 3600e3) } }
    );
    const res = await request(app).get('/api/ingredients/price-summary').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data.summaries[ids.creme].staleCount).toBe(1);
    expect(res.body.data.summaries[ids.creme].comparableCount).toBe(2);
  });

  it('retirer une source / archiver une source : la moyenne se recalcule', async () => {
    const offer = await IngredientPrice.findOne({ ingredientId: ids.creme, sourceId: ids.marche });
    await request(app).delete(`/api/ingredients/${ids.creme}/prices/${offer!._id}`).set(auth);
    expect((await ingredient(ids.creme)).pricePerUnit).toBe(16);

    // dernière source archivée : on garde le dernier prix, l'ingrédient repasse en manuel
    const res = await request(app).delete(`/api/purchase-sources/${ids.magasin}`).set(auth);
    expect(res.status).toBe(200);
    const ing = await ingredient(ids.creme);
    expect(ing.pricePerUnit).toBe(16);
    expect(ing.priceBasis).toBe('manual');
  });

  it('la synchronisation au démarrage aligne les anciens prix de référence', async () => {
    // ancien ingrédient : prix saisi à 1,4 + deux sources à 1,2 et 1,8
    await IngredientPrice.insertMany([
      { ingredientId: ids.sucre, sourceId: ids.grossiste, price: 1.2, unit: 'kg' },
      { ingredientId: ids.sucre, sourceId: ids.marche, price: 2, unit: 'piece' }, // non comparable
    ]);
    await IngredientPrice.create({
      ingredientId: ids.sucre,
      sourceId: (await PurchaseSource.create({ name: 'Épicerie', type: 'store' }))._id,
      price: 1.8,
      unit: 'kg',
    });
    const first = await syncAllIngredientPrices();
    expect(first.changed).toBeGreaterThanOrEqual(1);
    const ing = await ingredient(ids.sucre);
    expect(ing.pricePerUnit).toBe(1.5); // (1,2 + 1,8) / 2 remplace le 1,4 saisi
    expect(ing.priceBasis).toBe('sources');
    // idempotent
    expect((await syncAllIngredientPrices()).changed).toBe(0);
  });

  describe('frais supplémentaires', () => {
    let orderId: string;

    it('pas de montant fixe de transport / emballage dans les paramètres', async () => {
      const res = await request(app)
        .put('/api/settings')
        .set(auth)
        .send({ defaultTransportFee: 7, defaultPackagingFee: 1.5 });
      expect(res.status).toBe(400);
    });

    it('création avec frais : total = produits + frais', async () => {
      const res = await request(app)
        .post('/api/orders/manual')
        .set(auth)
        .set(idem())
        .send({
          clientName: 'Amira',
          clientPhone: '22111222',
          items: [{ recipeId: ids.recipe, variantIndex: 0, quantity: 1 }],
          additionalFees: [{ label: 'Transport', amount: 7 }],
        });
      expect(res.status).toBe(201);
      orderId = res.body.data.order._id;
      const order = (await Order.findById(orderId))!;
      const items = order.items.reduce((s, i: any) => s + i.calculatedPrice.total * i.quantity, 0);
      expect(order.totalPrice).toBeCloseTo(items + 7, 3);
    });

    it('refuse des frais invalides', async () => {
      for (const additionalFees of [
        [{ label: '', amount: 2 }],
        [{ label: 'Emballage', amount: -1 }],
        [{ label: 'Emballage', amount: 'abc' }],
        'Transport',
      ]) {
        const res = await request(app)
          .put(`/api/orders/${orderId}/fees`)
          .set(auth)
          .send({ additionalFees });
        expect(res.status).toBe(400);
      }
    });

    it('modifier les frais après création met à jour total et reste à encaisser', async () => {
      const before = (await Order.findById(orderId))!;
      const itemsTotal = before.totalPrice - 7;
      // la cliente paie tout
      const pay = await request(app)
        .post(`/api/cash/orders/${orderId}/payment`)
        .set(auth)
        .set(idem())
        .send({ method: 'cash' });
      expect(pay.status).toBe(201);
      expect((await Order.findById(orderId))!.paymentStatus).toBe('paid');

      // on ajoute l'emballage après coup : la commande redevient partiellement payée
      const res = await request(app)
        .put(`/api/orders/${orderId}/fees`)
        .set(auth)
        .send({
          additionalFees: [
            { label: 'Transport', amount: 7 },
            { label: ' Emballage ', amount: '1.5' },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.data.order.additionalFees).toEqual([
        expect.objectContaining({ label: 'Transport', amount: 7 }),
        expect.objectContaining({ label: 'Emballage', amount: 1.5 }),
      ]);
      const after = (await Order.findById(orderId))!;
      expect(after.totalPrice).toBeCloseTo(itemsTotal + 8.5, 3);
      expect(after.paymentStatus).toBe('partial');
      expect(after.totalPrice - after.amountPaid).toBeCloseTo(1.5, 3);

      // retirer tous les frais : la cliente a trop payé → payée
      await request(app).put(`/api/orders/${orderId}/fees`).set(auth).send({ additionalFees: [] });
      const cleared = (await Order.findById(orderId))!;
      expect(cleared.totalPrice).toBeCloseTo(itemsTotal, 3);
      expect(cleared.paymentStatus).toBe('paid');
    });

    it('pas de modification des frais sur une commande annulée', async () => {
      await Order.updateOne({ _id: orderId }, { $set: { status: 'cancelled' } });
      const res = await request(app)
        .put(`/api/orders/${orderId}/fees`)
        .set(auth)
        .send({ additionalFees: [{ label: 'Transport', amount: 3 }] });
      expect(res.status).toBe(400);
    });

    it('route réservée à l’admin', async () => {
      const res = await request(app)
        .put(`/api/orders/${orderId}/fees`)
        .send({ additionalFees: [] });
      expect(res.status).toBe(401);
    });
  });
});
