import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * Prix observe d'un ingredient chez une source d'achat.
 * Un seul document par couple (ingredient, source) ; chaque changement de prix
 * est ajoute a `history` — l'ancien prix n'est jamais efface.
 */
export interface IPriceHistoryEntry {
  price: number;
  unit: string;
  checkedAt: Date; // date a laquelle Rahma a constate ce prix
  note?: string;
  recordedAt: Date; // date de saisie dans l'application
}

export interface IIngredientPrice extends Document {
  _id: string;
  ingredientId: Types.ObjectId;
  sourceId: Types.ObjectId;
  price: number; // prix actuel (= derniere entree de history)
  unit: string; // unite du prix (DT par `unit`)
  lastCheckedAt: Date;
  notes?: string;
  isActive: boolean;
  history: IPriceHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const UNITS = ['kg', 'g', 'l', 'ml', 'piece', 'cuillere', 'tasse'];

const historyEntrySchema = new Schema<IPriceHistoryEntry>(
  {
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, enum: UNITS },
    checkedAt: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 300 },
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ingredientPriceSchema = new Schema<IIngredientPrice>(
  {
    ingredientId: {
      type: Schema.Types.ObjectId,
      ref: 'Ingredient',
      required: [true, 'Ingrédient requis'],
    },
    sourceId: {
      type: Schema.Types.ObjectId,
      ref: 'PurchaseSource',
      required: [true, "Source d'achat requise"],
    },
    price: {
      type: Number,
      required: [true, 'Prix requis'],
      min: [0, 'Le prix ne peut pas être négatif'],
    },
    unit: { type: String, required: true, enum: UNITS },
    lastCheckedAt: { type: Date, default: Date.now },
    notes: { type: String, trim: true, maxlength: 500 },
    isActive: { type: Boolean, default: true },
    history: { type: [historyEntrySchema], default: [] },
  },
  { timestamps: true }
);

ingredientPriceSchema.index({ ingredientId: 1, sourceId: 1 }, { unique: true });
ingredientPriceSchema.index({ sourceId: 1 });

export const IngredientPrice = mongoose.model<IIngredientPrice>(
  'IngredientPrice',
  ingredientPriceSchema
);
