import mongoose from 'mongoose';
import { Readable } from 'stream';

/**
 * Photos stockées DANS la base (GridFS, bucket « uploads ») et non sur le
 * disque du serveur : un hébergeur gratuit (Render) vide son disque à chaque
 * redémarrage, la base (Atlas) garde tout et se sauvegarde avec le reste.
 * URL publique : /api/files/<id>.
 */
const BUCKET = 'uploads';

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function bucket() {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Base de données non connectée');
  }
  return new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET });
}

export const fileUrl = (id: unknown) => `/api/files/${String(id)}`;

/** Enregistre une image ; renvoie son URL publique. */
export function saveFile(
  buffer: Buffer,
  filename: string,
  contentType: string,
  metadata: Record<string, unknown> = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const upload = bucket().openUploadStream(filename, {
      metadata: { ...metadata, contentType },
    });
    Readable.from(buffer)
      .pipe(upload)
      .on('error', reject)
      .on('finish', () => resolve(fileUrl(upload.id)));
  });
}

export async function findFile(id: string) {
  if (!mongoose.isValidObjectId(id)) {
    return null;
  }
  const [file] = await bucket()
    .find({ _id: new mongoose.Types.ObjectId(id) })
    .limit(1)
    .toArray();
  return file || null;
}

export const openFile = (id: string) =>
  bucket().openDownloadStream(new mongoose.Types.ObjectId(id));
