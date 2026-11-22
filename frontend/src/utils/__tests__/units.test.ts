import { describe, expect, it } from 'vitest';
import { convertQuantity, recipeUnitsFor } from '../units';

describe('unités (identiques au serveur)', () => {
  it('1 cuillère = 10 g ; 100 g de café à 10 DT/kg = 1 DT', () => {
    expect(convertQuantity(1, 'cuillere', 'g')).toBe(10);
    expect(convertQuantity(100, 'g', 'kg')! * 10).toBeCloseTo(1, 10);
    expect(convertQuantity(1, 'cuillere', 'kg')! * 10).toBeCloseTo(0.1, 10);
  });
  it('liquide : 1 cuillère = 10 ml', () =>
    expect(convertQuantity(2, 'cuillere', 'l')).toBeCloseTo(0.02, 10));
  it('refuse pièce ↔ masse et cuillère ↔ pièce', () => {
    expect(convertQuantity(1, 'piece', 'g')).toBeNull();
    expect(convertQuantity(1, 'cuillere', 'piece')).toBeNull();
  });
  it('ne propose que des unités convertibles', () => {
    expect(recipeUnitsFor('kg')).toEqual(['g', 'kg', 'cuillere']);
    expect(recipeUnitsFor('piece')).toEqual(['piece']);
    for (const stock of ['kg', 'g', 'l', 'ml', 'piece', 'cuillere', 'tasse'])
      for (const u of recipeUnitsFor(stock))
        expect([stock, u, convertQuantity(1, u, stock)]).not.toContain(null);
  });
});
