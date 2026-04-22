import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPriceBreakdown {
  ingredientsCost: number;
  electricityCost: number;
  waterCost: number;
  margin: number;
  total: number;
}

export interface IOrderItem {
  recipeId: Types.ObjectId;
  variantIndex: number;
  quantity: number;
  clientOfferedIngredients: Types.ObjectId[];   // ce que le client propose de ramener
  clientProvidedIngredients: Types.ObjectId[];  // ce que Mariem confirme
  calculatedPrice: IPriceBreakdown;
}

export interface IOrder extends Document {
  _id: string;
  clientName: string;
  clientPhone: string;
  items: IOrderItem[];
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'paid' | 'cancelled';
  ingredientsReady: boolean;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const priceBreakdownSchema = new Schema<IPriceBreakdown>({
  ingredientsCost: { type: Number, default: 0 },
  electricityCost: { type: Number, default: 0 },
  waterCost: { type: Number, default: 0 },
  margin: { type: Number, default: 0 },
  total: { type: Number, default: 0 }
}, { _id: false });

const orderItemSchema = new Schema<IOrderItem>({
  recipeId: {
    type: Schema.Types.ObjectId,
    ref: 'Recipe',
    required: [true, 'ID de la recette requis']
  },
  variantIndex: {
    type: Number,
    required: [true, 'Index du variant requis'],
    min: 0
  },
  quantity: {
    type: Number,
    required: [true, 'Quantité requise'],
    min: [1, 'La quantité doit être d\'au moins 1']
  },
  clientOfferedIngredients: [{
    type: Schema.Types.ObjectId,
    ref: 'Ingredient'
  }],
  clientProvidedIngredients: [{
    type: Schema.Types.ObjectId,
    ref: 'Ingredient'
  }],
  calculatedPrice: {
    type: priceBreakdownSchema,
    default: () => ({})
  }
}, { _id: false });

const orderSchema = new Schema<IOrder>({
  clientName: {
    type: String,
    required: [true, 'Nom du client requis'],
    trim: true,
    maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères']
  },
  clientPhone: {
    type: String,
    required: [true, 'Téléphone du client requis'],
    trim: true
  },
  items: {
    type: [orderItemSchema],
    validate: {
      validator: (v: IOrderItem[]) => v.length > 0,
      message: 'Au moins un article est requis'
    }
  },
  totalPrice: {
    type: Number,
    default: 0,
    min: [0, 'Le prix ne peut pas être négatif']
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'paid', 'cancelled'],
    default: 'pending'
  },
  ingredientsReady: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Les notes ne peuvent pas dépasser 500 caractères'],
    default: ''
  }
}, {
  timestamps: true
});

// Index
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ clientPhone: 1 });

// Recalculer totalPrice quand items changent.
// Arrondi au millime près (3 décimales) pour éviter les dérives flottantes sur la somme.
orderSchema.pre('save', function(next) {
  if (this.isModified('items')) {
    const raw = this.items.reduce((sum, item) => {
      return sum + (item.calculatedPrice?.total || 0) * item.quantity;
    }, 0);
    this.totalPrice = Math.round(raw * 1000) / 1000;
  }
  next();
});

export const Order = mongoose.model<IOrder>('Order', orderSchema);
