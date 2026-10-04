import express, { Request, Response } from 'express';
import { Order } from '../models/Order';
import { Ingredient } from '../models/Ingredient';
import { CashMovement } from '../models/CashMovement';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { listSales, totalOutstanding } from '../services/salesService';
import { cashSummary, currentCashBalance } from '../services/cashService';
import {
  buildActionRequired,
  buildShoppingList,
  orderNeededBy,
  orderRef,
} from '../services/purchaseNeedService';
import { PurchaseNeed } from '../models/PurchaseNeed';
import { isBelowThreshold } from '../services/stockForecastService';
import { round } from '../services/unitService';

const router = express.Router();

router.use(authenticate, authorize('admin'));

// @desc    Indicateurs du tableau de bord
// @route   GET /api/dashboard/summary?from=<debut du jour ISO>&to=<fin du jour ISO>
// Les bornes du jour viennent du navigateur (fuseau horaire de Rahma).
router.get(
  '/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const from = new Date(req.query.from as string);
    const to = new Date(req.query.to as string);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) {
      throw createError('Periode invalide (from/to)', 400);
    }

    const [sales, cashToday, balance, outstanding, action, shopping] = await Promise.all([
      listSales({ from, to }),
      cashSummary(from, to),
      currentCashBalance(),
      totalOutstanding(),
      buildActionRequired(),
      buildShoppingList(),
    ]);

    // Paiements de commandes reçus aujourd'hui (nets des corrections)
    const payments = await CashMovement.find({
      type: { $in: ['order_payment', 'order_refund'] },
      occurredAt: { $gte: from, $lt: to },
    }).select('direction amount');
    const collectedToday = round(
      payments.reduce((s, m) => s + (m.direction === 'in' ? m.amount : -m.amount), 0)
    );

    const scheduledIn = (a: Date, b: Date) => ({
      status: { $ne: 'cancelled' },
      $or: [
        { confirmedDate: { $gte: a, $lt: b } },
        { confirmedDate: null, requestedDate: { $gte: a, $lt: b } },
      ],
    });
    // Veille (même durée juste avant) : contexte pour les variations affichées
    const span = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - span);
    const [ordersToday, ordersYesterday, salesYesterday, todayList] = await Promise.all([
      Order.countDocuments(scheduledIn(from, to)),
      Order.countDocuments(scheduledIn(prevFrom, from)),
      listSales({ from: prevFrom, to: from }),
      Order.find(scheduledIn(from, to))
        .sort({ confirmedDate: 1, requestedDate: 1 })
        .limit(8)
        .select(
          'orderNumber clientName status paymentStatus totalPrice amountPaid confirmedDate requestedDate items'
        )
        .populate('items.recipeId', 'name'),
    ]);
    const withThreshold = await Ingredient.find({ isActive: true, minStock: { $gt: 0 } }).select(
      'name unit stockQuantity minStock'
    );
    const lowStockItems = withThreshold
      .filter((i) => isBelowThreshold(i.stockQuantity || 0, i.minStock))
      .sort((a, b) => (a.stockQuantity || 0) / a.minStock! - (b.stockQuantity || 0) / b.minStock!);
    const missingToday = new Set(
      (
        await PurchaseNeed.find({
          status: 'open',
          orderId: { $in: todayList.map((o) => o._id) },
        }).select('orderId')
      ).map((n) => n.orderId.toString())
    );
    const [activeByStatus, recentMovements] = await Promise.all([
      Order.aggregate([
        { $match: { status: { $in: ['pending', 'confirmed', 'paid', 'preparing', 'ready'] } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      CashMovement.find()
        .sort({ occurredAt: -1, createdAt: -1 })
        .limit(5)
        .select('type direction amount description occurredAt orderNumber reversalOf'),
    ]);
    const active = Object.fromEntries(activeByStatus.map((a) => [a._id, a.count]));

    res.json({
      success: true,
      data: {
        today: {
          revenue: sales.summary.revenue, // CA des ventes prévues aujourd'hui
          collected: collectedToday, // argent reçu aujourd'hui pour des commandes
          outflows: cashToday.totalOut, // sorties de caisse aujourd'hui
        },
        outstanding, // reste à encaisser, toutes ventes confondues
        cashBalance: balance, // solde théorique actuel de la caisse
        recentMovements,
        yesterday: { revenue: salesYesterday.summary.revenue, orders: ordersYesterday },
        orders: {
          today: ordersToday,
          pending: active.pending || 0,
          confirmed: (active.confirmed || 0) + (active.paid || 0),
          preparing: active.preparing || 0,
          ready: active.ready || 0,
          todayList: todayList.map((o) => ({
            _id: o._id,
            orderRef: orderRef(o),
            clientName: o.clientName,
            status: o.status,
            paymentStatus: o.paymentStatus,
            totalPrice: o.totalPrice,
            amountPaid: o.amountPaid,
            date: orderNeededBy(o),
            items: o.items.map((it: any) => `${it.quantity}× ${it.recipeId?.name || 'Recette'}`),
            missingIngredients: missingToday.has(o._id.toString()),
          })),
          actionRequired: action.orders.filter(
            (o) => o.urgency === 'overdue' || o.urgency === 'urgent'
          ).length,
          withMissingIngredients: action.orders.length,
        },
        stock: {
          lowStock: lowStockItems.length,
          lowStockItems: lowStockItems.slice(0, 6).map((i) => ({
            _id: i._id,
            name: i.name,
            unit: i.unit,
            stockQuantity: i.stockQuantity || 0,
            minStock: i.minStock,
          })),
          purchasesNeeded: shopping.shoppingList.length,
          purchasesEstimatedCost: shopping.totalCost,
        },
      },
    });
  })
);

export default router;
