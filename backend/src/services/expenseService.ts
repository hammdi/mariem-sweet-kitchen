import { Types } from 'mongoose';
import { Expense } from '../models/Expense';
import { CashMovement } from '../models/CashMovement';
import { PURCHASE_PAYMENT_METHODS, PurchasePaymentMethod } from '../models/StockHistory';
import { createError } from '../middleware/errorHandler';
import { Actor, correctMovement, recordManualMovement } from './cashService';
import { round } from './unitService';

/**
 * Dépenses (hors achats de stock). Seule une dépense payée avec la caisse
 * crée une sortie de caisse ; les autres sont tracées sans toucher la liquidité.
 */

function parseAmount(input: unknown): number {
  const n = typeof input === 'string' ? parseFloat(input) : (input as number);
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) {
    throw createError('Montant invalide', 400);
  }
  return round(n);
}

export async function recordExpense(opts: {
  amount: unknown;
  description?: unknown;
  paymentMethod: unknown;
  occurredAt?: unknown;
  actor: Actor;
}) {
  const amount = parseAmount(opts.amount);
  const description = typeof opts.description === 'string' ? opts.description.trim() : '';
  if (!description) {
    throw createError('Decrivez la depense (ex : emballages, gaz, transport)', 400);
  }
  if (!PURCHASE_PAYMENT_METHODS.includes(opts.paymentMethod as PurchasePaymentMethod)) {
    throw createError(
      'Indiquez le moyen de paiement de la depense (caisse, argent personnel, banque ou autre)',
      400
    );
  }
  const paymentMethod = opts.paymentMethod as PurchasePaymentMethod;
  const occurredAt = opts.occurredAt ? new Date(opts.occurredAt as string) : new Date();
  if (isNaN(occurredAt.getTime())) {
    throw createError('Date invalide', 400);
  }

  const expense = await Expense.create({
    amount,
    description,
    occurredAt,
    paymentMethod,
    createdBy: { userId: opts.actor.userId as any, email: opts.actor.email },
  });

  // Payée avec la caisse : la liquidité baisse
  if (paymentMethod === 'cash_register') {
    try {
      const movement = await recordManualMovement({
        type: 'expense',
        amount,
        description,
        occurredAt,
        actor: opts.actor,
        expenseId: expense._id as unknown as Types.ObjectId,
      });
      expense.cashMovementId = movement._id as unknown as Types.ObjectId;
      await expense.save();
    } catch (e) {
      // pas de dépense « caisse » sans sa sortie de caisse : on annule l'enregistrement incomplet
      await Expense.deleteOne({ _id: expense._id, cashMovementId: null });
      throw e;
    }
  }
  return expense;
}

/** Annuler une dépense erronée : si elle était payée avec la caisse, l'argent y revient (correction tracée). */
export async function cancelExpense(id: string, opts: { reason?: unknown; actor: Actor }) {
  if (!Types.ObjectId.isValid(id)) {
    throw createError('Depense introuvable', 404);
  }
  const reason = typeof opts.reason === 'string' ? opts.reason.trim() : '';
  if (reason.length < 3) {
    throw createError("Indiquez la raison de l'annulation", 400);
  }
  const expense = await Expense.findOneAndUpdate(
    { _id: id, status: 'active' },
    {
      $set: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: reason,
        cancelledBy: opts.actor.email,
      },
    },
    { new: true }
  );
  if (!expense) {
    const exists = await Expense.exists({ _id: id });
    throw createError(exists ? 'Depense deja annulee' : 'Depense introuvable', exists ? 409 : 404);
  }
  if (expense.cashMovementId) {
    const movement = await CashMovement.findById(expense.cashMovementId);
    if (movement && !movement.reversedBy) {
      await correctMovement(String(movement._id), {
        reason: `Depense annulee : ${reason}`,
        actor: opts.actor,
        fromExpense: true,
      });
    }
  }
  return expense;
}

export async function listExpenses(from: Date, to: Date) {
  const expenses = await Expense.find({ occurredAt: { $gte: from, $lt: to } }).sort({
    occurredAt: -1,
    createdAt: -1,
  });
  return { expenses, ...summarizeExpenses(expenses) };
}

export function summarizeExpenses(
  expenses: { amount: number; paymentMethod: string; status: string }[]
) {
  const active = expenses.filter((e) => e.status === 'active');
  const byMethod: Record<string, { total: number; count: number }> = {};
  for (const e of active) {
    const m = (byMethod[e.paymentMethod] = byMethod[e.paymentMethod] || { total: 0, count: 0 });
    m.total = round(m.total + e.amount);
    m.count += 1;
  }
  return {
    total: round(active.reduce((s, e) => s + e.amount, 0)),
    count: active.length,
    byMethod,
  };
}

/**
 * Dépenses d'une période pour les statistiques : dépenses enregistrées
 * + anciennes sorties de caisse "dépense" saisies avant le module Dépenses.
 */
export async function expenseTotals(from: Date, to: Date) {
  const expenses = await Expense.find({ occurredAt: { $gte: from, $lt: to } }).select(
    'amount paymentMethod status'
  );
  const summary = summarizeExpenses(expenses);
  const legacy = await CashMovement.find({
    type: 'expense',
    expenseId: { $exists: false },
    occurredAt: { $gte: from, $lt: to },
  }).select('amount reversalOf');
  const legacyTotal = round(legacy.reduce((s, m) => s + (m.reversalOf ? -m.amount : m.amount), 0));
  if (Math.abs(legacyTotal) > 0.0005) {
    const m = (summary.byMethod.cash_register = summary.byMethod.cash_register || {
      total: 0,
      count: 0,
    });
    m.total = round(m.total + legacyTotal);
    m.count += legacy.filter((x) => !x.reversalOf).length;
    summary.total = round(summary.total + legacyTotal);
    summary.count += legacy.filter((x) => !x.reversalOf).length;
  }
  return summary;
}
