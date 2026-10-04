import { Types } from 'mongoose';
import { Order } from '../models/Order';
import { CashMovement } from '../models/CashMovement';
import { StockHistory } from '../models/StockHistory';
import { SALE_STATUSES, saleDateQuery } from './salesService';
import { expenseTotals } from './expenseService';
import { cashSummary } from './cashService';
import { round } from './unitService';

/**
 * Statistiques — agrégations MongoDB en un seul appel, sans nouvelle logique
 * financière : mêmes conventions que salesService (CA) et cashService (caisse).
 *
 *   CA         = ventes (commandes confirmées → prêtes) à leur date prévue, payées ou non
 *   Encaissé   = déjà payé sur ces ventes ; À encaisser = CA − encaissé
 *   Caisse     = argent réellement entré / sorti pendant la période (nets des corrections)
 *   Achats     = achats d'ingrédients enregistrés (StockHistory "restock")
 *   Pas de "bénéfice" : charges et achats ne sont pas tous enregistrés.
 *
 * Les regroupements (heure / jour / semaine / mois) se font dans le fuseau
 * horaire du navigateur ($dateTrunc + timezone) : pas de décalage UTC.
 */

export type Bucket = 'hour' | 'day' | 'week' | 'month';

export function pickBucket(from: Date, to: Date): Bucket {
  const days = (to.getTime() - from.getTime()) / 86400000;
  if (days <= 2) {
    return 'hour';
  }
  if (days <= 62) {
    return 'day';
  }
  if (days <= 366) {
    return 'week';
  }
  return 'month';
}

export function safeTimezone(tz: unknown): string {
  if (typeof tz !== 'string' || !tz) {
    return 'UTC';
  }
  try {
    new Intl.DateTimeFormat('fr', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

const SALE_DATE = { $ifNull: ['$confirmedDate', { $ifNull: ['$requestedDate', '$createdAt'] }] };
const trunc = (date: unknown, unit: Bucket, timezone: string) => ({
  $dateTrunc: { date, unit, timezone, ...(unit === 'week' ? { startOfWeek: 'monday' } : {}) },
});
// Une correction (reversalOf) compte en négatif dans la catégorie du mouvement corrigé
const NATURE_OUT = {
  $or: [
    { $and: [{ $eq: ['$direction', 'out'] }, { $not: ['$reversalOf'] }] },
    { $and: [{ $eq: ['$direction', 'in'] }, { $ne: [{ $ifNull: ['$reversalOf', null] }, null] }] },
  ],
};
const CONTRIBUTION = {
  $cond: [{ $ifNull: ['$reversalOf', false] }, { $multiply: ['$amount', -1] }, '$amount'],
};

async function salesFacet(from: Date, to: Date, unit: Bucket, timezone: string) {
  const [res] = await Order.aggregate([
    { $match: { $and: [{ status: { $in: SALE_STATUSES } }, saleDateQuery(from, to)] } },
    {
      $addFields: {
        saleDate: SALE_DATE,
        paid: { $ifNull: ['$amountPaid', 0] },
        remaining: { $max: [0, { $subtract: ['$totalPrice', { $ifNull: ['$amountPaid', 0] }] }] },
      },
    },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              revenue: { $sum: '$totalPrice' },
              count: { $sum: 1 },
              collected: { $sum: '$paid' },
              remaining: { $sum: '$remaining' },
              remainingCount: { $sum: { $cond: [{ $gt: ['$remaining', 0.0005] }, 1, 0] } },
              ids: { $push: '$_id' },
            },
          },
        ],
        series: [
          {
            $group: {
              _id: trunc('$saleDate', unit, timezone),
              revenue: { $sum: '$totalPrice' },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
        byClientType: [
          {
            $lookup: { from: 'clients', localField: 'clientId', foreignField: '_id', as: 'client' },
          },
          {
            $group: {
              _id: { $ifNull: [{ $first: '$client.type' }, 'individual'] },
              count: { $sum: 1 },
              revenue: { $sum: '$totalPrice' },
            },
          },
        ],
        clients: [
          {
            $group: {
              _id: { $ifNull: ['$clientId', '$clientPhone'] },
              clientId: { $first: '$clientId' },
              name: { $first: '$clientName' },
              count: { $sum: 1 },
              revenue: { $sum: '$totalPrice' },
            },
          },
          { $sort: { count: -1, revenue: -1 } },
        ],
        products: [
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.recipeId',
              quantity: { $sum: '$items.quantity' },
              revenue: {
                $sum: {
                  $multiply: [{ $ifNull: ['$items.calculatedPrice.total', 0] }, '$items.quantity'],
                },
              },
            },
          },
          { $sort: { revenue: -1, quantity: -1 } },
          { $limit: 8 },
          { $lookup: { from: 'recipes', localField: '_id', foreignField: '_id', as: 'recipe' } },
          { $project: { quantity: 1, revenue: 1, name: { $first: '$recipe.name' } } },
        ],
      },
    },
  ]);
  return res;
}

export async function buildStatistics(from: Date, to: Date, tz: unknown) {
  const timezone = safeTimezone(tz);
  const unit = pickBucket(from, to);
  const span = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - span);

  const expensesPromise = expenseTotals(from, to);
  const [sales, previous, cash, movementsCount, cashSeries, purchases, orders] = await Promise.all([
    salesFacet(from, to, unit, timezone),
    Order.aggregate([
      { $match: { $and: [{ status: { $in: SALE_STATUSES } }, saleDateQuery(prevFrom, from)] } },
      { $group: { _id: null, revenue: { $sum: '$totalPrice' }, count: { $sum: 1 } } },
    ]),
    cashSummary(from, to),
    CashMovement.countDocuments({ occurredAt: { $gte: from, $lt: to } }),
    CashMovement.aggregate([
      { $match: { occurredAt: { $gte: from, $lt: to } } },
      {
        $facet: {
          // encaissements nets (paiements − remboursements, corrections comprises)
          payments: [
            { $match: { type: { $in: ['order_payment', 'order_refund'] } } },
            {
              $group: {
                _id: trunc('$occurredAt', unit, timezone),
                amount: {
                  $sum: {
                    $cond: [
                      { $eq: ['$direction', 'in'] },
                      '$amount',
                      { $multiply: ['$amount', -1] },
                    ],
                  },
                },
              },
            },
            { $sort: { _id: 1 } },
          ],
          // flux net de caisse (tous mouvements) : évolution de la liquidité
          net: [
            {
              $group: {
                _id: trunc('$occurredAt', unit, timezone),
                amount: {
                  $sum: {
                    $cond: [
                      { $eq: ['$direction', 'in'] },
                      '$amount',
                      { $multiply: ['$amount', -1] },
                    ],
                  },
                },
              },
            },
            { $sort: { _id: 1 } },
          ],
          outflows: [
            { $match: { $expr: NATURE_OUT } },
            {
              $group: {
                _id: { bucket: trunc('$occurredAt', unit, timezone), type: '$type' },
                amount: { $sum: CONTRIBUTION },
              },
            },
            { $sort: { '_id.bucket': 1 } },
          ],
        },
      },
    ]),
    StockHistory.aggregate([
      {
        $match: {
          type: 'restock',
          $expr: {
            $and: [
              { $gte: [{ $ifNull: ['$purchasedAt', '$createdAt'] }, from] },
              { $lt: [{ $ifNull: ['$purchasedAt', '$createdAt'] }, to] },
            ],
          },
        },
      },
      // un achat = une operation (purchaseId), quel que soit le nombre d'ingredients
      {
        $group: {
          _id: {
            purchase: { $ifNull: ['$purchaseId', '$_id'] },
            method: { $ifNull: ['$paymentMethod', 'unknown'] },
          },
          total: { $sum: { $ifNull: ['$totalPrice', 0] } },
          unpriced: { $sum: { $cond: [{ $ifNull: ['$totalPrice', false] }, 0, 1] } },
        },
      },
      {
        $group: {
          _id: '$_id.method',
          total: { $sum: '$total' },
          count: { $sum: 1 },
          unpriced: { $sum: '$unpriced' },
        },
      },
    ]),
    Order.aggregate([
      { $match: saleDateQuery(from, to) },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const totals = sales.totals[0] || {
    revenue: 0,
    count: 0,
    collected: 0,
    remaining: 0,
    remainingCount: 0,
    ids: [],
  };
  const paymentsCount = totals.ids.length
    ? await CashMovement.countDocuments({
        type: 'order_payment',
        direction: 'in',
        reversalOf: { $exists: false },
        reversedBy: { $exists: false },
        orderId: { $in: totals.ids as Types.ObjectId[] },
      })
    : 0;

  const byType = (t: string) =>
    sales.byClientType.find((x: any) => x._id === t) || { count: 0, revenue: 0 };
  const statusCounts: Record<string, number> = Object.fromEntries(
    orders.map((o) => [o._id, o.count])
  );
  const prev = previous[0] || { revenue: 0, count: 0 };
  // Achats par moyen de paiement : seuls ceux payes avec la caisse sont des sorties de caisse
  const byMethod: Record<string, { total: number; count: number }> = {};
  for (const p of purchases) {
    byMethod[p._id] = { total: round(p.total), count: p.count };
  }
  const purch = purchases.reduce(
    (acc, p) => ({
      total: acc.total + p.total,
      count: acc.count + p.count,
      unpriced: acc.unpriced + p.unpriced,
    }),
    { total: 0, count: 0, unpriced: 0 }
  );
  const cs = cashSeries[0];
  // Dépenses (hors achats de stock), tous moyens de paiement : seules celles payées
  // avec la caisse sont aussi des sorties de caisse
  const expenses = await expensesPromise;

  return {
    period: { from, to, bucket: unit, timezone },
    sales: {
      revenue: round(totals.revenue),
      count: totals.count,
      collected: round(totals.collected),
      paymentsCount,
      remaining: round(totals.remaining),
      remainingCount: totals.remainingCount,
      averageBasket: totals.count ? round(totals.revenue / totals.count) : null,
      previous: { from: prevFrom, to: from, revenue: round(prev.revenue), count: prev.count },
    },
    cash: { ...cash, movementsCount },
    purchases: {
      total: round(purch.total),
      count: purch.count,
      unpriced: purch.unpriced,
      byMethod, // cash_register | personal | bank | other | unknown (anciens achats)
    },
    expenses, // { total, count, byMethod }
    orders: {
      total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      byStatus: statusCounts,
      ready: statusCounts.ready || 0,
      delivered: statusCounts.delivered || 0,
      cancelled: statusCounts.cancelled || 0,
    },
    series: {
      sales: sales.series.map((s: any) => ({
        bucket: s._id,
        revenue: round(s.revenue),
        count: s.count,
      })),
      payments: cs.payments.map((p: any) => ({ bucket: p._id, amount: round(p.amount) })),
      cashNet: cs.net.map((p: any) => ({ bucket: p._id, amount: round(p.amount) })),
      outflows: cs.outflows.map((o: any) => ({
        bucket: o._id.bucket,
        type: o._id.type,
        amount: round(o.amount),
      })),
    },
    topProducts: sales.products.map((p: any) => ({
      recipeId: p._id,
      name: p.name || 'Recette supprimee',
      quantity: p.quantity,
      revenue: round(p.revenue),
    })),
    clients: {
      active: sales.clients.length,
      individual: {
        count: byType('individual').count,
        revenue: round(byType('individual').revenue),
      },
      cafe: { count: byType('cafe').count, revenue: round(byType('cafe').revenue) },
      top: sales.clients.slice(0, 5).map((c: any) => ({
        clientId: c.clientId,
        name: c.name,
        count: c.count,
        revenue: round(c.revenue),
      })),
    },
  };
}
