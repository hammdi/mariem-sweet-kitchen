import mongoose, { Document, Schema, Types } from 'mongoose';
import { nextSequence } from './Counter';

export interface IPriceBreakdown {
  ingredientsCost: number;
  electricityCost: number;
  waterCost: number;
  margin: number;
  total: number;
}

// Valeurs figees a la creation : un changement de prix d'ingredient ne modifie
// jamais le prix d'une commande existante.
export interface IOrderPriceSnapshot {
  ingredients: { ingredientId: Types.ObjectId | string; name: string; fullCost: number }[];
  electricityCost: number;
  waterCost: number;
  marginPercent: number;
  capturedAt: Date;
}

export interface IOrderItem {
  recipeId: Types.ObjectId;
  variantIndex: number;
  quantity: number;
  clientOfferedIngredients: Types.ObjectId[]; // ce que le client propose de ramener
  clientProvidedIngredients: Types.ObjectId[]; // ce que Mariem confirme
  calculatedPrice: IPriceBreakdown;
  priceSnapshot?: IOrderPriceSnapshot;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'paid'
  | 'cancelled';
export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'delivered',
  'paid',
  'cancelled',
];

export interface IStatusChange {
  from: string;
  to: string;
  at: Date;
  by: string;
  reason?: string;
}

export interface IOrder extends Document {
  _id: string;
  orderNumber?: number; // numero lisible (CMD-12), absent sur les anciennes commandes
  clientId: Types.ObjectId | null; // fiche client (optionnelle pour les anciennes commandes)
  clientName: string;
  clientPhone: string;
  items: IOrderItem[];
  totalPrice: number;
  // Avancement réel de la commande. Le paiement est suivi À PART (paymentStatus).
  // "paid" : ancien statut (avant la séparation paiement / préparation), gardé
  // pour lire les anciennes commandes ; il se comporte comme "confirmed".
  status: OrderStatus;
  ingredientsReady: boolean;
  deliveredAt: Date | null;
  // Annulation : raison obligatoire dès que la préparation a commencé
  cancellationReason: string;
  cancelledAt: Date | null;
  cancelledBy: string;
  cancelledAfterPreparation: boolean;
  statusHistory: IStatusChange[];
  stockDeducted: boolean; // le stock de cette commande a ete deduit (une seule fois)
  // Paiement : copie calculee depuis la caisse (CashMovement), jamais saisie a la main
  amountPaid: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  paymentMethod: string | null;
  paidAt: Date | null;
  stockDeductedAt: Date | null;
  requestedDate: Date | null;
  confirmedDate: Date | null;
  additionalFees: { label: string; amount: number }[];
  source: 'website' | 'manual'; // d'où vient la commande
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const priceBreakdownSchema = new Schema<IPriceBreakdown>(
  {
    ingredientsCost: { type: Number, default: 0 },
    electricityCost: { type: Number, default: 0 },
    waterCost: { type: Number, default: 0 },
    margin: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false }
);

const priceSnapshotSchema = new Schema<IOrderPriceSnapshot>(
  {
    ingredients: [
      {
        ingredientId: { type: Schema.Types.ObjectId, ref: 'Ingredient' },
        name: String,
        fullCost: Number,
        _id: false,
      },
    ],
    electricityCost: Number,
    waterCost: Number,
    marginPercent: Number,
    capturedAt: Date,
  },
  { _id: false }
);

const orderItemSchema = new Schema<IOrderItem>(
  {
    recipeId: {
      type: Schema.Types.ObjectId,
      ref: 'Recipe',
      required: [true, 'ID de la recette requis'],
    },
    variantIndex: {
      type: Number,
      required: [true, 'Index du variant requis'],
      min: 0,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantité requise'],
      min: [1, "La quantité doit être d'au moins 1"],
    },
    clientOfferedIngredients: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Ingredient',
      },
    ],
    clientProvidedIngredients: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Ingredient',
      },
    ],
    calculatedPrice: {
      type: priceBreakdownSchema,
      default: () => ({}),
    },
    priceSnapshot: {
      type: priceSnapshotSchema,
      default: undefined,
    },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: Number,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
    },
    clientName: {
      type: String,
      required: [true, 'Nom du client requis'],
      trim: true,
      maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères'],
    },
    clientPhone: {
      type: String,
      required: [true, 'Téléphone du client requis'],
      trim: true,
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (v: IOrderItem[]) => v.length > 0,
        message: 'Au moins un article est requis',
      },
    },
    totalPrice: {
      type: Number,
      default: 0,
      min: [0, 'Le prix ne peut pas être négatif'],
    },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: 'pending',
    },
    ingredientsReady: {
      type: Boolean,
      default: false,
    },
    deliveredAt: { type: Date, default: null },
    cancellationReason: { type: String, trim: true, maxlength: 300, default: '' },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: String, default: '' },
    cancelledAfterPreparation: { type: Boolean, default: false },
    statusHistory: [
      {
        from: String,
        to: String,
        at: Date,
        by: String,
        reason: String,
        _id: false,
      },
    ],
    stockDeducted: {
      type: Boolean,
      default: false,
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
      default: 'unpaid',
    },
    paymentMethod: {
      type: String,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    stockDeductedAt: {
      type: Date,
      default: null,
    },
    requestedDate: {
      type: Date,
      default: null,
    },
    confirmedDate: {
      type: Date,
      default: null,
    },
    additionalFees: [
      {
        label: { type: String, required: true, trim: true },
        amount: { type: Number, required: true, min: 0 },
      },
    ],
    source: {
      type: String,
      enum: ['website', 'manual'],
      default: 'website',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Les notes ne peuvent pas dépasser 500 caractères'],
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Index
orderSchema.index({ orderNumber: 1 }, { unique: true, sparse: true });
orderSchema.index({ status: 1 });

// Numero de commande sequentiel attribue a la creation
orderSchema.pre('save', async function () {
  if (this.isNew && this.orderNumber === undefined) {
    this.orderNumber = await nextSequence('order');
  }
});
orderSchema.index({ createdAt: -1 });
orderSchema.index({ clientPhone: 1 });
orderSchema.index({ clientId: 1, createdAt: -1 });

// Recalculer totalPrice quand items changent.
// Arrondi au millime près (3 décimales) pour éviter les dérives flottantes sur la somme.
orderSchema.pre('save', function (next) {
  if (this.isModified('items') || this.isModified('additionalFees')) {
    const itemsTotal = this.items.reduce((sum, item) => {
      return sum + (item.calculatedPrice?.total || 0) * item.quantity;
    }, 0);
    const feesTotal = (this.additionalFees || []).reduce((sum, fee) => sum + (fee.amount || 0), 0);
    this.totalPrice = Math.round((itemsTotal + feesTotal) * 1000) / 1000;
  }
  next();
});

export const Order = mongoose.model<IOrder>('Order', orderSchema);
