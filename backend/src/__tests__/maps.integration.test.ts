/**
 * Carte : position du domicile et des sources d'achat, réglages de la voiture.
 * Vraies routes HTTP + base MongoDB dédiée (nom finissant par "_test", vidée).
 */
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const BASE_URI = process.env.MONGODB_TEST_URI || '';
const TEST_URI = BASE_URI.replace(/_test(\?|$)/, '_maps_test$1');
const enabled = BASE_URI !== '' && new URL(TEST_URI).pathname.endsWith('_maps_test');
const describeDb = enabled ? describe : describe.skip;

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-de-plus-de-32-caracteres-ok';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = require('../app').default;
import { User } from '../models/User';
import { Settings } from '../models/Settings';
import { PurchaseSource } from '../models/PurchaseSource';

const MODELS = [User, Settings, PurchaseSource];
const clearAll = () =>
  Promise.all(MODELS.map((m) => (m as unknown as mongoose.Model<unknown>).deleteMany({})));

describeDb('carte : domicile, sources, voiture (intégration)', () => {
  let auth: { Authorization: string };
  let sourceId: string;

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
  });

  afterAll(async () => {
    await clearAll();
    await mongoose.disconnect();
  });

  it('domicile et voiture dans les paramètres', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set(auth)
      .send({ homeLat: 36.8065, homeLng: 10.1815, fuelConsumption: 7, fuelPrice: 2.525 });
    expect(res.status).toBe(200);
    const values = Object.fromEntries(res.body.data.settings.map((s: any) => [s.key, s.value]));
    expect(values).toMatchObject({ homeLat: 36.8065, homeLng: 10.1815, fuelConsumption: 7 });
  });

  it('longitude négative acceptée, valeurs hors bornes refusées', async () => {
    expect((await request(app).put('/api/settings').set(auth).send({ homeLng: -5.2 })).status).toBe(
      200
    );
    for (const body of [{ homeLat: 95 }, { fuelConsumption: 80 }, { fuelPrice: -1 }]) {
      expect((await request(app).put('/api/settings').set(auth).send(body)).status).toBe(400);
    }
  });

  it('position d’une source : enregistrée, modifiée, effacée, validée', async () => {
    const created = await request(app)
      .post('/api/purchase-sources')
      .set(auth)
      .send({ name: 'Marché central', type: 'other', location: { lat: 36.799, lng: '10.18' } });
    expect(created.status).toBe(201);
    sourceId = created.body.data.source._id;
    expect(created.body.data.source.location).toEqual({ lat: 36.799, lng: 10.18 });

    const bad = await request(app)
      .put(`/api/purchase-sources/${sourceId}`)
      .set(auth)
      .send({ location: { lat: 'abc', lng: 10 } });
    expect(bad.status).toBe(400);

    const cleared = await request(app)
      .put(`/api/purchase-sources/${sourceId}`)
      .set(auth)
      .send({ location: null });
    expect(cleared.status).toBe(200);
    expect((await PurchaseSource.findById(sourceId))!.location).toBeNull();
  });

  it('positions réservées à l’admin', async () => {
    expect((await request(app).get('/api/settings')).status).toBe(401);
    expect((await request(app).get('/api/purchase-sources')).status).toBe(401);
  });
});
