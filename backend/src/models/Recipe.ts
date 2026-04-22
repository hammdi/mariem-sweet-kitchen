import mongoose, { Document, Schema, Types } from 'mongoose';

// Ingrédient dans un variant (avec quantité spécifique à cette taille)
export interface IVariantIngredient {
  ingredientId: Types.ObjectId;
  quantity: number;
  unit: string;
}

// Machine dans un variant (avec durée spécifique à cette taille)
export interface IVariantAppliance {
  applianceId: Types.ObjectId;
  duration: number; // en minutes
}

// Un variant = une taille avec ses propres quantités
export interface IRecipeVariant {
  sizeName: string;       // "Petit", "Moyen", "Grand", "2 étages", "12 pièces"
  portions: number;
  ingredients: IVariantIngredient[];
  appliances: IVariantAppliance[];
}

export interface IRecipe extends Document {
  _id: string;
  name: string;
  description: string;
  images: string[];
  categories: string[];
  isActive: boolean;
  variants: IRecipeVariant[];
  createdAt: Date;
  updatedAt: Date;
}

const variantIngredientSchema = new Schema<IVariantIngredient>({
  ingredientId: {
    type: Schema.Types.ObjectId,
    ref: 'Ingredient',
    required: [true, 'ID de l\'ingrédient requis']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantité requise'],
    min: [0, 'La quantité ne peut pas être négative']
  },
  unit: {
    type: String,
    required: [true, 'Unité requise'],
    enum: ['kg', 'g', 'l', 'ml', 'piece', 'cuillere', 'tasse']
  }
}, { _id: false });

const variantApplianceSchema = new Schema<IVariantAppliance>({
  applianceId: {
    type: Schema.Types.ObjectId,
    ref: 'Appliance',
    required: [true, 'ID de l\'appareil requis']
  },
  duration: {
    type: Number,
    required: [true, 'Durée d\'utilisation requise'],
    min: [1, 'La durée doit être d\'au moins 1 minute']
  }
}, { _id: false });

const recipeVariantSchema = new Schema<IRecipeVariant>({
  sizeName: {
    type: String,
    required: [true, 'Nom de la taille requis'],
    trim: true
  },
  portions: {
    type: Number,
    required: [true, 'Nombre de portions requis'],
    min: [1, 'Au moins 1 portion']
  },
  ingredients: [variantIngredientSchema],
  appliances: [variantApplianceSchema]
}, { _id: false });

const recipeSchema = new Schema<IRecipe>({
  name: {
    type: String,
    required: [true, 'Nom de la recette requis'],
    trim: true,
    maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères']
  },
  description: {
    type: String,
    required: [true, 'Description requise'],
    trim: true,
    maxlength: [1000, 'La description ne peut pas dépasser 1000 caractères']
  },
  images: [{
    type: String,
    trim: true
  }],
  categories: [{
    type: String,
    trim: true,
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  variants: {
    type: [recipeVariantSchema],
    validate: {
      validator: (v: IRecipeVariant[]) => v.length > 0,
      message: 'Au moins une taille (variant) est requise'
    }
  }
}, {
  timestamps: true
});

// Index
recipeSchema.index({ name: 'text', description: 'text' });
recipeSchema.index({ categories: 1 });
recipeSchema.index({ isActive: 1 });
recipeSchema.index({ createdAt: -1 });

export const Recipe = mongoose.model<IRecipe>('Recipe', recipeSchema);
