import mongoose, { Document, Schema, Types } from 'mongoose';

/** Avec quel argent un achat de stock a ete paye. Seul "cash_register" touche la caisse. */
export type PurchasePaymentMethod = 'cash_register' | 'personal' | 'bank' | 'other';
export const PURCHASE_PAYMENT_METHODS: PurchasePaymentMethod[] = [
  'cash_register',
  'personal',
  'bank',
  'other',
];

/** Raison d'une correction manuelle du stock (obligatoire). */
export type StockAdjustmentReason =
  | 'inventory'
  | 'entry_error'
  | 'loss'
  | 'breakage'
  | 'correction'
  | 'other';
export const STOCK_ADJUSTMENT_REASONS: StockAdjustmentReason[] = [
  'inventory',
  'entry_error',
  'loss',
  'breakage',
  'correction',
  'other',
];

export interface IStockHistory extends Document {
  ingredientId: Types.ObjectId;
  ingredientName: string;
  quantity: number; // positif ; pour "adjustment" : ecart signe (apres − avant)
  unit: string;
  orderId: Types.ObjectId;
  clientName: string;
  recipeName: string;
  // deduction = consommee par une commande ; restock = achat ; restore = remise en stock d'une
  // deduction ; adjustment = correction manuelle du stock (inventaire)
  type: 'deduction' | 'restock' | 'restore' | 'adjustment';
  // Achat reel (restock) : prix reellement paye, distinct du prix de reference
  unitPrice?: number;
  totalPrice?: number;
  sourceId?: Types.ObjectId;
  sourceName?: string;
  purchasedAt?: Date;
  purchaseId?: Types.ObjectId; // lignes d'un meme achat (liste de courses : plusieurs ingredients)
  paymentMethod?: PurchasePaymentMethod;
  cashMovementId?: Types.ObjectId | null; // sortie de caisse, seulement si paye avec la caisse
  unblockedOrders: {
    orderId: Types.ObjectId;
    orderNumber?: number;
    clientName: string;
    fully: boolean;
  }[];
  // Correction manuelle : valeur avant / apres, raison, auteur
  stockBefore?: number;
  stockAfter?: number;
  note?: string;
  reason?: StockAdjustmentReason; // correction manuelle : pourquoi
  createdBy?: string;
  createdAt: Date;
}

const stockHistorySchema = new Schema<IStockHistory>(
  {
    ingredientId: { type: Schema.Types.ObjectId, ref: 'Ingredient', required: true },
    ingredientName: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    clientName: { type: String, default: '' },
    recipeName: { type: String, default: '' },
    type: {
      type: String,
      enum: ['deduction', 'restock', 'restore', 'adjustment'],
      default: 'deduction',
    },
    unitPrice: { type: Number, min: 0 },
    totalPrice: { type: Number, min: 0 },
    sourceId: { type: Schema.Types.ObjectId, ref: 'PurchaseSource' },
    sourceName: { type: String, default: '' },
    purchasedAt: { type: Date },
    purchaseId: { type: Schema.Types.ObjectId },
    paymentMethod: { type: String, enum: PURCHASE_PAYMENT_METHODS },
    cashMovementId: { type: Schema.Types.ObjectId, ref: 'CashMovement', default: null },
    unblockedOrders: [
      {
        orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
        orderNumber: Number,
        clientName: String,
        fully: Boolean,
        _id: false,
      },
    ],
    stockBefore: { type: Number },
    stockAfter: { type: Number },
    note: { type: String, trim: true, maxlength: 300 },
    reason: { type: String, enum: STOCK_ADJUSTMENT_REASONS },
    createdBy: { type: String },
  },
  { timestamps: true }
);

stockHistorySchema.index({ createdAt: -1 });
stockHistorySchema.index({ ingredientId: 1 });
stockHistorySchema.index({ orderId: 1 });
stockHistorySchema.index({ purchaseId: 1 });

export const StockHistory = mongoose.model<IStockHistory>('StockHistory', stockHistorySchema);
