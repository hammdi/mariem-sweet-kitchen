import express from 'express';
import { Settings } from '../models/Settings';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = express.Router();

// Clés autorisées — toute autre clé envoyée sera rejetée.
const ALLOWED_SETTING_KEYS = [
  'stegTariff',
  'waterForfaitSmall',
  'waterForfaitLarge',
  'marginPercent',
] as const;

// @desc    Récupérer tous les paramètres (admin)
// @route   GET /api/settings
router.get('/', authenticate, authorize('admin'), asyncHandler(async (_req, res) => {
  const settings = await Settings.find();
  res.json({ success: true, data: { settings } });
}));

// @desc    Modifier les paramètres (admin)
// @route   PUT /api/settings
router.put('/', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const updates = req.body;

  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw createError('Format invalide', 400);
  }

  const unknownKeys = Object.keys(updates).filter(
    k => !ALLOWED_SETTING_KEYS.includes(k as typeof ALLOWED_SETTING_KEYS[number])
  );
  if (unknownKeys.length > 0) {
    throw createError(`Clés inconnues: ${unknownKeys.join(', ')}`, 400);
  }

  for (const key of ALLOWED_SETTING_KEYS) {
    const value = updates[key];
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw createError(`Valeur invalide pour ${key}`, 400);
    }
    await Settings.findOneAndUpdate({ key }, { value }, { upsert: false });
  }

  const settings = await Settings.find();

  logger.info(`Parametres mis a jour par ${req.user!.email}`);

  res.json({ success: true, data: { settings } });
}));

export default router;
