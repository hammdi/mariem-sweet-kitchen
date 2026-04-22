import express, { Request, Response } from 'express';
import { AvailabilityBlock } from '../models/AvailabilityBlock';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * Parse une date sous forme "YYYY-MM-DD" ou ISO. Retourne null si invalide.
 */
function parseDate(input: unknown): Date | null {
  if (typeof input !== 'string') {
    return null;
  }
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

// @desc    Liste des creneaux bloques (public — pour griser le calendrier)
// @route   GET /api/availability/blocks
// @query   from, to (dates ISO, optionnelles)
router.get(
  '/blocks',
  asyncHandler(async (req: Request, res: Response) => {
    const now = new Date();
    const defaultTo = new Date();
    defaultTo.setDate(defaultTo.getDate() + 60);

    const from = parseDate(req.query.from) || now;
    const to = parseDate(req.query.to) || defaultTo;

    // On ne renvoie que les blocages qui touchent la fenetre [from, to]
    const blocks = await AvailabilityBlock.find({
      endDate: { $gte: from },
      startDate: { $lte: to },
    })
      .sort({ startDate: 1 })
      .select('startDate endDate reason');

    res.json({ success: true, data: { blocks } });
  })
);

// @desc    Version admin : memes donnees avec _id pour gestion
// @route   GET /api/availability/blocks/admin
router.get(
  '/blocks/admin',
  authenticate,
  authorize('admin'),
  asyncHandler(async (_req: Request, res: Response) => {
    const blocks = await AvailabilityBlock.find().sort({ startDate: -1 }).limit(200);
    res.json({ success: true, data: { blocks } });
  })
);

// @desc    Creer un blocage (admin)
// @route   POST /api/availability/blocks
router.post(
  '/blocks',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate, reason } = req.body;

    const start = parseDate(startDate);
    const end = parseDate(endDate);

    if (!start) {
      throw createError('startDate invalide (format ISO attendu)', 400);
    }
    if (!end) {
      throw createError('endDate invalide (format ISO attendu)', 400);
    }
    if (end < start) {
      throw createError('endDate doit etre >= startDate', 400);
    }

    const block = new AvailabilityBlock({
      startDate: start,
      endDate: end,
      reason: reason?.trim() || undefined,
      createdBy: req.user!._id,
    });

    await block.save();

    logger.info(
      `Blocage cree (${start.toISOString()} -> ${end.toISOString()}) par ${req.user!.email}`
    );

    res.status(201).json({ success: true, data: { block } });
  })
);

// @desc    Supprimer un blocage (admin)
// @route   DELETE /api/availability/blocks/:id
router.delete(
  '/blocks/:id',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const block = await AvailabilityBlock.findByIdAndDelete(req.params.id);
    if (!block) {
      throw createError('Blocage non trouve', 404);
    }

    logger.info(`Blocage ${block._id} supprime par ${req.user!.email}`);

    res.json({ success: true, message: 'Blocage supprime' });
  })
);

export default router;
