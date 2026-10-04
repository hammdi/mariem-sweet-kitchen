import { randomUUID } from 'crypto';

/** En-tête d'idempotence : une clé unique par opération (comme le navigateur). */
export const idem = (key: string = randomUUID()) => ({ 'Idempotency-Key': `test-${key}` });
