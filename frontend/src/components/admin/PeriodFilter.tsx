import { useEffect, useState } from 'react';
import { Box, Chip } from '@mui/material';
import DateTimeField from '../common/DateTimeField';
import { customRange, periodRange, toLocalParts } from '../../utils/dateTime';

export type PeriodKey = 'today' | 'week' | 'month' | '7d' | '30d' | 'custom';
export interface Range {
  from: string;
  to: string;
}

const LABELS: Record<PeriodKey, string> = {
  today: "Aujourd'hui",
  week: 'Cette semaine',
  month: 'Ce mois',
  '7d': '7 jours',
  '30d': '30 jours',
  custom: 'Personnalisée',
};

// Filtre de periode commun (Ventes, Caisse, Statistiques) — bornes calculees en heure locale
export default function PeriodFilter({
  onChange,
  initial = 'today',
  presets = ['today', 'week', 'month', 'custom'],
  initialRange,
}: {
  onChange: (range: Range) => void;
  initial?: PeriodKey;
  presets?: PeriodKey[];
  // periode imposee (ex: lien depuis un graphique) : ouvre "Personnalisee" sur ces bornes
  initialRange?: Range | null;
}) {
  const [period, setPeriod] = useState<PeriodKey>(initialRange ? 'custom' : initial);
  const [customFrom, setCustomFrom] = useState<string | null>(initialRange?.from || null);
  const [customTo, setCustomTo] = useState<string | null>(() => {
    if (!initialRange) return null;
    const last = new Date(initialRange.to);
    last.setMilliseconds(last.getMilliseconds() - 1); // "au" est inclus
    return last.toISOString();
  });

  useEffect(() => {
    if (period !== 'custom') {
      onChange(periodRange(period));
    } else if (initialRange && customFrom === initialRange.from) {
      onChange(initialRange); // bornes exactes (peut etre une heure precise)
    } else if (customFrom && customTo) {
      onChange(customRange(toLocalParts(customFrom).date, toLocalParts(customTo).date));
    }
    // onChange / initialRange viennent du parent : seule la saisie de période doit relancer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customFrom, customTo]);

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {presets.map((key) => (
          <Chip
            key={key}
            label={LABELS[key]}
            color={period === key ? 'primary' : 'default'}
            variant={period === key ? 'filled' : 'outlined'}
            onClick={() => setPeriod(key)}
            clickable
          />
        ))}
      </Box>
      {period === 'custom' && (
        <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
          <DateTimeField label="Du" dateOnly value={customFrom} onChange={setCustomFrom} />
          <DateTimeField label="Au (inclus)" dateOnly value={customTo} onChange={setCustomTo} />
        </Box>
      )}
    </Box>
  );
}
