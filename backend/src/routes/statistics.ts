import express, { Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { buildStatistics } from '../services/statisticsService';

const router = express.Router();

// Statistiques financieres : admin uniquement
router.use(authenticate, authorize('admin'));

// @desc    Toutes les statistiques d'une periode en un appel (agregations MongoDB)
// @route   GET /api/statistics?from=<ISO>&to=<ISO>&tz=<fuseau IANA du navigateur>
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const from = new Date(req.query.from as string);
    const to = new Date(req.query.to as string);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) {
      throw createError('Periode invalide (from/to)', 400);
    }
    if (to.getTime() - from.getTime() > 5 * 366 * 86400000) {
      throw createError('Periode trop longue (5 ans maximum)', 400);
    }
    res.json({ success: true, data: await buildStatistics(from, to, req.query.tz) });
  })
);

export default router;
