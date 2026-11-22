import { describe, expect, it } from 'vitest';
import {
  formatPrice,
  formatWeight,
  fromPrice,
  variantFacts,
} from '../../components/catalog/catalog';

const v = (price: number | null, extra = {}) => ({
  sizeName: 'S',
  portions: 8,
  weightGrams: null,
  dimensions: '',
  saleMode: '',
  price,
  ...extra,
});

describe('catalogue client', () => {
  it('prix d’appel = la taille la moins chère, rien si prix masqués', () => {
    const item = {
      _id: '1',
      name: 'C',
      description: '',
      images: [],
      categories: [],
      recommendations: [],
    };
    expect(fromPrice({ ...item, variants: [v(45), v(30)] })).toBe(30);
    expect(fromPrice({ ...item, variants: [v(null)] })).toBeNull();
  });

  it('formats lisibles', () => {
    expect(formatPrice(30)).toBe('30 DT');
    expect(formatPrice(12.5)).toBe('12.5 DT');
    expect(formatPrice(12.25)).toBe('12.25 DT');
    expect(formatWeight(900)).toBe('900 g');
    expect(formatWeight(1250)).toBe('1,25 kg');
  });

  it('infos d’une taille dans l’ordre, sans cases vides', () => {
    expect(
      variantFacts(v(30, { weightGrams: 900, dimensions: 'Ø 20 cm', saleMode: 'À la pièce' }))
    ).toEqual(['8 portions', '≈ 900 g', 'Ø 20 cm', 'À la pièce']);
    expect(variantFacts(v(30, { portions: 1 }))).toEqual(['1 portion']);
  });
});
