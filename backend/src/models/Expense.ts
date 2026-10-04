import mongoose, { Document, Schema, Types } from 'mongoose';
import { PURCHASE_PAYMENT_METHODS, PurchasePaymentMethod } from './StockHistory';

/**
 * DÉPENSE = argent dépensé pour l'activité, HORS achat d'ingrédients
 * (emballages, gaz, transport, petit matériel...).
 *
 *  - payée avec la caisse → une sortie de caisse liée (CashMovement "expense") ;
 *  - argent personnel / banque / autre → aucune sortie de caisse, mais la
 *    dépense compte dans les statistiques.
 * Un achat de stock n'est jamais une dépense (il fait monter le stock).
 * Rien n'est supprimé : une dépense erronée est annulée (trace conservée).
 */
export interface IExpense extends Document {
  amount: number;
  description: string;
  occurredAt: Date;
  paymentMethod: PurchasePaymentMethod;
  cashMovementId: Types.ObjectId | null;
  status: 'active' | 'cancelled';
  cancelledAt: Date | null;
  cancelReason: string;
  cancelledBy: string;
  createdBy: { userId?: Types.ObjectId; email: string };
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<IExpense>(
  {
    amount: { type: Number, required: true, min: [0.001, 'Montant invalide'] },
    description: {
      type: String,
      required: [true, 'Description requise'],
      trim: true,
      maxlength: 300,
    },
    occurredAt: { type: Date, default: Date.now },
    paymentMethod: { type: String, enum: PURCHASE_PAYMENT_METHODS, required: true },
    cashMovementId: { type: Schema.Types.ObjectId, ref: 'CashMovement', default: null },
    status: { type: String, enum: ['active', 'cancelled'], default: 'active' },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, trim: true, maxlength: 300, default: '' },
    cancelledBy: { type: String, default: '' },
    createdBy: {
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      email: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

expenseSchema.index({ occurredAt: -1 });
expenseSchema.index({ status: 1, occurredAt: -1 });

export const Expense = mongoose.model<IExpense>('Expense', expenseSchema);
