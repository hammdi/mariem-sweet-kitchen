import { Order, IOrder } from '../models/Order';
import { Client } from '../models/Client';
import { escapeRegex } from '../utils/regex';
import { round } from './unitService';

/**
 * VENTES — convention retenue (à valider avec Rahma) :
 *
 *  - Une VENTE est une commande acceptée : statut confirmée, en préparation,
 *    prête ou remise (et l'ancien statut "payée"). "En attente" (demande pas
 *    encore acceptée) et "annulée" ne sont pas des ventes. Une vente n'est pas
 *    un paiement : elle peut être non payée (= à encaisser).
 *  - Date de vente = date prévue de la commande (date confirmée, sinon date
 *    souhaitée, sinon date de création) : c'est le jour où la vente a lieu.
 *  - Chiffre d'affaires (CA) d'une période = somme des montants des ventes de
 *    la période, PAYÉES OU NON.
 *  - Encaissé = ce qui a été réellement payé sur ces ventes (Order.amountPaid,
 *    calculé depuis la caisse). À encaisser = CA − encaissé (jamais négatif).
 *  - La CAISSE (cashService) ne compte que l'argent réellement reçu/dépensé,
 *    à la date du mouvement. CA et caisse sont donc deux chiffres différents.
 *
 *  Exemple : CMD-21 43,60 DT payée + CMD-22 25 DT confirmée non payée
 *    → CA = 68,60 · Encaissé = 43,60 · À encaisser = 25 · Caisse = +43,60
 */

export const SALE_STATUSES = ['confirmed', 'paid', 'preparing', 'ready', 'delivered'];

export const saleDate = (o: Pick<IOrder, 'confirmedDate' | 'requestedDate' | 'createdAt'>) =>
  o.confirmedDate || o.requestedDate || o.createdAt;

/** Filtre MongoDB "date de vente dans [from, to[" */
export function saleDateQuery(from: Date, to: Date) {
  const range = { $gte: from, $lt: to };
  return {
    $or: [
      { confirmedDate: range },
      { confirmedDate: null, requestedDate: range },
      { confirmedDate: null, requestedDate: null, createdAt: range },
    ],
  };
}

/** Filtres communs (historique des commandes et ventes) */
export async function buildOrderFilters(params: {
  search?: string;
  clientType?: string;
  paymentStatus?: string;
}) {
  const and: any[] = [];
  const term = (params.search || '').trim();
  if (term) {
    const cmd = term.match(/^(?:cmd[-\s]?)?(\d+)$/i);
    const explicitCmd = /^cmd/i.test(term);
    const digits = term.replace(/\D/g, '');
    const or: any[] = [];
    if (cmd) {
      or.push({ orderNumber: parseInt(cmd[1], 10) });
    }
    if (!explicitCmd) {
      or.push({ clientName: { $regex: escapeRegex(term), $options: 'i' } });
      // telephone : seulement a partir de 3 chiffres ("4" = numero de commande, pas un telephone)
      if (digits.length >= 3) {
        or.push({ clientPhone: { $regex: digits.split('').join('\\D*') } });
      }
    }
    and.push({ $or: or });
  }
  if (params.clientType === 'cafe' || params.clientType === 'individual') {
    const ids = await Client.find({ type: params.clientType }).distinct('_id');
    // commandes sans fiche client (site public, anciennes) = particuliers
    and.push(
      params.clientType === 'cafe'
        ? { clientId: { $in: ids } }
        : { $or: [{ clientId: { $in: ids } }, { clientId: null }] }
    );
  }
  if (['unpaid', 'partial', 'paid'].includes(params.paymentStatus || '')) {
    and.push({ paymentStatus: params.paymentStatus });
  }
  return and;
}

const brief = (o: any) => ({
  _id: o._id,
  orderNumber: o.orderNumber,
  orderRef: o.orderNumber ? `CMD-${o.orderNumber}` : `CMD-${String(o._id).slice(-5).toUpperCase()}`,
  date: saleDate(o),
  createdAt: o.createdAt,
  clientName: o.clientName,
  clientType: o.clientId?.type || 'individual',
  status: o.status,
  totalPrice: o.totalPrice,
  amountPaid: o.amountPaid || 0,
  remaining: round(Math.max(0, o.totalPrice - (o.amountPaid || 0))),
  paymentStatus: o.paymentStatus || 'unpaid',
  paymentMethod: o.paymentMethod || null,
  items: (o.items || []).map((it: any) => ({
    recipeName: it.recipeId?.name || 'Recette',
    sizeName: it.recipeId?.variants?.[it.variantIndex]?.sizeName || '',
    quantity: it.quantity,
  })),
});

export async function listSales(params: {
  from: Date;
  to: Date;
  search?: string;
  clientType?: string;
  paymentStatus?: string;
  status?: string;
}) {
  const and = [
    {
      status: SALE_STATUSES.includes(params.status || '') ? params.status : { $in: SALE_STATUSES },
    },
    saleDateQuery(params.from, params.to),
    ...(await buildOrderFilters(params)),
  ];
  const orders = await Order.find({ $and: and })
    .populate('items.recipeId', 'name variants.sizeName')
    .populate('clientId', 'name type');

  const sales = orders.map(brief).sort((a, b) => b.date.getTime() - a.date.getTime());
  const revenue = round(sales.reduce((s, x) => s + x.totalPrice, 0));
  const collected = round(sales.reduce((s, x) => s + x.amountPaid, 0));
  const remaining = round(sales.reduce((s, x) => s + x.remaining, 0));

  // Annulées avec de l'argent encore encaissé (remboursement à décider)
  const cancelledPaid = await Order.find({
    $and: [{ status: 'cancelled', amountPaid: { $gt: 0 } }, saleDateQuery(params.from, params.to)],
  }).select('amountPaid');

  return {
    sales,
    summary: {
      count: sales.length,
      revenue,
      collected,
      remaining,
      cancelledWithPayment: {
        count: cancelledPaid.length,
        amount: round(cancelledPaid.reduce((s, o) => s + o.amountPaid, 0)),
      },
    },
    convention:
      'CA = commandes confirmees, payees, en preparation ou pretes dont la date prevue est dans la periode (payees ou non). Encaisse = paiements enregistres sur ces commandes. A encaisser = CA - encaisse.',
  };
}

/** Commandes vendues pas encore (entièrement) payées : "à encaisser", toutes dates. */
export async function listReceivables() {
  const orders = await Order.find({
    status: { $in: SALE_STATUSES },
    $expr: { $gt: [{ $subtract: ['$totalPrice', { $ifNull: ['$amountPaid', 0] }] }, 0.0005] },
  })
    .populate('items.recipeId', 'name variants.sizeName')
    .populate('clientId', 'name type');
  const list = orders.map(brief).sort((a, b) => a.date.getTime() - b.date.getTime());
  return {
    orders: list,
    total: round(list.reduce((s, x) => s + x.remaining, 0)),
  };
}

/** Reste à encaisser sur toutes les ventes (toutes dates). */
export async function totalOutstanding() {
  const orders = await Order.find({ status: { $in: SALE_STATUSES } }).select(
    'totalPrice amountPaid'
  );
  return round(orders.reduce((s, o) => s + Math.max(0, o.totalPrice - (o.amountPaid || 0)), 0));
}
