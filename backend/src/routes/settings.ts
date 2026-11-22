import express, { Request, Response } from 'express';
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
  'orderMinLeadHours', // delai minimum entre commande et date de recuperation souhaitee
  'actionAlertHours', // alerte "ingredients manquants" quand la commande est dans moins de X heures
  'catalogShowPrices', // 1 : prix affichés dans le catalogue client ; 0 : « prix sur demande »
  'homeLat', // domicile (carte) : départ des trajets vers les sources
  'homeLng',
  'fuelConsumption', // voiture : litres aux 100 km
  'fuelPrice', // prix du litre d'essence (DT)
] as const;

// Bornes propres à certaines clés (les autres : nombre ≥ 0)
const RANGES: Record<string, [number, number]> = {
  homeLat: [-90, 90],
  homeLng: [-180, 180],
  fuelConsumption: [0, 50],
  fuelPrice: [0, 100],
};

// Libelles utilises si le parametre n'existe pas encore en base (creation a la volee)
const SETTING_LABELS: Record<string, string> = {
  stegTariff: 'Tarif STEG (DT/kWh)',
  waterForfaitSmall: 'Forfait eau petit (DT)',
  waterForfaitLarge: 'Forfait eau grand (DT)',
  marginPercent: 'Marge effort (%)',
  orderMinLeadHours: 'Delai minimum de commande (heures)',
  actionAlertHours: 'Alerte ingredients manquants (heures avant la commande)',
  catalogShowPrices: 'Afficher les prix dans le catalogue (1 = oui, 0 = non)',
  homeLat: 'Domicile — latitude',
  homeLng: 'Domicile — longitude',
  fuelConsumption: 'Consommation de la voiture (L/100 km)',
  fuelPrice: "Prix du litre d'essence (DT)",
};

// @desc    Récupérer tous les paramètres (admin)
// @route   GET /api/settings
router.get(
  '/',
  authenticate,
  authorize('admin'),
  asyncHandler(async (_req: Request, res: Response) => {
    const settings = await Settings.find({ key: { $in: ALLOWED_SETTING_KEYS } }); // anciennes clés ignorées
    res.json({ success: true, data: { settings } });
  })
);

// @desc    Modifier les paramètres (admin)
// @route   PUT /api/settings
router.put(
  '/',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const updates = req.body;

    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      throw createError('Format invalide', 400);
    }

    const unknownKeys = Object.keys(updates).filter(
      (k) => !ALLOWED_SETTING_KEYS.includes(k as (typeof ALLOWED_SETTING_KEYS)[number])
    );
    if (unknownKeys.length > 0) {
      throw createError(`Clés inconnues: ${unknownKeys.join(', ')}`, 400);
    }

    for (const key of ALLOWED_SETTING_KEYS) {
      const value = updates[key];
      if (value === undefined) {
        continue;
      }
      const [min, max] = RANGES[key] || [0, Infinity];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
        throw createError(`Valeur invalide pour ${key}`, 400);
      }
      // upsert : un parametre jamais seede (ex: base de production) est cree au lieu d'etre ignore
      await Settings.findOneAndUpdate(
        { key },
        { $set: { value }, $setOnInsert: { label: SETTING_LABELS[key] || key } },
        { upsert: true }
      );
    }

    const settings = await Settings.find({ key: { $in: ALLOWED_SETTING_KEYS } }); // anciennes clés ignorées

    logger.info(`Parametres mis a jour par ${req.user!.email}`);

    res.json({ success: true, data: { settings } });
  })
);

export default router;
