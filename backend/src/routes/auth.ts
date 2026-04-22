import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { createError } from '../middleware/errorHandler';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// @desc    Inscription d'un nouvel utilisateur
// @route   POST /api/auth/register
// @access  Public
router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, firstName, lastName, phone } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw createError('Un utilisateur avec cet email existe déjà', 400);
    }

    // Créer le nouvel utilisateur
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      phone,
    });

    await user.save();

    // Générer le token JWT
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    } as jwt.SignOptions);

    logger.info(`✅ Nouvel utilisateur inscrit: ${email}`);

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: {
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          role: user.role,
        },
        token,
      },
    });
  })
);

// @desc    Connexion d'un utilisateur
// @route   POST /api/auth/login
// @access  Public
router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    // Vérifier si l'utilisateur existe
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw createError('Email ou mot de passe incorrect', 401);
    }

    // Vérifier si le compte est actif
    if (!user.isActive) {
      throw createError('Compte désactivé', 401);
    }

    // Vérifier le mot de passe
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw createError('Email ou mot de passe incorrect', 401);
    }

    // Mettre à jour la dernière connexion
    user.lastLogin = new Date();
    await user.save();

    // Générer le token JWT
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    } as jwt.SignOptions);

    logger.info(`✅ Utilisateur connecté: ${email}`);

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          role: user.role,
          lastLogin: user.lastLogin,
        },
        token,
      },
    });
  })
);

// @desc    Obtenir le profil de l'utilisateur connecté
// @route   GET /api/auth/me
// @access  Private
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        user: req.user,
      },
    });
  })
);

// @desc    Mettre à jour le profil de l'utilisateur
// @route   PUT /api/auth/profile
// @access  Private
router.put(
  '/profile',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { firstName, lastName, phone } = req.body;
    const userId = req.user!._id;

    const user = await User.findByIdAndUpdate(
      userId,
      { firstName, lastName, phone },
      { new: true, runValidators: true }
    );

    if (!user) {
      throw createError('Utilisateur non trouvé', 404);
    }

    logger.info(`✅ Profil mis à jour: ${user.email}`);

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      data: {
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          role: user.role,
        },
      },
    });
  })
);

// @desc    Changer le mot de passe
// @route   PUT /api/auth/password
// @access  Private
router.put(
  '/password',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!._id;

    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw createError('Utilisateur non trouvé', 404);
    }

    // Vérifier le mot de passe actuel
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw createError('Mot de passe actuel incorrect', 400);
    }

    // Mettre à jour le mot de passe
    user.password = newPassword;
    await user.save();

    logger.info(`✅ Mot de passe changé: ${user.email}`);

    res.json({
      success: true,
      message: 'Mot de passe changé avec succès',
    });
  })
);

export default router;
