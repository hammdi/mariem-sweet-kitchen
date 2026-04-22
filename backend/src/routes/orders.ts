import express from 'express';
import { Order } from '../models/Order';
import { Recipe } from '../models/Recipe';
import { Ingredient } from '../models/Ingredient';
import { StockHistory } from '../models/StockHistory';
import { PriceCalculationService } from '../services/priceCalculationService';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = express.Router();

// @desc    Créer une commande (public — pas besoin d'auth)
// @route   POST /api/orders
router.post('/', asyncHandler(async (req, res) => {
  const { clientName, clientPhone, items, notes } = req.body;

  if (!clientName || !clientPhone) {
    throw createError('Nom et telephone du client requis', 400);
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw createError('Au moins un article est requis', 400);
  }

  // Vérifier les recettes et calculer les prix
  const orderItems = [];
  for (const item of items) {
    const recipe = await Recipe.findById(item.recipeId);
    if (!recipe || !recipe.isActive) {
      throw createError(`Recette ${item.recipeId} non trouvee`, 400);
    }
    if (!recipe.variants[item.variantIndex]) {
      throw createError(`Taille invalide pour ${recipe.name}`, 400);
    }

    const price = await PriceCalculationService.calculateVariantPrice(
      item.recipeId,
      item.variantIndex,
      []
    );

    orderItems.push({
      recipeId: item.recipeId,
      variantIndex: item.variantIndex,
      quantity: item.quantity || 1,
      clientOfferedIngredients: item.clientOfferedIngredients || [],
      clientProvidedIngredients: [],
      calculatedPrice: {
        ingredientsCost: price.ingredientsCost,
        electricityCost: price.electricityCost,
        waterCost: price.waterCost,
        margin: price.margin,
        total: price.total,
      }
    });
  }

  const order = new Order({
    clientName,
    clientPhone,
    items: orderItems,
    notes: notes || '',
  });

  await order.save();
  await order.populate('items.recipeId', 'name images');

  logger.info(`Nouvelle commande ${order._id} de ${clientName} (${clientPhone})`);

  // TODO: envoyer notification Telegram

  res.status(201).json({
    success: true,
    message: 'Commande envoyee, Mariem vous contactera',
    data: { order }
  });
}));

// @desc    Liste des commandes (admin)
// @route   GET /api/orders
router.get('/', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;

  const query: any = {};
  if (status) query.status = status;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  const orders = await Order.find(query)
    .populate('items.recipeId', 'name images')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit as string));

  const total = await Order.countDocuments(query);

  res.json({
    success: true,
    data: {
      orders,
      pagination: {
        total,
        page: parseInt(page as string),
        totalPages: Math.ceil(total / parseInt(limit as string))
      }
    }
  });
}));

// @desc    Vérifier quelles commandes sont preparables (stock suffisant)
// @route   GET /api/orders/check-preparable
router.get('/check-preparable', authenticate, authorize('admin'), asyncHandler(async (_req, res) => {
  const orders = await Order.find({ status: { $in: ['pending', 'confirmed'] } })
    .populate({
      path: 'items.recipeId',
      populate: [{ path: 'variants.ingredients.ingredientId', select: 'name stockQuantity unit' }]
    });

  const result = orders.map(order => {
    let preparable = true;
    const missingItems: string[] = [];

    for (const item of order.items) {
      const recipe = item.recipeId as any;
      if (!recipe?.variants) { preparable = false; continue; }
      const variant = recipe.variants[item.variantIndex];
      if (!variant) { preparable = false; continue; }

      for (const vi of variant.ingredients) {
        const ing = vi.ingredientId as any;
        if (!ing) continue;
        if (item.clientProvidedIngredients.map((id: any) => id.toString()).includes(ing._id.toString())) continue;
        const needed = vi.quantity * item.quantity;
        if (ing.stockQuantity < needed) {
          preparable = false;
          missingItems.push(ing.name);
        }
      }
    }
    return { orderId: order._id, clientName: order.clientName, status: order.status, preparable, missingItems };
  });

  res.json({ success: true, data: result });
}));

// @desc    Historique du stock
// @route   GET /api/orders/stock-history
router.get('/stock-history', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const history = await StockHistory.find().sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit as string));
  const total = await StockHistory.countDocuments();
  res.json({ success: true, data: { history, pagination: { total, page: parseInt(page as string), totalPages: Math.ceil(total / parseInt(limit as string)) } } });
}));

// @desc    Détail d'une commande (admin)
// @route   GET /api/orders/:id
router.get('/:id', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate({
      path: 'items.recipeId',
      populate: [
        { path: 'variants.ingredients.ingredientId', select: 'name pricePerUnit unit' },
        { path: 'variants.appliances.applianceId', select: 'name powerConsumption' },
      ]
    });

  if (!order) throw createError('Commande non trouvee', 404);

  res.json({ success: true, data: { order } });
}));

// @desc    Modifier une commande — cocher ingrédients, notes (admin)
// @route   PUT /api/orders/:id
router.put('/:id', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw createError('Commande non trouvee', 404);

  const { items, notes } = req.body;

  // Si les ingrédients changent, remettre ingredientsReady à false
  if (items && Array.isArray(items)) {
    order.ingredientsReady = false;
  }

  // Mettre à jour les ingrédients cochés et recalculer les prix
  if (items && Array.isArray(items)) {
    for (const update of items) {
      const orderItem = order.items[update.index];
      if (!orderItem) continue;

      if (update.clientProvidedIngredients) {
        orderItem.clientProvidedIngredients = update.clientProvidedIngredients;
      }

      // Recalculer le prix avec les ingrédients cochés
      const price = await PriceCalculationService.calculateVariantPrice(
        orderItem.recipeId.toString(),
        orderItem.variantIndex,
        orderItem.clientProvidedIngredients.map((id: any) => id.toString())
      );

      orderItem.calculatedPrice = {
        ingredientsCost: price.ingredientsCost,
        electricityCost: price.electricityCost,
        waterCost: price.waterCost,
        margin: price.margin,
        total: price.total,
      };
    }
  }

  if (notes !== undefined) order.notes = notes;
  if (req.body.ingredientsReady !== undefined) order.ingredientsReady = req.body.ingredientsReady;

  await order.save();
  await order.populate('items.recipeId', 'name images');

  logger.info(`Commande ${order._id} mise a jour par ${req.user!.email}`);

  res.json({
    success: true,
    data: { order }
  });
}));

// @desc    Changer le statut d'une commande (admin)
// @route   PUT /api/orders/:id/status
router.put('/:id/status', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'paid', 'cancelled'];

  if (!validStatuses.includes(status)) {
    throw createError('Statut invalide', 400);
  }

  const order = await Order.findById(req.params.id)
    .populate({
      path: 'items.recipeId',
      populate: [
        { path: 'variants.ingredients.ingredientId', select: 'name stockQuantity unit' },
      ]
    });
  if (!order) throw createError('Commande non trouvee', 404);

  // Si on passe en "preparing", vérifier ingredientsReady + stock
  if (status === 'preparing' && order.status !== 'preparing') {
    if (!order.ingredientsReady) {
      throw createError('Vous devez confirmer que les ingredients sont prets avant de lancer la preparation', 400);
    }
    const missing: string[] = [];

    // Vérifier le stock pour chaque item
    for (const item of order.items) {
      const recipe = item.recipeId as any;
      if (!recipe?.variants) continue;
      const variant = recipe.variants[item.variantIndex];
      if (!variant) continue;

      for (const vi of variant.ingredients) {
        const ing = vi.ingredientId as any;
        if (!ing) continue;
        // Ignorer les ingrédients fournis par le client
        if (item.clientProvidedIngredients.map((id: any) => id.toString()).includes(ing._id.toString())) continue;

        const needed = vi.quantity * item.quantity;
        if (ing.stockQuantity < needed) {
          missing.push(`${ing.name}: besoin ${needed} ${vi.unit}, stock ${ing.stockQuantity} ${ing.unit}`);
        }
      }
    }

    if (missing.length > 0) {
      throw createError(`Stock insuffisant:\n${missing.join('\n')}`, 400);
    }

    // Déduire du stock et créer l'historique
    for (const item of order.items) {
      const recipe = item.recipeId as any;
      if (!recipe?.variants) continue;
      const variant = recipe.variants[item.variantIndex];
      if (!variant) continue;

      for (const vi of variant.ingredients) {
        const ing = vi.ingredientId as any;
        if (!ing) continue;
        if (item.clientProvidedIngredients.map((id: any) => id.toString()).includes(ing._id.toString())) continue;

        const needed = vi.quantity * item.quantity;

        // Déduire du stock
        await Ingredient.findByIdAndUpdate(ing._id, { $inc: { stockQuantity: -needed } });

        // Historique
        await StockHistory.create({
          ingredientId: ing._id,
          ingredientName: ing.name,
          quantity: needed,
          unit: vi.unit,
          orderId: order._id,
          clientName: order.clientName,
          recipeName: recipe.name,
          type: 'deduction',
        });
      }
    }

    logger.info(`Stock deduit pour commande ${order._id}`);
  }

  order.status = status;
  await order.save();

  logger.info(`Commande ${order._id} -> ${status} par ${req.user!.email}`);

  res.json({
    success: true,
    data: { order }
  });
}));

export default router;
