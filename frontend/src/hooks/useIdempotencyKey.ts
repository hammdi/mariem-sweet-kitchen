import { useCallback, useRef, useState } from 'react';

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/**
 * Clé d'idempotence d'UNE opération (pas d'un clic) + état « envoi en cours ».
 *
 *   const op = useIdempotentAction();
 *   op.reset()  à l'ouverture du formulaire (nouvelle opération)
 *   await op.run(() => api.post(url, body, withIdempotency(op.key)))
 *
 * Un double clic renvoie la même clé : le serveur n'enregistre qu'une fois.
 * Le bouton est désactivé pendant l'envoi (op.busy) — confort, pas la protection.
 */
export function useIdempotentAction() {
  const keyRef = useRef(newKey());
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const reset = useCallback(() => {
    keyRef.current = newKey();
  }, []);

  const run = useCallback(async <T,>(fn: (key: string) => Promise<T>): Promise<T | undefined> => {
    if (busyRef.current) return undefined; // clic pendant l'envoi : ignoré
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await fn(keyRef.current);
      keyRef.current = newKey(); // opération terminée : la suivante aura sa propre clé
      return result;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  return {
    get key() {
      return keyRef.current;
    },
    busy,
    reset,
    run,
  };
}
