import { Types } from 'mongoose';
import { Ingredient } from '../models/Ingredient';
import { createError } from '../middleware/errorHandler';
import { areUnitsCompatible } from './unitService';

interface VariantInput {
  sizeName?: string;
  ingredients?: { ingredientId: unknown; unit?: string }[];
}

/**
 * Refuse (400) une recette dont une quantité est exprimée dans une unité non
 * convertible vers l'unité de l'ingrédient (ex: "g" pour des œufs vendus à la pièce).
 * Sans ce contrôle, le prix et la déduction de stock ne pourraient pas être calculés.
 */
export async function assertRecipeUnits(variants: VariantInput[] | undefined): Promise<void> {
  if (!Array.isArray(variants)) {
    return;
  }
  const ids = variants
    .flatMap((v) => (v.ingredients || []).map((i) => String(i.ingredientId)))
    .filter((id) => Types.ObjectId.isValid(id));
  const ingredients = await Ingredient.find({ _id: { $in: ids } }).select('name unit');
  const byId = new Map(ingredients.map((i) => [i._id.toString(), i]));

  const problems: string[] = [];
  for (const v of variants) {
    for (const vi of v.ingredients || []) {
      const ing = byId.get(String(vi.ingredientId));
      if (ing && vi.unit && !areUnitsCompatible(vi.unit, ing.unit)) {
        problems.push(
          `${v.sizeName ? `Taille "${v.sizeName}" : ` : ''}${ing.name} en "${vi.unit}" alors qu'il est géré en "${ing.unit}"`
        );
      }
    }
  }
  if (problems.length > 0) {
    throw createError(
      `Unité incompatible (utilisez g/kg, ml/l ou l'unité de l'ingrédient) :\n${problems.join('\n')}`,
      400
    );
  }
}
