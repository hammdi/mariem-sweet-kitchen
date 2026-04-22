import { BuiltContext, RecipeFormInput } from './contextBuilder';

/**
 * Prompt simple : genere juste une description marketing.
 * Utilise pour /api/ai/recipe-description (legacy, stateless).
 */
export function buildDescriptionPrompt(params: {
  recipeName: string;
  category?: string;
  ingredients: Array<{ name: string; quantity: number; unit: string }>;
}): string {
  const ingredientsList = params.ingredients
    .map(i => `- ${i.name} (${i.quantity} ${i.unit})`)
    .join('\n');

  return `Tu es l'assistant marketing d'une patisserie artisanale tunisienne nommee Mariem's Sweet Kitchen.
Redige une description gourmande et chaleureuse (2 a 3 phrases, 180 caracteres maximum) pour la recette suivante.
Mets en avant les saveurs et la gourmandise, sans mentionner les quantites exactes.
Langue : francais. Pas d'emojis, pas de guillemets, pas de hashtags. Reponds uniquement avec la description, rien d'autre.

Recette : ${params.recipeName}
${params.category ? `Categorie : ${params.category}` : ''}
Ingredients :
${ingredientsList}`;
}

/**
 * Prompt riche : l'assistant analyse la recette en cours d'edition,
 * en la comparant aux autres recettes de Mariem et au catalogue,
 * et renvoie un JSON strict avec ses suggestions.
 */
export function buildAssistantPrompt(params: {
  formState: RecipeFormInput;
  context: BuiltContext;
  question?: string;
}): string {
  const { formState, context, question } = params;

  const formJson = JSON.stringify(formState, null, 2);
  const catalogIngredients = context.catalog.ingredients.join(', ');
  const catalogAppliances = context.catalog.appliances
    .map(a => `${a.name} (${a.powerW}W)`)
    .join(', ');

  const similarSummary = context.similarRecipes.length
    ? context.similarRecipes
        .map(
          (r, i) =>
            `${i + 1}. "${r.name}" (categories: ${r.categories.join(', ') || 'n/a'}) — ingredients: [${r.ingredientNames.join(', ')}] — tailles: [${r.variantSizes.join(', ')}]`
        )
        .join('\n')
    : 'Aucune recette similaire dans le catalogue.';

  const pricing = context.pricing;

  const questionBlock = question
    ? `\nQUESTION DE MARIEM: ${question}\nReponds brievement dans priceReactionAnalysis.`
    : '';

  return `Tu es l'assistant IA de Mariem, une patissiere artisanale tunisienne.
Tu l'aides a CREER ou MODIFIER une recette dans son interface d'administration.
Tu as acces a son catalogue d'ingredients, ses machines, et ses recettes existantes.

Ton role :
1. Detecter les ingredients probablement oublies en comparant avec ses recettes similaires.
2. Reperer les incoherences de quantites entre les tailles (ex: la farine double, le sucre reste pareil).
3. Suggerer une description gourmande (2-3 phrases, 180 car max, pas d'emoji).
4. Suggerer une categorie si absente.
5. Avertir si un ingredient tape ressemble a un ingredient existant (risque de doublon).
6. Si Mariem pose une question, y repondre brievement.

REGLE ABSOLUE: Reponds uniquement en JSON strict, avec la structure EXACTE ci-dessous.
Pas de texte avant ou apres le JSON. Pas de markdown. Pas de commentaires.

Structure attendue:
{
  "generatedDescription": string | null,
  "missingLikelyIngredients": [{"name": string, "reason": string, "confidence": "high" | "medium" | "low"}],
  "quantityInconsistencies": [{"variantSize": string, "ingredient": string, "suggestion": string, "reasoning": string}],
  "similarRecipeWarnings": [string],
  "categorySuggestion": string | null,
  "priceReactionAnalysis": string | null
}

Regles:
- Ne propose JAMAIS un ingredient qui n'existe pas dans le catalogue (sauf si tu le dis explicitement dans "reason").
- Si la recette est deja complete, retourne des tableaux vides et un description null.
- Limite chaque tableau a 5 elements maximum (priorite aux cas les plus certains).
- Langue : francais naturel, pas d'emojis, pas d'expressions anglaises.

CATALOGUE DISPONIBLE
Ingredients : ${catalogIngredients}
Machines : ${catalogAppliances}

PARAMETRES PRICING
Tarif STEG: ${pricing.stegTariff} DT/kWh
Forfait eau petit: ${pricing.waterForfaitSmall} DT
Forfait eau grand: ${pricing.waterForfaitLarge} DT
Marge: ${pricing.marginPercent}%

RECETTES SIMILAIRES DE MARIEM
${similarSummary}

RECETTE EN COURS D'EDITION
${formJson}${questionBlock}`;
}
