import { Types } from 'mongoose';
import {
  CashMovement,
  CashMovementType,
  ICashMovement,
  PaymentMethod,
} from '../models/CashMovement';
import { Order } from '../models/Order';
import { createError } from '../middleware/errorHandler';
import { round } from './unitService';

/**
 * CAISSE — argent réellement encaissé ou dépensé.
 *
 * Conventions (voir aussi salesService) :
 *  - Une commande n'entre dans la caisse que lorsqu'un paiement est ENREGISTRÉ
 *    (mouvement order_payment). Confirmée mais non payée = "à encaisser", 0 en caisse.
 *  - Order.amountPaid / paymentStatus sont recalculés depuis les mouvements
 *    (jamais saisis à la main) : la caisse est la source de vérité de l'argent.
 *  - Aucune suppression : une correction = mouvement inverse + éventuel remplacement.
 *  - Le paiement est une action EXPLICITE (« Encaisser »), indépendante de
 *    l'avancement de la commande (on peut encaisser avant ou après la préparation).
 *  - Chaque opération porte une clé d'idempotence : un double clic ou deux
 *    requêtes simultanées n'enregistrent qu'un seul mouvement.
 *  - Annuler une commande ne rembourse rien automatiquement : le remboursement
 *    est une action explicite (mouvement order_refund).
 */

const EPS = 0.0005;
const DIRECTION: Record<CashMovementType, 'in' | 'out'> = {
  order_payment: 'in',
  order_refund: 'out',
  other_income: 'in',
  purchase: 'out',
  expense: 'out',
  opening_balance: 'in',
};

export interface Actor {
  userId?: string | Types.ObjectId;
  email: string;
}

const signed = (m: { direction: string; amount: number }) =>
  m.direction === 'in' ? m.amount : -m.amount;

function parseAmount(input: unknown): number {
  const n = typeof input === 'string' ? parseFloat(input) : (input as number);
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) {
    throw createError('Montant invalide', 400);
  }
  return round(n);
}

async function insertOnce(doc: Partial<ICashMovement>) {
  try {
    return await CashMovement.create(doc);
  } catch (e: any) {
    if (e?.code === 11000 && doc.idempotencyKey) {
      return null; // même opération déjà enregistrée (double clic, requêtes simultanées)
    }
    throw e;
  }
}

/** Recalcule Order.amountPaid / paymentStatus depuis la caisse. */
export async function refreshOrderPayment(orderId: string | Types.ObjectId) {
  const order = await Order.findById(orderId).select('totalPrice paidAt');
  if (!order) {
    return null;
  }
  const movements = await CashMovement.find({ orderId: order._id }).sort({ occurredAt: 1 });
  const amountPaid = round(movements.reduce((s, m) => s + signed(m), 0));
  const paymentStatus =
    amountPaid <= EPS ? 'unpaid' : amountPaid + EPS < order.totalPrice ? 'partial' : 'paid';
  const lastPayment = [...movements]
    .reverse()
    .find((m) => m.type === 'order_payment' && m.direction === 'in' && !m.reversedBy);
  await Order.updateOne(
    { _id: order._id },
    {
      $set: {
        amountPaid,
        paymentStatus,
        paymentMethod: amountPaid > EPS ? lastPayment?.method || null : null,
        paidAt:
          paymentStatus === 'paid' ? order.paidAt || lastPayment?.occurredAt || new Date() : null,
      },
    }
  );
  return { amountPaid, paymentStatus, total: order.totalPrice };
}

async function currentPaid(orderId: unknown) {
  const movements = await CashMovement.find({ orderId });
  return {
    paid: round(movements.reduce((s, m) => s + signed(m), 0)),
    // version = nombre de mouvements : change après chaque paiement/remboursement,
    // identique pour deux requêtes simultanées (une seule passe l'index unique)
    version: movements.length,
  };
}

/**
 * Encaisser une commande. Sans montant : le reste dû.
 * Refuse un montant supérieur au reste dû.
 */
export async function recordOrderPayment(
  orderId: string,
  opts: {
    amount?: unknown;
    method?: PaymentMethod;
    note?: string;
    occurredAt?: Date;
    actor: Actor;
  }
) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw createError('Commande non trouvee', 404);
  }
  if (order.status === 'cancelled') {
    throw createError('Commande annulee : pas de paiement possible', 400);
  }
  const { paid, version } = await currentPaid(order._id);
  const outstanding = round(order.totalPrice - paid);
  if (outstanding <= EPS) {
    throw createError('Cette commande est deja entierement payee', 400);
  }
  const amount =
    opts.amount === undefined || opts.amount === null || opts.amount === ''
      ? outstanding
      : parseAmount(opts.amount);
  if (amount > outstanding + EPS) {
    throw createError(`Montant superieur au reste a payer (${outstanding} DT)`, 400);
  }

  const movement = await insertOnce({
    type: 'order_payment',
    direction: 'in',
    amount,
    method: opts.method || 'cash',
    description: opts.note || 'Paiement commande',
    occurredAt: opts.occurredAt || new Date(),
    orderId: order._id as unknown as Types.ObjectId,
    orderNumber: order.orderNumber,
    createdBy: { userId: opts.actor.userId as any, email: opts.actor.email },
    // même commande, même état de paiement, même montant : un seul enregistrement
    idempotencyKey: `order-payment:${order._id}:v${version}:${amount}`,
  });
  await refreshOrderPayment(order._id);
  return {
    created: !!movement,
    movement,
    outstanding: round(outstanding - (movement ? amount : 0)),
  };
}

/** Remboursement explicite (annulation, geste commercial...). */
export async function recordOrderRefund(
  orderId: string,
  opts: { amount?: unknown; method?: PaymentMethod; reason?: string; actor: Actor }
) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw createError('Commande non trouvee', 404);
  }
  const { paid, version } = await currentPaid(order._id);
  if (paid <= EPS) {
    throw createError('Rien a rembourser : aucun paiement enregistre', 400);
  }
  const amount = opts.amount === undefined || opts.amount === '' ? paid : parseAmount(opts.amount);
  if (amount > paid + EPS) {
    throw createError(`Montant superieur au deja paye (${paid} DT)`, 400);
  }
  const movement = await insertOnce({
    type: 'order_refund',
    direction: 'out',
    amount,
    method: opts.method || 'cash',
    description: opts.reason || 'Remboursement commande',
    occurredAt: new Date(),
    orderId: order._id as unknown as Types.ObjectId,
    orderNumber: order.orderNumber,
    createdBy: { userId: opts.actor.userId as any, email: opts.actor.email },
    idempotencyKey: `order-refund:${order._id}:v${version}:${amount}`,
  });
  await refreshOrderPayment(order._id);
  return { created: !!movement, movement };
}

/**
 * Entrée manuelle (autre entrée, fonds de caisse).
 * Les dépenses passent par expenseService (elles peuvent être payées hors caisse).
 */
export async function recordManualMovement(opts: {
  type: 'other_income' | 'opening_balance' | 'expense';
  amount: unknown;
  description?: string;
  method?: PaymentMethod;
  occurredAt?: unknown;
  actor: Actor;
  expenseId?: Types.ObjectId;
}) {
  if (!['other_income', 'expense', 'opening_balance'].includes(opts.type)) {
    throw createError('Type de mouvement invalide', 400);
  }
  if (opts.type === 'expense' && !opts.expenseId) {
    throw createError('Une depense s enregistre avec son moyen de paiement (Depenses)', 400);
  }
  const occurredAt = opts.occurredAt ? new Date(opts.occurredAt as string) : new Date();
  if (isNaN(occurredAt.getTime())) {
    throw createError('Date invalide', 400);
  }
  return CashMovement.create({
    type: opts.type,
    direction: DIRECTION[opts.type],
    amount: parseAmount(opts.amount),
    method: opts.method || 'cash',
    description: (opts.description || '').trim(),
    occurredAt,
    expenseId: opts.expenseId,
    createdBy: { userId: opts.actor.userId as any, email: opts.actor.email },
  });
}

/** Sortie de caisse pour un achat d'ingrédients déjà enregistré dans StockHistory. */
export async function recordPurchaseOutflow(opts: {
  amount: number;
  description: string;
  stockHistoryIds: Types.ObjectId[];
  stockItems?: ICashMovement['stockItems'];
  unblockedOrders?: ICashMovement['unblockedOrders'];
  sourceId?: Types.ObjectId;
  sourceName?: string;
  occurredAt?: Date;
  method?: PaymentMethod;
  actor: Actor;
  idempotencyKey?: string;
}) {
  if (!(opts.amount > 0)) {
    return null;
  }
  return CashMovement.create({
    type: 'purchase',
    direction: 'out',
    amount: round(opts.amount),
    method: opts.method || 'cash',
    description: opts.description,
    occurredAt: opts.occurredAt || new Date(),
    stockHistoryIds: opts.stockHistoryIds,
    stockItems: opts.stockItems || [],
    unblockedOrders: opts.unblockedOrders || [],
    sourceId: opts.sourceId,
    sourceName: opts.sourceName,
    createdBy: { userId: opts.actor.userId as any, email: opts.actor.email },
    idempotencyKey:
      opts.idempotencyKey || `purchase:${opts.stockHistoryIds.map(String).sort().join(',')}`,
  });
}

/**
 * Correction tracée : annule le mouvement (mouvement inverse) et, si un nouveau
 * montant est donné, enregistre la valeur corrigée.
 */
export async function correctMovement(
  id: string,
  opts: {
    amount?: unknown;
    description?: string;
    reason?: string;
    actor: Actor;
    fromExpense?: boolean;
  }
) {
  const original = await CashMovement.findById(id);
  if (!original) {
    throw createError('Mouvement non trouve', 404);
  }
  if (original.reversalOf) {
    throw createError(
      "Une correction ne peut pas etre corrigee : corrigez le mouvement d'origine",
      400
    );
  }
  if (original.expenseId && !opts.fromExpense) {
    throw createError(
      'Cette sortie correspond a une depense : annulez ou corrigez la depense (onglet Depenses)',
      400
    );
  }
  if (!opts.reason || !String(opts.reason).trim()) {
    throw createError('Indiquez la raison de la correction', 400);
  }
  const actor = { userId: opts.actor.userId as any, email: opts.actor.email };

  const reversal = new CashMovement({
    type: original.type,
    direction: original.direction === 'in' ? 'out' : 'in',
    amount: original.amount,
    method: original.method,
    description: `Correction : annule "${original.description}"`,
    occurredAt: new Date(),
    orderId: original.orderId,
    orderNumber: original.orderNumber,
    sourceId: original.sourceId,
    sourceName: original.sourceName,
    createdBy: actor,
    reversalOf: original._id,
    expenseId: original.expenseId,
    correctionReason: String(opts.reason).trim(),
    idempotencyKey: `reversal:${original._id}`,
  });
  if (original.reversedBy) {
    throw createError('Ce mouvement a deja ete corrige', 409);
  }
  try {
    await reversal.save(); // cle unique "reversal:<id>" : une seule annulation possible
  } catch (e: any) {
    if (e?.code === 11000) {
      throw createError('Ce mouvement a deja ete corrige', 409);
    }
    throw e;
  }
  await CashMovement.updateOne({ _id: original._id }, { $set: { reversedBy: reversal._id } });

  let replacement = null;
  if (opts.amount !== undefined && opts.amount !== null && opts.amount !== '') {
    replacement = await CashMovement.create({
      type: original.type,
      direction: original.direction,
      amount: parseAmount(opts.amount),
      method: original.method,
      description: opts.description?.trim() || original.description,
      occurredAt: original.occurredAt,
      orderId: original.orderId,
      orderNumber: original.orderNumber,
      stockHistoryIds: original.stockHistoryIds,
      sourceId: original.sourceId,
      sourceName: original.sourceName,
      createdBy: actor,
      expenseId: original.expenseId,
      replacementOf: original._id,
      correctionReason: String(opts.reason).trim(),
    });
  }

  if (original.orderId) {
    await refreshOrderPayment(original.orderId);
  }
  return { reversal, replacement };
}

/**
 * Résumé de caisse sur une période.
 * Entrées/sorties sont NETTES des corrections : une annulation d'entrée réduit
 * les entrées (elle n'apparaît pas comme une sortie).
 */
export async function cashSummary(from: Date, to: Date) {
  const nature = (m: ICashMovement) =>
    m.reversalOf ? (m.direction === 'in' ? 'out' : 'in') : m.direction;
  const contribution = (m: ICashMovement) => (m.reversalOf ? -m.amount : m.amount);

  const before = await CashMovement.find({ occurredAt: { $lt: from } }).select('direction amount');
  const inPeriod = await CashMovement.find({ occurredAt: { $gte: from, $lt: to } });
  const openingBalance = round(before.reduce((s, m) => s + signed(m), 0));
  const totalIn = round(
    inPeriod.filter((m) => nature(m) === 'in').reduce((s, m) => s + contribution(m), 0)
  );
  const totalOut = round(
    inPeriod.filter((m) => nature(m) === 'out').reduce((s, m) => s + contribution(m), 0)
  );
  return {
    openingBalance,
    totalIn,
    totalOut,
    theoreticalBalance: round(openingBalance + totalIn - totalOut),
  };
}

export async function currentCashBalance() {
  const all = await CashMovement.find().select('direction amount');
  return round(all.reduce((s, m) => s + signed(m), 0));
}
