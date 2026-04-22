import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { createError } from './errorHandler';
import { logger } from '../utils/logger';

// Étendre l'interface Request pour inclure user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw createError('Token d\'authentification manquant', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      throw createError('Utilisateur non trouvé', 401);
    }

    if (!user.isActive) {
      throw createError('Compte désactivé', 401);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(createError('Token invalide', 401));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(createError('Token expiré', 401));
    } else {
      next(error);
    }
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(createError('Authentification requise', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(createError('Accès refusé', 403));
    }

    next();
  };
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await User.findById(decoded.userId).select('-password');

    if (user && user.isActive) {
      req.user = user;
    }
    next();
  } catch (error) {
    // Token fourni mais invalide/expiré → on log et on continue sans user,
    // mais on ne cache plus l'erreur silencieusement.
    logger.warn(`optionalAuth: token invalide ignore (${(error as Error).message})`);
    next();
  }
};
