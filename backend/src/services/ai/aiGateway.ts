import { logger } from '../../utils/logger';
import { AIProvider, GenerateOptions, GenerateResult } from './types';
import { geminiProvider } from './geminiProvider';
import { groqProvider } from './groqProvider';

// Liste ordonnee : on essaie gemini d'abord, groq en fallback.
// L'ordre refl ete la preference qualite > latence pour notre cas d'usage
// (assistance metier, ce n'est pas du chat temps reel).
const PROVIDERS: AIProvider[] = [geminiProvider, groqProvider];

// Circuit breaker ultra-leger : si un provider echoue trop, on le skip
// temporairement. Reset automatique apres OPEN_DURATION_MS.
const FAILURE_THRESHOLD = 3;
const FAILURE_WINDOW_MS = 60_000;
const OPEN_DURATION_MS = 2 * 60_000;

interface BreakerState {
  failures: number[]; // timestamps des echecs recents
  openUntil: number; // timestamp jusqu'auquel on skip ce provider
}

const breakers = new Map<string, BreakerState>();

function getBreaker(name: string): BreakerState {
  let b = breakers.get(name);
  if (!b) {
    b = { failures: [], openUntil: 0 };
    breakers.set(name, b);
  }
  return b;
}

function isBreakerOpen(name: string): boolean {
  const b = getBreaker(name);
  return Date.now() < b.openUntil;
}

function recordFailure(name: string) {
  const b = getBreaker(name);
  const now = Date.now();
  b.failures = b.failures.filter(t => now - t < FAILURE_WINDOW_MS);
  b.failures.push(now);
  if (b.failures.length >= FAILURE_THRESHOLD) {
    b.openUntil = now + OPEN_DURATION_MS;
    logger.warn(`AI circuit breaker OPEN sur ${name} jusqu'a ${new Date(b.openUntil).toISOString()}`);
    b.failures = [];
  }
}

function recordSuccess(name: string) {
  const b = getBreaker(name);
  b.failures = [];
  b.openUntil = 0;
}

export function getProvidersStatus() {
  return PROVIDERS.map(p => ({
    name: p.name,
    enabled: p.isEnabled(),
    healthy: !isBreakerOpen(p.name),
  }));
}

export function isAnyProviderEnabled(): boolean {
  return PROVIDERS.some(p => p.isEnabled());
}

/**
 * Tente chaque provider configure dans l'ordre. Renvoie le premier succes.
 * Lance une erreur si tous echouent.
 */
export async function generateWithFallback(opts: GenerateOptions): Promise<GenerateResult> {
  const errors: string[] = [];

  for (const provider of PROVIDERS) {
    if (!provider.isEnabled()) {continue;}
    if (isBreakerOpen(provider.name)) {
      logger.info(`AI: skip ${provider.name} (circuit breaker ouvert)`);
      continue;
    }

    try {
      const result = await provider.generate(opts);
      recordSuccess(provider.name);
      logger.info(
        `AI ok: provider=${result.provider} model=${result.model} latency=${result.latencyMs}ms chars=${result.text.length}`
      );
      return result;
    } catch (error) {
      const msg = (error as Error).message;
      logger.warn(`AI: ${provider.name} a echoue -> ${msg}`);
      errors.push(`${provider.name}: ${msg}`);
      recordFailure(provider.name);
    }
  }

  throw new Error(
    errors.length > 0
      ? `Tous les providers IA ont echoue: ${errors.join(' | ')}`
      : 'Aucun provider IA configure'
  );
}
