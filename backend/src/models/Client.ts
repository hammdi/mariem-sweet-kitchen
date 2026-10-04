import mongoose, { Document, Schema } from 'mongoose';

export type ClientType = 'individual' | 'cafe';

export interface IClient extends Document {
  _id: string;
  type: ClientType;
  name: string; // nom du particulier ou nom du cafe
  phone: string; // normalise (+216XXXXXXXX)
  address?: string;
  contactPerson?: string; // cafe uniquement
  conditions?: string; // cafe uniquement (conditions particulieres)
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const clientSchema = new Schema<IClient>(
  {
    type: {
      type: String,
      enum: ['individual', 'cafe'],
      required: [true, 'Type de client requis'],
      default: 'individual',
    },
    name: {
      type: String,
      required: [true, 'Nom requis'],
      trim: true,
      maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères'],
    },
    phone: {
      type: String,
      required: [true, 'Téléphone requis'],
      trim: true,
    },
    address: { type: String, trim: true, maxlength: 300 },
    contactPerson: { type: String, trim: true, maxlength: 100 },
    conditions: { type: String, trim: true, maxlength: 1000 },
    notes: { type: String, trim: true, maxlength: 1000 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

clientSchema.index({ phone: 1 });
clientSchema.index({ name: 1 });
clientSchema.index({ type: 1, isActive: 1 });

export const Client = mongoose.model<IClient>('Client', clientSchema);
