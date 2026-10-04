import { Order, IOrder, ORDER_STATUSES, OrderStatus } from '../models/Order';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { deductStockForOrder, isStockDeducted } from './stockMovementService';

/**
 * AVANCEMENT D'UNE COMMANDE — indépendant du paiement.
 *
 *   En attente → Confirmée → En préparation → Prête → Remise
 *                    (annulation possible jusqu'à « Prête »)
 *
 *  - Le paiement est suivi à part (Order.paymentStatus, calculé depuis la caisse)
 *    et s'enregistre par une action explicite : on peut préparer, terminer ou
 *    remettre une commande non payée, et encaisser avant ou après.
 *  - « En préparation » = consommation réelle : le stock est déduit à ce moment,
 *    une seule fois, et seulement si le stock réel suffit.
 *  - Annuler après le début de la préparation demande une raison ; les ingrédients
 *    déjà consommés ne reviennent jamais automatiquement en stock.
 *  - « paid » : ancien statut (avant cette séparation). Il n'est plus proposé et
 *    se comporte comme « confirmed » pour les anciennes commandes.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'pending', 'cancelled'],
  paid: ['preparing', 'confirmed', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivered', 'preparing', 'cancelled'],
  delivered: ['ready'],
  cancelled: ['pending'],
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmee',
  paid: 'Confirmee',
  preparing: 'En preparation',
  ready: 'Prete',
  delivered: 'Remise',
  cancelled: 'Annulee',
};

/** Statuts où la préparation a commencé (ingrédients consommés). */
export const PREPARATION_STARTED: OrderStatus[] = ['preparing', 'ready', 'delivered'];

export async function changeOrderStatus(
  orderId: string,
  targetInput: unknown,
  opts: { reason?: unknown; actor: string }
): Promise<{ order: IOrder; oldStatus: OrderStatus; changed: boolean }> {
  const target = targetInput as OrderStatus;
  if (target === 'paid') {
    throw createError(
      'Le paiement ne fait plus partie des etapes : enregistrez-le avec "Encaisser" (carte Paiement)',
      400
    );
  }
  if (!ORDER_STATUSES.includes(target)) {
    throw createError('Statut invalide', 400);
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw createError('Commande non trouvee', 404);
  }
  const from = order.status;
  if (from === target) {
    return { order, oldStatus: from, changed: false }; // double clic : rien à faire
  }
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(target)) {
    throw createError(
      `Transition impossible : ${STATUS_LABELS[from] || from} → ${STATUS_LABELS[target]}`,
      400
    );
  }

  const reason = typeof opts.reason === 'string' ? opts.reason.trim() : '';
  const consumed = await isStockDeducted(order);

  if (target === 'cancelled' && consumed && reason.length < 3) {
    throw createError(
      "Indiquez la raison de l'annulation : la preparation a commence, les ingredients ont deja ete utilises",
      400
    );
  }
  if (target === 'pending' && from === 'cancelled' && consumed) {
    throw createError(
      'Cette commande a deja consomme du stock : elle ne peut pas etre reactivee. Creez une nouvelle commande.',
      400
    );
  }

  // Consommation réelle : déduction (une seule fois) AVANT de changer le statut.
  // Refusée sans rien modifier si le stock réel ne suffit pas.
  if (target === 'preparing') {
    await deductStockForOrder(order._id);
  }

  const now = new Date();
  const set: Record<string, unknown> = { status: target };
  if (target === 'preparing') {
    set.stockDeducted = true;
  }
  if (target === 'delivered') {
    set.deliveredAt = now;
  }
  if (from === 'delivered') {
    set.deliveredAt = null;
  }
  if (target === 'cancelled') {
    Object.assign(set, {
      cancellationReason: reason,
      cancelledAt: now,
      cancelledBy: opts.actor,
      cancelledAfterPreparation: consumed,
    });
  }
  if (from === 'cancelled') {
    Object.assign(set, {
      cancellationReason: '',
      cancelledAt: null,
      cancelledBy: '',
      cancelledAfterPreparation: false,
    });
  }

  // Mise à jour conditionnée au statut lu : deux changements simultanés ne
  // peuvent pas s'écraser (le 2e voit que la commande a déjà changé).
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: from },
    {
      $set: set,
      $push: { statusHistory: { from, to: target, at: now, by: opts.actor, reason } },
    },
    { new: true }
  );
  if (!updated) {
    const current = await Order.findById(order._id);
    if (current && current.status === target) {
      return { order: current, oldStatus: from, changed: false };
    }
    logger.warn(`Commande ${order._id} : changement ${from} → ${target} concurrent refuse`);
    throw createError('La commande a ete modifiee entre-temps, rechargez la page', 409);
  }
  return { order: updated, oldStatus: from, changed: true };
}
