import express, { Request, Response } from 'express';
import { CashMovement } from '../models/CashMovement';
import { Order } from '../models/Order';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { idempotent } from '../middleware/idempotency';
import { recordExpense } from '../services/expenseService';
import { logger } from '../utils/logger';
import { listReceivables, totalOutstanding } from '../services/salesService';
import {
  cashSummary,
  correctMovement,
  recordManualMovement,
  recordOrderPayment,
  recordOrderRefund,
} from '../services/cashService';

const router = express.Router();

// Données financières : admin uniquement
router.use(authenticate, authorize('admin'));

const actorOf = (req: Request) => ({ userId: req.user!._id, email: req.user!.email });

function parseRange(req: Request) {
  const from = new Date(req.query.from as string);
  const to = new Date(req.query.to as string);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) {
    throw createError('Periode invalide (from/to)', 400);
  }
  return { from, to };
}

// @desc    Mouvements de caisse d'une période + solde initial / entrées / sorties / solde théorique
// @route   GET /api/cash?from=&to=&type=
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = parseRange(req);
    const query: any = { occurredAt: { $gte: from, $lt: to } };
    if (typeof req.query.type === 'string' && req.query.type) {
      query.type = req.query.type;
    }
    const movements = await CashMovement.find(query).sort({ occurredAt: -1, createdAt: -1 });
    const [summary, outstanding] = await Promise.all([cashSummary(from, to), totalOutstanding()]);
    // outstanding = commandes vendues pas encore payees (pas de l'argent en caisse)
    res.json({ success: true, data: { movements, summary: { ...summary, outstanding } } });
  })
);

// @desc    Commandes a encaisser (vendues, pas encore entierement payees)
// @route   GET /api/cash/receivables
router.get(
  '/receivables',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, data: await listReceivables() });
  })
);

// @desc    Entrée manuelle, fonds de caisse (une dépense en caisse passe par le module Dépenses)
// @route   POST /api/cash
router.post(
  '/',
  idempotent(),
  asyncHandler(async (req: Request, res: Response) => {
    if (req.body.type === 'expense') {
      // compatibilité : dépense payée avec la caisse = dépense + sortie de caisse liée
      const expense = await recordExpense({
        ...req.body,
        paymentMethod: 'cash_register',
        actor: actorOf(req),
      });
      const movement = await CashMovement.findById(expense.cashMovementId);
      res.status(201).json({ success: true, data: { movement, expense } });
      return;
    }
    const movement = await recordManualMovement({ ...req.body, actor: actorOf(req) });
    logger.info(`Caisse: ${movement.type} ${movement.amount} DT par ${req.user!.email}`);
    res.status(201).json({ success: true, data: { movement } });
  })
);

// @desc    Corriger un mouvement (annulation tracée + valeur corrigée optionnelle)
// @route   POST /api/cash/:id/correct
router.post(
  '/:id/correct',
  idempotent(),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await correctMovement(req.params.id, { ...req.body, actor: actorOf(req) });
    logger.info(`Caisse: mouvement ${req.params.id} corrige par ${req.user!.email}`);
    res.status(201).json({ success: true, data: result });
  })
);

// @desc    Paiements d'une commande
// @route   GET /api/cash/orders/:orderId
router.get(
  '/orders/:orderId',
  asyncHandler(async (req: Request, res: Response) => {
    const order = await Order.findById(req.params.orderId).select(
      'totalPrice amountPaid paymentStatus paymentMethod status'
    );
    if (!order) {
      throw createError('Commande non trouvee', 404);
    }
    const movements = await CashMovement.find({ orderId: order._id }).sort({ occurredAt: 1 });
    res.json({
      success: true,
      data: {
        totalPrice: order.totalPrice,
        amountPaid: order.amountPaid,
        remaining: Math.max(0, Math.round((order.totalPrice - order.amountPaid) * 1000) / 1000),
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        movements,
      },
    });
  })
);

// @desc    Encaisser une commande (montant libre ≤ reste dû, défaut = reste dû)
// @route   POST /api/cash/orders/:orderId/payment
router.post(
  '/orders/:orderId/payment',
  idempotent(),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await recordOrderPayment(req.params.orderId, {
      amount: req.body.amount,
      method: req.body.method,
      note: req.body.note,
      actor: actorOf(req),
    });
    res.status(201).json({ success: true, data: result });
  })
);

// @desc    Rembourser une commande (action explicite)
// @route   POST /api/cash/orders/:orderId/refund
router.post(
  '/orders/:orderId/refund',
  idempotent(),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await recordOrderRefund(req.params.orderId, {
      amount: req.body.amount,
      method: req.body.method,
      reason: req.body.reason,
      actor: actorOf(req),
    });
    res.status(201).json({ success: true, data: result });
  })
);

export default router;
