/**
 * Normalisation des numeros de telephone (Tunisie par defaut).
 *
 * "22 123 456", "+21622123456", "0021622123456", "216 22 123 456"
 * → "+21622123456"
 *
 * Les numeros etrangers saisis avec "+" ou "00" gardent leur indicatif.
 * Retourne null si le numero ne contient pas assez de chiffres.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  let digits = trimmed.replace(/\D/g, '');
  const international = trimmed.startsWith('+') || digits.startsWith('00');

  if (!trimmed.startsWith('+') && digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (digits.length < 8) {
    return null;
  }

  // Numero national tunisien (8 chiffres)
  if (!international && digits.length === 8) {
    return `+216${digits}`;
  }

  // Indicatif tunisien saisi sans "+"
  if (digits.length === 11 && digits.startsWith('216')) {
    return `+${digits}`;
  }

  if (international) {
    return `+${digits}`;
  }

  // Format inconnu : on garde les chiffres pour pouvoir comparer
  return digits;
}

/**
 * Regex qui retrouve un numero stocke dans un format libre (ancien champ
 * clientPhone des commandes) a partir de ses 8 derniers chiffres,
 * quels que soient les espaces/tirets entre les chiffres.
 */
export function phoneDigitsRegex(normalized: string): RegExp {
  const lastDigits = normalized.replace(/\D/g, '').slice(-8);
  return new RegExp(`${lastDigits.split('').join('\\D*')}\\D*$`);
}
