import express, { Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { idempotent } from '../middleware/idempotency';
import { logger } from '../utils/logger';
import { cancelExpense, listExpenses, recordExpense } from '../services/expenseService';

const router = express.Router();

// Données financières : admin uniquement
router.use(authenticate, authorize('admin'));

const actorOf = (req: Request) => ({ userId: req.user!._id, email: req.user!.email });

// @desc    Dépenses d'une période (tous moyens de paiement)
// @route   GET /api/expenses?from=&to=
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const from = new Date(req.query.from as string);
    const to = new Date(req.query.to as string);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) {
      throw createError('Periode invalide (from/to)', 400);
    }
    res.json({ success: true, data: await listExpenses(from, to) });
  })
);

// @desc    Enregistrer une dépense (sortie de caisse seulement si payée avec la caisse)
// @route   POST /api/expenses   { amount, description, paymentMethod, occurredAt? }
router.post(
  '/',
  idempotent(),
  asyncHandler(async (req: Request, res: Response) => {
    const expense = await recordExpense({ ...req.body, actor: actorOf(req) });
    logger.info(`Depense ${expense.amount} DT (${expense.paymentMethod}) par ${req.user!.email}`);
    res.status(201).json({ success: true, data: { expense } });
  })
);

// @desc    Annuler une dépense erronée (raison obligatoire, trace conservée)
// @route   POST /api/expenses/:id/cancel   { reason }
router.post(
  '/:id/cancel',
  idempotent(),
  asyncHandler(async (req: Request, res: Response) => {
    const expense = await cancelExpense(req.params.id, {
      reason: req.body.reason,
      actor: actorOf(req),
    });
    logger.info(`Depense ${expense._id} annulee par ${req.user!.email}`);
    res.json({ success: true, data: { expense } });
  })
);

export default router;
