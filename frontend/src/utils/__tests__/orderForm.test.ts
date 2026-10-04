import { describe, expect, it } from 'vitest';
import { getOrderFormIssues, OrderFormItem } from '../orderForm';

const cake: OrderFormItem = { mode: 'existing', recipeId: 'r1', customName: '', quantity: 2 };

describe('Creer la commande — conditions du bouton', () => {
  it('actif des que client + article complet', () => {
    expect(getOrderFormIssues({ hasClient: true, items: [cake] })).toEqual([]);
  });

  it('explique ce qui manque', () => {
    expect(
      getOrderFormIssues({
        hasClient: false,
        items: [{ ...cake, recipeId: '' }],
      })
    ).toEqual([
      'Choisissez un client dans la liste ou créez-en un nouveau',
      'Article : choisissez une recette',
    ]);
  });

  it('signale une ligne d article vide en plus', () => {
    const issues = getOrderFormIssues({
      hasClient: true,
      items: [cake, { ...cake, recipeId: '' }],
    });
    expect(issues).toEqual(['Article 2 : choisissez une recette (ou supprimez la ligne)']);
  });

  it('recette speciale : il faut un nom', () => {
    expect(
      getOrderFormIssues({
        hasClient: true,
        items: [{ mode: 'custom', recipeId: '', customName: ' ', quantity: 1 }],
      })
    ).toEqual(['Article : donnez un nom a la recette speciale']);
  });

  it('le stock ne fait pas partie des conditions (manque d ingredients ≠ blocage)', () => {
    // la fonction ne recoit aucune information de stock : impossible de bloquer pour ce motif
    expect(getOrderFormIssues.length).toBe(1);
    const form = { hasClient: true, items: [cake], stockNeeds: [{ status: 'missing' }] };
    expect(getOrderFormIssues(form)).toEqual([]);
  });
});
