import { Bucket, bucketLabel, bucketStarts } from './dateTime';

/** Réponse de GET /api/statistics (définitions : voir statisticsService côté serveur). */
export interface Stats {
  period: { from: string; to: string; bucket: Bucket };
  sales: {
    revenue: number;
    count: number;
    collected: number;
    paymentsCount: number;
    remaining: number;
    remainingCount: number;
    averageBasket: number | null;
    previous: { revenue: number; count: number };
  };
  cash: {
    openingBalance: number;
    totalIn: number;
    totalOut: number;
    theoreticalBalance: number;
    movementsCount: number;
  };
  purchases: {
    total: number;
    count: number;
    unpriced: number;
    byMethod: Record<string, { total: number; count: number }>;
  };
  expenses: { total: number; count: number; byMethod: Record<string, { total: number; count: number }> };
  orders: {
    total: number;
    byStatus: Record<string, number>;
    ready: number;
    delivered: number;
    cancelled: number;
  };
  series: {
    sales: { bucket: string; revenue: number; count: number }[];
    payments: { bucket: string; amount: number }[];
    cashNet: { bucket: string; amount: number }[];
    outflows: { bucket: string; type: string; amount: number }[];
  };
  topProducts: { recipeId: string; name: string; quantity: number; revenue: number }[];
  clients: {
    active: number;
    individual: { count: number; revenue: number };
    cafe: { count: number; revenue: number };
    top: { clientId?: string; name: string; count: number; revenue: number }[];
  };
}

export interface StatsChart {
  bucket: Bucket;
  buckets: string[];
  labels: string[];
  longLabels: string[];
  revenue: number[];
  counts: number[];
  payments: number[];
  purchase: number[];
  expense: number[];
  refund: number[];
  /** liquidité de la caisse à la fin de chaque créneau */
  balance: number[];
}

/** Séries complétées avec les créneaux vides (heure locale = mêmes clés que le serveur). */
export function buildChart(stats: Stats): StatsChart {
  const { from, to, bucket } = stats.period;
  const buckets = bucketStarts(from, to, bucket);
  const key = (b: string) => new Date(b).toISOString();
  const sales = new Map(stats.series.sales.map((s) => [key(s.bucket), s]));
  const pays = new Map(stats.series.payments.map((p) => [key(p.bucket), p.amount]));
  const net = new Map((stats.series.cashNet || []).map((p) => [key(p.bucket), p.amount]));
  const out = (type: string) =>
    buckets.map((b) =>
      stats.series.outflows
        .filter((o) => o.type === type && key(o.bucket) === b)
        .reduce((s, o) => s + o.amount, 0)
    );
  let running = stats.cash.openingBalance;
  const balance = buckets.map((b) => {
    running = Math.round((running + (net.get(b) || 0)) * 1000) / 1000;
    return running;
  });
  return {
    bucket,
    buckets,
    labels: buckets.map((b) => bucketLabel(b, bucket)),
    longLabels: buckets.map((b) => bucketLabel(b, bucket, true)),
    revenue: buckets.map((b) => sales.get(b)?.revenue || 0),
    counts: buckets.map((b) => sales.get(b)?.count || 0),
    payments: buckets.map((b) => pays.get(b) || 0),
    purchase: out('purchase'),
    expense: out('expense'),
    refund: out('order_refund'),
    balance,
  };
}

