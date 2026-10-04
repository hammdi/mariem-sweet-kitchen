import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * Mouvement de CAISSE = argent reellement entre ou sorti.
 *
 * Ne jamais modifier ni supprimer un mouvement : une correction cree un
 * mouvement inverse (reversalOf) et, si besoin, un mouvement de remplacement
 * (replacementOf). Le solde reste ainsi explicable ligne par ligne.
 */
export type CashMovementType =
  | 'order_payment' // paiement d'une commande (entree)
  | 'order_refund' // remboursement d'une commande (sortie)
  | 'other_income' // autre entree
  | 'purchase' // achat d'ingredients (sortie)
  | 'expense' // depense payee avec la caisse (sortie, liee a une Expense)
  | 'opening_balance'; // fonds de caisse de depart (entree)

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'check' | 'other';

export interface ICashMovement extends Document {
  type: CashMovementType;
  direction: 'in' | 'out';
  amount: number; // toujours positif ; le sens est donne par direction
  method: PaymentMethod;
  description: string;
  occurredAt: Date;
  orderId?: Types.ObjectId;
  orderNumber?: number;
  stockHistoryIds: Types.ObjectId[]; // achats (StockHistory "restock") payes par ce mouvement
  sourceId?: Types.ObjectId;
  sourceName?: string;
  // Achat de stock : ce qui est entre en stock et les commandes que cet achat debloque
  stockItems: { ingredientId: Types.ObjectId; name: string; quantity: number; unit: string }[];
  unblockedOrders: {
    orderId: Types.ObjectId;
    orderNumber?: number;
    clientName: string;
    fully: boolean;
  }[];
  createdBy: { userId?: Types.ObjectId; email: string };
  reversalOf?: Types.ObjectId; // ce mouvement annule celui-ci
  reversedBy?: Types.ObjectId; // ce mouvement a ete annule par celui-la
  replacementOf?: Types.ObjectId; // valeur corrigee d'un mouvement annule
  correctionReason?: string;
  expenseId?: Types.ObjectId; // dépense payée avec la caisse
  idempotencyKey?: string; // evite les doubles enregistrements (double clic, statut repete)
  createdAt: Date;
  updatedAt: Date;
}

const cashMovementSchema = new Schema<ICashMovement>(
  {
    type: {
      type: String,
      enum: [
        'order_payment',
        'order_refund',
        'other_income',
        'purchase',
        'expense',
        'opening_balance',
      ],
      required: true,
    },
    direction: { type: String, enum: ['in', 'out'], required: true },
    amount: { type: Number, required: true, min: [0.001, 'Montant invalide'] },
    method: {
      type: String,
      enum: ['cash', 'card', 'transfer', 'check', 'other'],
      default: 'cash',
    },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    occurredAt: { type: Date, default: Date.now },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    orderNumber: { type: Number },
    stockHistoryIds: [{ type: Schema.Types.ObjectId, ref: 'StockHistory' }],
    sourceId: { type: Schema.Types.ObjectId, ref: 'PurchaseSource' },
    sourceName: { type: String },
    stockItems: [
      {
        ingredientId: { type: Schema.Types.ObjectId, ref: 'Ingredient' },
        name: String,
        quantity: Number,
        unit: String,
        _id: false,
      },
    ],
    unblockedOrders: [
      {
        orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
        orderNumber: Number,
        clientName: String,
        fully: Boolean,
        _id: false,
      },
    ],
    createdBy: {
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      email: { type: String, default: '' },
    },
    reversalOf: { type: Schema.Types.ObjectId, ref: 'CashMovement' },
    reversedBy: { type: Schema.Types.ObjectId, ref: 'CashMovement' },
    replacementOf: { type: Schema.Types.ObjectId, ref: 'CashMovement' },
    correctionReason: { type: String, trim: true, maxlength: 300 },
    expenseId: { type: Schema.Types.ObjectId, ref: 'Expense' },
    idempotencyKey: { type: String },
  },
  { timestamps: true }
);

cashMovementSchema.index({ occurredAt: -1 });
cashMovementSchema.index({ orderId: 1 });
cashMovementSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export const CashMovement = mongoose.model<ICashMovement>('CashMovement', cashMovementSchema);
