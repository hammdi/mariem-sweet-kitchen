import express, { Request, Response } from 'express';
import { Recipe } from '../models/Recipe';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = express.Router();

// @desc    Liste des recettes (public)
// @route   GET /api/recipes
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 10, search, category } = req.query;

  const query: any = { isActive: true };
  if (search) {query.$text = { $search: search as string };}
  if (category) {query.categories = category;}

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  const recipes = await Recipe.find(query)
    .populate('variants.ingredients.ingredientId', 'name pricePerUnit unit category')
    .populate('variants.appliances.applianceId', 'name powerConsumption category')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit as string));

  const total = await Recipe.countDocuments(query);

  res.json({
    success: true,
    data: {
      recipes,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string))
      }
    }
  });
}));

// @desc    Détail d'une recette (public)
// @route   GET /api/recipes/:id
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const recipe = await Recipe.findById(req.params.id)
    .populate('variants.ingredients.ingredientId', 'name pricePerUnit unit category')
    .populate('variants.appliances.applianceId', 'name powerConsumption category');

  if (!recipe || !recipe.isActive) {
    throw createError('Recette non trouvee', 404);
  }

  res.json({ success: true, data: { recipe } });
}));

// @desc    Créer une recette (admin)
// @route   POST /api/recipes
router.post('/', authenticate, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { name, description, categories, variants } = req.body;

  if (!variants || !Array.isArray(variants) || variants.length === 0) {
    throw createError('Au moins un variant (taille) est requis', 400);
  }

  const recipe = new Recipe({ name, description, categories, variants });
  await recipe.save();

  await recipe.populate([
    { path: 'variants.ingredients.ingredientId', select: 'name pricePerUnit unit category' },
    { path: 'variants.appliances.applianceId', select: 'name powerConsumption category' }
  ]);

  logger.info(`Recette creee: ${name} par ${req.user!.email}`);

  res.status(201).json({
    success: true,
    data: { recipe }
  });
}));

// @desc    Dupliquer une recette (admin)
// @route   POST /api/recipes/:id/duplicate
router.post('/:id/duplicate', authenticate, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const original = await Recipe.findById(req.params.id);
  if (!original) {throw createError('Recette non trouvee', 404);}

  const duplicate = new Recipe({
    name: `${original.name} (copie)`,
    description: original.description,
    images: [...original.images],
    categories: [...(original.categories || [])],
    variants: original.variants.map(v => ({
      sizeName: v.sizeName,
      portions: v.portions,
      ingredients: v.ingredients.map(i => ({
        ingredientId: i.ingredientId,
        quantity: i.quantity,
        unit: i.unit
      })),
      appliances: v.appliances.map(a => ({
        applianceId: a.applianceId,
        duration: a.duration
      }))
    }))
  });

  await duplicate.save();

  logger.info(`Recette dupliquee: ${original.name} -> ${duplicate.name} par ${req.user!.email}`);

  res.status(201).json({
    success: true,
    data: { recipe: duplicate }
  });
}));

// @desc    Modifier une recette (admin)
// @route   PUT /api/recipes/:id
router.put('/:id', authenticate, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const recipe = await Recipe.findById(req.params.id);
  if (!recipe) {throw createError('Recette non trouvee', 404);}

  const { name, description, categories, variants, images } = req.body;
  if (name !== undefined) {recipe.name = name;}
  if (description !== undefined) {recipe.description = description;}
  if (categories !== undefined) {recipe.categories = categories;}
  if (variants !== undefined) {recipe.variants = variants;}
  if (images !== undefined) {recipe.images = images;}

  await recipe.save();

  await recipe.populate([
    { path: 'variants.ingredients.ingredientId', select: 'name pricePerUnit unit category' },
    { path: 'variants.appliances.applianceId', select: 'name powerConsumption category' }
  ]);

  logger.info(`Recette modifiee: ${recipe.name} par ${req.user!.email}`);

  res.json({ success: true, data: { recipe } });
}));

// @desc    Supprimer une recette (soft delete, admin)
// @route   DELETE /api/recipes/:id
router.delete('/:id', authenticate, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const recipe = await Recipe.findById(req.params.id);
  if (!recipe) {throw createError('Recette non trouvee', 404);}

  recipe.isActive = false;
  await recipe.save();

  logger.info(`Recette desactivee: ${recipe.name} par ${req.user!.email}`);

  res.json({ success: true, message: 'Recette desactivee' });
}));

export default router;
