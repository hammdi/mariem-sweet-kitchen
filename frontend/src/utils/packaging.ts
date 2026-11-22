/**
 * Emballages (boîte, sachet, caissette…) : gérés comme des ingrédients
 * (sources, prix moyen, stock, achats) mais choisis pour chaque article
 * d'une commande. Leur coût s'ajoute au total, jamais au prix de la recette.
 */
export type PackagingType =
  | 'box'
  | 'bag'
  | 'case'
  | 'tray'
  | 'paper'
  | 'ribbon'
  | 'label'
  | 'other';
export type PackagingUse = 'per_item' | 'per_portion';

export const PACKAGING_TYPES: { value: PackagingType; label: string; emoji: string }[] = [
  { value: 'box', label: 'Boîte', emoji: '📦' },
  { value: 'bag', label: 'Sachet', emoji: '🛍️' },
  { value: 'case', label: 'Caissette / barquette', emoji: '🧁' },
  { value: 'tray', label: 'Plateau / support', emoji: '🍽️' },
  { value: 'paper', label: 'Papier / film', emoji: '📜' },
  { value: 'ribbon', label: 'Ruban / décoration', emoji: '🎀' },
  { value: 'label', label: 'Étiquette', emoji: '🏷️' },
  { value: 'other', label: 'Autre', emoji: '✨' },
];

export const packagingTypeOf = (t?: string) =>
  PACKAGING_TYPES.find((x) => x.value === t) || PACKAGING_TYPES[PACKAGING_TYPES.length - 1];

export const PACKAGING_USE_LABELS: Record<PackagingUse, { short: string; long: string }> = {
  per_item: { short: 'par article', long: '1 par article (ex : une boîte par gâteau)' },
  per_portion: { short: 'par portion', long: '1 par portion (ex : 8 caissettes pour 8 parts)' },
};

export interface PackagingOption {
  _id: string;
  name: string;
  pricePerUnit: number;
  packagingType?: string;
  packagingUse?: PackagingUse;
  stockQuantity?: number;
}

export interface PackagingChoice {
  packagingId: string;
  quantity: number; // pour 1 article
}

/** Quantité proposée pour 1 article : 1, ou le nombre de portions de la taille. */
export const defaultPackagingQuantity = (p: { packagingUse?: string }, portions: number) =>
  p.packagingUse === 'per_portion' ? Math.max(1, Math.round(portions || 1)) : 1;

/** Coût d'emballage d'UN article. */
export const packagingUnitCost = (choices: PackagingChoice[], options: PackagingOption[]) =>
  Math.round(
    choices.reduce((s, c) => {
      const o = options.find((x) => x._id === c.packagingId);
      return s + (o ? o.pricePerUnit * (c.quantity || 0) : 0);
    }, 0) * 1000
  ) / 1000;
