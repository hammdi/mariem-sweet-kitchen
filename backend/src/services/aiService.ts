import { logger } from '../utils/logger';
import { generateWithFallback, isAnyProviderEnabled, getProvidersStatus } from './ai/aiGateway';
import { buildDescriptionPrompt, buildAssistantPrompt } from './ai/prompts';
import { buildRecipeContext, RecipeFormInput } from './ai/contextBuilder';
import { AssistantSuggestion } from './ai/types';

export const isAiEnabled = isAnyProviderEnabled;
export const getAiStatus = getProvidersStatus;

export interface IngredientInput {
  name: string;
  quantity: number;
  unit: string;
}

/**
 * Genere une description marketing courte pour une recette.
 * Retourne null si aucun provider IA n'est configure.
 */
export async function generateRecipeDescription(params: {
  recipeName: string;
  category?: string;
  ingredients: IngredientInput[];
}): Promise<string | null> {
  if (!isAnyProviderEnabled()) {
    logger.warn('aiService: aucun provider IA configure');
    return null;
  }

  const prompt = buildDescriptionPrompt(params);
  const result = await generateWithFallback({
    prompt,
    maxTokens: 300,
    temperature: 0.7,
  });
  return result.text;
}

/**
 * Reponse nulle retournee quand l'IA n'est pas configuree ou echoue.
 */
function emptySuggestion(): AssistantSuggestion {
  return {
    generatedDescription: null,
    missingLikelyIngredients: [],
    quantityInconsistencies: [],
    similarRecipeWarnings: [],
    categorySuggestion: null,
    priceReactionAnalysis: null,
  };
}

/**
 * Parser tolerant : le LLM peut parfois entourer son JSON de blocs markdown
 * ou ajouter du texte avant/apres. On cherche le premier objet JSON valide.
 */
function parseAssistantResponse(raw: string): AssistantSuggestion {
  const trimmed = raw.trim();

  // Cas simple : deja du JSON pur
  const candidates: string[] = [trimmed];

  // Cas avec fence markdown
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    candidates.push(fenceMatch[1].trim());
  }

  // Cas avec prefixe/suffixe textuel
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c) as Partial<AssistantSuggestion>;
      // Normalisation : on s'assure que les champs existent meme si le LLM en a oublie
      return {
        generatedDescription: parsed.generatedDescription ?? null,
        missingLikelyIngredients: Array.isArray(parsed.missingLikelyIngredients)
          ? parsed.missingLikelyIngredients.slice(0, 5)
          : [],
        quantityInconsistencies: Array.isArray(parsed.quantityInconsistencies)
          ? parsed.quantityInconsistencies.slice(0, 5)
          : [],
        similarRecipeWarnings: Array.isArray(parsed.similarRecipeWarnings)
          ? parsed.similarRecipeWarnings.slice(0, 5)
          : [],
        categorySuggestion: parsed.categorySuggestion ?? null,
        priceReactionAnalysis: parsed.priceReactionAnalysis ?? null,
      };
    } catch {
      // essai suivant
    }
  }

  throw new Error('Reponse IA non parsable en JSON');
}

/**
 * Assistant contextuel : analyse la recette en cours d'edition,
 * interroge la DB pour enrichir le contexte, et renvoie des suggestions
 * structurees.
 */
export async function generateRecipeAssistant(params: {
  formState: RecipeFormInput;
  question?: string;
}): Promise<AssistantSuggestion> {
  if (!isAnyProviderEnabled()) {
    logger.warn('aiService.assistant: aucun provider IA configure');
    return emptySuggestion();
  }

  const context = await buildRecipeContext(params.formState);
  const prompt = buildAssistantPrompt({
    formState: params.formState,
    context,
    question: params.question,
  });

  const result = await generateWithFallback({
    prompt,
    maxTokens: 1500,
    temperature: 0.4, // plus bas que la description : on veut des suggestions factuelles
    jsonMode: true,
  });

  try {
    return parseAssistantResponse(result.text);
  } catch (error) {
    logger.error('aiService.assistant: parsing JSON echoue', {
      error: (error as Error).message,
      rawPreview: result.text.slice(0, 500),
    });
    throw new Error('Reponse IA invalide, reessayez');
  }
}
