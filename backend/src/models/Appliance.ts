import mongoose, { Document, Schema } from 'mongoose';

export interface IAppliance extends Document {
  _id: string;
  name: string;
  powerConsumption: number; // en Watts
  unit: string;
  category: 'cooking' | 'mixing' | 'cooling' | 'other';
  isActive: boolean;
  description?: string;
  brand?: string;
  applianceModel?: string;
  createdAt: Date;
  updatedAt: Date;
}

const applianceSchema = new Schema<IAppliance>({
  name: {
    type: String,
    required: [true, 'Nom de l\'appareil requis'],
    trim: true,
    maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères'],
    unique: true
  },
  powerConsumption: {
    type: Number,
    required: [true, 'Consommation électrique requise'],
    min: [0, 'La consommation ne peut pas être négative']
  },
  unit: {
    type: String,
    required: [true, 'Unité requise'],
    enum: ['W', 'kW'],
    default: 'W'
  },
  category: {
    type: String,
    required: [true, 'Catégorie requise'],
    enum: ['cooking', 'mixing', 'cooling', 'other'],
    default: 'other'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'La description ne peut pas dépasser 500 caractères']
  },
  brand: {
    type: String,
    trim: true,
    maxlength: [50, 'La marque ne peut pas dépasser 50 caractères']
  },
  applianceModel: {
    type: String,
    trim: true,
    maxlength: [50, 'Le modèle ne peut pas dépasser 50 caractères']
  }
}, {
  timestamps: true
});

// Index pour les performances
applianceSchema.index({ name: 1 });
applianceSchema.index({ category: 1 });
applianceSchema.index({ isActive: 1 });

// Méthode pour calculer la consommation en kWh
applianceSchema.methods.calculateConsumption = function(hours: number): number {
  const powerInKw = this.unit === 'kW' ? this.powerConsumption : this.powerConsumption / 1000;
  return powerInKw * hours;
};

// Méthode pour calculer le coût électrique
applianceSchema.methods.calculateElectricityCost = function(hours: number, pricePerKwh: number = 0.15): number {
  const consumption = this.calculateConsumption(hours);
  return consumption * pricePerKwh;
};

export const Appliance = mongoose.model<IAppliance>('Appliance', applianceSchema);
