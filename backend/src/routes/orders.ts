import express, { Request, Response } from 'express';
import { Order } from '../models/Order';
import { Recipe } from '../models/Recipe';
import { Ingredient } from '../models/Ingredient';
import { StockHistory } from '../models/StockHistory';
import { AvailabilityBlock } from '../models/AvailabilityBlock';
import { Settings } from '../models/Settings';
import { PriceCalculationService } from '../services/priceCalculationService';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { TelegramService } from '../services/telegramService';

// State machine : transitions autorisées
// Transitions autorisées — Mariem peut revenir en arrière en cas d'erreur
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['paid', 'pending', 'cancelled'],
  paid: ['preparing', 'confirmed', 'cancelled'],
  preparing: ['ready', 'paid'],
  ready: ['preparing'],
  cancelled: ['pending'],
};

const router = express.Router();

// @desc    Créer une commande (public — pas besoin d'auth)
// @route   POST /api/orders
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { clientName, clientPhone, items, notes, requestedDate } = req.body;

    if (!clientName || !clientPhone) {
      throw createError('Nom et telephone du client requis', 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw createError('Au moins un article est requis', 400);
    }

    // Validation de la date de recuperation souhaitee (si fournie)
    let parsedRequestedDate: Date | null = null;
    if (requestedDate) {
      parsedRequestedDate = new Date(requestedDate);
      if (isNaN(parsedRequestedDate.getTime())) {
        throw createError('requestedDate invalide', 400);
      }

      // 1. Delai minimum (lead time)
      const leadSetting = await Settings.findOne({ key: 'orderMinLeadHours' });
      const minLeadHours = typeof leadSetting?.value === 'number' ? leadSetting.value : 24;
      const earliestAllowed = new Date(Date.now() + minLeadHours * 60 * 60 * 1000);
      if (parsedRequestedDate < earliestAllowed) {
        throw createError(`Il faut commander au moins ${minLeadHours}h a l'avance`, 400);
      }

      // 2. Pas dans un creneau bloque par Mariem
      const overlap = await AvailabilityBlock.findOne({
        startDate: { $lte: parsedRequestedDate },
        endDate: { $gte: parsedRequestedDate },
      });
      if (overlap) {
        throw createError(
          `Ce creneau n'est pas disponible${overlap.reason ? ` (${overlap.reason})` : ''}`,
          400
        );
      }
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
        },
      });
    }

    const order = new Order({
      clientName,
      clientPhone,
      items: orderItems,
      requestedDate: parsedRequestedDate,
      notes: notes || '',
    });

    await order.save();
    await order.populate('items.recipeId', 'name images');

    logger.info(`Nouvelle commande ${order._id} de ${clientName} (${clientPhone})`);

    // Notification Telegram (non-bloquant)
    const populatedOrder = order.toObject();
    TelegramService.notifyNewOrder({
      _id: populatedOrder._id,
      clientName: populatedOrder.clientName,
      clientPhone: populatedOrder.clientPhone,
      totalPrice: populatedOrder.totalPrice,
      requestedDate: populatedOrder.requestedDate,
      notes: populatedOrder.notes,
      items: populatedOrder.items.map((item: any) => {
        const recipe = item.recipeId;
        const recipeName = recipe && typeof recipe === 'object' ? recipe.name : 'Recette';
        return {
          recipeName,
          sizeName: `Variant ${item.variantIndex + 1}`,
          quantity: item.quantity,
          unitPrice: item.calculatedPrice?.total || 0,
        };
      }),
    });

    res.status(201).json({
      success: true,
      message: 'Commande envoyee, Mariem vous contactera',
      data: { order },
    });
  })
);

// @desc    Créer une commande manuellement (admin — appel tel, ami, etc.)
// @route   POST /api/orders/manual
router.post(
  '/manual',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { clientName, clientPhone, items, notes, requestedDate, additionalFees, saveAsRecipe } =
      req.body;

    if (!clientName || !clientPhone) {
      throw createError('Nom et telephone du client requis', 400);
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw createError('Au moins un article est requis', 400);
    }

    const orderItems = [];
    for (const item of items) {
      // Mode 1 : recette existante
      if (item.recipeId) {
        const recipe = await Recipe.findById(item.recipeId);
        if (!recipe) {
          throw createError(`Recette ${item.recipeId} non trouvee`, 400);
        }
        if (!recipe.variants[item.variantIndex]) {
          throw createError(`Taille invalide pour ${recipe.name}`, 400);
        }

        const price = await PriceCalculationService.calculateVariantPrice(
          item.recipeId,
          item.variantIndex,
          item.clientProvidedIngredients || []
        );

        orderItems.push({
          recipeId: item.recipeId,
          variantIndex: item.variantIndex,
          quantity: item.quantity || 1,
          clientOfferedIngredients: item.clientProvidedIngredients || [],
          clientProvidedIngredients: item.clientProvidedIngredients || [],
          calculatedPrice: {
            ingredientsCost: price.ingredientsCost,
            electricityCost: price.electricityCost,
            waterCost: price.waterCost,
            margin: price.margin,
            total: price.total,
          },
        });
      }
      // Mode 2 : recette custom (créée à la volée)
      else if (item.custom) {
        const c = item.custom;
        const newRecipe = new Recipe({
          name: c.name || `Commande speciale ${clientName}`,
          description: c.description || `Recette personnalisee pour ${clientName}`,
          categories: c.categories || ['Speciale'],
          isActive: saveAsRecipe === true, // visible au public seulement si Mariem le veut
          variants: [
            {
              sizeName: c.sizeName || 'Standard',
              portions: c.portions || 1,
              ingredients: (c.ingredients || []).map((ing: any) => ({
                ingredientId: ing.ingredientId,
                quantity: ing.quantity,
                unit: ing.unit,
              })),
              appliances: (c.appliances || []).map((app: any) => ({
                applianceId: app.applianceId,
                duration: app.duration,
              })),
            },
          ],
        });

        await newRecipe.save();
        logger.info(`Recette custom creee: ${newRecipe.name} par ${req.user!.email}`);

        const price = await PriceCalculationService.calculateVariantPrice(
          newRecipe._id.toString(),
          0,
          item.clientProvidedIngredients || []
        );

        orderItems.push({
          recipeId: newRecipe._id,
          variantIndex: 0,
          quantity: item.quantity || 1,
          clientOfferedIngredients: item.clientProvidedIngredients || [],
          clientProvidedIngredients: item.clientProvidedIngredients || [],
          calculatedPrice: {
            ingredientsCost: price.ingredientsCost,
            electricityCost: price.electricityCost,
            waterCost: price.waterCost,
            margin: price.margin,
            total: price.total,
          },
        });
      }
    }

    const order = new Order({
      clientName,
      clientPhone,
      items: orderItems,
      requestedDate: requestedDate ? new Date(requestedDate) : null,
      confirmedDate: requestedDate ? new Date(requestedDate) : null, // Mariem confirme directement
      additionalFees: additionalFees || [],
      source: 'manual',
      notes: notes || '',
    });

    await order.save();
    await order.populate('items.recipeId', 'name images');

    logger.info(`Commande manuelle ${order._id} creee par ${req.user!.email} pour ${clientName}`);

    TelegramService.notifyNewOrder({
      _id: order._id,
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      totalPrice: order.totalPrice,
      requestedDate: order.requestedDate,
      notes: `[MANUELLE] ${order.notes}`,
      items: order.items.map((item: any) => {
        const recipe = item.recipeId;
        return {
          recipeName: recipe?.name || 'Recette',
          sizeName: 'Custom',
          quantity: item.quantity,
          unitPrice: item.calculatedPrice?.total || 0,
        };
      }),
    });

    res.status(201).json({ success: true, message: 'Commande manuelle creee', data: { order } });
  })
);

// @desc    Liste des commandes (admin)
// @route   GET /api/orders
router.get(
  '/',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 20, status } = req.query;

    const query: any = {};
    if (status) {
      query.status = status;
    }

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
          totalPages: Math.ceil(total / parseInt(limit as string)),
        },
      },
    });
  })
);

// @desc    Liste de courses — ingredients manquants pour les commandes payees
// @route   GET /api/orders/shopping-list
router.get(
  '/shopping-list',
  authenticate,
  authorize('admin'),
  asyncHandler(async (_req: Request, res: Response) => {
    const orders = await Order.find({ status: 'paid' }).populate({
      path: 'items.recipeId',
      populate: [
        {
          path: 'variants.ingredients.ingredientId',
          select: 'name pricePerUnit unit stockQuantity',
        },
      ],
    });

    // Agréger les besoins par ingrédient
    const needs: Record<
      string,
      {
        ingredientId: string;
        name: string;
        unit: string;
        needed: number;
        inStock: number;
        pricePerUnit: number;
      }
    > = {};

    for (const order of orders) {
      for (const item of order.items) {
        const recipe = item.recipeId as any;
        if (!recipe?.variants) {
          continue;
        }
        const variant = recipe.variants[item.variantIndex];
        if (!variant) {
          continue;
        }

        for (const vi of variant.ingredients) {
          const ing = vi.ingredientId as any;
          if (!ing) {
            continue;
          }
          // Ignorer les ingrédients fournis par le client
          if (
            item.clientProvidedIngredients
              .map((id: any) => id.toString())
              .includes(ing._id.toString())
          ) {
            continue;
          }

          const key = ing._id.toString();
          const needed = vi.quantity * item.quantity;

          if (!needs[key]) {
            needs[key] = {
              ingredientId: key,
              name: ing.name,
              unit: ing.unit || vi.unit,
              needed: 0,
              inStock: ing.stockQuantity || 0,
              pricePerUnit: ing.pricePerUnit || 0,
            };
          }
          needs[key].needed += needed;
        }
      }
    }

    // Calculer ce qui manque
    const shoppingList = Object.values(needs)
      .map((item) => ({
        ...item,
        toBuy: Math.max(0, Math.round((item.needed - item.inStock) * 1000) / 1000),
        estimatedCost:
          Math.round(Math.max(0, item.needed - item.inStock) * item.pricePerUnit * 1000) / 1000,
      }))
      .filter((item) => item.toBuy > 0)
      .sort((a, b) => b.estimatedCost - a.estimatedCost);

    const totalCost = shoppingList.reduce((sum, i) => sum + i.estimatedCost, 0);

    res.json({
      success: true,
      data: {
        shoppingList,
        totalCost: Math.round(totalCost * 1000) / 1000,
        orderCount: orders.length,
      },
    });
  })
);

// @desc    Ajouter au stock (Mariem a achete des ingredients)
// @route   POST /api/orders/shopping-list/purchase
router.post(
  '/shopping-list/purchase',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { purchases } = req.body;
    // purchases: [{ ingredientId, quantity }]

    if (!purchases || !Array.isArray(purchases) || purchases.length === 0) {
      throw createError('Aucun achat a enregistrer', 400);
    }

    for (const p of purchases) {
      if (!p.ingredientId || !p.quantity || p.quantity <= 0) {
        continue;
      }

      await Ingredient.findByIdAndUpdate(p.ingredientId, {
        $inc: { stockQuantity: p.quantity },
      });

      await StockHistory.create({
        ingredientId: p.ingredientId,
        ingredientName: p.name || '',
        quantity: p.quantity,
        unit: p.unit || '',
        type: 'restock',
      });
    }

    logger.info(`Stock mis a jour: ${purchases.length} ingredients achetes par ${req.user!.email}`);

    res.json({ success: true, message: `${purchases.length} ingredient(s) ajoute(s) au stock` });
  })
);

// @desc    Vérifier quelles commandes sont preparables (stock suffisant)
// @route   GET /api/orders/check-preparable
router.get(
  '/check-preparable',
  authenticate,
  authorize('admin'),
  asyncHandler(async (_req: Request, res: Response) => {
    const orders = await Order.find({ status: { $in: ['pending', 'confirmed'] } }).populate({
      path: 'items.recipeId',
      populate: [{ path: 'variants.ingredients.ingredientId', select: 'name stockQuantity unit' }],
    });

    const result = orders.map((order) => {
      let preparable = true;
      const missingItems: string[] = [];

      for (const item of order.items) {
        const recipe = item.recipeId as any;
        if (!recipe?.variants) {
          preparable = false;
          continue;
        }
        const variant = recipe.variants[item.variantIndex];
        if (!variant) {
          preparable = false;
          continue;
        }

        for (const vi of variant.ingredients) {
          const ing = vi.ingredientId as any;
          if (!ing) {
            continue;
          }
          if (
            item.clientProvidedIngredients
              .map((id: any) => id.toString())
              .includes(ing._id.toString())
          ) {
            continue;
          }
          const needed = vi.quantity * item.quantity;
          if (ing.stockQuantity < needed) {
            preparable = false;
            missingItems.push(ing.name);
          }
        }
      }
      return {
        orderId: order._id,
        clientName: order.clientName,
        status: order.status,
        preparable,
        missingItems,
      };
    });

    res.json({ success: true, data: result });
  })
);

// @desc    Historique du stock
// @route   GET /api/orders/stock-history
router.get(
  '/stock-history',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const history = await StockHistory.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string));
    const total = await StockHistory.countDocuments();
    res.json({
      success: true,
      data: {
        history,
        pagination: {
          total,
          page: parseInt(page as string),
          totalPages: Math.ceil(total / parseInt(limit as string)),
        },
      },
    });
  })
);

// @desc    Détail d'une commande (admin)
// @route   GET /api/orders/:id
router.get(
  '/:id',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const order = await Order.findById(req.params.id).populate({
      path: 'items.recipeId',
      populate: [
        { path: 'variants.ingredients.ingredientId', select: 'name pricePerUnit unit' },
        { path: 'variants.appliances.applianceId', select: 'name powerConsumption' },
      ],
    });

    if (!order) {
      throw createError('Commande non trouvee', 404);
    }

    res.json({ success: true, data: { order } });
  })
);

// @desc    Modifier une commande — cocher ingrédients, notes (admin)
// @route   PUT /api/orders/:id
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const order = await Order.findById(req.params.id);
    if (!order) {
      throw createError('Commande non trouvee', 404);
    }

    const { items, notes } = req.body;

    // Si les ingrédients changent, remettre ingredientsReady à false
    if (items && Array.isArray(items)) {
      order.ingredientsReady = false;
    }

    // Mettre à jour les ingrédients cochés et recalculer les prix
    if (items && Array.isArray(items)) {
      for (const update of items) {
        const orderItem = order.items[update.index];
        if (!orderItem) {
          continue;
        }

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

    if (notes !== undefined) {
      order.notes = notes;
    }
    if (req.body.confirmedDate !== undefined) {
      order.confirmedDate = req.body.confirmedDate ? new Date(req.body.confirmedDate) : null;
    }
    if (req.body.requestedDate !== undefined) {
      order.requestedDate = req.body.requestedDate ? new Date(req.body.requestedDate) : null;
    }

    // "Ingrédients prêts" → passer automatiquement en preparation + déduire le stock
    if (req.body.ingredientsReady === true && !order.ingredientsReady) {
      if (order.status !== 'paid') {
        throw createError('La commande doit etre payee avant de lancer la preparation', 400);
      }

      // Recharger avec le stock pour vérifier
      const populated = await Order.findById(order._id).populate({
        path: 'items.recipeId',
        populate: [
          { path: 'variants.ingredients.ingredientId', select: 'name stockQuantity unit' },
        ],
      });
      if (!populated) {
        throw createError('Commande non trouvee', 404);
      }

      const missing: string[] = [];
      for (const item of populated.items) {
        const recipe = item.recipeId as any;
        if (!recipe?.variants) {
          continue;
        }
        const variant = recipe.variants[item.variantIndex];
        if (!variant) {
          continue;
        }
        for (const vi of variant.ingredients) {
          const ing = vi.ingredientId as any;
          if (!ing) {
            continue;
          }
          if (
            item.clientProvidedIngredients
              .map((id: any) => id.toString())
              .includes(ing._id.toString())
          ) {
            continue;
          }
          const needed = vi.quantity * item.quantity;
          if (ing.stockQuantity < needed) {
            missing.push(
              `${ing.name}: besoin ${needed} ${vi.unit}, stock ${ing.stockQuantity} ${ing.unit}`
            );
          }
        }
      }
      if (missing.length > 0) {
        throw createError(`Stock insuffisant:\n${missing.join('\n')}`, 400);
      }

      // Déduire le stock
      for (const item of populated.items) {
        const recipe = item.recipeId as any;
        if (!recipe?.variants) {
          continue;
        }
        const variant = recipe.variants[item.variantIndex];
        if (!variant) {
          continue;
        }
        for (const vi of variant.ingredients) {
          const ing = vi.ingredientId as any;
          if (!ing) {
            continue;
          }
          if (
            item.clientProvidedIngredients
              .map((id: any) => id.toString())
              .includes(ing._id.toString())
          ) {
            continue;
          }
          const needed = vi.quantity * item.quantity;
          await Ingredient.findByIdAndUpdate(ing._id, { $inc: { stockQuantity: -needed } });
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

      order.ingredientsReady = true;
      order.status = 'preparing';
      logger.info(
        `Ingredients confirmes + stock deduit + preparation lancee pour commande ${order._id}`
      );

      TelegramService.notifyStatusChange(order.clientName, order.clientPhone, 'paid', 'preparing');
    } else if (req.body.ingredientsReady === false) {
      order.ingredientsReady = false;
    }

    await order.save();
    await order.populate('items.recipeId', 'name images');

    logger.info(`Commande ${order._id} mise a jour par ${req.user!.email}`);

    res.json({
      success: true,
      data: { order },
    });
  })
);

// @desc    Changer le statut d'une commande (admin)
// @route   PUT /api/orders/:id/status
router.put(
  '/:id/status',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'paid', 'cancelled'];

    if (!validStatuses.includes(status)) {
      throw createError('Statut invalide', 400);
    }

    const order = await Order.findById(req.params.id).populate({
      path: 'items.recipeId',
      populate: [{ path: 'variants.ingredients.ingredientId', select: 'name stockQuantity unit' }],
    });
    if (!order) {
      throw createError('Commande non trouvee', 404);
    }

    // Valider la transition de statut
    const allowed = ALLOWED_TRANSITIONS[order.status];
    if (!allowed || !allowed.includes(status)) {
      throw createError(
        `Transition impossible : ${order.status} → ${status}. Transitions autorisees : ${(allowed || []).join(', ') || 'aucune'}`,
        400
      );
    }

    // Si on passe en "preparing", vérifier stock + déduire
    if (status === 'preparing') {
      const missing: string[] = [];

      // Vérifier le stock pour chaque item
      for (const item of order.items) {
        const recipe = item.recipeId as any;
        if (!recipe?.variants) {
          continue;
        }
        const variant = recipe.variants[item.variantIndex];
        if (!variant) {
          continue;
        }

        for (const vi of variant.ingredients) {
          const ing = vi.ingredientId as any;
          if (!ing) {
            continue;
          }
          if (
            item.clientProvidedIngredients
              .map((id: any) => id.toString())
              .includes(ing._id.toString())
          ) {
            continue;
          }

          const needed = vi.quantity * item.quantity;
          if (ing.stockQuantity < needed) {
            missing.push(
              `${ing.name}: besoin ${needed} ${vi.unit}, stock ${ing.stockQuantity} ${ing.unit}`
            );
          }
        }
      }

      if (missing.length > 0) {
        throw createError(`Stock insuffisant:\n${missing.join('\n')}`, 400);
      }

      // Déduire du stock (séquentiel — les transactions nécessitent un replica set)
      for (const item of order.items) {
        const recipe = item.recipeId as any;
        if (!recipe?.variants) {
          continue;
        }
        const variant = recipe.variants[item.variantIndex];
        if (!variant) {
          continue;
        }

        for (const vi of variant.ingredients) {
          const ing = vi.ingredientId as any;
          if (!ing) {
            continue;
          }
          if (
            item.clientProvidedIngredients
              .map((id: any) => id.toString())
              .includes(ing._id.toString())
          ) {
            continue;
          }

          const needed = vi.quantity * item.quantity;

          await Ingredient.findByIdAndUpdate(ing._id, { $inc: { stockQuantity: -needed } });

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

    const oldStatus = order.status;
    order.status = status;
    await order.save();

    logger.info(`Commande ${order._id} -> ${status} par ${req.user!.email}`);

    // Notification Telegram (non-bloquant)
    TelegramService.notifyStatusChange(order.clientName, order.clientPhone, oldStatus, status);

    res.json({
      success: true,
      data: { order },
    });
  })
);

export default router;
