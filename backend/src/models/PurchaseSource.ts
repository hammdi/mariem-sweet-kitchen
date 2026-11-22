import mongoose, { Document, Schema } from 'mongoose';

/**
 * Endroit ou Rahma achete ses ingredients : fournisseur, grande surface
 * (Carrefour, MG...), magasin, kiosque...
 */
export type PurchaseSourceType = 'supplier' | 'supermarket' | 'store' | 'kiosk' | 'other';

export interface IPurchaseSource extends Document {
  _id: string;
  name: string;
  type: PurchaseSourceType;
  phone?: string;
  address?: string;
  city?: string; // ville / zone
  contact?: string;
  url?: string;
  openingHours?: string;
  delivers: boolean;
  notes?: string;
  // Position sur la carte (distance et coût du trajet depuis le domicile)
  location?: { lat: number; lng: number } | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const purchaseSourceSchema = new Schema<IPurchaseSource>(
  {
    name: {
      type: String,
      required: [true, 'Nom requis'],
      trim: true,
      maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères'],
    },
    type: {
      type: String,
      enum: ['supplier', 'supermarket', 'store', 'kiosk', 'other'],
      required: [true, 'Type requis'],
      default: 'other',
    },
    phone: { type: String, trim: true, maxlength: 30 },
    address: { type: String, trim: true, maxlength: 300 },
    city: { type: String, trim: true, maxlength: 100 },
    contact: { type: String, trim: true, maxlength: 100 },
    url: { type: String, trim: true, maxlength: 300 },
    openingHours: { type: String, trim: true, maxlength: 200 },
    delivers: { type: Boolean, default: false },
    notes: { type: String, trim: true, maxlength: 1000 },
    location: {
      type: new Schema(
        {
          lat: { type: Number, required: true, min: -90, max: 90 },
          lng: { type: Number, required: true, min: -180, max: 180 },
        },
        { _id: false }
      ),
      default: null,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

purchaseSourceSchema.index({ name: 1 });
purchaseSourceSchema.index({ isActive: 1, type: 1 });

export const PurchaseSource = mongoose.model<IPurchaseSource>(
  'PurchaseSource',
  purchaseSourceSchema
);
