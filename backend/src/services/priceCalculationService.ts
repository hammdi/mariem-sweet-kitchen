import { Recipe } from '../models/Recipe';
import { Settings } from '../models/Settings';
import { convertQuantityStrict } from './unitService';

export interface PriceBreakdown {
  ingredientsCost: number;
  electricityCost: number;
  waterCost: number;
  margin: number;
  total: number;
  marginPercent: number;
  ingredientsDetail: {
    ingredientId: string;
    name: string;
    quantity: number; // quantité de la recette, dans l'unité de la recette
    unit: string;
    quantityInStockUnit: number; // même quantité convertie dans l'unité de l'ingrédient
    stockUnit: string; // unité de l'ingrédient (celle du prix et du stock)
    unitPrice: number; // DT par stockUnit
    fullCost: number; // coût si Rahma fournit l'ingrédient
    cost: number; // 0 si apporté par le client
    providedByClient: boolean;
  }[];
  appliancesDetail: {
    name: string;
    duration: number;
    powerW: number;
    cost: number;
  }[];
}

// Variant dont ingredientId / applianceId sont des documents chargés (ou null)
export interface PopulatedVariant {
  portions: number;
  ingredients: { ingredientId: any; quantity: number; unit: string }[];
  appliances: { applianceId: any; duration: number }[];
}

/**
 * Valeurs figées au moment de la commande : permettent de recalculer le prix
 * (ex: client qui apporte un ingrédient) SANS reprendre les prix actuels.
 */
export interface PriceSnapshot {
  ingredients: { ingredientId: string; name: string; fullCost: number }[];
  electricityCost: number;
  waterCost: number;
  marginPercent: number;
  capturedAt: Date;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export class PriceCalculationService {
  /**
   * Récupère les paramètres depuis la collection Settings
   */
  static async getSettings() {
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
    return this.computeVariantPrice(
      variant as unknown as PopulatedVariant,
      settings,
      clientProvidedIngredients
    );
  }

  /**
   * Calcul pur à partir d'un variant dont ingrédients et machines sont déjà
   * chargés (populate). Même formule que calculateVariantPrice — utilisé aussi
   * pour l'aperçu de prix d'une recette spéciale pas encore enregistrée.
   */
  static computeVariantPrice(
    variant: PopulatedVariant,
    settings: Record<string, number>,
    clientProvidedIngredients: string[] = []
  ): PriceBreakdown {
    // Coût des ingrédients
    let ingredientsCost = 0;
    const ingredientsDetail: PriceBreakdown['ingredientsDetail'] = [];

    for (const vi of variant.ingredients) {
      const ingredient = vi.ingredientId as any;
      if (!ingredient) {
        continue;
      }

      const providedByClient = clientProvidedIngredients.includes(ingredient._id.toString());
      // Le prix est exprimé par unité de l'ingrédient : convertir la quantité de la
      // recette dans cette unité (250 g × 0,80 DT/kg = 0,25 kg × 0,80 = 0,20 DT)
      const quantityInStockUnit = convertQuantityStrict(
        vi.quantity,
        vi.unit,
        ingredient.unit,
        ingredient.name
      );
      const fullCost = ingredient.pricePerUnit * quantityInStockUnit;
      const cost = providedByClient ? 0 : fullCost;

      ingredientsCost += cost;
      ingredientsDetail.push({
        ingredientId: ingredient._id.toString(),
        name: ingredient.name,
        quantity: vi.quantity,
        unit: vi.unit,
        quantityInStockUnit,
        stockUnit: ingredient.unit,
        unitPrice: ingredient.pricePerUnit,
        fullCost,
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

    return {
      ...this.finalize(ingredientsCost, electricityCost, waterCost, settings.marginPercent),
      ingredientsDetail,
      appliancesDetail,
    };
  }

  /** Formule finale, commune au calcul normal et au recalcul depuis un instantané. */
  private static finalize(
    ingredientsCost: number,
    electricityCost: number,
    waterCost: number,
    marginPercent: number
  ) {
    const subtotal = ingredientsCost + electricityCost + waterCost;
    const margin = (subtotal * marginPercent) / 100;
    const total = subtotal + margin;
    return {
      ingredientsCost: round3(ingredientsCost),
      electricityCost: round3(electricityCost),
      waterCost,
      margin: round3(margin),
      total: round3(total),
      marginPercent,
    };
  }

  /** Instantané à stocker sur la ligne de commande. */
  static snapshotOf(breakdown: PriceBreakdown): PriceSnapshot {
    return {
      ingredients: breakdown.ingredientsDetail.map((d) => ({
        ingredientId: d.ingredientId,
        name: d.name,
        fullCost: d.fullCost,
      })),
      // électricité non arrondie : recalcul identique au calcul initial
      electricityCost: breakdown.appliancesDetail.reduce((s, a) => s + a.cost, 0),
      waterCost: breakdown.waterCost,
      marginPercent: breakdown.marginPercent,
      capturedAt: new Date(),
    };
  }

  /**
   * Recalcule le prix d'une ligne de commande avec les prix FIGÉS à la création
   * (seule la liste des ingrédients apportés par le client change).
   */
  static recomputeFromSnapshot(snapshot: PriceSnapshot, clientProvidedIngredients: string[] = []) {
    const provided = clientProvidedIngredients.map(String);
    const ingredientsCost = snapshot.ingredients
      .filter((i) => !provided.includes(String(i.ingredientId)))
      .reduce((s, i) => s + i.fullCost, 0);
    return this.finalize(
      ingredientsCost,
      snapshot.electricityCost,
      snapshot.waterCost,
      snapshot.marginPercent
    );
  }
}
