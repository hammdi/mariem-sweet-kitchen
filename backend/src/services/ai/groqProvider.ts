import { AIProvider, GenerateOptions, GenerateResult } from './types';

const MODEL = 'llama-3.3-70b-versatile';
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

const apiKey = process.env.GROQ_API_KEY;

export const groqProvider: AIProvider = {
  name: 'groq',

  isEnabled() {
    return Boolean(apiKey);
  },

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    if (!apiKey) {
      throw new Error('Groq non configure');
    }

    const body: Record<string, unknown> = {
      model: MODEL,
      messages: [{ role: 'user', content: opts.prompt }],
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 800,
    };

    if (opts.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const start = Date.now();
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '<no body>');
      throw new Error(`Groq HTTP ${response.status}: ${errorText.slice(0, 200)}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';

    if (!text) {
      throw new Error('Groq: reponse vide');
    }

    return {
      text,
      provider: 'groq',
      model: MODEL,
      latencyMs: Date.now() - start,
    };
  },
};
