import { Types } from 'mongoose';
import { Order, IOrder } from '../models/Order';
import { Ingredient } from '../models/Ingredient';
import { StockHistory } from '../models/StockHistory';
import { createError } from '../middleware/errorHandler';
import { PopulatedVariant } from './priceCalculationService';
import { computeConsumption, ConsumptionItem, ForecastLine } from './stockForecastService';
import { roundQty } from './unitService';

/**
 * Mouvements de stock liés aux commandes — seul endroit qui modifie le stock
 * à cause d'une commande.
 *
 * Garanties :
 *  - une commande ne déduit son stock qu'UNE fois, quel que soit le nombre de
 *    changements de statut (verrou atomique Order.stockDeducted + vérification
 *    dans StockHistory pour les anciennes commandes) ;
 *  - chaque déduction et chaque remise en stock est tracée dans StockHistory ;
 *  - les quantités viennent de computeConsumption, exactement comme la prévision.
 */

const POPULATE_STOCK = {
  path: 'items.recipeId',
  populate: [{ path: 'variants.ingredients.ingredientId' }],
};

/** Lignes de consommation d'une commande déjà chargée avec POPULATE_STOCK. */
export function orderLines(order: IOrder): ForecastLine[] {
  return order.items
    .map((item) => {
      const recipe = item.recipeId as any;
      const variant = recipe?.variants?.[item.variantIndex];
      if (!variant) {
        return null;
      }
      return {
        variant: variant as PopulatedVariant,
        quantity: item.quantity,
        clientProvidedIngredients: item.clientProvidedIngredients.map((id: any) => id.toString()),
        label: recipe.name,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);
}

export async function loadOrderForStock(orderId: string | Types.ObjectId) {
  const order = await Order.findById(orderId).populate(POPULATE_STOCK);
  if (!order) {
    throw createError('Commande non trouvee', 404);
  }
  return order;
}

/**
 * Quantité nette actuellement déduite pour cette commande, par ingrédient
 * (déductions − remises en stock), d'après StockHistory.
 */
export async function netDeducted(orderId: string | Types.ObjectId) {
  const rows = await StockHistory.aggregate([
    {
      $match: {
        orderId: new Types.ObjectId(String(orderId)),
        type: { $in: ['deduction', 'restore'] },
      },
    },
    {
      $group: {
        _id: '$ingredientId',
        name: { $last: '$ingredientName' },
        unit: { $last: '$unit' },
        deducted: { $sum: { $cond: [{ $eq: ['$type', 'deduction'] }, '$quantity', 0] } },
        restored: { $sum: { $cond: [{ $eq: ['$type', 'restore'] }, '$quantity', 0] } },
      },
    },
  ]);
  return rows
    .map((r) => ({
      ingredientId: r._id as Types.ObjectId,
      name: r.name as string,
      unit: r.unit as string,
      quantity: roundQty(r.deducted - r.restored),
    }))
    .filter((r) => r.quantity > 0);
}

export async function isStockDeducted(order: IOrder): Promise<boolean> {
  if (order.stockDeducted) {
    return true;
  }
  return (await netDeducted(order._id)).length > 0;
}

const addToStock = (ingredientId: unknown, delta: number) =>
  // pipeline update : arrondi côté MongoDB pour éviter 1.7500000000000002
  Ingredient.updateOne({ _id: ingredientId }, [
    { $set: { stockQuantity: { $round: [{ $add: ['$stockQuantity', delta] }, 6] } } },
  ]);

/**
 * Peut-on lancer la préparation (= déduire le stock) maintenant ?
 * Compare la consommation de la commande au stock RÉEL. Même règle pour
 * l'affichage (bouton/alerte) et pour la déduction.
 */
export function checkPreparation(order: IOrder) {
  const { items, unitIssues } = computeConsumption(orderLines(order));
  const missing = items
    .filter((i) => roundQty(i.ingredient.stockQuantity || 0) < roundQty(i.quantity))
    .map((m) => ({
      ingredientId: m.ingredientId,
      name: m.name,
      unit: m.unit,
      needed: m.quantity,
      stock: m.ingredient.stockQuantity || 0,
      missing: roundQty(m.quantity - (m.ingredient.stockQuantity || 0)),
    }));

  let message = '';
  if (unitIssues.length > 0) {
    message = `Unités incompatibles, stock non déduit :\n${unitIssues
      .map((u) => `${u.name} (${u.label}) : recette en ${u.recipeUnit}, stock en ${u.stockUnit}`)
      .join('\n')}`;
  } else if (missing.length > 0) {
    message = `Stock insuffisant:\n${missing
      .map((m) => `${m.name}: besoin ${m.needed} ${m.unit}, stock ${m.stock} ${m.unit}`)
      .join('\n')}`;
  }
  return { ok: message === '', message, items, missing, unitIssues };
}

export interface DeductResult {
  deducted: boolean;
  alreadyDeducted: boolean;
  consumption: ConsumptionItem[];
}

/**
 * Déduit le stock d'une commande. Idempotent : si déjà déduit, ne fait rien.
 * Refuse (400) si une unité est incompatible ou si le stock est insuffisant
 * (comportement existant conservé), sans rien modifier.
 */
export async function deductStockForOrder(orderId: string | Types.ObjectId): Promise<DeductResult> {
  const order = await loadOrderForStock(orderId);

  if (await isStockDeducted(order)) {
    if (!order.stockDeducted) {
      // ancienne commande déduite avant l'existence du verrou : on synchronise
      await Order.updateOne({ _id: order._id }, { $set: { stockDeducted: true } });
    }
    return { deducted: false, alreadyDeducted: true, consumption: [] };
  }

  const check = checkPreparation(order);
  if (!check.ok) {
    throw createError(check.message, 400);
  }
  const { items } = check;

  // Verrou atomique : deux clics simultanés ne peuvent pas déduire deux fois
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, stockDeducted: { $ne: true } },
    { $set: { stockDeducted: true, stockDeductedAt: new Date() } }
  );
  if (!claimed) {
    return { deducted: false, alreadyDeducted: true, consumption: [] };
  }

  for (const item of items) {
    await addToStock(item.ingredientId, -item.quantity);
    for (const part of item.parts) {
      await StockHistory.create({
        ingredientId: item.ingredientId,
        ingredientName: item.name,
        quantity: part.quantity,
        unit: item.unit,
        orderId: order._id,
        clientName: order.clientName,
        recipeName: part.label,
        type: 'deduction',
      });
    }
  }

  return { deducted: true, alreadyDeducted: false, consumption: items };
}

/**
 * Remise en stock EXCEPTIONNELLE de ce qui a été déduit pour une commande
 * (d'après StockHistory), tracée avec sa raison et son auteur.
 *
 * Jamais automatique. Seulement pour une commande ANNULÉE qui a réellement
 * consommé du stock (ex. préparation lancée par erreur, rien n'a été utilisé) :
 * une commande en préparation / prête / remise a consommé ses ingrédients, on ne
 * peut pas la laisser dans cet état avec un stock « non consommé ».
 */
export async function restoreStockForOrder(
  orderId: string | Types.ObjectId,
  opts: { reason?: unknown; actor?: string } = {}
) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw createError('Commande non trouvee', 404);
  }
  if (order.status !== 'cancelled') {
    throw createError(
      'Remise en stock impossible : seule une commande annulee peut rendre ses ingredients',
      400
    );
  }
  const reason = typeof opts.reason === 'string' ? opts.reason.trim() : '';
  if (reason.length < 3) {
    throw createError('Indiquez la raison de la remise en stock', 400);
  }

  const net = await netDeducted(order._id);
  if (net.length === 0) {
    await Order.updateOne(
      { _id: order._id },
      { $set: { stockDeducted: false, stockDeductedAt: null } }
    );
    return { restored: [] as typeof net };
  }

  // Verrou : seule la requête qui fait passer stockDeducted à false restaure
  if (!order.stockDeducted) {
    await Order.updateOne({ _id: order._id }, { $set: { stockDeducted: true } });
  }
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, stockDeducted: true, status: 'cancelled' },
    { $set: { stockDeducted: false, stockDeductedAt: null } }
  );
  if (!claimed) {
    return { restored: [] as typeof net };
  }

  for (const r of net) {
    const before = await Ingredient.findById(r.ingredientId).select('stockQuantity');
    await addToStock(r.ingredientId, r.quantity);
    await StockHistory.create({
      ingredientId: r.ingredientId,
      ingredientName: r.name,
      quantity: r.quantity,
      unit: r.unit,
      orderId: order._id,
      clientName: order.clientName,
      recipeName: '',
      type: 'restore',
      stockBefore: before?.stockQuantity ?? undefined,
      stockAfter:
        before?.stockQuantity !== undefined
          ? roundQty((before.stockQuantity || 0) + r.quantity)
          : undefined,
      note: reason,
      createdBy: opts.actor || '',
    });
  }

  return { restored: net };
}
