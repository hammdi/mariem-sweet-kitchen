import mongoose, { Document, Schema } from 'mongoose';

export interface IIngredient extends Document {
  _id: string;
  name: string;
  pricePerUnit: number;
  unit: string;
  category: 'base' | 'sweetener' | 'dairy' | 'flavoring' | 'leavening' | 'other';
  isActive: boolean;
  stockQuantity: number;
  minStock?: number; // seuil d'alerte (optionnel, meme unite que le stock)
  referencePriceHistory: { price: number; changedAt: Date; reason?: string }[];
  description?: string;
  supplier?: string;
  lastPriceUpdate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ingredientSchema = new Schema<IIngredient>(
  {
    name: {
      type: String,
      required: [true, "Nom de l'ingrédient requis"],
      trim: true,
      maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères'],
      unique: true,
    },
    pricePerUnit: {
      type: Number,
      required: [true, 'Prix par unité requis'],
      min: [0, 'Le prix ne peut pas être négatif'],
    },
    unit: {
      type: String,
      required: [true, 'Unité requise'],
      enum: ['kg', 'g', 'l', 'ml', 'piece', 'cuillere', 'tasse'],
      default: 'kg',
    },
    category: {
      type: String,
      required: [true, 'Catégorie requise'],
      enum: ['base', 'sweetener', 'dairy', 'flavoring', 'leavening', 'other'],
      default: 'other',
    },
    stockQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Le stock ne peut pas etre negatif'],
    },
    minStock: {
      type: Number,
      min: [0, 'Le seuil ne peut pas etre negatif'],
    },
    // Historique du prix de reference (pricePerUnit) : l'ancien prix n'est jamais perdu
    referencePriceHistory: {
      type: [
        {
          price: { type: Number, required: true },
          changedAt: { type: Date, default: Date.now },
          reason: { type: String, trim: true, maxlength: 100 },
          _id: false,
        },
      ],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'La description ne peut pas dépasser 500 caractères'],
    },
    supplier: {
      type: String,
      trim: true,
      maxlength: [100, 'Le nom du fournisseur ne peut pas dépasser 100 caractères'],
    },
    lastPriceUpdate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index pour les performances
ingredientSchema.index({ name: 1 });
ingredientSchema.index({ category: 1 });
ingredientSchema.index({ isActive: 1 });
ingredientSchema.index({ pricePerUnit: 1 });

// Middleware pour mettre à jour lastPriceUpdate
// + garder une trace du prix de reference precedent
ingredientSchema.pre('save', function (next) {
  if (this.isModified('pricePerUnit')) {
    this.lastPriceUpdate = new Date();
    this.referencePriceHistory.push({
      price: this.pricePerUnit,
      changedAt: new Date(),
      reason: (this as any).$locals?.priceChangeReason || (this.isNew ? 'creation' : 'manuel'),
    });
  }
  next();
});

// Méthode pour calculer le coût d'une quantité donnée
ingredientSchema.methods.calculateCost = function (quantity: number): number {
  return this.pricePerUnit * quantity;
};

export const Ingredient = mongoose.model<IIngredient>('Ingredient', ingredientSchema);
