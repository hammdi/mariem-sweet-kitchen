import { Ingredient } from '../models/Ingredient';
import { IngredientPrice, IIngredientPrice } from '../models/IngredientPrice';
import { logger } from '../utils/logger';
import { convertUnitPrice, round } from './unitService';

/**
 * Résumé des prix d'un ingrédient chez ses différentes sources.
 *
 * Prix moyen de référence = moyenne simple des prix actuels des sources
 * actives et valides (prix > 0), exprimés dans l'unité de l'ingrédient.
 * Les prix dans une unité non convertible (ex: "piece" pour un ingrédient en kg)
 * sont exclus du calcul et signalés.
 *
 * Ce résumé ne touche jamais aux achats réels (StockHistory), qui gardent le
 * prix réellement payé.
 */

/** Prix de source non revérifié depuis plus de N jours : signalé « à vérifier ». */
export const STALE_PRICE_DAYS = 90;

export interface OfferInput {
  _id?: unknown;
  price: number;
  unit: string;
  isActive: boolean;
  sourceId?: any;
  lastCheckedAt?: Date | string | null;
}

export interface PriceSummary {
  unit: string;
  activeCount: number;
  comparableCount: number;
  average: number | null;
  best: { price: number; offerId: string | null; sourceName: string | null } | null;
  incomparableCount: number;
  /** Prix comptés dans la moyenne mais non revérifiés depuis STALE_PRICE_DAYS jours. */
  staleCount: number;
}

export function summarizeOffers(
  offers: OfferInput[],
  ingredientUnit: string,
  now: Date = new Date()
): PriceSummary {
  const active = offers.filter((o) => o.isActive && typeof o.price === 'number' && o.price > 0);
  const comparable: { price: number; offer: OfferInput }[] = [];

  for (const o of active) {
    const converted = convertUnitPrice(o.price, o.unit, ingredientUnit);
    if (converted !== null) {
      comparable.push({ price: converted, offer: o });
    }
  }

  let best: PriceSummary['best'] = null;
  for (const c of comparable) {
    if (!best || c.price < best.price) {
      const src = c.offer.sourceId;
      best = {
        price: round(c.price, 4),
        offerId: c.offer._id ? String(c.offer._id) : null,
        sourceName: src && typeof src === 'object' && 'name' in src ? src.name : null,
      };
    }
  }

  const average =
    comparable.length > 0
      ? round(comparable.reduce((sum, c) => sum + c.price, 0) / comparable.length, 4)
      : null;

  const staleLimit = now.getTime() - STALE_PRICE_DAYS * 24 * 3600 * 1000;
  const staleCount = comparable.filter((c) => {
    const checked = c.offer.lastCheckedAt ? new Date(c.offer.lastCheckedAt).getTime() : NaN;
    return Number.isFinite(checked) && checked < staleLimit;
  }).length;

  return {
    unit: ingredientUnit,
    activeCount: active.length,
    comparableCount: comparable.length,
    average,
    best,
    incomparableCount: active.length - comparable.length,
    staleCount,
  };
}

/** Une offre compte dans la moyenne si elle et sa source sont actives. */
export const effectiveOffers = (offers: IIngredientPrice[]): OfferInput[] =>
  offers.map((o) => {
    const src = o.sourceId as any;
    const sourceActive = !src || typeof src !== 'object' || src.isActive !== false;
    return {
      _id: o._id,
      price: o.price,
      unit: o.unit,
      isActive: o.isActive && sourceActive,
      sourceId: o.sourceId,
      lastCheckedAt: o.lastCheckedAt,
    };
  });

/**
 * PRIX UTILISÉ POUR LES RECETTES ET LA FACTURATION = moyenne des prix des sources
 * d'achat actives de l'ingrédient (décision de l'atelier : on achète presque
 * toujours au meilleur prix, la moyenne garde un prix raisonnable avec une marge).
 *
 * Ingredient.pricePerUnit est tenu à jour ici, à chaque changement de prix de
 * source : tous les calculs existants (prix, liste de courses, devis) l'utilisent
 * sans changement. Sans source : le prix saisi est conservé (priceBasis 'manual').
 * Les commandes déjà enregistrées gardent leur prix figé.
 */
export async function syncIngredientPrice(ingredientId: unknown) {
  const ingredient = await Ingredient.findById(ingredientId);
  if (!ingredient) {
    return null;
  }
  const offers = await IngredientPrice.find({
    ingredientId: ingredient._id,
    isActive: true,
  }).populate('sourceId', 'name isActive');
  const summary = summarizeOffers(effectiveOffers(offers), ingredient.unit);
  if (summary.average === null) {
    if (ingredient.priceBasis !== 'manual') {
      ingredient.priceBasis = 'manual'; // plus aucune source : on garde le dernier prix connu
      await ingredient.save();
    }
    return { ingredient, changed: false };
  }
  const average = round(summary.average, 4);
  if (ingredient.pricePerUnit === average && ingredient.priceBasis === 'sources') {
    return { ingredient, changed: false };
  }
  const previous = ingredient.pricePerUnit;
  ingredient.pricePerUnit = average;
  ingredient.priceBasis = 'sources';
  // le hook pre-save trace l'ancien prix dans referencePriceHistory avec ce motif
  (ingredient as any).$locals.priceChangeReason = `moyenne de ${summary.comparableCount} source(s)`;
  await ingredient.save();
  logger.info(`Prix ${ingredient.name}: ${previous} -> ${average} (moyenne des sources)`);
  return { ingredient, changed: previous !== average };
}

/** Recalcule les ingrédients liés à une source (archivage / réactivation de la source). */
export async function syncIngredientsOfSource(sourceId: unknown) {
  const ids = await IngredientPrice.find({ sourceId }).distinct('ingredientId');
  for (const id of ids) {
    await syncIngredientPrice(id);
  }
}

/** Recalcule tous les ingrédients (au démarrage : idempotent). */
export async function syncAllIngredientPrices() {
  const ids = await IngredientPrice.find({ isActive: true }).distinct('ingredientId');
  let changed = 0;
  for (const id of ids) {
    if ((await syncIngredientPrice(id))?.changed) {
      changed += 1;
    }
  }
  return { checked: ids.length, changed };
}
