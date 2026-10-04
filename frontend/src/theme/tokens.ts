/**
 * DESIGN TOKENS — source unique des couleurs, rayons, ombres, typographie,
 * espacements et transitions de l'interface admin.
 *
 * Les couleurs sont exposées en variables CSS (`color.bg` = `var(--mk-bg)`) :
 * le thème clair / sombre change en une fois toute l'application.
 * Les valeurs brutes (pour MUI) sont dans `palettes.light` / `palettes.dark`.
 *
 * Règle des couleurs (elles portent un sens, jamais décoratives) :
 *   orange  = action principale / achat / marque
 *   vert    = entrée d'argent, état positif (OK, payé, prêt)
 *   rouge   = sortie d'argent, alerte, manque, annulation
 *   ambre   = à surveiller, en attente
 *   bleu / violet = catégories et informations neutres
 */

const light = {
  bg: '#FBF7F1', // crème très clair
  bgSubtle: '#F6EFE6',
  surface: '#FFFFFF',
  surfaceMuted: '#FDFAF6',
  border: '#EFE6DA',
  borderStrong: '#E2D4C2',
  headerGlass: 'rgba(251,247,241,0.9)',
  overlay: 'rgba(28,18,10,0.55)',

  ink: '#2A1F17',
  inkSoft: '#6B5E53',
  inkMuted: '#9A8C80',

  primary: '#F1770A',
  primaryDark: '#C95C00',
  primarySoft: '#FFF1E3',
  primaryTint: '#FDE1C4',
  primaryBorder: '#FAD3AE',

  success: '#2F9E62',
  successDark: '#1F7A49',
  successSoft: '#E8F6EE',
  successBorder: '#C6E9D4',

  danger: '#DC3D43',
  dangerDark: '#B42328',
  dangerSoft: '#FDECEC',
  dangerBorder: '#F6CACC',

  warning: '#E69A00',
  warningDark: '#9A6100',
  warningSoft: '#FFF5DB',
  warningBorder: '#F6DFA0',

  info: '#3B7BE0',
  infoDark: '#2257AE',
  infoSoft: '#EAF2FD',
  infoBorder: '#C9DCF8',

  violet: '#7C5CD6',
  violetDark: '#5A3DB0',
  violetSoft: '#F1ECFC',
  violetBorder: '#DCD0F7',

  rose: '#D9467A',
  roseDark: '#A92D5B',
  roseSoft: '#FDEDF2',
  roseBorder: '#F6C9D8',

  neutralSoft: '#F3EEE7',
  cream: '#FFF8EE',
  butter: '#FFE6A8',
};

type Palette = typeof light;

const dark: Palette = {
  bg: '#16110D',
  bgSubtle: '#211A15',
  surface: '#1E1813',
  surfaceMuted: '#241D17',
  border: '#352A21',
  borderStrong: '#4A3C30',
  headerGlass: 'rgba(22,17,13,0.88)',
  overlay: 'rgba(0,0,0,0.65)',

  ink: '#F6EEE5',
  inkSoft: '#C4B5A7',
  inkMuted: '#918274',

  primary: '#F5862A',
  primaryDark: '#FFAA66',
  primarySoft: '#36210F',
  primaryTint: '#55331A',
  primaryBorder: '#5C3A1E',

  success: '#47B87B',
  successDark: '#86D9AB',
  successSoft: '#142B1D',
  successBorder: '#24472F',

  danger: '#EF5F67',
  dangerDark: '#FF9EA3',
  dangerSoft: '#371719',
  dangerBorder: '#5A2629',

  warning: '#F0B13C',
  warningDark: '#FFD27D',
  warningSoft: '#352910',
  warningBorder: '#58451C',

  info: '#5C95EE',
  infoDark: '#A1C4FF',
  infoSoft: '#14233B',
  infoBorder: '#24395E',

  violet: '#9D82EC',
  violetDark: '#CAB8FF',
  violetSoft: '#241D3A',
  violetBorder: '#3A2F5E',

  rose: '#EC6B99',
  roseDark: '#FFA3C3',
  roseSoft: '#351823',
  roseBorder: '#572738',

  neutralSoft: '#2A221B',
  cream: '#221A13',
  butter: '#4A3A14',
};

export const palettes = { light, dark };
export type ThemeMode = 'light' | 'dark';

const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** Variables CSS d'un thème (à poser sur :root ou [data-mk-theme]). */
export const cssVars = (mode: ThemeMode) =>
  Object.fromEntries(Object.entries(palettes[mode]).map(([k, v]) => [`--mk-${kebab(k)}`, v])) as Record<string, string>;

/** Couleurs utilisables partout (sx, SVG, CSS) : elles suivent le thème actif. */
export const color = Object.fromEntries(
  Object.keys(light).map((k) => [k, `var(--mk-${kebab(k)})`])
) as Record<keyof Palette, string>;

export type Tone = 'neutral' | 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'violet' | 'rose';

/** Couleurs d'un « ton » : texte fort, fond doux, accent, bordure. */
export const tone: Record<Tone, { fg: string; bg: string; accent: string; border: string }> = {
  neutral: { fg: color.inkSoft, bg: color.neutralSoft, accent: color.inkMuted, border: color.border },
  primary: { fg: color.primaryDark, bg: color.primarySoft, accent: color.primary, border: color.primaryBorder },
  success: { fg: color.successDark, bg: color.successSoft, accent: color.success, border: color.successBorder },
  danger: { fg: color.dangerDark, bg: color.dangerSoft, accent: color.danger, border: color.dangerBorder },
  warning: { fg: color.warningDark, bg: color.warningSoft, accent: color.warning, border: color.warningBorder },
  info: { fg: color.infoDark, bg: color.infoSoft, accent: color.info, border: color.infoBorder },
  violet: { fg: color.violetDark, bg: color.violetSoft, accent: color.violet, border: color.violetBorder },
  rose: { fg: color.roseDark, bg: color.roseSoft, accent: color.rose, border: color.roseBorder },
};

export const radius = {
  xs: 8,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const shadow = {
  card: '0 1px 2px rgba(42,31,23,0.05), 0 2px 6px rgba(42,31,23,0.04)',
  raised: '0 8px 22px rgba(42,31,23,0.10)',
  floating: '0 14px 36px rgba(42,31,23,0.18)',
  focus: '0 0 0 3px rgba(241,119,10,0.30)',
} as const;

export const font = {
  heading: '"Plus Jakarta Sans", "Inter", "Helvetica", "Arial", sans-serif',
  body: '"Inter", "Helvetica", "Arial", sans-serif',
  brand: '"Playfair Display", "Georgia", serif',
} as const;

export const motion = {
  fast: 140,
  base: 220,
  slow: 360,
  ease: 'cubic-bezier(0.2, 0, 0, 1)',
  easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;

export const transition = (props: string[], ms: number = motion.base) =>
  props.map((p) => `${p} ${ms}ms ${motion.ease}`).join(', ');

export const layout = {
  sidebarWidth: 280,
  topbarHeight: 72,
  mobileTopbarHeight: 58,
  bottomNavHeight: 64,
  contentMaxWidth: 1400,
  gutter: { xs: 2, sm: 3, md: 3.5 }, // unités MUI (×8 px)
} as const;

/** Statuts de commande → ton + libellé (avancement, indépendant du paiement). */
export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'En attente', tone: 'warning' },
  confirmed: { label: 'Confirmée', tone: 'info' },
  paid: { label: 'Confirmée', tone: 'info' }, // ancien statut « Payée »
  preparing: { label: 'En préparation', tone: 'primary' },
  ready: { label: 'Prête', tone: 'success' },
  delivered: { label: 'Remise', tone: 'violet' },
  cancelled: { label: 'Annulée', tone: 'danger' },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  unpaid: { label: 'Non payée', tone: 'warning' },
  partial: { label: 'Partiel', tone: 'info' },
  paid: { label: 'Payée', tone: 'success' },
};
