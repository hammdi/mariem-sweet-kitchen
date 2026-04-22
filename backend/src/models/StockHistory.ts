import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IStockHistory extends Document {
  ingredientId: Types.ObjectId;
  ingredientName: string;
  quantity: number;
  unit: string;
  orderId: Types.ObjectId;
  clientName: string;
  recipeName: string;
  type: 'deduction' | 'restock';
  createdAt: Date;
}

const stockHistorySchema = new Schema<IStockHistory>({
  ingredientId: { type: Schema.Types.ObjectId, ref: 'Ingredient', required: true },
  ingredientName: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true },
  orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
  clientName: { type: String, default: '' },
  recipeName: { type: String, default: '' },
  type: { type: String, enum: ['deduction', 'restock'], default: 'deduction' },
}, { timestamps: true });

stockHistorySchema.index({ createdAt: -1 });
stockHistorySchema.index({ ingredientId: 1 });
stockHistorySchema.index({ orderId: 1 });

export const StockHistory = mongoose.model<IStockHistory>('StockHistory', stockHistorySchema);
