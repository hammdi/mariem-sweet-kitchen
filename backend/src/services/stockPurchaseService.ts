import { Types } from 'mongoose';
import { Ingredient } from '../models/Ingredient';
import { IngredientPrice } from '../models/IngredientPrice';
import { PurchaseNeed } from '../models/PurchaseNeed';
import { PurchaseSource, IPurchaseSource } from '../models/PurchaseSource';
import {
  IStockHistory,
  PURCHASE_PAYMENT_METHODS,
  PurchasePaymentMethod,
  StockHistory,
} from '../models/StockHistory';
import { CashMovement } from '../models/CashMovement';
import { createError } from '../middleware/errorHandler';
import { Actor, correctMovement, recordPurchaseOutflow } from './cashService';
import { syncPurchaseNeeds } from './purchaseNeedService';
import { round } from './unitService';

/**
 * ACHAT DE STOCK = une seule opération synchronisée :
 *   1. le stock augmente (StockHistory "restock" : prix réellement payé, source,
 *      moyen de paiement, commandes débloquées) ;
 *   2. SEULEMENT si payé avec la caisse : sortie de caisse correspondante.
 *      Argent personnel / banque / autre : achat tracé, caisse physique inchangée ;
 *   3. les besoins d'achat des commandes sont recalculés.
 * Utilisé par la Caisse, la fiche ingrédient et la liste de courses.
 */

export const PAYMENT_METHOD_LABELS: Record<PurchasePaymentMethod, string> = {
  cash_register: 'Caisse',
  personal: 'Argent personnel',
  bank: 'Banque',
  other: 'Autre',
};

function parsePaymentMethod(input: unknown): PurchasePaymentMethod {
  if (!PURCHASE_PAYMENT_METHODS.includes(input as PurchasePaymentMethod)) {
    throw createError(
      'Indiquez le moyen de paiement de l achat (caisse, argent personnel, banque ou autre)',
      400
    );
  }
  return input as PurchasePaymentMethod;
}

export interface PurchaseItemInput {
  ingredientId: string;
  quantity: unknown; // dans l'unité de stock de l'ingrédient
  unitPrice: unknown; // prix réellement payé, DT par unité de stock (obligatoire)
  updateSourcePrice?: boolean;
}

function parsePositive(input: unknown, message: string): number {
  const n = typeof input === 'string' ? parseFloat(input) : (input as number);
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) {
    throw createError(message, 400);
  }
  return n;
}

export async function recordStockPurchase(opts: {
  items: PurchaseItemInput[];
  paymentMethod: unknown;
  sourceId?: string;
  purchasedAt?: unknown;
  actor: Actor;
}) {
  if (!Array.isArray(opts.items) || opts.items.length === 0) {
    throw createError('Aucun achat a enregistrer', 400);
  }
  const paymentMethod = parsePaymentMethod(opts.paymentMethod);
  const purchasedAt = opts.purchasedAt ? new Date(opts.purchasedAt as string) : new Date();
  if (isNaN(purchasedAt.getTime())) {
    throw createError('Date invalide', 400);
  }
  let source: IPurchaseSource | null = null;
  if (opts.sourceId) {
    if (!Types.ObjectId.isValid(opts.sourceId)) {
      throw createError('Source invalide', 400);
    }
    source = await PurchaseSource.findById(opts.sourceId);
    if (!source) {
      throw createError('Source introuvable', 400);
    }
  }

  // Tout valider avant de toucher au stock ou à la caisse
  const lines = [];
  for (const item of opts.items) {
    const ingredient = Types.ObjectId.isValid(item.ingredientId)
      ? await Ingredient.findById(item.ingredientId)
      : null;
    if (!ingredient) {
      throw createError('Ingredient introuvable', 400);
    }
    const quantity = parsePositive(item.quantity, `${ingredient.name} : quantite achetee invalide`);
    const unitPrice = parsePositive(
      item.unitPrice,
      `${ingredient.name} : indiquez le prix reellement paye`
    );
    lines.push({
      ingredient,
      quantity,
      unitPrice,
      updateSourcePrice: item.updateSourcePrice === true,
    });
  }

  const ingredientIds = lines.map((l) => l.ingredient._id);
  const before = await PurchaseNeed.find({ status: 'open', ingredientId: { $in: ingredientIds } });

  const purchaseId = new Types.ObjectId();
  const entries = [];
  for (const l of lines) {
    await Ingredient.updateOne({ _id: l.ingredient._id }, [
      { $set: { stockQuantity: { $round: [{ $add: ['$stockQuantity', l.quantity] }, 6] } } },
    ]);
    entries.push(
      await StockHistory.create({
        ingredientId: l.ingredient._id,
        ingredientName: l.ingredient.name,
        quantity: l.quantity,
        unit: l.ingredient.unit,
        type: 'restock',
        unitPrice: l.unitPrice,
        totalPrice: round(l.unitPrice * l.quantity),
        sourceId: source?._id,
        sourceName: source?.name || '',
        purchasedAt,
        purchaseId,
        paymentMethod,
        createdBy: opts.actor.email,
      })
    );

    // Optionnel : reporter ce prix comme dernier prix constaté chez la source
    if (l.updateSourcePrice && source) {
      let offer = await IngredientPrice.findOne({
        ingredientId: l.ingredient._id,
        sourceId: source._id,
      });
      if (!offer) {
        offer = new IngredientPrice({ ingredientId: l.ingredient._id, sourceId: source._id });
      }
      offer.isActive = true;
      offer.price = l.unitPrice;
      offer.unit = l.ingredient.unit;
      offer.lastCheckedAt = purchasedAt;
      offer.history.push({
        price: l.unitPrice,
        unit: l.ingredient.unit,
        checkedAt: purchasedAt,
        note: 'achat',
        recordedAt: new Date(),
      });
      await offer.save();
    }
  }

  // Besoins recalculés : quelles commandes cet achat a-t-il débloquées ?
  await syncPurchaseNeeds();
  const after = await PurchaseNeed.find({ _id: { $in: before.map((n) => n._id) } });
  const unblocked = new Map<
    string,
    { orderId: Types.ObjectId; orderNumber?: number; clientName: string; fully: boolean }
  >();
  for (const prev of before) {
    const now = after.find((n) => n._id.toString() === prev._id.toString());
    if (!now || now.missingQty >= prev.missingQty) {
      continue;
    }
    const key = prev.orderId.toString();
    const fully = now.status !== 'open';
    const existing = unblocked.get(key);
    unblocked.set(key, {
      orderId: prev.orderId,
      orderNumber: prev.orderNumber,
      clientName: prev.clientName,
      fully: existing ? existing.fully && fully : fully,
    });
  }
  // une commande n'est "débloquée" que si plus aucun de ses besoins n'est ouvert
  for (const u of unblocked.values()) {
    if (u.fully && (await PurchaseNeed.exists({ orderId: u.orderId, status: 'open' }))) {
      u.fully = false;
    }
  }

  const total = round(entries.reduce((s, e) => s + (e.totalPrice || 0), 0));
  const unblockedOrders = Array.from(unblocked.values());
  // Sortie de caisse UNIQUEMENT si l'achat a été payé avec l'argent de la caisse
  const cashMovement =
    paymentMethod === 'cash_register'
      ? await purchaseOutflow(entries, opts.actor, unblockedOrders, source, purchasedAt)
      : null;
  await StockHistory.updateMany(
    { purchaseId },
    { $set: { unblockedOrders, cashMovementId: cashMovement?._id || null } }
  );

  return { purchaseId, paymentMethod, entries, cashMovement, total, unblockedOrders };
}

async function purchaseOutflow(
  entries: IStockHistory[],
  actor: Actor,
  unblockedOrders: IStockHistory['unblockedOrders'],
  source: { _id: unknown; name: string } | null,
  occurredAt: Date,
  idempotencyKey?: string
) {
  return recordPurchaseOutflow({
    amount: round(entries.reduce((s, e) => s + (e.totalPrice || 0), 0)),
    description: `Achat de stock : ${entries.map((e) => `${e.ingredientName} ${e.quantity} ${e.unit}`).join(', ')}`,
    stockHistoryIds: entries.map((e) => e._id as unknown as Types.ObjectId),
    stockItems: entries.map((e) => ({
      ingredientId: e.ingredientId,
      name: e.ingredientName,
      quantity: e.quantity,
      unit: e.unit,
    })),
    unblockedOrders,
    sourceId: (source?._id as Types.ObjectId) || undefined,
    sourceName: source?.name,
    occurredAt,
    actor,
    idempotencyKey,
  });
}

/** Lignes d'un achat (anciens achats sans purchaseId : la ligne seule). */
async function purchaseEntries(purchaseId: string) {
  if (!Types.ObjectId.isValid(purchaseId)) {
    throw createError('Achat introuvable', 404);
  }
  const entries = await StockHistory.find({
    type: 'restock',
    $or: [{ purchaseId }, { _id: purchaseId, purchaseId: { $exists: false } }],
  });
  if (entries.length === 0) {
    throw createError('Achat introuvable', 404);
  }
  return entries;
}

/**
 * Changer le moyen de paiement d'un achat déjà enregistré (erreur de saisie).
 * Caisse → autre : la sortie de caisse est annulée par une correction tracée.
 * Autre → caisse : une sortie de caisse est créée. Le stock ne bouge pas.
 */
export async function changePurchasePaymentMethod(
  purchaseId: string,
  newMethodInput: unknown,
  actor: Actor
) {
  const newMethod = parsePaymentMethod(newMethodInput);
  const entries = await purchaseEntries(purchaseId);
  const current = (entries[0].paymentMethod || 'cash_register') as PurchasePaymentMethod;
  const ids = entries.map((e) => e._id);
  // Sortie de caisse encore active pour cet achat ?
  const active = await CashMovement.findOne({
    type: 'purchase',
    stockHistoryIds: { $in: ids },
    reversalOf: { $exists: false },
    reversedBy: { $exists: false },
  });

  if (newMethod === current && (newMethod === 'cash_register') === !!active) {
    return { changed: false, paymentMethod: current, cashMovement: active };
  }

  const reason = `Moyen de paiement modifie : ${PAYMENT_METHOD_LABELS[current]} → ${PAYMENT_METHOD_LABELS[newMethod]}`;
  let cashMovement = null;
  if (newMethod !== 'cash_register' && active) {
    try {
      await correctMovement(String(active._id), { reason, actor });
    } catch (e: any) {
      // deja annulee par une demande simultanee identique
      if (e?.statusCode !== 409) {
        throw e;
      }
    }
  }
  if (newMethod === 'cash_register' && !active) {
    // version : une nouvelle sortie par changement, jamais deux pour le même changement
    const version = await CashMovement.countDocuments({
      type: 'purchase',
      stockHistoryIds: { $in: ids },
      reversalOf: { $exists: false },
    });
    const first = entries[0];
    const key = `purchase:${ids.map(String).sort().join(',')}:v${version}`;
    try {
      cashMovement = await purchaseOutflow(
        entries,
        actor,
        first.unblockedOrders || [],
        first.sourceId ? { _id: first.sourceId, name: first.sourceName || '' } : null,
        first.purchasedAt || first.createdAt,
        key
      );
    } catch (e: any) {
      if (e?.code !== 11000) {
        throw e;
      }
      // demande simultanee identique : la sortie existe deja, ne pas la doubler
      return {
        changed: false,
        paymentMethod: newMethod,
        cashMovement: await CashMovement.findOne({ idempotencyKey: key }),
      };
    }
  }
  await StockHistory.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        paymentMethod: newMethod,
        cashMovementId: newMethod === 'cash_register' ? cashMovement?._id || active?._id : null,
        note: reason,
      },
    }
  );
  return { changed: true, paymentMethod: newMethod, cashMovement };
}

/** Achats de stock d'une période (tous moyens de paiement), regroupés par achat. */
export async function listPurchases(from: Date, to: Date) {
  const entries = await StockHistory.find({
    type: 'restock',
    $expr: {
      $and: [
        { $gte: [{ $ifNull: ['$purchasedAt', '$createdAt'] }, from] },
        { $lt: [{ $ifNull: ['$purchasedAt', '$createdAt'] }, to] },
      ],
    },
  }).sort({ createdAt: -1 });

  // anciens achats sans moyen de paiement : déduit de l'existence d'une sortie de caisse
  const linked = await CashMovement.find({
    type: 'purchase',
    stockHistoryIds: { $in: entries.map((e) => e._id) },
    reversalOf: { $exists: false },
  }).select('stockHistoryIds amount reversedBy');

  const groups = new Map<string, any>();
  for (const e of entries) {
    const key = String(e.purchaseId || e._id);
    if (!groups.has(key)) {
      const move = linked.find(
        (m) => m.stockHistoryIds.some((id) => String(id) === String(e._id)) && !m.reversedBy
      );
      groups.set(key, {
        purchaseId: key,
        date: e.purchasedAt || e.createdAt,
        sourceName: e.sourceName || '',
        paymentMethod: e.paymentMethod || (move ? 'cash_register' : 'unknown'),
        cashOut: move ? move.amount : 0,
        unblockedOrders: e.unblockedOrders || [],
        createdBy: e.createdBy || '',
        note: e.note || '',
        total: 0,
        items: [] as any[],
      });
    }
    const g = groups.get(key);
    g.items.push({
      ingredientId: e.ingredientId,
      name: e.ingredientName,
      quantity: e.quantity,
      unit: e.unit,
      unitPrice: e.unitPrice ?? null,
      total: e.totalPrice ?? null,
    });
    g.total = round(g.total + (e.totalPrice || 0));
  }
  const purchases = Array.from(groups.values());
  const byMethod: Record<string, number> = {};
  for (const p of purchases) {
    byMethod[p.paymentMethod] = round((byMethod[p.paymentMethod] || 0) + p.total);
  }
  return { purchases, byMethod, total: round(purchases.reduce((s, p) => s + p.total, 0)) };
}
