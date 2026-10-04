import { Types } from 'mongoose';
import { Ingredient } from '../models/Ingredient';
import {
  STOCK_ADJUSTMENT_REASONS,
  StockAdjustmentReason,
  StockHistory,
} from '../models/StockHistory';
import { createError } from '../middleware/errorHandler';
import { roundQty } from './unitService';
import { syncPurchaseNeedsSafe } from './purchaseNeedService';

/**
 * CORRECTION MANUELLE DU STOCK (inventaire, perte, casse...).
 * Jamais silencieuse : raison obligatoire, et l'historique garde l'ancienne
 * valeur, la nouvelle, la différence, la raison, l'auteur et la date.
 * C'est le seul moyen de fixer le stock à la main (la fiche ingrédient ne le modifie pas).
 */
export const ADJUSTMENT_REASON_LABELS: Record<StockAdjustmentReason, string> = {
  inventory: 'Inventaire',
  entry_error: 'Erreur de saisie',
  loss: 'Perte',
  breakage: 'Casse',
  correction: 'Correction',
  other: 'Autre',
};

export async function adjustStock(
  ingredientId: string,
  opts: { newQuantity: unknown; reason: unknown; note?: unknown; actor: string }
) {
  if (!Types.ObjectId.isValid(ingredientId)) {
    throw createError('Ingredient introuvable', 404);
  }
  const ingredient = await Ingredient.findById(ingredientId);
  if (!ingredient) {
    throw createError('Ingredient introuvable', 404);
  }
  const raw =
    typeof opts.newQuantity === 'string' ? parseFloat(opts.newQuantity) : opts.newQuantity;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
    throw createError('Nouvelle quantite invalide (0 ou plus)', 400);
  }
  if (!STOCK_ADJUSTMENT_REASONS.includes(opts.reason as StockAdjustmentReason)) {
    throw createError(
      'Indiquez la raison de la correction (inventaire, erreur de saisie, perte, casse, correction, autre)',
      400
    );
  }
  const reason = opts.reason as StockAdjustmentReason;
  const note = typeof opts.note === 'string' ? opts.note.trim() : '';
  if (reason === 'other' && note.length < 3) {
    throw createError('Raison "Autre" : precisez en quelques mots', 400);
  }

  const before = ingredient.stockQuantity || 0;
  const after = roundQty(raw);
  if (after === roundQty(before)) {
    throw createError('Le stock est deja a cette valeur : rien a corriger', 400);
  }

  // Mise à jour conditionnée à la valeur lue : un achat ou une préparation
  // simultané(e) ne peut pas être écrasé(e) silencieusement.
  const updated = await Ingredient.findOneAndUpdate(
    {
      _id: ingredient._id,
      stockQuantity:
        ingredient.stockQuantity === undefined || ingredient.stockQuantity === null
          ? { $in: [null, 0] }
          : ingredient.stockQuantity,
    },
    { $set: { stockQuantity: after } },
    { new: true }
  );
  if (!updated) {
    throw createError('Le stock a change entre-temps : rechargez la page puis recommencez', 409);
  }

  const entry = await StockHistory.create({
    ingredientId: ingredient._id,
    ingredientName: ingredient.name,
    quantity: roundQty(after - before),
    unit: ingredient.unit,
    type: 'adjustment',
    stockBefore: before,
    stockAfter: after,
    reason,
    note: note || ADJUSTMENT_REASON_LABELS[reason],
    createdBy: opts.actor,
  });
  await syncPurchaseNeedsSafe(); // le stock change : les besoins d'achat suivent
  return { ingredient: updated, entry };
}
