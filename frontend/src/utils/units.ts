/**
 * Unités côté interface — mêmes règles que le serveur (backend/src/services/unitService.ts) :
 * g ↔ kg, ml ↔ l, et 1 cuillère = 10 g (solide) ou 10 ml (liquide).
 * Les pièces et les tasses restent dans leur propre unité.
 */
export const SPOON_GRAMS = 10;

const FACTORS: Record<string, { family: 'mass' | 'volume'; toBase: number }> = {
  kg: { family: 'mass', toBase: 1000 },
  g: { family: 'mass', toBase: 1 },
  l: { family: 'volume', toBase: 1000 },
  ml: { family: 'volume', toBase: 1 },
};

export function convertQuantity(q: number, from: string, to: string): number | null {
  if (from === to) return q;
  if (from === 'cuillere' || to === 'cuillere') {
    const other = from === 'cuillere' ? to : from;
    const fam = FACTORS[other]?.family;
    if (!fam) return null;
    const base = fam === 'mass' ? 'g' : 'ml';
    return from === 'cuillere'
      ? convertQuantity(q * SPOON_GRAMS, base, to)
      : (convertQuantity(q, from, base) as number) / SPOON_GRAMS;
  }
  const a = FACTORS[from];
  const b = FACTORS[to];
  if (!a || !b || a.family !== b.family) return null;
  return (q * a.toBase) / b.toBase;
}

/** Unités proposées dans une recette pour un ingrédient géré en `stockUnit`. */
export function recipeUnitsFor(stockUnit: string): string[] {
  if (stockUnit === 'kg' || stockUnit === 'g') return ['g', 'kg', 'cuillere'];
  if (stockUnit === 'l' || stockUnit === 'ml') return ['ml', 'l', 'cuillere'];
  if (stockUnit === 'cuillere') return ['cuillere', 'g', 'kg', 'ml', 'l'];
  return [stockUnit];
}

export const UNIT_LABELS: Record<string, string> = {
  kg: 'kg',
  g: 'g',
  l: 'l',
  ml: 'ml',
  piece: 'pièce',
  cuillere: 'cuillère (10 g)',
  tasse: 'tasse',
};
