import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * Besoin d'achat lie a UNE commande et UN ingredient :
 * commande → ingredient → quantite necessaire → quantite disponible → manque → date du besoin.
 *
 * Calcule par purchaseNeedService (quantites issues de computeConsumption) ;
 * un seul document par couple (commande, ingredient) — jamais de doublon.
 *
 * Statuts :
 *  - open      : il manque encore missingQty
 *  - covered   : le stock couvre maintenant ce besoin (achat, stock corrige...)
 *  - fulfilled : la commande a ete preparee (stock deduit)
 *  - cancelled : commande annulee ou ingredient plus necessaire
 */
export type PurchaseNeedStatus = 'open' | 'covered' | 'fulfilled' | 'cancelled';

export interface IPurchaseNeed extends Document {
  orderId: Types.ObjectId;
  orderNumber?: number;
  clientName: string;
  ingredientId: Types.ObjectId;
  ingredientName: string;
  unit: string; // unite de stock de l'ingredient
  neededQty: number; // besoin total de la commande pour cet ingredient
  availableQty: number; // stock attribue a cette commande
  missingQty: number; // neededQty - availableQty (0 si couvert)
  maxMissingQty: number; // plus grand manque constate (pour "partiellement achete")
  neededBy: Date | null; // date prevue de la commande
  status: PurchaseNeedStatus;
  openedAt: Date;
  coveredAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const purchaseNeedSchema = new Schema<IPurchaseNeed>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    orderNumber: { type: Number },
    clientName: { type: String, default: '' },
    ingredientId: { type: Schema.Types.ObjectId, ref: 'Ingredient', required: true },
    ingredientName: { type: String, required: true },
    unit: { type: String, required: true },
    neededQty: { type: Number, required: true, min: 0 },
    availableQty: { type: Number, required: true, min: 0 },
    missingQty: { type: Number, required: true, min: 0 },
    maxMissingQty: { type: Number, default: 0, min: 0 },
    neededBy: { type: Date, default: null },
    status: {
      type: String,
      enum: ['open', 'covered', 'fulfilled', 'cancelled'],
      default: 'open',
    },
    openedAt: { type: Date, default: Date.now },
    coveredAt: { type: Date },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

purchaseNeedSchema.index({ orderId: 1, ingredientId: 1 }, { unique: true });
purchaseNeedSchema.index({ status: 1, neededBy: 1 });

export const PurchaseNeed = mongoose.model<IPurchaseNeed>('PurchaseNeed', purchaseNeedSchema);
