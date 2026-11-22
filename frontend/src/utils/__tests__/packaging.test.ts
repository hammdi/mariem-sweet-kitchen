import { describe, expect, it } from 'vitest';
import { defaultPackagingQuantity, packagingTypeOf, packagingUnitCost } from '../packaging';

describe('emballages', () => {
  it('par portion : 8 parts → 8 caissettes ; par article : 1 boîte', () => {
    expect(defaultPackagingQuantity({ packagingUse: 'per_portion' }, 8)).toBe(8);
    expect(defaultPackagingQuantity({ packagingUse: 'per_item' }, 8)).toBe(1);
    expect(defaultPackagingQuantity({}, 8)).toBe(1);
  });

  it('8 caissettes à 0,5 DT + 1 boîte à 1,2 DT = 5,2 DT par article', () => {
    const options = [
      { _id: 'c', name: 'Caissette', pricePerUnit: 0.5 },
      { _id: 'b', name: 'Boîte', pricePerUnit: 1.2 },
    ];
    expect(
      packagingUnitCost(
        [
          { packagingId: 'c', quantity: 8 },
          { packagingId: 'b', quantity: 1 },
        ],
        options
      )
    ).toBe(5.2);
  });

  it('type inconnu → « Autre »', () => {
    expect(packagingTypeOf('fusée').label).toBe('Autre');
    expect(packagingTypeOf('box').label).toBe('Boîte');
  });
});
