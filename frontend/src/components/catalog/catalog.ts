/**
 * Catalogue client : vitrine (photos, description, tailles, prix).
 * Jamais la composition ni le détail du calcul — le serveur ne les envoie pas.
 */
export interface CatalogVariant {
  sizeName: string;
  portions: number;
  weightGrams: number | null;
  dimensions: string;
  saleMode: string;
  price: number | null;
}

export interface CatalogItem {
  _id: string;
  name: string;
  description: string;
  images: string[];
  categories: string[];
  recommendations: string[];
  variants: CatalogVariant[];
}

/** Prix d'appel : la taille la moins chère (null si aucun prix affiché). */
export const fromPrice = (item: CatalogItem): number | null => {
  const prices = item.variants
    .map((v) => v.price)
    .filter((p): p is number => typeof p === 'number');
  return prices.length ? Math.min(...prices) : null;
};

export const formatPrice = (n: number) =>
  `${Number.isInteger(n) ? n : n.toFixed(n * 10 === Math.round(n * 10) ? 1 : 2)} DT`;

export const formatWeight = (g: number) =>
  g >= 1000 ? `${String(parseFloat((g / 1000).toFixed(2))).replace('.', ',')} kg` : `${g} g`;

/** Infos d'une taille, dans l'ordre de lecture : portions, poids, dimensions, façon de vente. */
export const variantFacts = (v: CatalogVariant): string[] =>
  [
    `${v.portions} portion${v.portions > 1 ? 's' : ''}`,
    v.weightGrams ? `≈ ${formatWeight(v.weightGrams)}` : '',
    v.dimensions,
    v.saleMode,
  ].filter(Boolean);

export const WHATSAPP_URL = (text?: string) =>
  `https://wa.me/${import.meta.env.VITE_WHATSAPP_NUMBER || '21612345678'}${
    text ? `?text=${encodeURIComponent(text)}` : ''
  }`;
