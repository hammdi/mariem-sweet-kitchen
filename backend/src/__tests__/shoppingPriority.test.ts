import { shoppingPriority } from '../services/purchaseNeedService';
import { ALLOWED_TRANSITIONS } from '../services/orderWorkflowService';

describe('priorité de la liste de courses', () => {
  const now = new Date('2026-10-03T10:00:00.000Z');
  const at = (h: number) => new Date(now.getTime() + h * 3600e3);

  it('urgent : en retard ou dans le délai d’alerte', () => {
    expect(shoppingPriority(at(-2), 24, now)).toEqual({ priority: 'urgent', hoursLeft: -2 });
    expect(shoppingPriority(at(24), 24, now).priority).toBe('urgent');
  });
  it('bientôt : dans moins de 3 × le délai ; plus tard au-delà ou sans date', () => {
    expect(shoppingPriority(at(25), 24, now).priority).toBe('soon');
    expect(shoppingPriority(at(72), 24, now).priority).toBe('soon');
    expect(shoppingPriority(at(73), 24, now).priority).toBe('later');
    expect(shoppingPriority(null, 24, now)).toEqual({ priority: 'later', hoursLeft: null });
  });
});

describe('avancement des commandes', () => {
  it('le paiement n’est plus une étape : aucune transition vers « paid »', () => {
    for (const targets of Object.values(ALLOWED_TRANSITIONS)) {
      expect(targets).not.toContain('paid');
    }
  });
  it('la préparation peut suivre directement la confirmation', () => {
    expect(ALLOWED_TRANSITIONS.confirmed).toContain('preparing');
  });
  it('une préparation commencée ne revient pas à « confirmée » (stock déjà consommé)', () => {
    expect(ALLOWED_TRANSITIONS.preparing).not.toContain('confirmed');
    expect(ALLOWED_TRANSITIONS.ready).not.toContain('confirmed');
  });
  it('annulation possible jusqu’à « Prête », pas après la remise', () => {
    expect(ALLOWED_TRANSITIONS.preparing).toContain('cancelled');
    expect(ALLOWED_TRANSITIONS.ready).toContain('cancelled');
    expect(ALLOWED_TRANSITIONS.delivered).not.toContain('cancelled');
  });
});
