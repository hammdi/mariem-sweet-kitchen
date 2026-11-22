/**
 * COPIE UNIQUE des données locales vers la base en ligne (MongoDB Atlas).
 *
 *   cd backend
 *   ATLAS_URI='mongodb+srv://…' npm run copy:atlas              # copie
 *   ATLAS_URI='mongodb+srv://…' npm run copy:atlas -- --dry-run # simple aperçu
 *
 * - Source : MONGODB_URI de backend/.env (ou FROM_URI). Elle n'est JAMAIS modifiée.
 * - Cible : ATLAS_URI. Refus si elle contient déjà des données (sauf --replace,
 *   qui vide d'abord la CIBLE uniquement).
 * - Les photos enregistrées sur le disque (/uploads/…) sont copiées dans la base
 *   cible (GridFS) et les adresses des recettes de la cible sont mises à jour.
 * - Les adresses de connexion ne sont jamais affichées.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

// Pilote MongoDB fourni par mongoose (pas de dépendance en plus)
const { MongoClient, GridFSBucket } = mongoose.mongo;
type Db = mongoose.mongo.Db;

const IMAGE_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

const mask = (uri: string) => uri.replace(/\/\/[^@/]*@/, '//***@').replace(/\?.*$/, '');

async function userCollections(db: Db) {
  return (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((n) => !n.startsWith('system.'));
}

export async function copyDatabase(opts: {
  fromUri: string;
  toUri: string;
  dryRun?: boolean;
  replace?: boolean;
  uploadsDir?: string;
  log?: (msg: string) => void;
}) {
  const log = opts.log || ((m: string) => console.log(m)); // eslint-disable-line no-console
  if (!opts.fromUri || !opts.toUri) {
    throw new Error('Source et cible obligatoires');
  }
  if (opts.fromUri === opts.toUri) {
    throw new Error('La source et la cible sont identiques');
  }

  const from = await MongoClient.connect(opts.fromUri);
  const to = await MongoClient.connect(opts.toUri);
  try {
    const src = from.db();
    const dst = to.db();
    if (src.databaseName === dst.databaseName && mask(opts.fromUri) === mask(opts.toUri)) {
      throw new Error('La source et la cible sont la même base');
    }
    log(`Source : ${mask(opts.fromUri)} (${src.databaseName}) — lecture seule`);
    log(`Cible  : ${mask(opts.toUri)} (${dst.databaseName})`);

    const existing = [];
    for (const name of await userCollections(dst)) {
      if ((await dst.collection(name).estimatedDocumentCount()) > 0) {
        existing.push(name);
      }
    }
    if (existing.length && !opts.replace) {
      throw new Error(
        `La cible contient déjà des données (${existing.join(', ')}). Rien n'a été copié. ` +
          'Relancez avec --replace pour la vider puis copier.'
      );
    }

    const names = await userCollections(src);
    const summary: Record<string, number> = {};
    for (const name of names) {
      summary[name] = await src.collection(name).countDocuments();
    }
    log(`Collections : ${names.map((n) => `${n} (${summary[n]})`).join(', ') || 'aucune'}`);

    const recipes = await src.collection('recipes').find({}).toArray();
    const diskImages = new Set(
      recipes.flatMap((r) => (r.images || []) as string[]).filter((u) => u.startsWith('/uploads/'))
    );
    log(`Photos sur le disque à copier : ${diskImages.size}`);

    if (opts.dryRun) {
      log('Aperçu seulement (--dry-run) : rien n’a été écrit.');
      return { summary, images: diskImages.size, copied: false };
    }

    if (existing.length && opts.replace) {
      for (const name of await userCollections(dst)) {
        await dst.collection(name).drop();
      }
      log('Cible vidée (--replace).');
    }

    for (const name of names) {
      const docs = src.collection(name).find({});
      let batch = [];
      for await (const doc of docs) {
        batch.push(doc);
        if (batch.length === 500) {
          await dst.collection(name).insertMany(batch, { ordered: false });
          batch = [];
        }
      }
      if (batch.length) {
        await dst.collection(name).insertMany(batch, { ordered: false });
      }
    }
    log('Données copiées.');

    // Photos du disque → base cible (GridFS), adresses des recettes mises à jour
    const bucket = new GridFSBucket(dst, { bucketName: 'uploads' });
    const moved = new Map<string, string>();
    const missing: string[] = [];
    for (const url of diskImages) {
      const file = path.join(opts.uploadsDir || UPLOADS_DIR, url.replace(/^\/uploads\//, ''));
      const type = IMAGE_TYPES[path.extname(file).toLowerCase()];
      if (!type || !fs.existsSync(file)) {
        missing.push(url);
        continue;
      }
      const id = await new Promise<unknown>((resolve, reject) => {
        const up = bucket.openUploadStream(path.basename(file), {
          metadata: { contentType: type, kind: 'recipe', migratedFrom: url },
        });
        fs.createReadStream(file)
          .pipe(up)
          .on('error', reject)
          .on('finish', () => resolve(up.id));
      });
      moved.set(url, `/api/files/${String(id)}`);
    }
    for (const r of recipes) {
      const images = (r.images || []) as string[];
      if (images.some((u) => moved.has(u))) {
        await dst
          .collection('recipes')
          .updateOne({ _id: r._id }, { $set: { images: images.map((u) => moved.get(u) || u) } });
      }
    }
    log(
      `Photos copiées dans la base : ${moved.size}${missing.length ? ` (introuvables : ${missing.length})` : ''}`
    );
    return { summary, images: moved.size, missing, copied: true };
  } finally {
    await from.close();
    await to.close();
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  copyDatabase({
    fromUri: process.env.FROM_URI || process.env.MONGODB_URI || '',
    toUri: process.env.ATLAS_URI || '',
    dryRun: args.includes('--dry-run'),
    replace: args.includes('--replace'),
  })
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(`❌ ${(e as Error).message}`); // eslint-disable-line no-console
      process.exit(1);
    });
}
