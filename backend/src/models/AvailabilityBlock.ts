import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * Creneau pendant lequel Mariem n'est PAS disponible (conges, journee pleine,
 * absence). Bloque la reservation d'une commande sur ce creneau cote public,
 * et sert de repere sur son calendrier admin.
 *
 * Design: un seul champ [startDate, endDate] permet de supporter aussi bien
 * des journees entieres (00:00 -> 23:59:59) que des creneaux horaires precis
 * si on decide de passer en granularite horaire plus tard.
 */
export interface IAvailabilityBlock extends Document {
  _id: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const availabilityBlockSchema = new Schema<IAvailabilityBlock>(
  {
    startDate: {
      type: Date,
      required: [true, 'Date de debut requise'],
    },
    endDate: {
      type: Date,
      required: [true, 'Date de fin requise'],
      validate: {
        validator: function (this: IAvailabilityBlock, v: Date) {
          return v >= this.startDate;
        },
        message: 'La date de fin doit etre posterieure ou egale a la date de debut',
      },
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [200, 'La raison ne peut pas depasser 200 caracteres'],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Recherche rapide par fenetre temporelle (pour le calendrier public)
availabilityBlockSchema.index({ startDate: 1, endDate: 1 });
availabilityBlockSchema.index({ endDate: 1 }); // pour filtrer les blocages passes

export const AvailabilityBlock = mongoose.model<IAvailabilityBlock>(
  'AvailabilityBlock',
  availabilityBlockSchema
);
