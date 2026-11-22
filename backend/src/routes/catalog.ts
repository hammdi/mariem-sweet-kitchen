import express, { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Recipe, IRecipe } from '../models/Recipe';
import { Settings } from '../models/Settings';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { PriceCalculationService, PopulatedVariant } from '../services/priceCalculationService';
import { escapeRegex } from '../utils/regex';

/**
 * CATALOGUE CLIENT (public, sans connexion)
 *
 * Vitrine : photos, description, recommandations, tailles (portions, poids,
 * dimensions, façon de vente) et prix de chaque taille.
 * JAMAIS la composition : ni ingrédients, ni quantités, ni machines, ni
 * détail du calcul (coûts, marge). Le prix peut être masqué (Paramètres).
 */
const router = express.Router();

async function showPrices(): Promise<boolean> {
  const s = await Settings.findOne({ key: 'catalogShowPrices' });
  return s ? s.value !== 0 : true; // par défaut : prix affichés
}

async function toCatalogItem(
  recipe: IRecipe,
  withPrices: boolean,
  settings: Awaited<ReturnType<typeof PriceCalculationService.getSettings>> | null
) {
  return {
    _id: recipe._id,
    name: recipe.name,
    description: recipe.description,
    images: recipe.images,
    categories: recipe.categories,
    recommendations: recipe.recommendations || [],
    variants: recipe.variants.map((v) => {
      let price: number | null = null;
      if (withPrices && settings) {
        try {
          price = PriceCalculationService.computeVariantPrice(
            v as unknown as PopulatedVariant,
            settings
          ).total;
        } catch {
          price = null; // pas de prix plutôt qu'un prix faux
        }
      }
      return {
        sizeName: v.sizeName,
        portions: v.portions,
        weightGrams: v.weightGrams ?? null,
        dimensions: v.dimensions || '',
        saleMode: v.saleMode || '',
        price,
      };
    }),
  };
}

// @desc    Catalogue (public)
// @route   GET /api/catalog?search=&category=
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const query: Record<string, unknown> = { isActive: true };
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      query.name = { $regex: escapeRegex(req.query.search.trim()), $options: 'i' };
    }
    if (typeof req.query.category === 'string' && req.query.category) {
      query.categories = req.query.category;
    }
    const withPrices = await showPrices();
    const [recipes, settings] = await Promise.all([
      Recipe.find(query)
        .sort({ createdAt: -1 })
        .limit(200)
        .populate(
          withPrices ? ['variants.ingredients.ingredientId', 'variants.appliances.applianceId'] : []
        ),
      withPrices ? PriceCalculationService.getSettings() : Promise.resolve(null),
    ]);
    const items = await Promise.all(recipes.map((r) => toCatalogItem(r, withPrices, settings)));
    const categories = Array.from(new Set(items.flatMap((i) => i.categories))).sort();
    res.json({ success: true, data: { items, categories, showPrices: withPrices } });
  })
);

// @desc    Une création du catalogue (public)
// @route   GET /api/catalog/:id
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    if (!Types.ObjectId.isValid(req.params.id)) {
      throw createError('Création introuvable', 404);
    }
    const withPrices = await showPrices();
    const recipe = await Recipe.findOne({ _id: req.params.id, isActive: true }).populate(
      withPrices ? ['variants.ingredients.ingredientId', 'variants.appliances.applianceId'] : []
    );
    if (!recipe) {
      throw createError('Création introuvable', 404);
    }
    const settings = withPrices ? await PriceCalculationService.getSettings() : null;
    res.json({
      success: true,
      data: { item: await toCatalogItem(recipe, withPrices, settings), showPrices: withPrices },
    });
  })
);

export default router;
