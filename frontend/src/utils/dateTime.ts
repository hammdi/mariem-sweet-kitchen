/**
 * Dates/heures saisies par Rahma : toujours interpretees dans le fuseau horaire
 * LOCAL du navigateur, puis envoyees au backend en ISO UTC complet
 * ("2026-10-02T14:00:00.000Z"). Jamais de chaine sans fuseau
 * ("2026-10-02T15:00") : le serveur (Docker en UTC) la lirait avec 1 h d'ecart.
 */

const MONTHS_FR = [
  'janvier',
  'fevrier',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'aout',
  'septembre',
  'octobre',
  'novembre',
  'decembre',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-02" + "15:00" (heure locale) → ISO UTC */
export function fromLocalParts(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = (time || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0).toISOString();
}

/** ISO (ou Date) → { date: "2026-10-02", time: "15:00" } en heure locale */
export function toLocalParts(value: string | Date): { date: string; time: string } {
  const d = new Date(value);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** "02 octobre 2026 · 15:00" */
export function formatDateTimeFr(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return `${pad(d.getDate())} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const MONTH_NAMES_FR = MONTHS_FR;

// Abreviations usuelles (axes des graphiques)
const MONTHS_SHORT_FR = [
  'janv.',
  'fevr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'aout',
  'sept.',
  'oct.',
  'nov.',
  'dec.',
];

/** Debut / fin de periode (heure locale) pour les filtres */
export function periodRange(
  period: 'today' | 'week' | 'month' | '7d' | '30d',
  now = new Date()
): { from: string; to: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === '7d' || period === '30d') {
    // jours glissants, aujourd'hui inclus
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    start.setDate(start.getDate() - (period === '7d' ? 6 : 29));
    return { from: start.toISOString(), to: end.toISOString() };
  }
  if (period === 'week') {
    const day = (start.getDay() + 6) % 7; // lundi = 0
    start.setDate(start.getDate() - day);
  } else if (period === 'month') {
    start.setDate(1);
  }
  const end = new Date(start);
  if (period === 'today') end.setDate(end.getDate() + 1);
  else if (period === 'week') end.setDate(end.getDate() + 7);
  else end.setMonth(end.getMonth() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

/** Periode personnalisee : jours inclus "2026-10-01" → "2026-10-31" (heure locale) */
export function customRange(fromDate: string, toDate: string): { from: string; to: string } {
  const from = fromLocalParts(fromDate, '00:00');
  const end = new Date(fromLocalParts(toDate, '00:00'));
  end.setDate(end.getDate() + 1);
  return { from, to: end.toISOString() };
}

export type Bucket = 'hour' | 'day' | 'week' | 'month';

/** Debuts de creneaux (heure locale) entre from et to — memes cles ISO que le backend ($dateTrunc + fuseau) */
export function bucketStarts(fromIso: string, toIso: string, bucket: Bucket): string[] {
  const to = new Date(toIso);
  const d = new Date(fromIso);
  if (bucket === 'hour') d.setMinutes(0, 0, 0);
  else d.setHours(0, 0, 0, 0);
  if (bucket === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (bucket === 'month') d.setDate(1);
  const out: string[] = [];
  while (d < to && out.length < 500) {
    out.push(d.toISOString());
    if (bucket === 'hour') d.setHours(d.getHours() + 1);
    else if (bucket === 'day') d.setDate(d.getDate() + 1);
    else if (bucket === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
  }
  return out;
}

/** Fin (exclue) d'un creneau, pour ouvrir les ventes de ce creneau */
export function bucketEnd(startIso: string, bucket: Bucket): string {
  const d = new Date(startIso);
  if (bucket === 'hour') d.setHours(d.getHours() + 1);
  else if (bucket === 'day') d.setDate(d.getDate() + 1);
  else if (bucket === 'week') d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

/** Libelle court d'un creneau : "15 h", "02 oct.", "sem. 28 sept.", "oct. 2026" */
export function bucketLabel(iso: string, bucket: Bucket, long = false): string {
  const d = new Date(iso);
  const month = MONTHS_FR[d.getMonth()];
  const short = MONTHS_SHORT_FR[d.getMonth()];
  if (bucket === 'hour')
    return long
      ? `${pad(d.getDate())} ${month} · ${pad(d.getHours())}:00`
      : `${pad(d.getHours())} h`;
  if (bucket === 'day')
    return long
      ? `${pad(d.getDate())} ${month} ${d.getFullYear()}`
      : `${pad(d.getDate())} ${short}`;
  if (bucket === 'week')
    return `${long ? 'Semaine du ' : 'sem. '}${pad(d.getDate())} ${long ? month : short}`;
  return long ? `${month} ${d.getFullYear()}` : `${short} ${String(d.getFullYear()).slice(2)}`;
}
