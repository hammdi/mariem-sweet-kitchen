import { describe, expect, it } from 'vitest';
import {
  averageComposition,
  isStale,
  priceBasisLabel,
  validateIngredientForm,
} from '../../components/admin/IngredientPricing';

const offer = (price: number, unit: string, name: string, extra: object = {}) => ({
  price,
  unit,
  isActive: true,
  sourceId: { name, isActive: true },
  ...extra,
});

describe('prix utilisé = moyenne des sources', () => {
  it('crème fraîche : (16 + 8,5) ÷ 2 = 12,25 DT/l', () => {
    const c = averageComposition([offer(16, 'l', 'Magasin'), offer(8.5, 'l', 'Marché')], 'l');
    expect(c.average).toBe(12.25);
    expect(c.formula).toBe('(16 + 8.5) ÷ 2 = 12.250 DT / l');
  });

  it('ramène chaque prix à l’unité de l’ingrédient (0,012 DT/g = 12 DT/kg)', () => {
    const c = averageComposition([offer(10, 'kg', 'A'), offer(0.012, 'g', 'B')], 'kg');
    expect(c.parts.map((p) => p.price)).toEqual([10, 12]);
    expect(c.average).toBe(11);
  });

  it('ignore les sources retirées, archivées et les unités non comparables', () => {
    const c = averageComposition(
      [
        offer(10, 'kg', 'A'),
        offer(99, 'kg', 'Retirée', { isActive: false }),
        offer(99, 'kg', 'Archivée', { sourceId: { name: 'X', isActive: false } }),
        offer(2, 'piece', 'Pièce'),
      ],
      'kg'
    );
    expect(c.parts).toEqual([{ source: 'A', price: 10 }]);
    expect(c.formula).toBe('10.000 DT / kg');
  });

  it('sans source : pas de moyenne et invitation à en ajouter une', () => {
    expect(averageComposition([], 'kg').average).toBeNull();
    expect(priceBasisLabel({ priceBasis: 'manual' }, null).text).toBe('Ajoutez une source');
  });

  it('prix à vérifier après 3 mois', () => {
    const now = new Date('2026-11-22T12:00:00Z');
    expect(isStale('2026-08-01T00:00:00Z', now)).toBe(true);
    expect(isStale('2026-10-01T00:00:00Z', now)).toBe(false);
    expect(isStale(null, now)).toBe(false);
  });

  it('formulaire : une source demande son prix, sans source un prix estimé', () => {
    const base = { name: 'Beurre', pricePerUnit: '', sourceId: '', sourcePrice: '' };
    const opts = { editing: false, fromSources: false };
    expect(validateIngredientForm({ ...base, sourceId: 's1' }, opts)).toMatch(/prix chez/);
    expect(validateIngredientForm({ ...base, sourceId: 's1', sourcePrice: '12,5' }, opts)).toBe(
      null
    );
    expect(validateIngredientForm(base, opts)).toMatch(/prix estimé/);
    expect(validateIngredientForm(base, { editing: true, fromSources: true })).toBe(null);
  });
});
