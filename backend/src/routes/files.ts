import express, { Request, Response } from 'express';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { findFile, IMAGE_TYPES, openFile } from '../services/fileStorage';

/**
 * Photos des recettes (publiques : elles servent au catalogue client).
 * Seules les images enregistrées par l'atelier sont servies.
 */
const router = express.Router();

// @route   GET /api/files/:id
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const file = await findFile(req.params.id);
    const type = file?.metadata?.contentType as string | undefined;
    if (!file || !type || !IMAGE_TYPES.includes(type)) {
      throw createError('Fichier introuvable', 404);
    }
    res.set({
      'Content-Type': type,
      'Content-Length': String(file.length),
      // une photo ne change jamais (nouvelle photo = nouvel identifiant)
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff',
    });
    openFile(req.params.id)
      .on('error', () => res.destroy())
      .pipe(res);
  })
);

export default router;
