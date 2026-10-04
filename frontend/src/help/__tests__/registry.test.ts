import { describe, expect, it } from 'vitest';
import { TOURS } from '../tours';
import { FLOWS } from '../flows';
import { PAGE_HELP, helpForPath } from '../pages';

/**
 * Intégrité de l'aide interactive : chaque action mène à une visite, un schéma
 * ou une page existante — et aucune ne peut modifier de données.
 */
describe('aide interactive — registre', () => {
  it('chaque action référence une visite ou un schéma qui existe', () => {
    for (const page of PAGE_HELP) {
      for (const a of page.actions) {
        if (a.kind === 'tour') expect([page.id, a.id, TOURS[a.tourId!]?.id]).toEqual([page.id, a.id, a.tourId]);
        if (a.kind === 'flow') expect([page.id, a.id, FLOWS[a.flowId!]?.id]).toEqual([page.id, a.id, a.flowId]);
      }
    }
  });

  it('les actions sont limitées à expliquer / montrer / naviguer (jamais d’écriture)', () => {
    for (const page of PAGE_HELP) {
      for (const a of page.actions) {
        expect(['tour', 'flow', 'navigate']).toContain(a.kind);
        if (a.kind === 'navigate') expect(a.to).toMatch(/^\/admin/);
      }
    }
    for (const t of Object.values(TOURS)) {
      if (t.finish) expect(t.finish.to).toMatch(/^\/admin/);
      if (t.route) expect(t.route).toMatch(/^\/admin/);
      for (const s of t.steps) if (s.flow) expect(FLOWS[s.flow]).toBeDefined();
    }
  });

  it('les pages complexes ont leur aide contextuelle', () => {
    const expected: [string, string][] = [
      ['/admin', 'dashboard'],
      ['/admin/orders', 'orders'],
      ['/admin/orders/new', 'new-order'],
      ['/admin/orders/64b0c0ffee', 'order-detail'],
      ['/admin/shopping-list', 'shopping'],
      ['/admin/stock', 'stock'],
      ['/admin/ingredients/64b0c0ffee', 'ingredient-detail'],
      ['/admin/ingredients', 'ingredients'],
      ['/admin/cash', 'cash'],
      ['/admin/statistics', 'statistics'],
      ['/admin/recipes', 'recipes'],
      ['/admin/clients', 'clients'],
      ['/admin/settings', 'settings'],
    ];
    for (const [path, id] of expected) expect([path, helpForPath(path).id]).toEqual([path, id]);
    expect(helpForPath('/admin/inconnue').id).toBe('default');
  });

  it('chaque schéma animé a des étapes lisibles', () => {
    for (const f of Object.values(FLOWS)) {
      expect(f.nodes.length).toBeGreaterThanOrEqual(3);
      for (const n of f.nodes) expect(n.label.length).toBeGreaterThan(0);
    }
  });
});
