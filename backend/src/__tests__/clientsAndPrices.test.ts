import { normalizePhone, phoneDigitsRegex } from '../utils/phone';
import { convertQuantity, convertUnitPrice } from '../services/unitService';
import { summarizeOffers } from '../services/ingredientPriceService';
import { computeStockNeeds, isBelowThreshold } from '../services/stockForecastService';
import { PriceCalculationService } from '../services/priceCalculationService';

describe('normalizePhone', () => {
  it.each(['22 123 456', '+21622123456', '0021622123456', '216 22 123 456', '22-123-456'])(
    'normalise %s en +21622123456',
    (raw) => {
      expect(normalizePhone(raw)).toBe('+21622123456');
    }
  );

  it('garde l’indicatif d’un numéro étranger', () => {
    expect(normalizePhone('+33 6 12 34 56 78')).toBe('+33612345678');
    expect(normalizePhone('0033612345678')).toBe('+33612345678');
  });

  it('refuse un numéro trop court ou vide', () => {
    expect(normalizePhone('1234')).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });

  it('retrouve un ancien numéro saisi librement', () => {
    const re = phoneDigitsRegex('+21622123456');
    expect(re.test('22 123 456')).toBe(true);
    expect(re.test('+216-22-123-456')).toBe(true);
    expect(re.test('22 123 457')).toBe(false);
  });
});

describe('conversions d’unités', () => {
  it('convertit masse et volume', () => {
    expect(convertQuantity(250, 'g', 'kg')).toBe(0.25);
    expect(convertQuantity(1.5, 'l', 'ml')).toBe(1500);
    expect(convertUnitPrice(0.0012, 'g', 'kg')).toBeCloseTo(1.2);
  });

  it('refuse les conversions sans sens', () => {
    expect(convertQuantity(1, 'g', 'piece')).toBeNull();
    expect(convertQuantity(1, 'kg', 'l')).toBeNull();
  });
});

describe('summarizeOffers (prix moyen de référence)', () => {
  const src = (name: string, isActive = true) => ({ name, isActive });

  it('calcule meilleur prix et moyenne sur les sources actives', () => {
    const summary = summarizeOffers(
      [
        { _id: 'a', price: 1.0, unit: 'kg', isActive: true, sourceId: src('Source A') },
        { _id: 'b', price: 1.2, unit: 'kg', isActive: true, sourceId: src('MG') },
        { _id: 'c', price: 1.3, unit: 'kg', isActive: true, sourceId: src('Carrefour') },
        { _id: 'd', price: 0.5, unit: 'kg', isActive: false, sourceId: src('Ancienne') },
      ],
      'kg'
    );
    expect(summary.average).toBe(1.1667);
    expect(summary.best).toEqual({ price: 1, offerId: 'a', sourceName: 'Source A' });
    expect(summary.activeCount).toBe(3);
  });

  it('convertit les prix exprimés en g vers le kg', () => {
    const summary = summarizeOffers(
      [
        { price: 0.001, unit: 'g', isActive: true },
        { price: 2, unit: 'kg', isActive: true },
      ],
      'kg'
    );
    expect(summary.average).toBe(1.5);
  });

  it('exclut les prix nuls et les unités incompatibles', () => {
    const summary = summarizeOffers(
      [
        { price: 0, unit: 'kg', isActive: true },
        { price: 3, unit: 'piece', isActive: true },
        { price: 2, unit: 'kg', isActive: true },
      ],
      'kg'
    );
    expect(summary.average).toBe(2);
    expect(summary.incomparableCount).toBe(1);
  });

  it('renvoie null sans source valide', () => {
    expect(summarizeOffers([], 'kg').average).toBeNull();
  });
});

describe('computeStockNeeds (stock actuel − besoin = reste prévu)', () => {
  const cacao = {
    _id: 'cacao',
    name: 'Cacao',
    unit: 'kg',
    stockQuantity: 2,
    minStock: 1,
    pricePerUnit: 8,
  };
  const oeufs = { _id: 'oeufs', name: 'Oeufs', unit: 'piece', stockQuantity: 3, pricePerUnit: 0.2 };

  it('calcule le reste prévu et le seuil', () => {
    const needs = computeStockNeeds([
      {
        variant: {
          portions: 6,
          ingredients: [{ ingredientId: cacao, quantity: 0.6, unit: 'kg' }],
          appliances: [],
        },
        quantity: 2,
      },
    ]);
    expect(needs[0]).toMatchObject({ needed: 1.2, remaining: 0.8, missing: 0, status: 'low' });
  });

  it('signale le manque, convertit g → kg et additionne les lignes', () => {
    const needs = computeStockNeeds([
      {
        variant: {
          portions: 6,
          ingredients: [
            { ingredientId: cacao, quantity: 1500, unit: 'g' },
            { ingredientId: oeufs, quantity: 2, unit: 'piece' },
          ],
          appliances: [],
        },
        quantity: 1,
      },
      {
        variant: {
          portions: 6,
          ingredients: [{ ingredientId: cacao, quantity: 1, unit: 'kg' }],
          appliances: [],
        },
        quantity: 1,
      },
    ]);
    const c = needs.find((n) => n.ingredientId === 'cacao')!;
    expect(c).toMatchObject({ needed: 2.5, remaining: -0.5, missing: 0.5, status: 'missing' });
    expect(needs.find((n) => n.ingredientId === 'oeufs')).toMatchObject({ status: 'ok' });
  });

  it('ignore les ingrédients apportés par le client et signale les unités incompatibles', () => {
    const needs = computeStockNeeds([
      {
        variant: {
          portions: 6,
          ingredients: [
            { ingredientId: cacao, quantity: 1, unit: 'kg' },
            { ingredientId: oeufs, quantity: 1, unit: 'g' },
          ],
          appliances: [],
        },
        quantity: 1,
        clientProvidedIngredients: ['cacao'],
      },
    ]);
    expect(needs).toHaveLength(1);
    expect(needs[0]).toMatchObject({ ingredientId: 'oeufs', unitMismatch: true });
  });

  it('isBelowThreshold : strictement inférieur, seulement si un seuil est défini', () => {
    expect(isBelowThreshold(0.5, 1)).toBe(true);
    expect(isBelowThreshold(1, 1)).toBe(false);
    expect(isBelowThreshold(0, null)).toBe(false);
  });
});

describe('PriceCalculationService.computeVariantPrice', () => {
  it('applique la même formule que calculateVariantPrice', () => {
    const result = PriceCalculationService.computeVariantPrice(
      {
        portions: 6,
        ingredients: [
          {
            ingredientId: { _id: 'f', name: 'Farine', pricePerUnit: 1.5, unit: 'kg' },
            quantity: 0.5,
            unit: 'kg',
          },
        ],
        appliances: [
          {
            applianceId: { _id: 'o', name: 'Four', powerConsumption: 2000, unit: 'W' },
            duration: 45,
          },
        ],
      },
      { stegTariff: 0.235, waterForfaitSmall: 0.3, waterForfaitLarge: 0.5, marginPercent: 15 }
    );
    // 0.75 + (2 kW × 0.75 h × 0.235 = 0.3525) + 0.3 = 1.4025 ; marge 15 % = 0.210375
    expect(result.ingredientsCost).toBe(0.75);
    expect(result.electricityCost).toBe(0.353);
    expect(result.total).toBe(1.613);
  });
});
