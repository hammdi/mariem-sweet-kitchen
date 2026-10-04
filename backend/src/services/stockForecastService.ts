import { PopulatedVariant } from './priceCalculationService';
import { convertQuantity, round, roundQty } from './unitService';

/**
 * Consommation d'ingrédients d'une commande, dans l'unité de STOCK de chaque
 * ingrédient (conversion via unitService).
 *
 * UNE seule fonction (computeConsumption) sert à la fois :
 *  - à la prévision (stock actuel − besoin = reste prévu, ingrédients manquants,
 *    liste de courses, commandes préparables) ;
 *  - à la déduction réelle du stock (stockMovementService).
 * La prévision et la déduction ne peuvent donc pas diverger.
 */

export interface ForecastLine {
  variant: PopulatedVariant;
  quantity: number;
  clientProvidedIngredients?: string[];
  label?: string; // nom de la recette (traçabilité StockHistory)
}

export interface ConsumptionPart {
  label: string;
  quantity: number; // unité de stock
}

export interface ConsumptionItem {
  ingredient: any; // document ingrédient chargé
  ingredientId: string;
  name: string;
  unit: string; // unité de stock (celle de l'ingrédient)
  quantity: number; // total consommé, unité de stock
  parts: ConsumptionPart[]; // détail par ligne de commande
}

export interface UnitIssue {
  ingredientId: string;
  name: string;
  recipeUnit: string;
  stockUnit: string;
  stock: number;
  label: string;
}

export interface Consumption {
  items: ConsumptionItem[];
  unitIssues: UnitIssue[];
}

export function computeConsumption(lines: ForecastLine[]): Consumption {
  const items = new Map<string, ConsumptionItem>();
  const unitIssues: UnitIssue[] = [];

  for (const line of lines) {
    const provided = (line.clientProvidedIngredients || []).map((id) => id.toString());
    for (const vi of line.variant.ingredients) {
      const ing = vi.ingredientId as any;
      if (!ing || !ing._id) {
        continue;
      }
      const id = ing._id.toString();
      if (provided.includes(id)) {
        continue; // apporté par le client : ne consomme pas le stock
      }

      const perUnit = convertQuantity(vi.quantity, vi.unit, ing.unit);
      if (perUnit === null) {
        unitIssues.push({
          ingredientId: id,
          name: ing.name,
          recipeUnit: vi.unit,
          stockUnit: ing.unit,
          stock: ing.stockQuantity || 0,
          label: line.label || '',
        });
        continue;
      }

      const qty = perUnit * line.quantity;
      let item = items.get(id);
      if (!item) {
        item = {
          ingredient: ing,
          ingredientId: id,
          name: ing.name,
          unit: ing.unit,
          quantity: 0,
          parts: [],
        };
        items.set(id, item);
      }
      item.quantity = roundQty(item.quantity + qty);
      item.parts.push({ label: line.label || '', quantity: roundQty(qty) });
    }
  }

  return { items: Array.from(items.values()), unitIssues };
}

export type StockStatus = 'ok' | 'low' | 'missing';

export interface StockNeed {
  ingredientId: string;
  name: string;
  unit: string; // unité du stock (celle de l'ingrédient)
  stock: number;
  needed: number;
  remaining: number;
  missing: number;
  minStock: number | null;
  status: StockStatus;
  unitMismatch: boolean; // unité recette non convertible vers l'unité du stock
  pricePerUnit: number;
}

/** Le stock passe sous le seuil d'alerte défini par Rahma (si défini). */
export const isBelowThreshold = (quantity: number, minStock?: number | null): boolean =>
  typeof minStock === 'number' && minStock > 0 && quantity < minStock;

export function computeStockNeeds(lines: ForecastLine[]): StockNeed[] {
  const { items, unitIssues } = computeConsumption(lines);

  const needs: StockNeed[] = items.map((c) => {
    const stock = c.ingredient.stockQuantity || 0;
    const needed = round(c.quantity, 4);
    const remaining = round(stock - needed, 4);
    const missing = remaining < 0 ? round(-remaining, 4) : 0;
    const minStock = typeof c.ingredient.minStock === 'number' ? c.ingredient.minStock : null;
    const status: StockStatus =
      missing > 0 ? 'missing' : isBelowThreshold(remaining, minStock) ? 'low' : 'ok';
    return {
      ingredientId: c.ingredientId,
      name: c.name,
      unit: c.unit,
      stock,
      needed,
      remaining,
      missing,
      minStock,
      status,
      unitMismatch: false,
      pricePerUnit: c.ingredient.pricePerUnit || 0,
    };
  });

  // Unités incompatibles : signalées, jamais converties au hasard
  for (const issue of unitIssues) {
    const existing = needs.find((n) => n.ingredientId === issue.ingredientId);
    if (existing) {
      existing.unitMismatch = true;
      continue;
    }
    needs.push({
      ingredientId: issue.ingredientId,
      name: issue.name,
      unit: issue.stockUnit,
      stock: issue.stock,
      needed: 0,
      remaining: issue.stock,
      missing: 0,
      minStock: null,
      status: 'ok',
      unitMismatch: true,
      pricePerUnit: 0,
    });
  }

  return needs.sort((a, b) => {
    const order = { missing: 0, low: 1, ok: 2 };
    return order[a.status] - order[b.status] || a.name.localeCompare(b.name);
  });
}
