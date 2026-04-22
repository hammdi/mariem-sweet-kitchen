import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads/recipes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `recipe-${uniqueSuffix}${ext}`);
  }
});

// File filter: only accept jpeg, png, webp
const fileFilter = (_req: express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
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
  }
});

// @desc    Upload recipe images (admin)
// @route   POST /api/upload
router.post(
  '/',
  authenticate,
  authorize('admin'),
  (req, res, next) => {
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
  asyncHandler(async (req, res) => {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw createError('Aucun fichier envoye', 400);
    }

    const urls = files.map((file) => `/uploads/recipes/${file.filename}`);

    logger.info(`${files.length} image(s) uploadee(s) par ${req.user!.email}`);

    res.status(201).json({
      success: true,
      data: { urls }
    });
  })
);

export default router;
