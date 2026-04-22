import mongoose, { Document, Schema } from 'mongoose';

export interface ISetting extends Document {
  key: string;
  value: number;
  label: string;
  updatedAt: Date;
}

const settingSchema = new Schema<ISetting>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      enum: ['stegTariff', 'waterForfaitSmall', 'waterForfaitLarge', 'marginPercent'],
    },
    value: {
      type: Number,
      required: true,
    },
    label: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Helper pour récupérer tous les paramètres en un objet
settingSchema.statics.getAll = async function () {
  const settings = await this.find();
  const result: Record<string, number> = {};
  settings.forEach((s: ISetting) => {
    result[s.key] = s.value;
  });
  return result;
};

export const Settings = mongoose.model<ISetting>('Settings', settingSchema);
