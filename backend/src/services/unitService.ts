/**
 * Service d'unites CENTRALISE.
 *
 * Seul endroit de l'application qui convertit des quantites ou des prix entre
 * unites. Utilise par : cout des recettes / prix, prevision de stock, deduction
 * reelle du stock, ingredients manquants, liste de courses, prix par source.
 *
 * Conversions supportees (strictement physiques) :
 *   g ↔ kg, ml ↔ l, et chaque unite vers elle-meme (piece ↔ piece,
 *   cuillere ↔ cuillere, tasse ↔ tasse).
 * Tout le reste (g → piece, kg → l, ...) est refuse.
 */

export const SUPPORTED_UNITS = ['kg', 'g', 'l', 'ml', 'piece', 'cuillere', 'tasse'] as const;
export type Unit = (typeof SUPPORTED_UNITS)[number];

const FACTORS: Record<string, { family: string; toBase: number }> = {
  kg: { family: 'mass', toBase: 1000 },
  g: { family: 'mass', toBase: 1 },
  l: { family: 'volume', toBase: 1000 },
  ml: { family: 'volume', toBase: 1 },
};

/** Conversion impossible — statusCode 400 pour le gestionnaire d'erreurs Express. */
export class UnitConversionError extends Error {
  statusCode = 400;
  isOperational = true;
  constructor(
    public readonly from: string,
    public readonly to: string,
    context?: string
  ) {
    super(
      `Unité incompatible${context ? ` pour ${context}` : ''} : impossible de convertir "${from}" en "${to}"`
    );
    this.name = 'UnitConversionError';
  }
}

/**
 * Convertit une quantite d'une unite vers une autre.
 * Retourne null si la conversion n'a pas de sens.
 */
export function convertQuantity(quantity: number, from: string, to: string): number | null {
  if (from === to) {
    return quantity;
  }
  const a = FACTORS[from];
  const b = FACTORS[to];
  if (!a || !b || a.family !== b.family) {
    return null;
  }
  return (quantity * a.toBase) / b.toBase;
}

/** Comme convertQuantity mais leve UnitConversionError si incompatible. */
export function convertQuantityStrict(
  quantity: number,
  from: string,
  to: string,
  context?: string
): number {
  const converted = convertQuantity(quantity, from, to);
  if (converted === null) {
    throw new UnitConversionError(from, to, context);
  }
  return converted;
}

/**
 * Convertit un prix "par unite `from`" en prix "par unite `to`".
 * Ex: 0.0012 DT/g → 1.2 DT/kg
 */
export function convertUnitPrice(price: number, from: string, to: string): number | null {
  const factor = convertQuantity(1, to, from);
  return factor === null ? null : price * factor;
}

export function areUnitsCompatible(a: string, b: string): boolean {
  return convertQuantity(1, a, b) !== null;
}

export const round = (n: number, decimals = 3): number => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};

/** Precision des quantites de stock (evite 1.7500000000000002). */
export const roundQty = (n: number): number => round(n, 6);
