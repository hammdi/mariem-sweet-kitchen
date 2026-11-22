import { Box, Typography } from '@mui/material';
import { WarningAmber, Update } from '@mui/icons-material';
import type { PriceSummary } from '../../types/admin';
import { color } from '../../theme/tokens';
import { convertQuantity } from '../../utils/units';
import { formatDT } from '../../utils/format';

/**
 * PRIX UTILISÉ D'UN INGRÉDIENT (recettes, devis, factures) = moyenne des prix
 * de ses sources d'achat actives. Calculé par le serveur à chaque changement
 * de prix d'une source ; sans source, le prix saisi reste fixe.
 */

/** Prix de source non revérifié depuis plus de 3 mois (même règle que le serveur). */
export const STALE_PRICE_DAYS = 90;

export const isStale = (lastCheckedAt?: string | Date | null, now: Date = new Date()) => {
  if (!lastCheckedAt) return false;
  const t = new Date(lastCheckedAt).getTime();
  return Number.isFinite(t) && now.getTime() - t > STALE_PRICE_DAYS * 24 * 3600 * 1000;
};

interface OfferLike {
  price: number;
  unit: string;
  isActive: boolean;
  sourceId?: { name?: string; isActive?: boolean } | null;
}

/**
 * Détail de la moyenne : prix de chaque source ramené à l'unité de
 * l'ingrédient, puis moyenne simple. Ex : (16 + 8,5) ÷ 2 = 12,25 DT/l.
 */
export function averageComposition(offers: OfferLike[], unit: string) {
  const parts = offers
    .filter((o) => o.isActive && o.sourceId?.isActive !== false && o.price > 0)
    .map((o) => {
      // 1 unité de l'ingrédient = combien d'unités de l'offre ?
      const factor = convertQuantity(1, unit, o.unit);
      return factor === null
        ? null
        : { source: o.sourceId?.name || 'Source', price: Math.round(o.price * factor * 1e4) / 1e4 };
    })
    .filter((p): p is { source: string; price: number } => p !== null);
  const average = parts.length
    ? Math.round((parts.reduce((t, p) => t + p.price, 0) / parts.length) * 1e4) / 1e4
    : null;
  const short = (n: number) => String(parseFloat(n.toFixed(3)));
  const formula =
    parts.length === 0
      ? ''
      : parts.length === 1
        ? `${formatDT(parts[0].price, 3)} / ${unit}`
        : `(${parts.map((p) => short(p.price)).join(' + ')}) ÷ ${parts.length} = ${formatDT(average, 3)} / ${unit}`;
  return { parts, average, formula };
}

/** Valeur spéciale du sélecteur de source : ouvre « Nouvelle source ». */
export const NEW_SOURCE = '__new__';

export interface IngredientFormValues {
  name: string;
  pricePerUnit: string;
  sourceId: string;
  sourcePrice: string;
}

const positive = (v: string) => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) && n > 0;
};

/** Message d'erreur à afficher, ou null si le formulaire est valide. */
export function validateIngredientForm(
  form: IngredientFormValues,
  opts: { editing: boolean; fromSources: boolean }
): string | null {
  if (!form.name.trim()) {
    return 'Indiquez le nom de l’ingrédient';
  }
  if (!opts.editing && form.sourceId) {
    return positive(form.sourcePrice) ? null : 'Indiquez le prix chez cette source';
  }
  if (!opts.fromSources && !positive(form.pricePerUnit)) {
    return 'Indiquez un prix estimé (ou choisissez une source)';
  }
  return null;
}

/** Libellé sous le prix : d'où vient-il ? (moyenne de N sources / à compléter / à vérifier) */
export function priceBasisLabel(
  ingredient: { priceBasis?: string },
  summary?: PriceSummary | null
): { text: string; tone: 'ok' | 'warning' } {
  const n = summary?.comparableCount || 0;
  if (ingredient.priceBasis === 'sources' && n > 0) {
    return { text: n === 1 ? 'prix de 1 source' : `moyenne de ${n} sources`, tone: 'ok' };
  }
  return { text: 'Ajoutez une source', tone: 'warning' };
}

export function PriceBasisCaption({
  ingredient,
  summary,
}: {
  ingredient: { priceBasis?: string };
  summary?: PriceSummary | null;
}) {
  const basis = priceBasisLabel(ingredient, summary);
  const stale = summary?.staleCount || 0;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
      <Typography
        variant="caption"
        sx={{
          color: basis.tone === 'warning' ? color.warningDark : color.inkSoft,
          fontWeight: basis.tone === 'warning' ? 700 : 400,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        {basis.tone === 'warning' && <WarningAmber sx={{ fontSize: 14 }} />}
        {basis.text}
      </Typography>
      {stale > 0 && (
        <Typography
          variant="caption"
          sx={{
            color: color.warningDark,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          <Update sx={{ fontSize: 14 }} />
          {stale === 1 ? '1 prix à vérifier' : `${stale} prix à vérifier`}
        </Typography>
      )}
    </Box>
  );
}
