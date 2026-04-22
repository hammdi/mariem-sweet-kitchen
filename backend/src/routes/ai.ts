import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import {
  generateRecipeDescription,
  generateRecipeAssistant,
  isAiEnabled,
  getAiStatus,
  IngredientInput,
} from '../services/aiService';
import { RecipeFormInput } from '../services/ai/contextBuilder';

const router = express.Router();

// Rate-limit dedie IA : evite de vider le tier gratuit en cas de boucle cote
// client ou d'abus. Scope par IP (suffisant tant qu'il n'y a qu'un seul admin).
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: 'Trop de requetes IA, reessayez dans une heure',
  },
});

// @desc    Indique quels providers IA sont disponibles
// @route   GET /api/ai/status
// @access  Admin
router.get('/status', authenticate, authorize('admin'), (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      enabled: isAiEnabled(),
      providers: getAiStatus(),
    },
  });
});

// @desc    Genere une description marketing pour une recette (outil simple)
// @route   POST /api/ai/recipe-description
// @access  Admin
router.post(
  '/recipe-description',
  authenticate,
  authorize('admin'),
  aiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    if (!isAiEnabled()) {
      throw createError('Feature IA desactivee (aucune cle configuree)', 503);
    }

    const { recipeName, category, ingredients } = req.body as {
      recipeName?: string;
      category?: string;
      ingredients?: IngredientInput[];
    };

    if (!recipeName || typeof recipeName !== 'string' || recipeName.trim().length < 2) {
      throw createError('recipeName requis (au moins 2 caracteres)', 400);
    }

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      throw createError('ingredients requis (au moins un)', 400);
    }

    for (const ing of ingredients) {
      if (!ing.name || typeof ing.name !== 'string') {
        throw createError('Chaque ingredient doit avoir un name', 400);
      }
    }

    const description = await generateRecipeDescription({
      recipeName: recipeName.trim(),
      category: category?.trim(),
      ingredients,
    });

    if (!description) {
      throw createError('Generation IA indisponible', 503);
    }

    logger.info(`ai.recipe-description: genere pour "${recipeName}" par ${req.user!.email}`);

    res.json({
      success: true,
      data: { description },
    });
  })
);

// @desc    Assistant contextuel : analyse la recette en cours et donne des
//          suggestions structurees (ingredients manquants, quantites, etc.)
// @route   POST /api/ai/recipe-assistant
// @access  Admin
router.post(
  '/recipe-assistant',
  authenticate,
  authorize('admin'),
  aiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    if (!isAiEnabled()) {
      throw createError('Feature IA desactivee (aucune cle configuree)', 503);
    }

    const { formState, question } = req.body as {
      formState?: RecipeFormInput;
      question?: string;
    };

    if (!formState || typeof formState !== 'object') {
      throw createError('formState requis (objet)', 400);
    }

    if (question !== undefined && typeof question !== 'string') {
      throw createError('question doit etre une chaine si fournie', 400);
    }

    const suggestion = await generateRecipeAssistant({
      formState,
      question: question?.trim() || undefined,
    });

    logger.info(
      `ai.recipe-assistant: analyse pour "${formState.name ?? 'recette sans nom'}" par ${req.user!.email}`
    );

    res.json({
      success: true,
      data: suggestion,
    });
  })
);

// @desc    Chat libre avec l'assistant IA de Mariem
// @route   POST /api/ai/chat
// @access  Admin
router.post(
  '/chat',
  authenticate,
  authorize('admin'),
  aiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    if (!isAiEnabled()) {
      throw createError('Feature IA desactivee', 503);
    }

    const { message, context } = req.body as {
      message: string;
      context?: {
        page?: string;
        pendingOrders?: number;
        lowStockItems?: string[];
        todayOrders?: number;
      };
    };

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw createError('message requis', 400);
    }

    const { generateWithFallback } = await import('../services/ai/aiGateway');

    const systemPrompt = `Tu es l'assistant IA de "Mariem's Sweet Kitchen", une patisserie artisanale tunisienne.
Tu aides Mariem (la patissiere) a gerer ses commandes, recettes et ingredients.

Regles :
- Reponds en francais, de maniere simple et chaleureuse (Mariem n'est pas technique)
- Sois concis (2-4 phrases max)
- Si Mariem demande quelque chose que tu ne peux pas faire, dis-le gentiment
- Tu connais le systeme : recettes avec variants (tailles), ingredients, machines, calcul de prix transparent
- Le flux des commandes : En attente → Confirmee → Payee → En preparation → Prete
- Utilise des emojis avec moderation

${context?.page ? `Mariem est actuellement sur la page : ${context.page}` : ''}
${context?.pendingOrders ? `Il y a ${context.pendingOrders} commandes en attente.` : ''}
${context?.lowStockItems?.length ? `Ingredients en stock faible : ${context.lowStockItems.join(', ')}` : ''}
${context?.todayOrders ? `${context.todayOrders} commandes prevues aujourd'hui.` : ''}`;

    const result = await generateWithFallback({
      prompt: `${systemPrompt}\n\nMariem dit : "${message.trim()}"`,
      maxTokens: 300,
      temperature: 0.7,
    });

    logger.info(
      `ai.chat: "${message.slice(0, 50)}..." par ${req.user!.email} via ${result.provider}`
    );

    res.json({
      success: true,
      data: {
        reply: result.text,
        provider: result.provider,
      },
    });
  })
);

export default router;
