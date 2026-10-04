import express, { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Ingredient } from '../models/Ingredient';
import { IngredientPrice, IIngredientPrice } from '../models/IngredientPrice';
import { PurchaseSource } from '../models/PurchaseSource';
import { StockHistory } from '../models/StockHistory';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { idempotent } from '../middleware/idempotency';
import { areUnitsCompatible, convertUnitPrice } from '../services/unitService';
import { summarizeOffers } from '../services/ingredientPriceService';
import { recordStockPurchase } from '../services/stockPurchaseService';

/**
 * Prix d'un ingrédient par source d'achat, prix moyen de référence et achats réels.
 * Monté sur /api/ingredients AVANT le routeur ingredients (sinon "/price-summary"
 * serait capturé par "/:id").
 */
const router = express.Router();

// Middleware appliqué route par route (pas de router.use) : ce routeur partage le
// préfixe /api/ingredients avec le routeur ingredients.
const admin = [authenticate, authorize('admin')];

function parseDate(input: unknown): Date {
  if (!input) {
    return new Date();
  }
  const d = new Date(input as string);
  if (isNaN(d.getTime())) {
    throw createError('Date invalide', 400);
  }
  return d;
}

function parsePrice(input: unknown): number {
  const price = typeof input === 'string' ? parseFloat(input) : (input as number);
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
    throw createError('Prix invalide', 400);
  }
  return price;
}

// Une offre compte dans la moyenne si elle et sa source sont actives
const effectiveOffers = (offers: IIngredientPrice[]) =>
  offers.map((o) => {
    const src = o.sourceId as any;
    const sourceActive = !src || typeof src !== 'object' || src.isActive !== false;
    return {
      _id: o._id,
      price: o.price,
      unit: o.unit,
      isActive: o.isActive && sourceActive,
      sourceId: o.sourceId,
    };
  });

// @desc    Résumé (nb sources, meilleur prix, prix moyen) pour tous les ingrédients
// @route   GET /api/ingredients/price-summary
router.get(
  '/price-summary',
  admin,
  asyncHandler(async (_req: Request, res: Response) => {
    const [ingredients, offers, purchases] = await Promise.all([
      Ingredient.find({ isActive: true }).select('unit'),
      IngredientPrice.find({ isActive: true }).populate('sourceId', 'name isActive'),
      // dernier prix reellement paye (achat), par ingredient
      StockHistory.aggregate([
        { $match: { type: 'restock', unitPrice: { $gt: 0 } } },
        { $sort: { purchasedAt: -1, createdAt: -1 } },
        {
          $group: {
            _id: '$ingredientId',
            unitPrice: { $first: '$unitPrice' },
            unit: { $first: '$unit' },
            date: { $first: { $ifNull: ['$purchasedAt', '$createdAt'] } },
            sourceName: { $first: '$sourceName' },
          },
        },
      ]),
    ]);

    const byIngredient = new Map<string, IIngredientPrice[]>();
    for (const o of offers) {
      const key = o.ingredientId.toString();
      byIngredient.set(key, [...(byIngredient.get(key) || []), o]);
    }

    const summaries: Record<string, ReturnType<typeof summarizeOffers>> = {};
    for (const ing of ingredients) {
      summaries[ing._id.toString()] = summarizeOffers(
        effectiveOffers(byIngredient.get(ing._id.toString()) || []),
        ing.unit
      );
    }

    const lastPurchases: Record<string, { unitPrice: number; date: Date; sourceName: string }> = {};
    for (const p of purchases) {
      const ing = ingredients.find((i) => i._id.toString() === p._id.toString());
      const price = ing ? convertUnitPrice(p.unitPrice, p.unit, ing.unit) : null;
      if (price !== null) {
        lastPurchases[p._id.toString()] = {
          unitPrice: Math.round(price * 10000) / 10000,
          date: p.date,
          sourceName: p.sourceName || '',
        };
      }
    }

    res.json({ success: true, data: { summaries, lastPurchases } });
  })
);

// @desc    Détail prix d'un ingrédient : sources, résumé, achats réels, historique de référence
// @route   GET /api/ingredients/:id/prices
router.get(
  '/:id/prices',
  admin,
  asyncHandler(async (req: Request, res: Response) => {
    const ingredient = await Ingredient.findById(req.params.id);
    if (!ingredient) {
      throw createError('Ingrédient non trouvé', 404);
    }

    const offers = await IngredientPrice.find({ ingredientId: ingredient._id })
      .populate('sourceId')
      .sort({ isActive: -1, price: 1 });

    const purchases = await StockHistory.find({ ingredientId: ingredient._id, type: 'restock' })
      .sort({ createdAt: -1 })
      .limit(30);

    res.json({
      success: true,
      data: {
        ingredient,
        offers,
        summary: summarizeOffers(effectiveOffers(offers), ingredient.unit),
        purchases,
      },
    });
  })
);

// @desc    Ajouter une source de prix pour un ingrédient (ou réactiver une ancienne)
// @route   POST /api/ingredients/:id/prices
router.post(
  '/:id/prices',
  admin,
  asyncHandler(async (req: Request, res: Response) => {
    const ingredient = await Ingredient.findById(req.params.id);
    if (!ingredient) {
      throw createError('Ingrédient non trouvé', 404);
    }
    const { sourceId, notes } = req.body;
    if (!sourceId || !Types.ObjectId.isValid(sourceId)) {
      throw createError("Source d'achat requise", 400);
    }
    const source = await PurchaseSource.findById(sourceId);
    if (!source || !source.isActive) {
      throw createError("Source d'achat introuvable", 400);
    }

    const price = parsePrice(req.body.price);
    const unit: string = req.body.unit || ingredient.unit;
    if (!areUnitsCompatible(unit, ingredient.unit)) {
      throw createError(
        `Unité "${unit}" incompatible avec l'unité de l'ingrédient (${ingredient.unit})`,
        400
      );
    }
    const checkedAt = parseDate(req.body.checkedAt);

    let offer = await IngredientPrice.findOne({ ingredientId: ingredient._id, sourceId });
    if (offer && offer.isActive) {
      throw createError(
        `${source.name} est déjà enregistré pour cet ingrédient — utilisez "Nouveau prix"`,
        409
      );
    }
    if (!offer) {
      offer = new IngredientPrice({ ingredientId: ingredient._id, sourceId });
    }
    offer.isActive = true;
    offer.price = price;
    offer.unit = unit;
    offer.lastCheckedAt = checkedAt;
    if (notes !== undefined) {
      offer.notes = notes;
    }
    offer.history.push({ price, unit, checkedAt, recordedAt: new Date() });
    await offer.save();

    logger.info(`Prix ${ingredient.name} @ ${source.name}: ${price} DT/${unit}`);
    res.status(201).json({ success: true, data: { offer } });
  })
);

// @desc    Nouveau prix constaté (ajouté à l'historique) et/ou notes
// @route   PUT /api/ingredients/:id/prices/:priceId
router.put(
  '/:id/prices/:priceId',
  admin,
  asyncHandler(async (req: Request, res: Response) => {
    const offer = await IngredientPrice.findOne({
      _id: req.params.priceId,
      ingredientId: req.params.id,
    });
    if (!offer) {
      throw createError('Prix non trouvé', 404);
    }

    if (req.body.price !== undefined) {
      const price = parsePrice(req.body.price);
      const checkedAt = parseDate(req.body.checkedAt);
      offer.price = price;
      offer.lastCheckedAt = checkedAt;
      offer.history.push({
        price,
        unit: offer.unit,
        checkedAt,
        note: typeof req.body.note === 'string' ? req.body.note.trim() : undefined,
        recordedAt: new Date(),
      });
    }
    if (req.body.notes !== undefined) {
      offer.notes = req.body.notes;
    }
    await offer.save();
    res.json({ success: true, data: { offer } });
  })
);

// @desc    Retirer une source pour cet ingrédient (désactivation, historique conservé)
// @route   DELETE /api/ingredients/:id/prices/:priceId
router.delete(
  '/:id/prices/:priceId',
  admin,
  asyncHandler(async (req: Request, res: Response) => {
    const offer = await IngredientPrice.findOne({
      _id: req.params.priceId,
      ingredientId: req.params.id,
    });
    if (!offer) {
      throw createError('Prix non trouvé', 404);
    }
    offer.isActive = false;
    await offer.save();
    res.json({ success: true, message: 'Source retirée (historique conservé)' });
  })
);

// @desc    Utiliser le prix moyen des sources comme prix de référence (action explicite)
// @route   POST /api/ingredients/:id/use-average-price
router.post(
  '/:id/use-average-price',
  admin,
  asyncHandler(async (req: Request, res: Response) => {
    const ingredient = await Ingredient.findById(req.params.id);
    if (!ingredient) {
      throw createError('Ingrédient non trouvé', 404);
    }
    const offers = await IngredientPrice.find({ ingredientId: ingredient._id }).populate(
      'sourceId',
      'name isActive'
    );
    const summary = summarizeOffers(effectiveOffers(offers), ingredient.unit);
    if (summary.average === null) {
      throw createError('Aucun prix de source valide pour calculer une moyenne', 400);
    }

    const previous = ingredient.pricePerUnit;
    ingredient.pricePerUnit = summary.average;
    (ingredient as any).$locals.priceChangeReason = 'moyenne des sources';
    await ingredient.save();

    logger.info(
      `Prix de reference ${ingredient.name}: ${previous} -> ${summary.average} (moyenne) par ${req.user!.email}`
    );
    res.json({ success: true, data: { ingredient, previous, summary } });
  })
);

// @desc    Achat de stock (prix reellement paye) : stock + sortie de caisse + besoins des commandes
// @route   POST /api/ingredients/:id/purchases
router.post(
  '/:id/purchases',
  admin,
  idempotent(), // stock + caisse : jamais deux fois le même achat
  asyncHandler(async (req: Request, res: Response) => {
    const result = await recordStockPurchase({
      items: [
        {
          ingredientId: req.params.id,
          quantity: req.body.quantity,
          unitPrice: req.body.unitPrice,
          updateSourcePrice: req.body.updateSourcePrice === true,
        },
      ],
      paymentMethod: req.body.paymentMethod,
      sourceId: req.body.sourceId || undefined,
      purchasedAt: req.body.purchasedAt,
      actor: { userId: req.user!._id, email: req.user!.email },
    });
    logger.info(
      `Achat de stock ${result.total} DT (${result.paymentMethod}) par ${req.user!.email}`
    );
    res.status(201).json({
      success: true,
      data: {
        purchase: result.entries[0],
        purchaseId: result.purchaseId,
        paymentMethod: result.paymentMethod,
        cashMovement: result.cashMovement,
        unblockedOrders: result.unblockedOrders,
      },
    });
  })
);

export default router;
