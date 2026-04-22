import express, { Request, Response } from 'express';
import { PriceCalculationService } from '../services/priceCalculationService';
import { asyncHandler, createError } from '../middleware/errorHandler';

const router = express.Router();

// @desc    Calculer le prix d'un variant (public)
// @route   POST /api/prices/calculate
router.post(
  '/calculate',
  asyncHandler(async (req: Request, res: Response) => {
    const { recipeId, variantIndex, clientProvidedIngredients } = req.body;

    if (!recipeId || variantIndex === undefined) {
      throw createError('recipeId et variantIndex sont requis', 400);
    }

    const result = await PriceCalculationService.calculateVariantPrice(
      recipeId,
      variantIndex,
      clientProvidedIngredients || []
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

export default router;
