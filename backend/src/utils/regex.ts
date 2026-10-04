/** Echappe une saisie utilisateur avant de l'utiliser dans une RegExp MongoDB. */
export const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
