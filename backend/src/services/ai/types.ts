export interface GenerateOptions {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean; // force une sortie JSON parsable
}

export interface GenerateResult {
  text: string;
  provider: string;
  model: string;
  latencyMs: number;
}

export interface AIProvider {
  readonly name: string;
  isEnabled(): boolean;
  generate(opts: GenerateOptions): Promise<GenerateResult>;
}

// Structure retournee par /api/ai/recipe-assistant
export interface AssistantSuggestion {
  generatedDescription: string | null;
  missingLikelyIngredients: Array<{
    name: string;
    reason: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
  quantityInconsistencies: Array<{
    variantSize: string;
    ingredient: string;
    suggestion: string;
    reasoning: string;
  }>;
  similarRecipeWarnings: string[];
  categorySuggestion: string | null;
  priceReactionAnalysis: string | null;
}
