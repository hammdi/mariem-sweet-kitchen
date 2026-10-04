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

export interface OfferInput {
  _id?: unknown;
  price: number;
  unit: string;
  isActive: boolean;
  sourceId?: any;
}

export interface PriceSummary {
  unit: string;
  activeCount: number;
  comparableCount: number;
  average: number | null;
  best: { price: number; offerId: string | null; sourceName: string | null } | null;
  incomparableCount: number;
}

export function summarizeOffers(offers: OfferInput[], ingredientUnit: string): PriceSummary {
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

  return {
    unit: ingredientUnit,
    activeCount: active.length,
    comparableCount: comparable.length,
    average,
    best,
    incomparableCount: active.length - comparable.length,
  };
}
