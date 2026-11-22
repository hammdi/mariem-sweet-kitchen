import mongoose, { Document, Schema } from 'mongoose';

export const INGREDIENT_KINDS = ['ingredient', 'packaging'] as const;
export type IngredientKind = (typeof INGREDIENT_KINDS)[number];
export const PACKAGING_TYPES = [
  'box',
  'bag',
  'case',
  'tray',
  'paper',
  'ribbon',
  'label',
  'other',
] as const;
export type PackagingType = (typeof PACKAGING_TYPES)[number];
export const PACKAGING_USES = ['per_item', 'per_portion'] as const;
export type PackagingUse = (typeof PACKAGING_USES)[number];

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
  // 'sources' : prix = moyenne des prix des sources d'achat (calculé) ; 'manual' : saisi (aucune source)
  priceBasis: 'sources' | 'manual';
  // 'packaging' : boîte, sachet, caissette… (géré comme un ingrédient : sources,
  // prix moyen, stock, achats) mais choisi dans la COMMANDE, jamais dans une recette.
  kind: IngredientKind;
  packagingType?: PackagingType;
  // quantité proposée dans une commande : 1 par article, ou 1 par portion
  packagingUse?: PackagingUse;
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
    priceBasis: {
      type: String,
      enum: ['sources', 'manual'],
      default: 'manual',
    },
    kind: {
      type: String,
      enum: INGREDIENT_KINDS,
      default: 'ingredient',
      index: true,
    },
    packagingType: {
      type: String,
      enum: PACKAGING_TYPES,
    },
    packagingUse: {
      type: String,
      enum: PACKAGING_USES,
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
