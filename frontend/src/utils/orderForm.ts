/**
 * Conditions pour activer "Creer la commande".
 *
 * Obligatoire : un client choisi + au moins un article, et chaque article
 * complet (recette choisie, ou nom pour une recette speciale).
 * Le stock n'en fait volontairement PAS partie : un manque d'ingredients
 * n'empeche jamais d'enregistrer une commande (il bloque seulement
 * "Lancer la preparation").
 */
export interface OrderFormItem {
  mode: 'existing' | 'custom';
  recipeId: string;
  customName: string;
  quantity: number;
}

export function getOrderFormIssues(form: { hasClient: boolean; items: OrderFormItem[] }): string[] {
  const issues: string[] = [];
  if (!form.hasClient) {
    issues.push('Choisissez un client dans la liste ou créez-en un nouveau');
  }
  if (form.items.length === 0) {
    issues.push('Ajoutez au moins un article');
  }
  form.items.forEach((item, i) => {
    const label = form.items.length > 1 ? `Article ${i + 1}` : 'Article';
    if (item.mode === 'existing' && !item.recipeId) {
      issues.push(
        `${label} : choisissez une recette${form.items.length > 1 ? ' (ou supprimez la ligne)' : ''}`
      );
    }
    if (item.mode === 'custom' && !item.customName.trim()) {
      issues.push(`${label} : donnez un nom a la recette speciale`);
    }
    if (!(item.quantity >= 1)) {
      issues.push(`${label} : quantite d'au moins 1`);
    }
  });
  return issues;
}
