import express, { Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { listSales } from '../services/salesService';

const router = express.Router();

router.use(authenticate, authorize('admin'));

// @desc    Ventes d'une période (CA, encaissé, à encaisser) — convention dans salesService
// @route   GET /api/sales?from=&to=&search=&clientType=&paymentStatus=
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const from = new Date(req.query.from as string);
    const to = new Date(req.query.to as string);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) {
      throw createError('Periode invalide (from/to)', 400);
    }
    const data = await listSales({
      from,
      to,
      search: req.query.search as string,
      clientType: req.query.clientType as string,
      paymentStatus: req.query.paymentStatus as string,
      status: req.query.status as string,
    });
    res.json({ success: true, data });
  })
);

export default router;
