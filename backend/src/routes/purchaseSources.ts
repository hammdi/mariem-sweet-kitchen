import express, { Request, Response } from 'express';
import { PurchaseSource } from '../models/PurchaseSource';
import { IngredientPrice } from '../models/IngredientPrice';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { escapeRegex } from '../utils/regex';

const router = express.Router();

// Données d'achat : jamais publiques
router.use(authenticate, authorize('admin'));

const FIELDS = [
  'name',
  'type',
  'phone',
  'address',
  'city',
  'contact',
  'url',
  'openingHours',
  'delivers',
  'notes',
] as const;

function pickFields(body: any) {
  const data: Record<string, unknown> = {};
  for (const key of FIELDS) {
    if (body[key] !== undefined) {
      data[key] = typeof body[key] === 'string' ? body[key].trim() : body[key];
    }
  }
  return data;
}

// @route   GET /api/purchase-sources?search=&type=
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const query: any = { isActive: true };
    if (typeof req.query.type === 'string' && req.query.type) {
      query.type = req.query.type;
    }
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      const re = { $regex: escapeRegex(req.query.search.trim()), $options: 'i' };
      query.$or = [{ name: re }, { city: re }];
    }
    const sources = await PurchaseSource.find(query).sort({ name: 1 });

    // Nombre d'ingrédients suivis par source (utile pour la liste)
    const counts = await IngredientPrice.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$sourceId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.count as number]));

    res.json({
      success: true,
      data: {
        sources: sources.map((s) => ({
          ...s.toObject(),
          ingredientCount: countMap.get(String(s._id)) || 0,
        })),
      },
    });
  })
);

// @route   POST /api/purchase-sources
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const data = pickFields(req.body);
    if (!data.name) {
      throw createError('Nom requis', 400);
    }
    const existing = await PurchaseSource.findOne({
      name: { $regex: `^${escapeRegex(String(data.name))}$`, $options: 'i' },
      isActive: true,
    });
    if (existing) {
      throw createError(`La source "${existing.name}" existe déjà`, 409);
    }
    const source = await PurchaseSource.create(data);
    logger.info(`Source d'achat creee: ${source.name} par ${req.user!.email}`);
    res.status(201).json({ success: true, data: { source } });
  })
);

// @route   PUT /api/purchase-sources/:id
router.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const source = await PurchaseSource.findById(req.params.id);
    if (!source) {
      throw createError('Source non trouvée', 404);
    }
    const data = pickFields(req.body);
    if (data.name !== undefined && !data.name) {
      throw createError('Nom requis', 400);
    }
    Object.assign(source, data);
    await source.save();
    logger.info(`Source d'achat modifiee: ${source.name} par ${req.user!.email}`);
    res.json({ success: true, data: { source } });
  })
);

// @route   DELETE /api/purchase-sources/:id   (archivage, les prix restent dans l'historique)
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const source = await PurchaseSource.findById(req.params.id);
    if (!source) {
      throw createError('Source non trouvée', 404);
    }
    source.isActive = false;
    await source.save();
    logger.info(`Source d'achat archivee: ${source.name} par ${req.user!.email}`);
    res.json({ success: true, message: 'Source archivée' });
  })
);

export default router;
