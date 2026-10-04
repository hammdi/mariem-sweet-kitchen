import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, Typography } from '@mui/material';
import {
  BarChart,
  Payments,
  HourglassTop,
  ReceiptLong,
  ShoppingBasket,
  Savings,
  RemoveCircleOutline,
  ShowChart,
  InfoOutlined,
  EmojiEvents,
  People,
  TrendingUp,
  TrendingDown,
} from '@mui/icons-material';
import PeriodFilter, { Range } from '../../components/admin/PeriodFilter';
import ChartCard from '../../components/charts/ChartCard';
import ColumnChart from '../../components/charts/ColumnChart';
import HBarChart from '../../components/charts/HBarChart';
import LineChart from '../../components/charts/LineChart';
import AnimatedNumber from '../../components/charts/AnimatedNumber';
import { CHART } from '../../components/charts/chartTheme';
import { useStatistics } from '../../hooks/useStatistics';
import { CASH_TYPE_LABELS, ORDER_STATUS_LABELS, PURCHASE_PAYMENT_LABELS, formatDT } from '../../utils/format';
import { bucketEnd } from '../../utils/dateTime';
import { PageHeader, SkeletonCards, SoftIcon } from '../../components/ui';
import { color, radius, Tone } from '../../theme/tokens';

const dt = (n: number) => formatDT(n);
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

/** Indicateur avec sa définition (pour ne jamais confondre CA, encaissé, caisse, achats). */
function Metric({
  icon,
  tone,
  title,
  definition,
  value,
  format = dt,
  lines,
  onClick,
}: {
  icon: ReactNode;
  tone: Tone;
  title: string;
  definition: string;
  value: number;
  format?: (n: number) => string;
  lines?: ReactNode[];
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      sx={{ p: 2, height: '100%', cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 200ms, transform 200ms', '&:hover': onClick ? { transform: 'translateY(-2px)' } : {} }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
        <SoftIcon tone={tone} size={38}>
          {icon}
        </SoftIcon>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.92rem' }}>{title}</Typography>
          <Typography variant="caption" sx={{ color: color.inkSoft, display: 'block', lineHeight: 1.3 }}>
            {definition}
          </Typography>
        </Box>
      </Box>
      <Typography sx={{ fontFamily: '"Plus Jakarta Sans", Inter, sans-serif', fontSize: { xs: '1.45rem', md: '1.65rem' }, fontWeight: 800, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
        <AnimatedNumber value={value} format={format} />
      </Typography>
      {lines?.map((l, i) => (
        <Typography key={i} variant="body2" sx={{ color: color.inkSoft, mt: 0.25 }} component="div">
          {l}
        </Typography>
      ))}
    </Card>
  );
}

function Row({ label, value, strong, valueColor }: { label: string; value: string; strong?: boolean; valueColor?: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.8, borderBottom: `1px solid ${color.border}`, '&:last-of-type': { borderBottom: 0 } }}>
      <Typography variant="body2" sx={{ color: color.inkSoft }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: strong ? 800 : 600, color: valueColor, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  );
}

const StatisticsPage = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState<Range | null>(null);
  const { stats: s, chart, loading } = useStatistics(range);

  const delta =
    s && s.sales.previous.count > 0 && s.sales.previous.revenue > 0
      ? Math.round(((s.sales.revenue - s.sales.previous.revenue) / s.sales.previous.revenue) * 100)
      : null;
  const linkRange = range ? `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}` : '';
  const statusOrder = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
  const hasOutflows = !!chart && [...chart.purchase, ...chart.expense, ...chart.refund].some((v) => v !== 0);
  const bucketWord = chart ? { hour: 'heure', day: 'jour', week: 'semaine', month: 'mois' }[chart.bucket] : '';
  const byStatus = (k: string) => (s ? (s.orders.byStatus[k] || 0) + (k === 'confirmed' ? s.orders.byStatus.paid || 0 : 0) : 0);

  return (
    <Box>
      <PageHeader
        title="Statistiques"
        subtitle="Vos ventes, votre caisse, vos achats et vos dépenses — chaque chiffre avec sa définition."
        icon={<BarChart />}
        tone="info"
        helpTour="understand-stats"
        helpFlow="stats"
      />

      <Card data-tour="stats-period" sx={{ p: { xs: 1.5, md: 2 }, mb: 2.5 }}>
        <PeriodFilter onChange={setRange} initial="7d" presets={['today', '7d', '30d', 'custom']} />
      </Card>

      {!s || !chart ? (
        <SkeletonCards count={4} height={140} />
      ) : (
        <Box sx={{ opacity: loading ? 0.55 : 1, transition: 'opacity 200ms' }}>
          {/* 1. Chiffres clés */}
          <Box data-tour="stats-kpis" sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0,1fr))', lg: 'repeat(4, minmax(0,1fr))' }, mb: 2.5 }}>
            <Metric
              icon={<ShowChart />}
              tone="primary"
              title="Chiffre d'affaires"
              definition="Ventes de la période, payées ou non"
              value={s.sales.revenue}
              lines={[
                plural(s.sales.count, 'vente'),
                delta !== null ? (
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: delta >= 0 ? color.successDark : color.dangerDark, fontWeight: 600 }}>
                    {delta >= 0 ? <TrendingUp sx={{ fontSize: 16 }} /> : <TrendingDown sx={{ fontSize: 16 }} />}
                    {delta >= 0 ? '+' : ''}
                    {delta} % vs période précédente
                  </Box>
                ) : (
                  'Pas de comparaison (période précédente vide)'
                ),
              ]}
            />
            <Metric icon={<Payments />} tone="success" title="Encaissements" definition="Argent déjà reçu sur ces ventes" value={s.sales.collected} lines={[plural(s.sales.paymentsCount, 'paiement')]} />
            <Metric
              icon={<HourglassTop />}
              tone="warning"
              title="À encaisser"
              definition="Vendu mais pas encore payé"
              value={s.sales.remaining}
              lines={[`${plural(s.sales.remainingCount, 'commande')} concernée${s.sales.remainingCount > 1 ? 's' : ''}`]}
              onClick={() => navigate('/admin/cash?tab=receivables')}
            />
            <Metric
              icon={<Savings />}
              tone="violet"
              title="Liquidité"
              definition="Argent dans la caisse en fin de période"
              value={s.cash.theoreticalBalance}
              lines={[`+${dt(s.cash.totalIn)} entrées · −${dt(s.cash.totalOut)} sorties`]}
              onClick={() => navigate(`/admin/cash${linkRange}`)}
            />
            <Metric icon={<ReceiptLong />} tone="rose" title="Commandes" definition="Prévues sur la période, tous statuts" value={s.orders.total} format={(n) => String(Math.round(n))} lines={[`${plural(byStatus('ready'), 'prête')} · ${plural(byStatus('delivered'), 'remise')} · ${plural(s.orders.cancelled, 'annulée')}`]} />
            <Metric icon={<EmojiEvents />} tone="info" title="Panier moyen" definition="Chiffre d'affaires ÷ nombre de ventes" value={s.sales.averageBasket ?? 0} lines={[s.sales.averageBasket === null ? 'Aucune vente' : `sur ${plural(s.sales.count, 'vente')}`]} />
            <Metric
              icon={<ShoppingBasket />}
              tone="success"
              title="Achats"
              definition="Ingrédients achetés, tous moyens de paiement"
              value={s.purchases.total}
              lines={[
                plural(s.purchases.count, 'achat') + (s.purchases.unpriced ? ` (${s.purchases.unpriced} sans prix)` : ''),
                `Caisse ${dt(s.purchases.byMethod.cash_register?.total || 0)} · hors caisse ${dt(s.purchases.total - (s.purchases.byMethod.cash_register?.total || 0))}`,
              ]}
            />
            <Metric
              icon={<RemoveCircleOutline />}
              tone="danger"
              title="Dépenses"
              definition="Emballages, gaz… (hors ingrédients), tous moyens"
              value={s.expenses?.total || 0}
              lines={[
                plural(s.expenses?.count || 0, 'dépense'),
                `Caisse ${dt(s.expenses?.byMethod.cash_register?.total || 0)} · hors caisse ${dt((s.expenses?.total || 0) - (s.expenses?.byMethod.cash_register?.total || 0))}`,
              ]}
            />
          </Box>

          {/* Rappel : vendu ≠ caisse */}
          <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', p: 1.75, mb: 2.5, borderRadius: `${radius.md}px`, bgcolor: color.infoSoft, border: `1px solid ${color.infoBorder}` }}>
            <InfoOutlined sx={{ color: color.info, mt: '2px' }} />
            <Typography variant="body2" sx={{ color: color.infoDark }}>
              <strong>Vendu n’est pas encaissé.</strong> Le chiffre d’affaires compte les commandes confirmées, payées ou non. La caisse ne bouge qu’au paiement. Achats et dépenses payés avec votre argent personnel comptent ici, mais ne sortent pas de la caisse.
            </Typography>
          </Box>

          {/* 2. Graphiques */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0,1fr))' }, mb: 2 }}>
            <Box sx={{ gridColumn: { lg: '1 / -1' } }}>
              <ChartCard
                key={`ca-${range?.from}-${range?.to}`}
                tourId="stats-sales-chart"
                icon={<ShowChart />}
                title="Évolution du chiffre d'affaires"
                subtitle={`Par ${bucketWord} · cliquez sur une colonne pour voir ces ventes`}
                empty={s.sales.count === 0}
                loading={loading}
                table={{
                  columns: ['Période', "Chiffre d'affaires", 'Ventes'],
                  rows: chart.buckets.map((_, i) => [chart.longLabels[i], dt(chart.revenue[i]), chart.counts[i]]).filter((r) => r[2] !== 0),
                }}
              >
                <ColumnChart
                  labels={chart.labels}
                  longLabels={chart.longLabels}
                  series={[{ key: 'ca', label: "chiffre d'affaires", color: CHART.sales, values: chart.revenue }]}
                  format={dt}
                  tooltipExtra={(i) => plural(chart.counts[i], 'vente')}
                  onSelect={(i) =>
                    navigate(`/admin/orders?dateField=scheduled&from=${encodeURIComponent(chart.buckets[i])}&to=${encodeURIComponent(bucketEnd(chart.buckets[i], chart.bucket))}`)
                  }
                />
              </ChartCard>
            </Box>
            <ChartCard
              key={`vs-${range?.from}-${range?.to}`}
              icon={<Payments />}
              title="Ventes vs encaissements"
              subtitle="Vendu (date prévue) et argent reçu (date du paiement)"
              legend={[
                { label: 'Ventes', color: CHART.sales },
                { label: 'Encaissé (net des remboursements)', color: CHART.payments },
              ]}
              empty={s.sales.count === 0 && chart.payments.every((v) => v === 0)}
              loading={loading}
              table={{
                columns: ['Période', 'Ventes', 'Encaissé'],
                rows: chart.buckets.map((_, i) => [chart.longLabels[i], dt(chart.revenue[i]), dt(chart.payments[i])]).filter((_, i) => chart.revenue[i] !== 0 || chart.payments[i] !== 0),
              }}
            >
              <ColumnChart
                mode="grouped"
                labels={chart.labels}
                longLabels={chart.longLabels}
                series={[
                  { key: 'v', label: 'ventes', color: CHART.sales, values: chart.revenue },
                  { key: 'e', label: 'encaissé', color: CHART.payments, values: chart.payments },
                ]}
                format={dt}
              />
            </ChartCard>
            <Box data-tour="stats-cash">
              <ChartCard
                key={`bal-${range?.from}-${range?.to}`}
                icon={<Savings />}
                title="Évolution de la caisse"
                subtitle="Liquidité à la fin de chaque créneau (tous mouvements de caisse)"
                empty={s.cash.movementsCount === 0}
                loading={loading}
                table={{
                  columns: ['Période', 'Liquidité'],
                  rows: chart.buckets.map((_, i) => [chart.longLabels[i], dt(chart.balance[i])]),
                }}
              >
                <LineChart labels={chart.labels} longLabels={chart.longLabels} values={chart.balance} color={CHART.payments} format={dt} ariaLabel="Évolution de la liquidité de la caisse" />
              </ChartCard>
            </Box>
            <Box data-tour="stats-purchases">
              <ChartCard
                key={`out-${range?.from}-${range?.to}`}
                icon={<ShoppingBasket />}
                title="Sorties de caisse"
                subtitle="Achats, dépenses et remboursements payés avec la caisse"
                legend={[
                  { label: CASH_TYPE_LABELS.purchase, color: CHART.purchase },
                  { label: 'Dépenses', color: CHART.expense },
                  { label: 'Remboursements', color: CHART.refund },
                ]}
                empty={!hasOutflows}
                loading={loading}
                table={{
                  columns: ['Période', 'Achats', 'Dépenses', 'Remboursements'],
                  rows: chart.buckets
                    .map((_, i) => [chart.longLabels[i], dt(chart.purchase[i]), dt(chart.expense[i]), dt(chart.refund[i])])
                    .filter((_, i) => chart.purchase[i] || chart.expense[i] || chart.refund[i]),
                }}
              >
                <ColumnChart
                  mode="stacked"
                  labels={chart.labels}
                  longLabels={chart.longLabels}
                  series={[
                    { key: 'p', label: 'achats', color: CHART.purchase, values: chart.purchase },
                    { key: 'x', label: 'dépenses', color: CHART.expense, values: chart.expense },
                    { key: 'r', label: 'remboursements', color: CHART.refund, values: chart.refund },
                  ]}
                  format={dt}
                />
              </ChartCard>
            </Box>
            <Card sx={{ p: 2.5 }}>
              <Typography sx={{ fontWeight: 700, mb: 0.25 }}>Achats et dépenses par moyen de paiement</Typography>
              <Typography variant="caption" sx={{ color: color.inkSoft }}>
                Seuls ceux payés avec la caisse sont des sorties de caisse
              </Typography>
              <Box sx={{ mt: 1.5 }}>
                {(['cash_register', 'personal', 'bank', 'other', 'unknown'] as const)
                  .filter((m) => (s.purchases.byMethod[m]?.total || 0) + (s.expenses?.byMethod[m]?.total || 0) > 0)
                  .map((m) => (
                    <Row
                      key={m}
                      label={PURCHASE_PAYMENT_LABELS[m]}
                      value={`achats ${dt(s.purchases.byMethod[m]?.total || 0)} · dépenses ${dt(s.expenses?.byMethod[m]?.total || 0)}`}
                    />
                  ))}
                {s.purchases.total + (s.expenses?.total || 0) === 0 && (
                  <Typography variant="body2" sx={{ color: color.inkSoft, py: 2 }}>
                    Aucun achat ni dépense sur cette période.
                  </Typography>
                )}
              </Box>
            </Card>
          </Box>

          {/* 3. Produits, commandes, clients */}
          <Box data-tour="stats-top" sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0,1fr))' }, mb: 2 }}>
            <ChartCard
              key={`prod-${range?.from}-${range?.to}`}
              icon={<EmojiEvents />}
              title="Produits les plus vendus"
              subtitle="Chiffre d'affaires par recette (quantité au survol)"
              empty={s.topProducts.length === 0}
              loading={loading}
              table={{ columns: ['Produit', 'Quantité', "Chiffre d'affaires"], rows: s.topProducts.map((p) => [p.name, p.quantity, dt(p.revenue)]) }}
            >
              <HBarChart
                color={CHART.sales}
                rows={s.topProducts.map((p) => ({
                  key: p.recipeId,
                  label: p.name,
                  value: p.revenue,
                  valueLabel: `${dt(p.revenue)} · ${p.quantity}×`,
                  tooltip: `${p.name} : ${p.quantity} vendu(s) — ${dt(p.revenue)}. Cliquer pour ouvrir la recette`,
                  onClick: () => navigate(`/admin/recipes/${p.recipeId}/edit`),
                }))}
              />
            </ChartCard>
            <ChartCard
              key={`status-${range?.from}-${range?.to}`}
              icon={<ReceiptLong />}
              title="Activité des commandes"
              subtitle="Commandes prévues sur la période, par avancement"
              empty={s.orders.total === 0}
              loading={loading}
              table={{ columns: ['Avancement', 'Commandes'], rows: statusOrder.map((k) => [ORDER_STATUS_LABELS[k].label, byStatus(k)]) }}
            >
              <HBarChart
                color={CHART.neutral}
                rows={statusOrder.map((k) => ({
                  key: k,
                  label: ORDER_STATUS_LABELS[k].label,
                  value: byStatus(k),
                  valueLabel: String(byStatus(k)),
                  onClick: () => navigate(`/admin/orders?status=${k}`),
                  tooltip: 'Cliquer pour voir ces commandes',
                }))}
              />
            </ChartCard>
            <Card sx={{ p: 2.5, gridColumn: { lg: '1 / -1' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
                <People sx={{ color: color.primary }} />
                <Typography sx={{ fontWeight: 700 }}>Activité clients</Typography>
              </Box>
              <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '5fr 7fr' } }}>
                <Box>
                  <Row label="Clients actifs" value={String(s.clients.active)} strong />
                  <Row label="Particuliers" value={`${plural(s.clients.individual.count, 'commande')} · ${dt(s.clients.individual.revenue)}`} />
                  <Row label="Cafés" value={`${plural(s.clients.cafe.count, 'commande')} · ${dt(s.clients.cafe.revenue)}`} />
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Clients avec le plus de commandes
                  </Typography>
                  {s.clients.top.length === 0 && (
                    <Typography variant="body2" sx={{ color: color.inkSoft }}>
                      Aucune vente sur cette période.
                    </Typography>
                  )}
                  {s.clients.top.map((c, i) => (
                    <Box
                      key={`${c.name}-${i}`}
                      onClick={() => c.clientId && navigate(`/admin/clients/${c.clientId}`)}
                      sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.6, px: 0.75, borderRadius: `${radius.xs}px`, cursor: c.clientId ? 'pointer' : 'default', '&:hover': c.clientId ? { bgcolor: color.surfaceMuted } : {} }}
                    >
                      <Typography variant="body2" noWrap>
                        {i + 1}. {c.name}
                      </Typography>
                      <Typography variant="body2" sx={{ color: color.inkSoft, whiteSpace: 'nowrap' }}>
                        {plural(c.count, 'commande')} · {dt(c.revenue)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Card>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', color: color.inkSoft }}>
            <InfoOutlined sx={{ fontSize: 18, mt: '2px' }} />
            <Typography variant="body2">
              Pas de « bénéfice » affiché : toutes les charges (électricité réelle, temps…) ne sont pas enregistrées, un tel chiffre serait trompeur. Les prix de vente incluent déjà la marge réglée dans les paramètres.
            </Typography>
          </Box>
          <Button variant="outlined" sx={{ mt: 2 }} onClick={() => navigate(`/admin/orders${linkRange}${linkRange ? '&dateField=scheduled' : ''}`)}>
            Voir les commandes de la période
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default StatisticsPage;
