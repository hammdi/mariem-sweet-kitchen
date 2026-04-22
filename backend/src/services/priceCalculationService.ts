import { Recipe } from '../models/Recipe';
import { Settings } from '../models/Settings';

export interface PriceBreakdown {
  ingredientsCost: number;
  electricityCost: number;
  waterCost: number;
  margin: number;
  total: number;
  ingredientsDetail: {
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    cost: number;
    providedByClient: boolean;
  }[];
  appliancesDetail: {
    name: string;
    duration: number;
    powerW: number;
    cost: number;
  }[];
}

export class PriceCalculationService {
  /**
   * Récupère les paramètres depuis la collection Settings
   */
  private static async getSettings() {
    const settings = await Settings.find();
    const result: Record<string, number> = {
      stegTariff: 0.235,
      waterForfaitSmall: 0.3,
      waterForfaitLarge: 0.5,
      marginPercent: 15,
    };
    settings.forEach((s) => {
      result[s.key] = s.value;
    });
    return result;
  }

  /**
   * Calcule le prix d'un variant de recette
   */
  static async calculateVariantPrice(
    recipeId: string,
    variantIndex: number,
    clientProvidedIngredients: string[] = []
  ): Promise<PriceBreakdown> {
    const recipe = await Recipe.findById(recipeId)
      .populate('variants.ingredients.ingredientId')
      .populate('variants.appliances.applianceId');

    if (!recipe) {
      throw new Error('Recette non trouvee');
    }

    const variant = recipe.variants[variantIndex];
    if (!variant) {
      throw new Error('Taille non trouvee');
    }

    const settings = await this.getSettings();

    // Coût des ingrédients
    let ingredientsCost = 0;
    const ingredientsDetail: PriceBreakdown['ingredientsDetail'] = [];

    for (const vi of variant.ingredients) {
      const ingredient = vi.ingredientId as any;
      if (!ingredient) {
        continue;
      }

      const providedByClient = clientProvidedIngredients.includes(ingredient._id.toString());
      const cost = providedByClient ? 0 : ingredient.pricePerUnit * vi.quantity;

      ingredientsCost += cost;
      ingredientsDetail.push({
        name: ingredient.name,
        quantity: vi.quantity,
        unit: vi.unit,
        unitPrice: ingredient.pricePerUnit,
        cost,
        providedByClient,
      });
    }

    // Coût électricité
    let electricityCost = 0;
    const appliancesDetail: PriceBreakdown['appliancesDetail'] = [];

    for (const va of variant.appliances) {
      const appliance = va.applianceId as any;
      if (!appliance) {
        continue;
      }

      // Convertir en kW puis multiplier par heures et tarif STEG
      const powerKw =
        appliance.unit === 'kW' ? appliance.powerConsumption : appliance.powerConsumption / 1000;
      const hours = va.duration / 60;
      const cost = powerKw * hours * settings.stegTariff;

      electricityCost += cost;
      appliancesDetail.push({
        name: appliance.name,
        duration: va.duration,
        powerW: appliance.powerConsumption,
        cost,
      });
    }

    // Coût eau (forfait selon taille)
    const waterCost =
      variant.portions <= 8 ? settings.waterForfaitSmall : settings.waterForfaitLarge;

    // Marge
    const subtotal = ingredientsCost + electricityCost + waterCost;
    const margin = (subtotal * settings.marginPercent) / 100;

    const total = subtotal + margin;

    return {
      ingredientsCost: Math.round(ingredientsCost * 1000) / 1000,
      electricityCost: Math.round(electricityCost * 1000) / 1000,
      waterCost,
      margin: Math.round(margin * 1000) / 1000,
      total: Math.round(total * 1000) / 1000,
      ingredientsDetail,
      appliancesDetail,
    };
  }
}
