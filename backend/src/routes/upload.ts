import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { IMAGE_TYPES, saveFile } from '../services/fileStorage';

const router = express.Router();

/** Signature binaire d'une image JPEG, PNG ou WebP. */
export function looksLikeImage(b: Buffer): boolean {
  if (b.length < 12) {
    return false;
  }
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp =
    b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP';
  return jpeg || png || webp;
}

// Photos gardées en mémoire le temps de l'envoi, puis enregistrées dans la base
const storage = multer.memoryStorage();

// File filter: only accept jpeg, png, webp
const fileFilter = (
  _req: express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorise. Seuls JPEG, PNG et WebP sont acceptes.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// @desc    Upload recipe images (admin)
// @route   POST /api/upload
router.post(
  '/',
  authenticate,
  authorize('admin'),
  (req: Request, res: Response, next: NextFunction) => {
    upload.array('images', 10)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(createError('Fichier trop volumineux. Maximum 5 Mo.', 400));
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(createError('Trop de fichiers. Maximum 10 fichiers.', 400));
        }
        return next(createError(err.message, 400));
      }
      if (err) {
        return next(createError(err.message, 400));
      }
      next();
    });
  },
  asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw createError('Aucun fichier envoye', 400);
    }

    // Contenu vérifié (pas seulement le type annoncé par le navigateur)
    if (files.some((f) => !looksLikeImage(f.buffer))) {
      throw createError('Fichier non reconnu comme une image JPEG, PNG ou WebP', 400);
    }

    const urls: string[] = [];
    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      urls.push(
        await saveFile(file.buffer, `recipe-${Date.now()}${ext}`, file.mimetype, {
          uploadedBy: req.user!.email,
          kind: 'recipe',
        })
      );
    }

    logger.info(`${files.length} image(s) uploadee(s) par ${req.user!.email}`);

    res.status(201).json({
      success: true,
      data: { urls },
    });
  })
);

export default router;
