import express, { Request, Response } from 'express';
import { Types } from 'mongoose';
import { PriceCalculationService, PopulatedVariant } from '../services/priceCalculationService';
import { ForecastLine } from '../services/stockForecastService';
import { computeAllocation } from '../services/purchaseNeedService';
import { Recipe } from '../models/Recipe';
import { Ingredient } from '../models/Ingredient';
import { Appliance } from '../models/Appliance';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { round } from '../services/unitService';

const router = express.Router();

// @desc    Calculer le prix d'un variant (public)
// @route   POST /api/prices/calculate
router.post(
  '/calculate',
  asyncHandler(async (req: Request, res: Response) => {
    const { recipeId, variantIndex, clientProvidedIngredients } = req.body;

    if (!recipeId || variantIndex === undefined) {
      throw createError('recipeId et variantIndex sont requis', 400);
    }

    const result = await PriceCalculationService.calculateVariantPrice(
      recipeId,
      variantIndex,
      clientProvidedIngredients || []
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

// @desc    Prix de chaque taille de chaque recette (pour la saisie de commande)
// @route   GET /api/prices/catalog
// @access  Admin
router.get(
  '/catalog',
  authenticate,
  authorize('admin'),
  asyncHandler(async (_req: Request, res: Response) => {
    const [recipes, settings] = await Promise.all([
      Recipe.find({ isActive: true })
        .populate('variants.ingredients.ingredientId')
        .populate('variants.appliances.applianceId'),
      PriceCalculationService.getSettings(),
    ]);

    const prices: Record<
      string,
      { sizeName: string; portions: number; total: number | null; error?: string }[]
    > = {};
    for (const r of recipes) {
      prices[r._id.toString()] = r.variants.map((v) => {
        try {
          return {
            sizeName: v.sizeName,
            portions: v.portions,
            total: PriceCalculationService.computeVariantPrice(
              v as unknown as PopulatedVariant,
              settings
            ).total,
          };
        } catch (e) {
          // unite incompatible : pas de prix plutot qu'un prix faux
          return {
            sizeName: v.sizeName,
            portions: v.portions,
            total: null,
            error: (e as Error).message,
          };
        }
      });
    }
    res.json({ success: true, data: { prices } });
  })
);

const parseNeededBy = (input: unknown): Date | null => {
  if (!input) {
    return null;
  }
  const d = new Date(input as string);
  return isNaN(d.getTime()) ? null : d;
};

interface QuoteItemInput {
  recipeId?: string;
  variantIndex?: number;
  quantity?: number;
  clientProvidedIngredients?: string[];
  custom?: {
    name?: string;
    sizeName?: string;
    portions?: number;
    ingredients?: { ingredientId: string; quantity: number; unit: string }[];
    appliances?: { applianceId: string; duration: number }[];
  };
}

// @desc    Devis d'une commande AVANT création : prix par ligne, total, besoins en stock
// @route   POST /api/prices/quote
// @access  Admin
// Lecture seule — ne crée ni recette ni commande.
router.post(
  '/quote',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const items: QuoteItemInput[] = Array.isArray(req.body.items) ? req.body.items : [];
    const fees: { label?: string; amount?: number }[] = Array.isArray(req.body.additionalFees)
      ? req.body.additionalFees
      : [];
    const settings = await PriceCalculationService.getSettings();

    const lines: any[] = [];
    const errors: string[] = [];
    const forecast: ForecastLine[] = [];
    let itemsTotalRaw = 0; // même arrondi que Order.pre('save') : sur la somme, pas par ligne

    for (const item of items) {
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const provided = (item.clientProvidedIngredients || []).map(String);
      let variant: PopulatedVariant | null = null;
      let label = '';
      let sizeName = '';

      if (item.recipeId && Types.ObjectId.isValid(item.recipeId)) {
        const recipe = await Recipe.findById(item.recipeId)
          .populate('variants.ingredients.ingredientId')
          .populate('variants.appliances.applianceId');
        const v = recipe?.variants[item.variantIndex ?? 0];
        if (recipe && v) {
          variant = v as unknown as PopulatedVariant;
          label = recipe.name;
          sizeName = v.sizeName;
        }
      } else if (item.custom) {
        const c = item.custom;
        const ingIds = (c.ingredients || [])
          .map((i) => i.ingredientId)
          .filter((id) => id && Types.ObjectId.isValid(id));
        const appIds = (c.appliances || [])
          .map((a) => a.applianceId)
          .filter((id) => id && Types.ObjectId.isValid(id));
        const [ings, apps] = await Promise.all([
          Ingredient.find({ _id: { $in: ingIds } }),
          Appliance.find({ _id: { $in: appIds } }),
        ]);
        const ingMap = new Map(ings.map((i) => [i._id.toString(), i]));
        const appMap = new Map(apps.map((a) => [a._id.toString(), a]));
        variant = {
          portions: c.portions || 1,
          ingredients: (c.ingredients || [])
            .filter((i) => ingMap.has(String(i.ingredientId)))
            .map((i) => ({
              ingredientId: ingMap.get(String(i.ingredientId)),
              quantity: Number(i.quantity) || 0,
              unit: i.unit,
            })),
          appliances: (c.appliances || [])
            .filter((a) => appMap.has(String(a.applianceId)))
            .map((a) => ({
              applianceId: appMap.get(String(a.applianceId)),
              duration: Number(a.duration) || 0,
            })),
        };
        label = c.name || 'Recette spéciale';
        sizeName = c.sizeName || 'Standard';
      }

      if (!variant) {
        lines.push(null); // ligne incomplète (recette pas encore choisie)
        continue;
      }

      let breakdown;
      try {
        breakdown = PriceCalculationService.computeVariantPrice(variant, settings, provided);
      } catch (e) {
        errors.push(`${label} : ${(e as Error).message}`);
        lines.push(null);
        continue;
      }
      lines.push({
        label,
        sizeName,
        quantity,
        unitPrice: breakdown.total,
        lineTotal: round(breakdown.total * quantity),
        breakdown: {
          ingredientsCost: breakdown.ingredientsCost,
          electricityCost: breakdown.electricityCost,
          waterCost: breakdown.waterCost,
          margin: breakdown.margin,
        },
      });
      forecast.push({ variant, quantity, clientProvidedIngredients: provided, label });
      itemsTotalRaw += breakdown.total * quantity;
    }

    const itemsTotal = itemsTotalRaw;
    const feesTotal = fees.reduce((s, f) => s + (Number(f.amount) > 0 ? Number(f.amount) : 0), 0);

    res.json({
      success: true,
      data: {
        lines,
        itemsTotal: round(itemsTotal),
        feesTotal: round(feesTotal),
        total: round(itemsTotal + feesTotal),
        // stock disponible pour cette nouvelle commande, apres les commandes deja prevues avant
        stockNeeds:
          (
            await computeAllocation({
              lines: forecast,
              neededBy: parseNeededBy(req.body.requestedDate),
            })
          ).allocation.get('__new__') || [],
        errors,
      },
    });
  })
);

export default router;
