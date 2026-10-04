// Couleurs des graphiques. Palettes validees (scripts dataviz, surface blanche) :
//  - ventes/encaissements : orange + bleu → toutes verifications OK
//  - sorties : aqua / jaune / magenta → OK, contraste < 3:1 compense par la legende + vue tableau
// Une couleur suit toujours la meme notion sur toute la page.
export const CHART = {
  sales: '#eb6834', // ventes / CA (orange de l'application)
  payments: '#2a78d6', // argent reellement encaisse
  purchase: '#1baf7a', // achats d'ingredients
  expense: '#eda100', // depenses manuelles
  refund: '#e87ba4', // remboursements
  neutral: '#8c887f', // comptages (statuts de commandes)
  // suivent le thème clair / sombre (variables CSS du design system)
  grid: 'var(--mk-border)',
  axis: 'var(--mk-border-strong)',
  muted: 'var(--mk-ink-muted)',
  hover: 'rgba(128,128,128,0.08)',
};

export const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Graduations "propres" : 0, 25, 50, 75, 100 */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.999; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}
