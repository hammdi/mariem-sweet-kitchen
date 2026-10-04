import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import { buildChart, Stats } from '../utils/statsChart';

export type { Stats, StatsChart } from '../utils/statsChart';

/** Charge les statistiques d'une période ; ignore les réponses dépassées. */
export function useStatistics(range: { from: string; to: string } | null) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (!range) return;
    const id = ++requestId.current;
    setLoading(true);
    api
      .get('/statistics', {
        params: { ...range, tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
      })
      .then((res) => id === requestId.current && setStats(res.data.data))
      .catch(() => {
        /* toast intercepteur */
      })
      .finally(() => id === requestId.current && setLoading(false));
  }, [range?.from, range?.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const chart = useMemo(() => (stats ? buildChart(stats) : null), [stats]);
  return { stats, chart, loading };
}
