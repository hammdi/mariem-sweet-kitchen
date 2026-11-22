import { Types } from 'mongoose';
import { Ingredient, IIngredient } from '../models/Ingredient';
import { IOrderItemPackaging } from '../models/Order';
import { createError } from '../middleware/errorHandler';
import { PopulatedVariant } from './priceCalculationService';
import { ForecastLine } from './stockForecastService';
import { round } from './unitService';

/**
 * EMBALLAGES D'UNE COMMANDE
 *
 * Un emballage (boîte, sachet, caissette…) est un Ingredient de kind 'packaging' :
 * mêmes sources d'achat, même prix moyen, même stock et mêmes achats.
 * Il n'entre jamais dans une recette : il est choisi pour chaque article d'une
 * commande (une même recette peut partir dans des emballages différents).
 * Son coût s'ajoute au total de la commande, pas au prix de la recette.
 */

export interface PackagingInput {
  packagingId: unknown;
  quantity: unknown;
}

const MAX_LINES = 10;

/**
 * Valide les emballages demandés pour un article et fige leur prix.
 * `previous` : emballages déjà enregistrés sur l'article — un emballage déjà
 * présent garde son prix figé (seule la quantité change).
 */
export async function resolvePackaging(
  input: unknown,
  previous: IOrderItemPackaging[] = []
): Promise<IOrderItemPackaging[]> {
  if (input === undefined || input === null) {
    return [];
  }
  if (!Array.isArray(input) || input.length > MAX_LINES) {
    throw createError('Emballages invalides', 400);
  }
  const ids = input.map((p: PackagingInput) => String(p?.packagingId || ''));
  if (ids.some((id) => !Types.ObjectId.isValid(id))) {
    throw createError('Emballage invalide', 400);
  }
  if (new Set(ids).size !== ids.length) {
    throw createError('Le même emballage est choisi deux fois pour un article', 400);
  }
  const docs = await Ingredient.find({ _id: { $in: ids }, kind: 'packaging' });
  const byId = new Map(docs.map((d) => [d._id.toString(), d]));
  return input.map((p: PackagingInput, i) => {
    const doc = byId.get(ids[i]);
    const kept = previous.find((x) => String(x.packagingId) === ids[i]);
    if (!doc || (!doc.isActive && !kept)) {
      throw createError('Emballage introuvable', 400);
    }
    const quantity =
      typeof p.quantity === 'string' ? parseFloat(p.quantity) : (p.quantity as number);
    if (
      typeof quantity !== 'number' ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > 1000
    ) {
      throw createError(`Quantité invalide pour « ${doc.name} »`, 400);
    }
    return {
      packagingId: doc._id as unknown as Types.ObjectId,
      name: doc.name,
      quantity: round(quantity, 3),
      unitPrice: kept ? kept.unitPrice : round(doc.pricePerUnit, 4),
    };
  });
}

/**
 * Ligne de consommation de stock pour les emballages d'un article : réutilise
 * exactement le calcul des ingrédients (prévision, besoins d'achat, déduction
 * au début de la préparation, remise en stock).
 */
export function packagingForecastLine(
  packaging: { packagingId: unknown; quantity: number }[],
  quantity: number,
  label: string
): ForecastLine | null {
  const ingredients = packaging
    .map((p) => {
      const doc = p.packagingId as unknown as IIngredient | null;
      return doc && typeof doc === 'object' && '_id' in doc
        ? { ingredientId: doc, quantity: p.quantity, unit: doc.unit }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (ingredients.length === 0) {
    return null;
  }
  const variant: PopulatedVariant = { portions: 1, ingredients, appliances: [] };
  return { variant, quantity, label: `${label} (emballage)` };
}

/**
 * Aperçu (devis) : comme resolvePackaging mais tolérant — une ligne incomplète
 * (emballage pas encore choisi, quantité vide) est simplement ignorée.
 */
export async function quotePackaging(input: unknown) {
  const raw = Array.isArray(input) ? input.slice(0, MAX_LINES) : [];
  const wanted = raw
    .map((p: PackagingInput) => ({
      id: String(p?.packagingId || ''),
      quantity: typeof p?.quantity === 'string' ? parseFloat(p.quantity) : Number(p?.quantity),
    }))
    .filter((p) => Types.ObjectId.isValid(p.id) && Number.isFinite(p.quantity) && p.quantity > 0);
  if (wanted.length === 0) {
    return {
      lines: [],
      unitCost: 0,
      forecast: [] as { packagingId: IIngredient; quantity: number }[],
    };
  }
  const docs = await Ingredient.find({
    _id: { $in: wanted.map((w) => w.id) },
    kind: 'packaging',
    isActive: true,
  });
  const byId = new Map(docs.map((d) => [d._id.toString(), d]));
  const lines = [];
  const forecast: { packagingId: IIngredient; quantity: number }[] = [];
  for (const w of wanted) {
    const doc = byId.get(w.id);
    if (!doc) {
      continue;
    }
    const quantity = round(Math.min(w.quantity, 1000), 3);
    lines.push({
      packagingId: w.id,
      name: doc.name,
      quantity,
      unitPrice: round(doc.pricePerUnit, 4),
      total: round(quantity * doc.pricePerUnit, 3),
    });
    forecast.push({ packagingId: doc, quantity });
  }
  return {
    lines,
    unitCost: round(
      lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
      3
    ),
    forecast,
  };
}
