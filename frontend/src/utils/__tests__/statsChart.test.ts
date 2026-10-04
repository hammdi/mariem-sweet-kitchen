import { describe, expect, it } from 'vitest';
import { buildChart, Stats } from '../statsChart';

const base = (over: Partial<Stats> = {}): Stats =>
  ({
    period: { from: '2026-10-01T23:00:00.000Z', to: '2026-10-04T23:00:00.000Z', bucket: 'day' },
    sales: { revenue: 0, count: 0, collected: 0, paymentsCount: 0, remaining: 0, remainingCount: 0, averageBasket: null, previous: { revenue: 0, count: 0 } },
    cash: { openingBalance: 100, totalIn: 0, totalOut: 0, theoreticalBalance: 100, movementsCount: 0 },
    purchases: { total: 0, count: 0, unpriced: 0, byMethod: {} },
    expenses: { total: 0, count: 0, byMethod: {} },
    orders: { total: 0, byStatus: {}, ready: 0, delivered: 0, cancelled: 0 },
    series: { sales: [], payments: [], cashNet: [], outflows: [] },
    topProducts: [],
    clients: { active: 0, individual: { count: 0, revenue: 0 }, cafe: { count: 0, revenue: 0 }, top: [] },
    ...over,
  }) as Stats;

describe('séries des graphiques', () => {
  it('complète les jours vides et cumule la liquidité depuis le solde initial', () => {
    const c = buildChart(
      base({
        series: {
          sales: [{ bucket: '2026-10-02T23:00:00.000Z', revenue: 40, count: 1 }],
          payments: [],
          cashNet: [
            { bucket: '2026-10-01T23:00:00.000Z', amount: 25 },
            { bucket: '2026-10-03T23:00:00.000Z', amount: -10 },
          ],
          outflows: [],
        },
      })
    );
    expect(c.buckets).toHaveLength(3);
    expect(c.revenue).toEqual([0, 40, 0]);
    expect(c.balance).toEqual([125, 125, 115]); // 100 + 25, inchangé, − 10
  });
});
