import { allocateStock, AllocationInput } from '../services/purchaseNeedService';
import { computeConsumption } from '../services/stockForecastService';

const sucre = { _id: 'sucre', name: 'Sucre', unit: 'kg', stockQuantity: 0.5, pricePerUnit: 1.2 };

// Commande consommant `grams` de sucre (recette en g, stock en kg)
const order = (
  id: string,
  grams: number,
  neededBy: string | null,
  createdAt = '2026-10-01'
): AllocationInput => {
  const { items, unitIssues } = computeConsumption([
    {
      variant: {
        portions: 8,
        ingredients: [{ ingredientId: sucre, quantity: grams, unit: 'g' }],
        appliances: [],
      },
      quantity: 1,
    },
  ]);
  return {
    orderId: id,
    neededBy: neededBy ? new Date(neededBy) : null,
    createdAt: new Date(createdAt),
    consumption: items,
    unitIssues,
  };
};

describe('allocateStock — attribution du stock aux commandes par date', () => {
  it('exemple CMD-104 / 108 / 110 : manques 0,5 + 0,7 + 0,3 = 1,5 kg', () => {
    const result = allocateStock([
      order('CMD-110', 300, '2026-10-06'),
      order('CMD-104', 1000, '2026-10-02'),
      order('CMD-108', 700, '2026-10-04'),
    ]);
    const missing = (id: string) => result.get(id)![0].missing;
    expect(missing('CMD-104')).toBe(0.5);
    expect(missing('CMD-108')).toBe(0.7);
    expect(missing('CMD-110')).toBe(0.3);
    expect(missing('CMD-104') + missing('CMD-108') + missing('CMD-110')).toBeCloseTo(1.5, 10);
    // la commande la plus proche reçoit le stock disponible
    expect(result.get('CMD-104')![0]).toMatchObject({ stock: 0.5, needed: 1, status: 'missing' });
    expect(result.get('CMD-108')![0].stock).toBe(0);
  });

  it('stock suffisant pour tout le monde : aucun manque', () => {
    const big = { ...sucre, stockQuantity: 2 };
    const input = [order('A', 1000, '2026-10-02'), order('B', 500, '2026-10-03')];
    input.forEach((o) => (o.consumption[0].ingredient = big));
    const result = allocateStock(input);
    expect(result.get('A')![0]).toMatchObject({ missing: 0, remaining: 1 });
    expect(result.get('B')![0]).toMatchObject({ stock: 1, missing: 0, remaining: 0.5 });
  });

  it('les commandes sans date passent après les commandes datées, puis par date de création', () => {
    const result = allocateStock([
      order('sans-date', 400, null, '2026-09-01'),
      order('datee', 400, '2026-12-01', '2026-10-01'),
    ]);
    expect(result.get('datee')![0].missing).toBe(0);
    expect(result.get('sans-date')![0]).toMatchObject({ stock: 0.1, missing: 0.3 });
  });
});
