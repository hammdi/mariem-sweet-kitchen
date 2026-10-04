import express, { Request, Response } from 'express';
import { Order } from '../models/Order';
import { Recipe } from '../models/Recipe';
import { StockHistory } from '../models/StockHistory';
import { AvailabilityBlock } from '../models/AvailabilityBlock';
import { Settings } from '../models/Settings';
import { PriceCalculationService } from '../services/priceCalculationService';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { TelegramService } from '../services/telegramService';
import { Client } from '../models/Client';
import { normalizePhone } from '../utils/phone';
import { computeConsumption, computeStockNeeds } from '../services/stockForecastService';
import {
  isStockDeducted,
  loadOrderForStock,
  orderLines,
  restoreStockForOrder,
} from '../services/stockMovementService';
import { assertRecipeUnits } from '../services/recipeUnitValidation';
import { roundQty } from '../services/unitService';
import {
  buildActionRequired,
  buildShoppingList,
  computeAllocation,
  orderNeededBy,
  orderRef,
  syncPurchaseNeedsSafe,
} from '../services/purchaseNeedService';
import { checkPreparation } from '../services/stockMovementService';
import { PurchaseNeed } from '../models/PurchaseNeed';
import { buildOrderFilters, saleDateQuery } from '../services/salesService';
import { refreshOrderPayment } from '../services/cashService';
import { recordStockPurchase } from '../services/stockPurchaseService';

import { changeOrderStatus, PREPARATION_STARTED } from '../services/orderWorkflowService';
import { idempotent } from '../middleware/idempotency';

const router = express.Router();

// @desc    Créer une commande (public — pas besoin d'auth)
// @route   POST /api/orders
router.post(
  '/',
  idempotent({ required: false }), // double envoi du formulaire public : une seule commande
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
        priceSnapshot: PriceCalculationService.snapshotOf(price),
      });
    }

    // Rattacher a une fiche client existante (meme numero normalise) — jamais de creation auto
    const normalizedPhone = normalizePhone(clientPhone);
    const knownClient = normalizedPhone
      ? await Client.findOne({ phone: normalizedPhone, isActive: true })
      : null;

    const order = new Order({
      clientId: knownClient?._id || null,
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

    // Le manque de stock n'empeche jamais l'enregistrement : il cree des besoins d'achat
    await syncPurchaseNeedsSafe();

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
  idempotent(), // double clic sur "Créer la commande" : une seule commande
  asyncHandler(async (req: Request, res: Response) => {
    const { clientId, items, notes, requestedDate, additionalFees, saveAsRecipe } = req.body;
    let { clientName, clientPhone } = req.body;

    // Client choisi dans la liste : nom et telephone viennent de sa fiche
    let client = null;
    if (clientId) {
      client = await Client.findById(clientId);
      if (!client || !client.isActive) {
        throw createError('Client introuvable', 400);
      }
      clientName = client.name;
      clientPhone = client.phone;
    }

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
          priceSnapshot: PriceCalculationService.snapshotOf(price),
        });
      }
      // Mode 2 : recette custom (créée à la volée)
      else if (item.custom) {
        const c = item.custom;
        await assertRecipeUnits([{ sizeName: c.sizeName, ingredients: c.ingredients }]);
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
          priceSnapshot: PriceCalculationService.snapshotOf(price),
        });
      }
    }

    const order = new Order({
      clientId: client?._id || null,
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

    // Le manque de stock n'empeche jamais l'enregistrement : il cree des besoins d'achat
    await syncPurchaseNeedsSafe();

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
    // Historique : recherche CMD / client, dates, statut, paiement, particulier/cafe
    const { status, search, clientType, paymentStatus, from, to, dateField } = req.query;
    const page = Math.max(1, parseInt((req.query.page as string) || '1') || 1);
    const limit = Math.min(500, Math.max(1, parseInt((req.query.limit as string) || '20') || 20));

    const and: any[] = await buildOrderFilters({
      search: search as string,
      clientType: clientType as string,
      paymentStatus: paymentStatus as string,
    });
    const fromDate = from ? new Date(from as string) : null;
    const toDate = to ? new Date(to as string) : null;
    if (fromDate && toDate && !isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
      // date de commande (creation) ou date prevue (date confirmee / souhaitee)
      and.push(
        dateField === 'scheduled'
          ? saleDateQuery(fromDate, toDate)
          : { createdAt: { $gte: fromDate, $lt: toDate } }
      );
    }
    const base = and.length ? { $and: and } : {};
    // "Confirmees" inclut l'ancien statut "paid" (avant la separation paiement / avancement)
    const query: any = status
      ? { ...base, status: status === 'confirmed' ? { $in: ['confirmed', 'paid'] } : status }
      : base;

    const [orders, total, byStatus] = await Promise.all([
      Order.find(query)
        .populate('items.recipeId', 'name images variants.sizeName')
        .populate('clientId', 'name type')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Order.countDocuments(query),
      // compteurs par statut avec les memes filtres (pour les puces)
      Order.aggregate([{ $match: base }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    // Commandes avec ingredients manquants (besoins d'achat ouverts) : reperables dans la liste
    const openNeeds = await PurchaseNeed.find({
      status: 'open',
      orderId: { $in: orders.map((o) => o._id) },
    }).select('orderId ingredientName missingQty unit');
    const stockAlerts: Record<string, { missingCount: number; ingredients: string[] }> = {};
    for (const n of openNeeds) {
      const k = n.orderId.toString();
      stockAlerts[k] = stockAlerts[k] || { missingCount: 0, ingredients: [] };
      stockAlerts[k].missingCount += 1;
      stockAlerts[k].ingredients.push(n.ingredientName);
    }

    res.json({
      success: true,
      data: {
        orders,
        stockAlerts,
        counts: Object.fromEntries(byStatus.map((c) => [c._id, c.count])),
        pagination: {
          total,
          page,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  })
);

// @desc    Liste de courses — manques des commandes en cours (en attente, confirmees, payees),
//          regroupes par ingredient avec le detail des commandes concernees
// @route   GET /api/orders/shopping-list
router.get(
  '/shopping-list',
  authenticate,
  authorize('admin'),
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, data: await buildShoppingList() });
  })
);

// @desc    Commandes necessitant une action (ingredients manquants), par urgence
// @route   GET /api/orders/action-required
router.get(
  '/action-required',
  authenticate,
  authorize('admin'),
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, data: await buildActionRequired() });
  })
);

// @desc    Ajouter au stock (Mariem a achete des ingredients)
// @route   POST /api/orders/shopping-list/purchase
router.post(
  '/shopping-list/purchase',
  authenticate,
  authorize('admin'),
  idempotent(), // stock + caisse : jamais deux fois le même achat
  asyncHandler(async (req: Request, res: Response) => {
    // purchases: [{ ingredientId, quantity, unitPrice }] ; sourceId?
    // Achat = stock + sortie de caisse + besoins recalcules (stockPurchaseService)
    const { purchases, sourceId, paymentMethod } = req.body;
    const result = await recordStockPurchase({
      items: Array.isArray(purchases) ? purchases : [],
      paymentMethod,
      sourceId: sourceId || undefined,
      actor: { userId: req.user!._id, email: req.user!.email },
    });
    logger.info(
      `Stock mis a jour: ${result.entries.length} ingredient(s), ${result.total} DT (${result.paymentMethod}) par ${req.user!.email}`
    );
    res.json({
      success: true,
      message: `${result.entries.length} ingredient(s) ajoute(s) au stock`,
      data: {
        purchaseId: result.purchaseId,
        paymentMethod: result.paymentMethod,
        cashMovement: result.cashMovement,
        unblockedOrders: result.unblockedOrders,
      },
    });
  })
);

// @desc    Vérifier quelles commandes sont preparables (stock suffisant)
// @route   GET /api/orders/check-preparable
// Chaque commande est evaluee seule contre le stock actuel, avec le meme calcul que la deduction.
router.get(
  '/check-preparable',
  authenticate,
  authorize('admin'),
  asyncHandler(async (_req: Request, res: Response) => {
    const orders = await Order.find({ status: { $in: ['pending', 'confirmed', 'paid'] } }).populate(
      {
        path: 'items.recipeId',
        populate: [
          { path: 'variants.ingredients.ingredientId', select: 'name stockQuantity unit' },
        ],
      }
    );

    const result = orders.map((order) => {
      const lines = orderLines(order);
      const { items, unitIssues } = computeConsumption(lines);
      const missingItems = items
        .filter((c) => roundQty(c.ingredient.stockQuantity || 0) < roundQty(c.quantity))
        .map((c) => c.name);
      unitIssues.forEach((u) => missingItems.push(`${u.name} (unite incompatible)`));
      return {
        orderId: order._id,
        clientName: order.clientName,
        status: order.status,
        preparable: lines.length === order.items.length && missingItems.length === 0,
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

// @desc    Besoins en ingredients d'une commande : stock actuel - besoin = reste prevu
// @route   GET /api/orders/:id/stock-needs
// Lecture seule. Memes lignes et meme conversion d'unites que la deduction reelle.
router.get(
  '/:id/stock-needs',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const order = await loadOrderForStock(req.params.id);
    const stockDeducted = await isStockDeducted(order);
    const active = ['pending', 'confirmed', 'paid'].includes(order.status) && !stockDeducted;

    // Commande en cours : stock attribue par date (les commandes plus proches d'abord)
    let stockNeeds = computeStockNeeds(orderLines(order));
    if (active) {
      const { allocation } = await computeAllocation();
      stockNeeds = allocation.get(order._id.toString()) || stockNeeds;
    }
    const preparation = checkPreparation(order);
    const purchaseNeeds = await PurchaseNeed.find({ orderId: order._id }).select(
      'ingredientId ingredientName missingQty maxMissingQty status unit'
    );

    res.json({
      success: true,
      data: {
        orderRef: orderRef(order),
        neededBy: orderNeededBy(order),
        active,
        stockDeducted,
        stockNeeds,
        // regle de blocage : stock REEL suffisant pour cette commande
        canStartPreparation: preparation.ok,
        // stock reel suffisant MAIS attribue a des commandes plus proches : preparer
        // maintenant les mettrait en manque (Rahma decide, l'interface previent)
        usesReservedStock:
          preparation.ok && active && stockNeeds.some((n: any) => n.status === 'missing'),
        preparationBlockedReason: preparation.ok ? null : preparation.message,
        purchaseNeeds,
      },
    });
  })
);

// @desc    Remise en stock exceptionnelle d'une commande annulee (raison obligatoire, tracee)
// @route   POST /api/orders/:id/restore-stock
router.post(
  '/:id/restore-stock',
  authenticate,
  authorize('admin'),
  idempotent(),
  asyncHandler(async (req: Request, res: Response) => {
    // Exceptionnel : commande annulee uniquement, raison obligatoire, trace dans l'historique
    const { restored } = await restoreStockForOrder(req.params.id, {
      reason: req.body.reason,
      actor: req.user!.email,
    });
    await syncPurchaseNeedsSafe();
    logger.info(
      `Stock remis pour commande ${req.params.id} (${restored.length} ingredient(s)) par ${req.user!.email}`
    );
    res.json({
      success: true,
      message:
        restored.length > 0
          ? `${restored.length} ingredient(s) remis en stock`
          : 'Rien a remettre en stock',
      data: { restored },
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
    const order = await Order.findById(req.params.id)
      .populate({
        path: 'items.recipeId',
        populate: [
          { path: 'variants.ingredients.ingredientId', select: 'name pricePerUnit unit' },
          { path: 'variants.appliances.applianceId', select: 'name powerConsumption' },
        ],
      })
      .populate('clientId');

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

        // Recalculer avec les prix FIGES a la creation : un changement de prix
        // d'ingredient ne modifie pas une commande existante
        const provided = orderItem.clientProvidedIngredients.map((id: any) => id.toString());
        if (orderItem.priceSnapshot) {
          const price = PriceCalculationService.recomputeFromSnapshot(
            orderItem.priceSnapshot as any,
            provided
          );
          orderItem.calculatedPrice = {
            ingredientsCost: price.ingredientsCost,
            electricityCost: price.electricityCost,
            waterCost: price.waterCost,
            margin: price.margin,
            total: price.total,
          };
        } else {
          // Ancienne commande sans instantane : calcul avec les prix actuels, puis on fige
          const price = await PriceCalculationService.calculateVariantPrice(
            orderItem.recipeId.toString(),
            orderItem.variantIndex,
            provided
          );
          orderItem.calculatedPrice = {
            ingredientsCost: price.ingredientsCost,
            electricityCost: price.electricityCost,
            waterCost: price.waterCost,
            margin: price.margin,
            total: price.total,
          };
          orderItem.priceSnapshot = PriceCalculationService.snapshotOf(price) as any;
        }
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

    await order.save();

    // "Ingrédients prêts" → lancer la préparation (déduction du stock, une seule fois).
    // Le paiement n'est PAS une condition : il est suivi à part.
    let result = order;
    if (req.body.ingredientsReady === true && PREPARATION_STARTED.includes(order.status)) {
      // preparation deja lancee (stock deja deduit) : on note seulement les ingredients prets
      order.ingredientsReady = true;
      await order.save();
    } else if (req.body.ingredientsReady === true && !order.ingredientsReady) {
      if (!['confirmed', 'paid'].includes(order.status)) {
        throw createError('La commande doit etre confirmee avant de lancer la preparation', 400);
      }
      const changed = await changeOrderStatus(order._id, 'preparing', {
        actor: req.user!.email,
      });
      await Order.updateOne({ _id: order._id }, { $set: { ingredientsReady: true } });
      result = (await Order.findById(order._id))!;
      logger.info(`Ingredients confirmes + preparation lancee pour commande ${order._id}`);
      TelegramService.notifyStatusChange(
        order.clientName,
        order.clientPhone,
        changed.oldStatus,
        'preparing'
      );
    } else if (req.body.ingredientsReady === false) {
      order.ingredientsReady = false;
      await order.save();
    }

    await refreshOrderPayment(order._id); // le total peut avoir change (ingredients apportes)
    await syncPurchaseNeedsSafe(); // ingredients apportes, dates ou preparation changes
    await result.populate('items.recipeId', 'name images');

    logger.info(`Commande ${order._id} mise a jour par ${req.user!.email}`);

    res.json({
      success: true,
      data: { order: result },
    });
  })
);

// @desc    Changer l'avancement d'une commande (admin) — indépendant du paiement
// @route   PUT /api/orders/:id/status   { status, reason? }
router.put(
  '/:id/status',
  authenticate,
  authorize('admin'),
  idempotent({ required: false }),
  asyncHandler(async (req: Request, res: Response) => {
    const { order, oldStatus, changed } = await changeOrderStatus(req.params.id, req.body.status, {
      reason: req.body.reason,
      actor: req.user!.email,
    });
    if (changed) {
      // annulation / reactivation / preparation : les besoins d'achat suivent
      await syncPurchaseNeedsSafe();
      logger.info(`Commande ${order._id} ${oldStatus} -> ${order.status} par ${req.user!.email}`);
      TelegramService.notifyStatusChange(
        order.clientName,
        order.clientPhone,
        oldStatus,
        order.status
      );
    }

    res.json({
      success: true,
      data: { order },
    });
  })
);

export default router;
