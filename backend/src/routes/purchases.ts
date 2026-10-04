import express, { Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { idempotent } from '../middleware/idempotency';
import { changePurchasePaymentMethod, listPurchases } from '../services/stockPurchaseService';

const router = express.Router();

// Achats (prix d'achat, moyens de paiement) : admin uniquement
router.use(authenticate, authorize('admin'));

// @desc    Achats de stock d'une periode, tous moyens de paiement (caisse, personnel, banque...)
// @route   GET /api/purchases?from=&to=
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const from = new Date(req.query.from as string);
    const to = new Date(req.query.to as string);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) {
      throw createError('Periode invalide (from/to)', 400);
    }
    res.json({ success: true, data: await listPurchases(from, to) });
  })
);

// @desc    Corriger le moyen de paiement d'un achat (la caisse suit, trace conservee)
// @route   PUT /api/purchases/:purchaseId/payment-method
router.put(
  '/:purchaseId/payment-method',
  idempotent(),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await changePurchasePaymentMethod(
      req.params.purchaseId,
      req.body.paymentMethod,
      {
        userId: req.user!._id,
        email: req.user!.email,
      }
    );
    logger.info(
      `Achat ${req.params.purchaseId} : moyen de paiement -> ${result.paymentMethod} par ${req.user!.email}`
    );
    res.json({ success: true, data: result });
  })
);

export default router;
