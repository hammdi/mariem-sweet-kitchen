import { Recipe } from '../../models/Recipe';
import { Ingredient } from '../../models/Ingredient';
import { Appliance } from '../../models/Appliance';
import { Settings } from '../../models/Settings';

// Version legere d'une recette utilisee pour construire le contexte envoye au LLM.
// On exclut les quantites et durees des recettes similaires pour rester compact.
export interface RecipeFormInput {
  name?: string;
  categories?: string[];
  description?: string;
  variants?: Array<{
    sizeName?: string;
    portions?: number;
    ingredients?: Array<{
      ingredientId?: string;
      name?: string;
      quantity?: number;
      unit?: string;
    }>;
    appliances?: Array<{
      applianceId?: string;
      name?: string;
      duration?: number;
    }>;
  }>;
}

export interface BuiltContext {
  catalog: {
    ingredients: string[]; // noms uniquement
    appliances: Array<{ name: string; powerW: number }>;
  };
  similarRecipes: Array<{
    name: string;
    categories: string[];
    ingredientNames: string[];
    variantSizes: string[];
  }>;
  pricing: {
    stegTariff: number;
    waterForfaitSmall: number;
    waterForfaitLarge: number;
    marginPercent: number;
  };
}

/**
 * Collecte le contexte DB pertinent pour aider le LLM a raisonner
 * sur la recette en cours d'edition. Reste compact pour maitriser
 * le volume de tokens envoye.
 */
export async function buildRecipeContext(formState: RecipeFormInput): Promise<BuiltContext> {
  const [allIngredients, allAppliances, allSettings] = await Promise.all([
    Ingredient.find({ isActive: true }).select('name').lean(),
    Appliance.find({ isActive: true }).select('name powerConsumption').lean(),
    Settings.find().lean(),
  ]);

  // Recettes similaires : priorite aux categories partagees, sinon recettes
  // recentes. On plafonne a 5 pour rester compact.
  const categoriesFilter = formState.categories?.length
    ? { isActive: true, categories: { $in: formState.categories } }
    : { isActive: true };

  const similarDocs = await Recipe.find(categoriesFilter)
    .populate('variants.ingredients.ingredientId', 'name')
    .sort({ updatedAt: -1 })
    .limit(5)
    .lean();

  const similarRecipes = similarDocs.map(r => {
    const ingredientNames = new Set<string>();
    const variantSizes: string[] = [];
    for (const v of r.variants || []) {
      if (v.sizeName) {variantSizes.push(v.sizeName);}
      for (const vi of v.ingredients || []) {
        const ing = vi.ingredientId as unknown as { name?: string } | null;
        if (ing?.name) {ingredientNames.add(ing.name);}
      }
    }
    return {
      name: r.name,
      categories: r.categories || [],
      ingredientNames: Array.from(ingredientNames),
      variantSizes,
    };
  });

  const pricingDefaults = {
    stegTariff: 0.235,
    waterForfaitSmall: 0.3,
    waterForfaitLarge: 0.5,
    marginPercent: 15,
  };
  const pricing = { ...pricingDefaults };
  for (const s of allSettings) {
    if (s.key in pricing) {
      (pricing as any)[s.key] = s.value;
    }
  }

  return {
    catalog: {
      ingredients: allIngredients.map(i => i.name),
      appliances: allAppliances.map(a => ({
        name: a.name,
        powerW: a.powerConsumption,
      })),
    },
    similarRecipes,
    pricing,
  };
}
