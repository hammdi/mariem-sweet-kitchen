import { PriceCalculationService } from '../services/priceCalculationService';
import { Recipe } from '../models/Recipe';
import { Settings } from '../models/Settings';

// Mock les modèles Mongoose
jest.mock('../models/Recipe');
jest.mock('../models/Settings');

const mockedRecipe = Recipe as jest.Mocked<typeof Recipe>;
const mockedSettings = Settings as jest.Mocked<typeof Settings>;

// Helper : crée un faux recipe populé
function makePopulatedRecipe(overrides: Partial<{
  portions: number;
  ingredients: { _id: string; name: string; pricePerUnit: number }[];
  quantities: number[];
  units: string[];
  appliances: { _id: string; name: string; powerConsumption: number; unit: string }[];
  durations: number[];
}> = {}) {
  const {
    portions = 6,
    ingredients = [
      { _id: 'ing1', name: 'Farine', pricePerUnit: 1.5 },
      { _id: 'ing2', name: 'Sucre', pricePerUnit: 2.0 },
      { _id: 'ing3', name: 'Beurre', pricePerUnit: 8.0 },
    ],
    quantities = [0.5, 0.3, 0.25],
    units = ['kg', 'kg', 'kg'],
    appliances = [
      { _id: 'app1', name: 'Four', powerConsumption: 2000, unit: 'W' },
    ],
    durations = [45], // 45 minutes
  } = overrides;

  return {
    _id: 'recipe1',
    name: 'Gâteau Test',
    variants: [
      {
        sizeName: 'Petit',
        portions,
        ingredients: ingredients.map((ing, i) => ({
          ingredientId: ing,
          quantity: quantities[i],
          unit: units[i],
        })),
        appliances: appliances.map((app, i) => ({
          applianceId: app,
          duration: durations[i],
        })),
      },
    ],
  };
}

// Helper : setup les mocks
function setupMocks(recipe: ReturnType<typeof makePopulatedRecipe> | null, settingsOverrides: Record<string, number> = {}) {
  const populateChain = {
    populate: jest.fn().mockReturnValue(recipe),
  };
  mockedRecipe.findById = jest.fn().mockReturnValue({
    populate: jest.fn().mockReturnValue(populateChain),
  }) as any;

  const defaultSettings = [
    { key: 'stegTariff', value: 0.235 },
    { key: 'waterForfaitSmall', value: 0.3 },
    { key: 'waterForfaitLarge', value: 0.5 },
    { key: 'marginPercent', value: 15 },
  ];

  // Appliquer les overrides
  const settings = defaultSettings.map(s => ({
    ...s,
    value: settingsOverrides[s.key] !== undefined ? settingsOverrides[s.key] : s.value,
  }));

  mockedSettings.find = jest.fn().mockResolvedValue(settings) as any;
}

describe('PriceCalculationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateVariantPrice', () => {
    it('calcule correctement le prix avec tous les ingrédients', async () => {
      const recipe = makePopulatedRecipe();
      setupMocks(recipe);

      const result = await PriceCalculationService.calculateVariantPrice('recipe1', 0, []);

      // Ingrédients : 0.5*1.5 + 0.3*2.0 + 0.25*8.0 = 0.75 + 0.6 + 2.0 = 3.35
      expect(result.ingredientsCost).toBe(3.35);

      // Électricité : 2000W = 2kW, 45min = 0.75h, 2 * 0.75 * 0.235 = 0.3525
      expect(result.electricityCost).toBe(0.353); // arrondi au millime

      // Eau : 6 portions <= 8 → forfait petit = 0.3
      expect(result.waterCost).toBe(0.3);

      // Marge : (3.35 + 0.3525 + 0.3) * 0.15 = 4.0025 * 0.15 = 0.600375
      // Subtotal arrondi : 3.35 + 0.353 + 0.3 = 4.003
      const subtotal = 3.35 + 0.3525 + 0.3;
      const expectedMargin = Math.round(subtotal * 15 / 100 * 1000) / 1000;
      expect(result.margin).toBe(expectedMargin);

      // Total > 0
      expect(result.total).toBeGreaterThan(0);
      expect(result.total).toBe(Math.round((subtotal + subtotal * 0.15) * 1000) / 1000);
    });

    it('déduit les ingrédients fournis par le client', async () => {
      const recipe = makePopulatedRecipe();
      setupMocks(recipe);

      // Le client fournit le Beurre (ing3, le plus cher à 8.0/kg)
      const result = await PriceCalculationService.calculateVariantPrice('recipe1', 0, ['ing3']);

      // Ingrédients facturés : 0.5*1.5 + 0.3*2.0 = 0.75 + 0.6 = 1.35 (beurre = 0)
      expect(result.ingredientsCost).toBe(1.35);

      // Vérifier le détail
      const beurreDetail = result.ingredientsDetail.find(d => d.name === 'Beurre');
      expect(beurreDetail?.providedByClient).toBe(true);
      expect(beurreDetail?.cost).toBe(0);

      const farineDetail = result.ingredientsDetail.find(d => d.name === 'Farine');
      expect(farineDetail?.providedByClient).toBe(false);
      expect(farineDetail?.cost).toBe(0.75);
    });

    it('utilise le forfait eau large pour > 8 portions', async () => {
      const recipe = makePopulatedRecipe({ portions: 12 });
      setupMocks(recipe);

      const result = await PriceCalculationService.calculateVariantPrice('recipe1', 0, []);

      expect(result.waterCost).toBe(0.5); // waterForfaitLarge
    });

    it('utilise le forfait eau petit pour <= 8 portions', async () => {
      const recipe = makePopulatedRecipe({ portions: 8 });
      setupMocks(recipe);

      const result = await PriceCalculationService.calculateVariantPrice('recipe1', 0, []);

      expect(result.waterCost).toBe(0.3); // waterForfaitSmall
    });

    it('respecte les settings personnalisés', async () => {
      const recipe = makePopulatedRecipe({
        ingredients: [{ _id: 'ing1', name: 'Farine', pricePerUnit: 2.0 }],
        quantities: [1],
        units: ['kg'],
        appliances: [],
        durations: [],
      });
      setupMocks(recipe, { marginPercent: 20, waterForfaitSmall: 0.5 });

      const result = await PriceCalculationService.calculateVariantPrice('recipe1', 0, []);

      // Ingrédients : 1 * 2.0 = 2.0
      expect(result.ingredientsCost).toBe(2.0);
      // Électricité : 0 (pas d'appareils)
      expect(result.electricityCost).toBe(0);
      // Eau : 0.5 (override)
      expect(result.waterCost).toBe(0.5);
      // Marge : (2.0 + 0 + 0.5) * 0.20 = 0.5
      expect(result.margin).toBe(0.5);
      // Total : 2.0 + 0 + 0.5 + 0.5 = 3.0
      expect(result.total).toBe(3);
    });

    it('gère une recette avec un appareil en kW', async () => {
      const recipe = makePopulatedRecipe({
        ingredients: [],
        quantities: [],
        units: [],
        appliances: [{ _id: 'app1', name: 'Four', powerConsumption: 2, unit: 'kW' }],
        durations: [60], // 1 heure
      });
      setupMocks(recipe);

      const result = await PriceCalculationService.calculateVariantPrice('recipe1', 0, []);

      // 2 kW * 1h * 0.235 = 0.47
      expect(result.electricityCost).toBe(0.47);
      expect(result.appliancesDetail[0].name).toBe('Four');
      expect(result.appliancesDetail[0].duration).toBe(60);
    });

    it('retourne le détail complet des ingrédients', async () => {
      const recipe = makePopulatedRecipe();
      setupMocks(recipe);

      const result = await PriceCalculationService.calculateVariantPrice('recipe1', 0, []);

      expect(result.ingredientsDetail).toHaveLength(3);
      expect(result.ingredientsDetail[0]).toEqual({
        name: 'Farine',
        quantity: 0.5,
        unit: 'kg',
        unitPrice: 1.5,
        cost: 0.75,
        providedByClient: false,
      });
    });

    it('retourne le détail complet des appareils', async () => {
      const recipe = makePopulatedRecipe();
      setupMocks(recipe);

      const result = await PriceCalculationService.calculateVariantPrice('recipe1', 0, []);

      expect(result.appliancesDetail).toHaveLength(1);
      expect(result.appliancesDetail[0]).toMatchObject({
        name: 'Four',
        duration: 45,
        powerW: 2000,
      });
    });

    it('arrondit au millime (3 décimales)', async () => {
      const recipe = makePopulatedRecipe({
        ingredients: [{ _id: 'ing1', name: 'Sel', pricePerUnit: 0.333 }],
        quantities: [0.777],
        units: ['kg'],
      });
      setupMocks(recipe);

      const result = await PriceCalculationService.calculateVariantPrice('recipe1', 0, []);

      // Vérifier que tout est arrondi à 3 décimales max
      const decimals = (n: number) => {
        const str = n.toString();
        const dot = str.indexOf('.');
        return dot === -1 ? 0 : str.length - dot - 1;
      };
      expect(decimals(result.ingredientsCost)).toBeLessThanOrEqual(3);
      expect(decimals(result.electricityCost)).toBeLessThanOrEqual(3);
      expect(decimals(result.margin)).toBeLessThanOrEqual(3);
      expect(decimals(result.total)).toBeLessThanOrEqual(3);
    });

    it('lance une erreur si la recette n\'existe pas', async () => {
      setupMocks(null);

      await expect(
        PriceCalculationService.calculateVariantPrice('fake', 0, [])
      ).rejects.toThrow('Recette non trouvee');
    });

    it('lance une erreur si le variant n\'existe pas', async () => {
      const recipe = makePopulatedRecipe();
      setupMocks(recipe);

      await expect(
        PriceCalculationService.calculateVariantPrice('recipe1', 99, [])
      ).rejects.toThrow('Taille non trouvee');
    });

    it('gère une recette sans ingrédients ni appareils', async () => {
      const recipe = makePopulatedRecipe({
        ingredients: [],
        quantities: [],
        units: [],
        appliances: [],
        durations: [],
      });
      setupMocks(recipe);

      const result = await PriceCalculationService.calculateVariantPrice('recipe1', 0, []);

      expect(result.ingredientsCost).toBe(0);
      expect(result.electricityCost).toBe(0);
      // Eau toujours facturée
      expect(result.waterCost).toBe(0.3);
      // Marge sur eau seule : 0.3 * 0.15 = 0.045
      expect(result.margin).toBe(0.045);
      expect(result.total).toBe(0.345);
    });

    it('gère le client qui fournit TOUS les ingrédients', async () => {
      const recipe = makePopulatedRecipe();
      setupMocks(recipe);

      const result = await PriceCalculationService.calculateVariantPrice(
        'recipe1', 0, ['ing1', 'ing2', 'ing3']
      );

      expect(result.ingredientsCost).toBe(0);
      // Le total ne contient que électricité + eau + marge
      expect(result.total).toBeGreaterThan(0);
      // Tous marqués providedByClient
      result.ingredientsDetail.forEach(d => {
        expect(d.providedByClient).toBe(true);
        expect(d.cost).toBe(0);
      });
    });
  });
});
