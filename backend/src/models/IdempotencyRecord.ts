import mongoose, { Document, Schema } from 'mongoose';

/**
 * Clé d'idempotence d'une opération sensible (achat, caisse, paiement, stock...).
 *
 * Le navigateur génère une clé par opération (pas par clic) et l'envoie dans
 * l'en-tête "Idempotency-Key". L'index unique garantit qu'une même opération
 * n'est exécutée qu'une fois : un double clic ou une requête renvoyée reçoit
 * la réponse de la première exécution, sans rien enregistrer une 2e fois.
 */
export interface IIdempotencyRecord extends Document {
  key: string; // "<userId>:<clé du navigateur>"
  method: string;
  path: string;
  bodyHash: string;
  state: 'processing' | 'done';
  statusCode?: number;
  response?: unknown;
  createdAt: Date;
}

const idempotencyRecordSchema = new Schema<IIdempotencyRecord>(
  {
    key: { type: String, required: true },
    method: { type: String, required: true },
    path: { type: String, required: true },
    bodyHash: { type: String, required: true },
    state: { type: String, enum: ['processing', 'done'], default: 'processing' },
    statusCode: { type: Number },
    response: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

idempotencyRecordSchema.index({ key: 1 }, { unique: true });
// Les clés sont gardées 2 jours : largement assez pour un double clic ou un renvoi réseau
idempotencyRecordSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 24 * 3600 });

export const IdempotencyRecord = mongoose.model<IIdempotencyRecord>(
  'IdempotencyRecord',
  idempotencyRecordSchema
);
