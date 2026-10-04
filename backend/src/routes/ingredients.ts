import express, { Request, Response } from 'express';
import { Ingredient } from '../models/Ingredient';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { syncPurchaseNeedsSafe } from '../services/purchaseNeedService';
import { roundQty } from '../services/unitService';
import { idempotent } from '../middleware/idempotency';
import { adjustStock } from '../services/stockAdjustmentService';

const router = express.Router();

// @desc    Récupérer tous les ingrédients
// @route   GET /api/ingredients
// @access  Private (Admin) — contient stock et prix d'achat
router.get(
  '/',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 50,
      search,
      category,
      sortBy = 'name',
      sortOrder = 'asc',
    } = req.query;

    // Construction de la requête
    const query: any = { isActive: true };

    // Recherche textuelle
    if (search) {
      query.name = { $regex: search as string, $options: 'i' };
    }

    // Filtre par catégorie
    if (category) {
      query.category = category;
    }

    // Options de tri
    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Exécution de la requête
    const ingredients = await Ingredient.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit as string));

    const total = await Ingredient.countDocuments(query);

    res.json({
      success: true,
      data: {
        ingredients,
        pagination: {
          total,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          totalPages: Math.ceil(total / parseInt(limit as string)),
        },
      },
    });
  })
);

// @desc    Récupérer un ingrédient par ID
// @route   GET /api/ingredients/:id
// @access  Private (Admin)
router.get(
  '/:id',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const ingredient = await Ingredient.findById(req.params.id);

    if (!ingredient || !ingredient.isActive) {
      throw createError('Ingrédient non trouvé', 404);
    }

    res.json({
      success: true,
      data: { ingredient },
    });
  })
);

// @desc    Créer un nouvel ingrédient
// @route   POST /api/ingredients
// @access  Private (Admin)
router.post(
  '/',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, pricePerUnit, unit, category, description, supplier, minStock } = req.body;

    // Vérifier si l'ingrédient existe déjà
    const existingIngredient = await Ingredient.findOne({ name });
    if (existingIngredient) {
      throw createError('Un ingrédient avec ce nom existe déjà', 400);
    }

    const ingredient = new Ingredient({
      name,
      pricePerUnit,
      unit,
      category,
      description,
      supplier,
      minStock: typeof minStock === 'number' && minStock > 0 ? minStock : undefined,
    });

    await ingredient.save();

    logger.info(`✅ Nouvel ingrédient créé: ${name} par ${req.user!.email}`);

    res.status(201).json({
      success: true,
      message: 'Ingrédient créé avec succès',
      data: { ingredient },
    });
  })
);

// @desc    Mettre à jour les prix en masse
// @route   PUT /api/ingredients/bulk-update-prices
// @access  Private (Admin)
// NOTE: doit être déclarée AVANT /:id pour ne pas être capturée comme paramètre
router.put(
  '/bulk-update-prices',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { priceUpdates } = req.body; // Array of { ingredientId, newPrice }

    if (!Array.isArray(priceUpdates)) {
      throw createError('Format de données invalide', 400);
    }

    const updatePromises = priceUpdates.map(async ({ ingredientId, newPrice }: any) => {
      if (!ingredientId || newPrice === undefined) {
        throw createError("ID d'ingrédient et nouveau prix requis", 400);
      }

      return Ingredient.findByIdAndUpdate(
        ingredientId,
        {
          pricePerUnit: newPrice,
          lastPriceUpdate: new Date(),
          $push: {
            referencePriceHistory: { price: newPrice, changedAt: new Date(), reason: 'en masse' },
          },
        },
        { new: true }
      );
    });

    const updatedIngredients = await Promise.all(updatePromises);

    logger.info(
      `✅ Prix mis à jour pour ${updatedIngredients.length} ingrédients par ${req.user!.email}`
    );

    res.json({
      success: true,
      message: `${updatedIngredients.length} prix mis à jour avec succès`,
      data: { updatedIngredients },
    });
  })
);

// @desc    Mettre à jour un ingrédient
// @route   PUT /api/ingredients/:id
// @access  Private (Admin)
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const ingredient = await Ingredient.findById(req.params.id);

    if (!ingredient) {
      throw createError('Ingrédient non trouvé', 404);
    }

    // Vérifier si le nom est changé et s'il n'existe pas déjà
    if (req.body.name && req.body.name !== ingredient.name) {
      const existingIngredient = await Ingredient.findOne({ name: req.body.name });
      if (existingIngredient) {
        throw createError('Un ingrédient avec ce nom existe déjà', 400);
      }
    }

    // Mettre à jour l'ingrédient (l'historique des prix n'est pas modifiable directement)
    const updates = { ...req.body };
    delete updates.referencePriceHistory;
    delete updates.lastPriceUpdate;
    delete updates._id;
    delete updates.stockNote;
    // Le stock ne se modifie pas ici : correction tracee avec raison obligatoire
    // (POST /:id/stock-adjustment), achat ou preparation.
    if (updates.stockQuantity !== undefined) {
      const asked = parseFloat(updates.stockQuantity);
      if (Number.isFinite(asked) && roundQty(asked) !== roundQty(ingredient.stockQuantity || 0)) {
        throw createError(
          'Pour changer le stock, utilisez "Corriger le stock" (raison obligatoire)',
          400
        );
      }
      delete updates.stockQuantity;
    }
    if (updates.minStock === '' || updates.minStock === null) {
      updates.minStock = undefined;
    }
    Object.assign(ingredient, updates);
    await ingredient.save();
    // stock (ou unite) modifie : recalculer les besoins d'achat des commandes
    await syncPurchaseNeedsSafe();

    logger.info(`✅ Ingrédient mis à jour: ${ingredient.name} par ${req.user!.email}`);

    res.json({
      success: true,
      message: 'Ingrédient mis à jour avec succès',
      data: { ingredient },
    });
  })
);

// @desc    Corriger le stock a la main (inventaire, perte, casse...) — raison obligatoire, tracee
// @route   POST /api/ingredients/:id/stock-adjustment   { newQuantity, reason, note? }
router.post(
  '/:id/stock-adjustment',
  authenticate,
  authorize('admin'),
  idempotent(),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await adjustStock(req.params.id, {
      newQuantity: req.body.newQuantity,
      reason: req.body.reason,
      note: req.body.note,
      actor: req.user!.email,
    });
    logger.info(
      `Stock corrige: ${result.ingredient.name} ${result.entry.stockBefore} -> ${result.entry.stockAfter} (${result.entry.reason}) par ${req.user!.email}`
    );
    res.status(201).json({ success: true, data: result });
  })
);

// @desc    Supprimer un ingrédient
// @route   DELETE /api/ingredients/:id
// @access  Private (Admin)
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const ingredient = await Ingredient.findById(req.params.id);

    if (!ingredient) {
      throw createError('Ingrédient non trouvé', 404);
    }

    // Soft delete - désactiver au lieu de supprimer
    ingredient.isActive = false;
    await ingredient.save();

    logger.info(`✅ Ingrédient supprimé: ${ingredient.name} par ${req.user!.email}`);

    res.json({
      success: true,
      message: 'Ingrédient supprimé avec succès',
    });
  })
);

export default router;
