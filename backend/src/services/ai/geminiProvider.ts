import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, GenerateOptions, GenerateResult } from './types';

const MODEL = 'gemini-2.5-flash';

const apiKey = process.env.GEMINI_API_KEY;
const client = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export const geminiProvider: AIProvider = {
  name: 'gemini',

  isEnabled() {
    return Boolean(client);
  },

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    if (!client) {
      throw new Error('Gemini non configure');
    }

    const generationConfig: Record<string, unknown> = {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxTokens ?? 800,
      // Gemini 2.5 Flash active le "thinking" par defaut, qui consomme le budget
      // de sortie avant la vraie reponse. On le desactive pour nos taches courtes.
      thinkingConfig: { thinkingBudget: 0 },
    };

    if (opts.jsonMode) {
      generationConfig.responseMimeType = 'application/json';
    }

    const model = client.getGenerativeModel({
      model: MODEL,
      generationConfig: generationConfig as any,
    });

    const start = Date.now();
    const result = await model.generateContent(opts.prompt);
    const text = result.response.text().trim();

    return {
      text,
      provider: 'gemini',
      model: MODEL,
      latencyMs: Date.now() - start,
    };
  },
};
