import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let { statusCode = 500, message } = error;

  // Log de l'erreur
  logger.error(`❌ Erreur ${statusCode}: ${message}`, {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Erreur de validation Mongoose
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Données de validation invalides';
  }

  // Erreur de duplication Mongoose
  if (error.name === 'MongoError' && (error as any).code === 11000) {
    statusCode = 400;
    message = 'Données dupliquées';
  }

  // Erreur de cast Mongoose
  if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Format de données invalide';
  }

  // Erreur JWT
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token d\'authentification invalide';
  }

  if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token d\'authentification expiré';
  }

  // Réponse d'erreur
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};

export const createError = (message: string, statusCode: number = 500): AppError => {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export const asyncHandler = (fn: AsyncRouteHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
