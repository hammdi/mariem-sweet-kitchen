import {
  areUnitsCompatible,
  convertQuantity,
  convertQuantityStrict,
  convertUnitPrice,
  UnitConversionError,
} from '../services/unitService';
import { PriceCalculationService } from '../services/priceCalculationService';
import { computeConsumption, computeStockNeeds } from '../services/stockForecastService';

describe('unitService — conversions supportées', () => {
  it.each([
    [250, 'g', 'kg', 0.25],
    [1.75, 'kg', 'g', 1750],
    [330, 'ml', 'l', 0.33],
    [0.5, 'l', 'ml', 500],
    [3, 'piece', 'piece', 3],
    [2, 'cuillere', 'cuillere', 2],
    [1, 'tasse', 'tasse', 1],
    [1.2, 'kg', 'kg', 1.2],
  ])('%s %s → %s = %s', (q, from, to, expected) => {
    expect(convertQuantity(q, from, to)).toBeCloseTo(expected, 10);
    expect(convertQuantityStrict(q, from, to)).toBeCloseTo(expected, 10);
  });

  it.each([
    ['g', 'piece'],
    ['kg', 'l'],
    ['ml', 'g'],
    ['piece', 'kg'],
    ['cuillere', 'g'],
    ['tasse', 'ml'],
  ])('refuse %s → %s', (from, to) => {
    expect(convertQuantity(1, from, to)).toBeNull();
    expect(areUnitsCompatible(from, to)).toBe(false);
    expect(() => convertQuantityStrict(1, from, to, 'Test')).toThrow(UnitConversionError);
  });

  it("l'erreur de conversion est une erreur 400 lisible", () => {
    try {
      convertQuantityStrict(2, 'g', 'piece', 'Oeufs');
      throw new Error('aurait dû échouer');
    } catch (e) {
      expect(e).toBeInstanceOf(UnitConversionError);
      expect((e as UnitConversionError).statusCode).toBe(400);
      expect((e as Error).message).toContain('Oeufs');
    }
  });

  it('convertit un prix par unité', () => {
    expect(convertUnitPrice(0.8, 'kg', 'g')).toBeCloseTo(0.0008, 10);
    expect(convertUnitPrice(0.0008, 'g', 'kg')).toBeCloseTo(0.8, 10);
    expect(convertUnitPrice(1, 'piece', 'kg')).toBeNull();
  });
});

// Exemple obligatoire : Farine 0,80 DT/kg, recette 250 g, stock 2 kg
const farine = { _id: 'farine', name: 'Farine', unit: 'kg', pricePerUnit: 0.8, stockQuantity: 2 };
const oeufs = { _id: 'oeufs', name: 'Oeufs', unit: 'piece', pricePerUnit: 0.2, stockQuantity: 12 };
const settings = {
  stegTariff: 0.235,
  waterForfaitSmall: 0,
  waterForfaitLarge: 0,
  marginPercent: 0,
};

describe('exemple 250 g de farine vendue au kg', () => {
  const variant = {
    portions: 6,
    ingredients: [{ ingredientId: farine, quantity: 250, unit: 'g' }],
    appliances: [],
  };

  it('coût de recette = 0,20 DT (et non 200 DT)', () => {
    const price = PriceCalculationService.computeVariantPrice(variant, settings);
    expect(price.ingredientsCost).toBe(0.2);
    expect(price.ingredientsDetail[0]).toMatchObject({
      quantity: 250,
      unit: 'g',
      quantityInStockUnit: 0.25,
      stockUnit: 'kg',
      cost: 0.2,
    });
  });

  it('prévision : 2 kg − 250 g = 1,75 kg restant', () => {
    const [need] = computeStockNeeds([{ variant, quantity: 1 }]);
    expect(need).toMatchObject({ unit: 'kg', stock: 2, needed: 0.25, remaining: 1.75, missing: 0 });
  });

  it('la consommation (utilisée par la déduction réelle) vaut exactement le besoin prévu', () => {
    const lines = [{ variant, quantity: 3 }];
    const { items } = computeConsumption(lines);
    const needs = computeStockNeeds(lines);
    expect(items[0].quantity).toBe(0.75);
    expect(needs[0].needed).toBe(items[0].quantity);
  });

  it('refuse proprement une recette en g pour un ingrédient à la pièce', () => {
    const bad = {
      portions: 6,
      ingredients: [{ ingredientId: oeufs, quantity: 100, unit: 'g' }],
      appliances: [],
    };
    expect(() => PriceCalculationService.computeVariantPrice(bad, settings)).toThrow(
      UnitConversionError
    );
    const { items, unitIssues } = computeConsumption([{ variant: bad, quantity: 1 }]);
    expect(items).toHaveLength(0); // jamais de quantité "au hasard"
    expect(unitIssues[0]).toMatchObject({ name: 'Oeufs', recipeUnit: 'g', stockUnit: 'piece' });
  });
});

describe('prix figé (instantané de commande)', () => {
  it('recalculer depuis l’instantané redonne le même prix, puis retire un ingrédient apporté', () => {
    const variant = {
      portions: 6,
      ingredients: [
        { ingredientId: farine, quantity: 250, unit: 'g' },
        { ingredientId: oeufs, quantity: 2, unit: 'piece' },
      ],
      appliances: [
        {
          applianceId: { _id: 'four', name: 'Four', powerConsumption: 2000, unit: 'W' },
          duration: 45,
        },
      ],
    };
    const s = {
      stegTariff: 0.235,
      waterForfaitSmall: 0.3,
      waterForfaitLarge: 0.5,
      marginPercent: 15,
    };
    const price = PriceCalculationService.computeVariantPrice(variant, s);
    const snapshot = PriceCalculationService.snapshotOf(price);

    expect(PriceCalculationService.recomputeFromSnapshot(snapshot).total).toBe(price.total);
    expect(PriceCalculationService.recomputeFromSnapshot(snapshot, ['oeufs']).total).toBe(
      PriceCalculationService.computeVariantPrice(variant, s, ['oeufs']).total
    );

    // Le prix de la farine change ensuite : l'instantané ne bouge pas
    farine.pricePerUnit = 1.6;
    expect(PriceCalculationService.recomputeFromSnapshot(snapshot).total).toBe(price.total);
    farine.pricePerUnit = 0.8;
  });
});
