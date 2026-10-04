import { Types } from 'mongoose';
import { Order, IOrder } from '../models/Order';
import { PurchaseNeed, IPurchaseNeed } from '../models/PurchaseNeed';
import { Settings } from '../models/Settings';
import { logger } from '../utils/logger';
import {
  computeConsumption,
  ConsumptionItem,
  ForecastLine,
  isBelowThreshold,
  StockNeed,
  StockStatus,
  UnitIssue,
} from './stockForecastService';
import { orderLines } from './stockMovementService';
import { convertUnitPrice, round, roundQty } from './unitService';
import { IngredientPrice } from '../models/IngredientPrice';
import { StockHistory } from '../models/StockHistory';

/**
 * Besoins d'achat des commandes en cours.
 *
 * 1. Les quantités viennent de computeConsumption (source unique, unités converties).
 * 2. Le stock est attribué aux commandes actives par date prévue (la plus proche
 *    d'abord) : le manque de chaque commande tient compte des commandes d'avant,
 *    et la somme des manques = ce qu'il faut réellement acheter.
 * 3. Le résultat est enregistré dans PurchaseNeed (un document par commande +
 *    ingrédient) pour garder le lien commande → ingrédient → manque → date.
 *
 * Ne change jamais le statut d'une commande, n'achète rien, ne prévient personne.
 */

// Commandes acceptées dont le stock n'a pas encore été déduit
export const ACTIVE_STATUSES = ['pending', 'confirmed', 'paid'];

const POPULATE_STOCK = {
  path: 'items.recipeId',
  populate: [{ path: 'variants.ingredients.ingredientId' }],
};

export const orderNeededBy = (o: { confirmedDate?: Date | null; requestedDate?: Date | null }) =>
  o.confirmedDate || o.requestedDate || null;

export const orderRef = (o: { _id: unknown; orderNumber?: number }) =>
  o.orderNumber ? `CMD-${o.orderNumber}` : `CMD-${String(o._id).slice(-5).toUpperCase()}`;

export interface AllocationInput {
  orderId: string;
  neededBy: Date | null;
  createdAt: Date;
  consumption: ConsumptionItem[];
  unitIssues: UnitIssue[];
}

export interface AllocatedNeed extends StockNeed {
  // stock = quantité disponible POUR CETTE COMMANDE (après les commandes plus proches)
  physicalStock: number; // stock réel de l'ingrédient
}

const byDate = (a: AllocationInput, b: AllocationInput) => {
  const da = a.neededBy ? a.neededBy.getTime() : Infinity;
  const db = b.neededBy ? b.neededBy.getTime() : Infinity;
  return (
    da - db || a.createdAt.getTime() - b.createdAt.getTime() || a.orderId.localeCompare(b.orderId)
  );
};

/**
 * Attribution du stock (fonction pure, testée seule).
 * Ordre : date prévue la plus proche, puis date de création. Commandes sans date en dernier.
 */
export function allocateStock(orders: AllocationInput[]): Map<string, AllocatedNeed[]> {
  const remaining = new Map<string, number>();
  const result = new Map<string, AllocatedNeed[]>();

  for (const order of [...orders].sort(byDate)) {
    const needs: AllocatedNeed[] = [];
    for (const c of order.consumption) {
      const physicalStock = c.ingredient.stockQuantity || 0;
      if (!remaining.has(c.ingredientId)) {
        remaining.set(c.ingredientId, physicalStock);
      }
      const available = roundQty(Math.max(0, remaining.get(c.ingredientId)!));
      const needed = roundQty(c.quantity);
      const missing = roundQty(Math.max(0, needed - available));
      const left = roundQty(available - needed);
      remaining.set(c.ingredientId, Math.max(0, left));
      const minStock = typeof c.ingredient.minStock === 'number' ? c.ingredient.minStock : null;
      const status: StockStatus =
        missing > 0 ? 'missing' : isBelowThreshold(left, minStock) ? 'low' : 'ok';
      needs.push({
        ingredientId: c.ingredientId,
        name: c.name,
        unit: c.unit,
        stock: available,
        needed,
        remaining: round(left, 4),
        missing: round(missing, 4),
        minStock,
        status,
        unitMismatch: false,
        pricePerUnit: c.ingredient.pricePerUnit || 0,
        physicalStock,
      });
    }
    for (const u of order.unitIssues) {
      needs.push({
        ingredientId: u.ingredientId,
        name: u.name,
        unit: u.stockUnit,
        stock: u.stock,
        needed: 0,
        remaining: u.stock,
        missing: 0,
        minStock: null,
        status: 'ok',
        unitMismatch: true,
        pricePerUnit: 0,
        physicalStock: u.stock,
      });
    }
    const order_ = { missing: 0, low: 1, ok: 2 };
    needs.sort((a, b) => order_[a.status] - order_[b.status] || a.name.localeCompare(b.name));
    result.set(order.orderId, needs);
  }
  return result;
}

const toInput = (order: IOrder): AllocationInput => {
  const { items, unitIssues } = computeConsumption(orderLines(order));
  return {
    orderId: order._id.toString(),
    neededBy: orderNeededBy(order),
    createdAt: order.createdAt,
    consumption: items,
    unitIssues,
  };
};

export async function loadActiveOrders() {
  return Order.find({ status: { $in: ACTIVE_STATUSES }, stockDeducted: { $ne: true } }).populate(
    POPULATE_STOCK
  );
}

/**
 * Attribution sur toutes les commandes actives.
 * `extra` : commande pas encore créée (aperçu de la saisie manuelle).
 */
export async function computeAllocation(extra?: { lines: ForecastLine[]; neededBy: Date | null }) {
  const orders = await loadActiveOrders();
  const inputs = orders.map(toInput);
  if (extra) {
    const { items, unitIssues } = computeConsumption(extra.lines);
    inputs.push({
      orderId: '__new__',
      neededBy: extra.neededBy,
      createdAt: new Date(),
      consumption: items,
      unitIssues,
    });
  }
  return { orders, allocation: allocateStock(inputs) };
}

async function upsertNeed(filter: object, update: object) {
  try {
    await PurchaseNeed.updateOne(filter, update, { upsert: true });
  } catch (e: any) {
    // deux synchronisations simultanées : l'index unique empêche le doublon, on réessaie
    if (e?.code === 11000) {
      await PurchaseNeed.updateOne(filter, update);
    } else {
      throw e;
    }
  }
}

/**
 * Recalcule et enregistre les besoins d'achat de toutes les commandes.
 * À appeler après tout ce qui change commandes ou stock (idempotent).
 */
export async function syncPurchaseNeeds() {
  const { orders, allocation } = await computeAllocation();
  const now = new Date();
  const activeById = new Map(orders.map((o) => [o._id.toString(), o]));
  const missingKeys = new Set<string>();

  for (const order of orders) {
    for (const n of allocation.get(order._id.toString()) || []) {
      if (n.unitMismatch || n.missing <= 0) {
        continue;
      }
      missingKeys.add(`${order._id}:${n.ingredientId}`);
      await upsertNeed(
        { orderId: order._id, ingredientId: new Types.ObjectId(n.ingredientId) },
        {
          $set: {
            orderNumber: order.orderNumber,
            clientName: order.clientName,
            ingredientName: n.name,
            unit: n.unit,
            neededQty: n.needed,
            availableQty: n.stock,
            missingQty: n.missing,
            neededBy: orderNeededBy(order),
            status: 'open',
          },
          $max: { maxMissingQty: n.missing },
          $setOnInsert: { openedAt: now },
        }
      );
    }
  }

  // Besoins ouverts/couverts qui ne sont plus "manquants" : les mettre à jour
  const tracked = await PurchaseNeed.find({ status: { $in: ['open', 'covered'] } });
  for (const need of tracked) {
    const key = `${need.orderId}:${need.ingredientId}`;
    if (missingKeys.has(key)) {
      continue;
    }
    const active = activeById.get(need.orderId.toString());
    const line = active
      ? (allocation.get(need.orderId.toString()) || []).find(
          (n) => n.ingredientId === need.ingredientId.toString() && !n.unitMismatch
        )
      : undefined;

    if (active && line) {
      // toujours nécessaire mais couvert par le stock
      if (need.status !== 'covered' || need.neededQty !== line.needed) {
        const wasCovered = need.status === 'covered';
        need.status = 'covered';
        need.neededQty = line.needed;
        need.availableQty = line.stock;
        need.missingQty = 0;
        need.neededBy = orderNeededBy(active);
        if (!wasCovered) {
          need.coveredAt = now;
        }
        await need.save();
      }
      continue;
    }

    const order = active || (await Order.findById(need.orderId).select('status stockDeducted'));
    need.missingQty = 0;
    need.closedAt = now;
    need.status =
      order && order.status !== 'cancelled' && order.stockDeducted ? 'fulfilled' : 'cancelled';
    await need.save();
  }

  return { orders, allocation };
}

/** Synchronisation qui ne fait jamais échouer l'action principale (création, achat...). */
export async function syncPurchaseNeedsSafe() {
  try {
    await syncPurchaseNeeds();
  } catch (e) {
    logger.error(`Synchronisation des besoins d'achat impossible: ${(e as Error).message}`);
  }
}

const needStatusLabel = (n: IPurchaseNeed) =>
  n.status === 'open'
    ? n.missingQty < n.maxMissingQty
      ? 'partiellement achete'
      : 'a acheter'
    : n.status === 'covered'
      ? 'couvert'
      : n.status;

export type ShoppingPriority = 'urgent' | 'soon' | 'later';

/**
 * Priorité d'achat d'après la date de besoin la plus proche :
 *  - urgent : en retard, ou dans moins de `alertHours` (réglage « Alerte ingrédients manquants ») ;
 *  - soon (bientôt) : dans moins de 3 × alertHours ;
 *  - later (plus tard) : au-delà, ou commande sans date.
 */
export function shoppingPriority(
  neededBy: Date | null | undefined,
  alertHours: number,
  now = new Date()
): { priority: ShoppingPriority; hoursLeft: number | null } {
  if (!neededBy) {
    return { priority: 'later', hoursLeft: null };
  }
  const hoursLeft = (new Date(neededBy).getTime() - now.getTime()) / 3600000;
  const priority =
    hoursLeft <= alertHours ? 'urgent' : hoursLeft <= alertHours * 3 ? 'soon' : 'later';
  return { priority, hoursLeft: Math.round(hoursLeft) };
}

/** Sources connues (prix constatés) et dernier prix réellement payé, par ingrédient. */
async function priceContext(ingredients: { id: string; unit: string }[]) {
  const ids = ingredients.map((i) => new Types.ObjectId(i.id));
  const unitOf = new Map(ingredients.map((i) => [i.id, i.unit]));
  const [offers, lastPurchases] = await Promise.all([
    IngredientPrice.find({ ingredientId: { $in: ids }, isActive: true }).populate(
      'sourceId',
      'name isActive'
    ),
    StockHistory.aggregate([
      { $match: { type: 'restock', ingredientId: { $in: ids }, unitPrice: { $gt: 0 } } },
      { $sort: { purchasedAt: -1, createdAt: -1 } },
      {
        $group: {
          _id: '$ingredientId',
          unitPrice: { $first: '$unitPrice' },
          unit: { $first: '$unit' },
          date: { $first: { $ifNull: ['$purchasedAt', '$createdAt'] } },
          sourceName: { $first: '$sourceName' },
        },
      },
    ]),
  ]);

  const sources = new Map<string, any[]>();
  for (const o of offers) {
    const src = o.sourceId as any;
    if (!src || src.isActive === false) {
      continue;
    }
    const id = o.ingredientId.toString();
    const converted = convertUnitPrice(o.price, o.unit, unitOf.get(id) || o.unit);
    sources.set(id, [
      ...(sources.get(id) || []),
      {
        sourceId: src._id,
        name: src.name,
        price: converted === null ? null : round(converted, 4),
        checkedAt: o.lastCheckedAt,
      },
    ]);
  }
  for (const list of sources.values()) {
    list.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  }

  const last = new Map<string, { unitPrice: number; date: Date; sourceName: string }>();
  for (const p of lastPurchases) {
    const id = p._id.toString();
    const converted = convertUnitPrice(p.unitPrice, p.unit, unitOf.get(id) || p.unit);
    if (converted !== null) {
      last.set(id, {
        unitPrice: round(converted, 4),
        date: p.date,
        sourceName: p.sourceName || '',
      });
    }
  }
  return { sources, last };
}

/**
 * Liste de courses : besoins ouverts regroupés par ingrédient, avec le détail
 * des commandes concernées, la priorité, les sources connues et le dernier
 * prix réellement payé (base du coût estimé).
 */
export async function buildShoppingList(now = new Date()) {
  const { orders, allocation } = await syncPurchaseNeeds();
  const open = await PurchaseNeed.find({ status: 'open' }).sort({ neededBy: 1, orderNumber: 1 });
  const alertHours = await getActionAlertHours();

  // besoin total (toutes commandes actives) et stock réel par ingrédient
  const totals = new Map<string, { needed: number; stock: number; price: number }>();
  for (const needs of allocation.values()) {
    for (const n of needs) {
      if (n.unitMismatch) {
        continue;
      }
      const t = totals.get(n.ingredientId) || {
        needed: 0,
        stock: n.physicalStock,
        price: n.pricePerUnit,
      };
      t.needed = roundQty(t.needed + n.needed);
      totals.set(n.ingredientId, t);
    }
  }

  const groups = new Map<string, any>();
  for (const need of open) {
    const id = need.ingredientId.toString();
    const t = totals.get(id) || { needed: 0, stock: 0, price: 0 };
    if (!groups.has(id)) {
      groups.set(id, {
        ingredientId: id,
        name: need.ingredientName,
        unit: need.unit,
        needed: t.needed, // besoin total des commandes en cours
        inStock: t.stock, // stock réel
        referencePrice: t.price, // prix de référence de la fiche ingrédient
        toBuy: 0, // = quantité manquante (somme des manques par commande)
        neededBy: need.neededBy,
        orders: [] as any[],
      });
    }
    const g = groups.get(id);
    g.toBuy = roundQty(g.toBuy + need.missingQty);
    g.orders.push({
      needId: need._id,
      orderId: need.orderId,
      orderRef: orderRef({ _id: need.orderId, orderNumber: need.orderNumber }),
      clientName: need.clientName,
      neededBy: need.neededBy,
      neededQty: need.neededQty,
      availableQty: need.availableQty,
      missingQty: need.missingQty,
      status: needStatusLabel(need),
    });
  }

  const { sources, last } = await priceContext(
    Array.from(groups.values()).map((g) => ({ id: g.ingredientId, unit: g.unit }))
  );
  const rank: Record<ShoppingPriority, number> = { urgent: 0, soon: 1, later: 2 };

  const shoppingList = Array.from(groups.values())
    .map((g) => {
      const known = sources.get(g.ingredientId) || [];
      const lastPurchase = last.get(g.ingredientId) || null;
      // Coût estimé : dernier prix réellement payé, sinon meilleur prix constaté, sinon référence
      const bestSource = known.find((x) => x.price !== null) || null;
      const basis = lastPurchase
        ? { price: lastPurchase.unitPrice, priceBasis: 'last_purchase' }
        : bestSource
          ? { price: bestSource.price, priceBasis: 'source' }
          : g.referencePrice > 0
            ? { price: g.referencePrice, priceBasis: 'reference' }
            : { price: 0, priceBasis: 'none' };
      const toBuy = round(g.toBuy, 4);
      return {
        ...g,
        toBuy,
        missing: toBuy,
        ...shoppingPriority(g.neededBy, alertHours, now),
        sources: known,
        lastPurchase,
        pricePerUnit: basis.price,
        priceBasis: basis.priceBasis,
        estimatedCost: round(toBuy * basis.price),
      };
    })
    .sort(
      (a, b) =>
        rank[a.priority as ShoppingPriority] - rank[b.priority as ShoppingPriority] ||
        (a.neededBy ? new Date(a.neededBy).getTime() : Infinity) -
          (b.neededBy ? new Date(b.neededBy).getTime() : Infinity) ||
        b.estimatedCost - a.estimatedCost
    );

  const orderIds = new Set(open.map((n) => n.orderId.toString()));
  return {
    shoppingList,
    alertHours,
    totalCost: round(shoppingList.reduce((s, i) => s + i.estimatedCost, 0)),
    orderCount: orderIds.size,
    activeOrderCount: orders.length,
  };
}

export async function getActionAlertHours(): Promise<number> {
  const s = await Settings.findOne({ key: 'actionAlertHours' });
  return typeof s?.value === 'number' ? s.value : 24;
}

/**
 * "Commandes nécessitant une action" : commandes actives avec ingrédients
 * manquants (ou unité incompatible), triées par date, avec niveau d'urgence.
 */
export async function buildActionRequired(now = new Date()) {
  const { orders, allocation } = await syncPurchaseNeeds();
  const alertHours = await getActionAlertHours();
  const needs = await PurchaseNeed.find({ status: 'open' });
  const needsByOrder = new Map<string, IPurchaseNeed[]>();
  for (const n of needs) {
    const k = n.orderId.toString();
    needsByOrder.set(k, [...(needsByOrder.get(k) || []), n]);
  }

  const items = orders
    .map((order) => {
      const id = order._id.toString();
      const lines = allocation.get(id) || [];
      const missing = lines.filter((l) => l.status === 'missing');
      const unitProblems = lines.filter((l) => l.unitMismatch);
      if (missing.length === 0 && unitProblems.length === 0) {
        return null;
      }
      const date = orderNeededBy(order);
      const hoursLeft = date ? (date.getTime() - now.getTime()) / 3600000 : null;
      const urgency =
        hoursLeft === null
          ? 'no_date'
          : hoursLeft < 0
            ? 'overdue'
            : hoursLeft <= alertHours
              ? 'urgent'
              : 'upcoming';
      const orderNeeds = needsByOrder.get(id) || [];
      return {
        orderId: id,
        orderRef: orderRef(order),
        clientName: order.clientName,
        status: order.status,
        date,
        hoursLeft: hoursLeft === null ? null : Math.round(hoursLeft),
        urgency,
        items: order.items.map((it: any) => ({
          recipeName: it.recipeId?.name || 'Recette',
          sizeName: it.recipeId?.variants?.[it.variantIndex]?.sizeName || '',
          quantity: it.quantity,
        })),
        missing: missing.map((m) => {
          const need = orderNeeds.find((n) => n.ingredientId.toString() === m.ingredientId);
          return {
            ingredientId: m.ingredientId,
            name: m.name,
            unit: m.unit,
            needed: m.needed,
            available: m.stock,
            missing: m.missing,
            purchaseStatus: need ? needStatusLabel(need) : 'a acheter',
          };
        }),
        unitProblems: unitProblems.map((u) => u.name),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const rank: Record<string, number> = { overdue: 0, urgent: 1, upcoming: 2, no_date: 3 };
  items.sort(
    (a, b) =>
      rank[a.urgency] - rank[b.urgency] ||
      (a.date ? a.date.getTime() : Infinity) - (b.date ? b.date.getTime() : Infinity)
  );
  return { alertHours, orders: items };
}
