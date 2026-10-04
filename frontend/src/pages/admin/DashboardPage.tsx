import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, ButtonBase, Card, Skeleton, Typography } from '@mui/material';
import {
  AccountBalanceWallet,
  Add,
  ArrowForward,
  BarChart,
  CheckCircle,
  ContentPasteOutlined,
  DescriptionOutlined,
  FavoriteBorder,
  Inventory2,
  NoteAdd,
  ShoppingCart,
  ViewInAr,
  WarningAmberRounded,
  AssignmentOutlined,
  TaskAltOutlined,
} from '@mui/icons-material';
import { useAdminData } from '../../context/AdminDataContext';
import { useHelp } from '../../help/HelpContext';
import { useStatistics } from '../../hooks/useStatistics';
import ActionRequiredSection from '../../components/admin/ActionRequiredSection';
import TopbarKpis from '../../components/layout/TopbarKpis';
import LineChart from '../../components/charts/LineChart';
import { CHART } from '../../components/charts/chartTheme';
import AnimatedNumber from '../../components/charts/AnimatedNumber';
import Illustration from '../../components/illustrations/Pastry';
import { EmptyState, OrderStatusBadge, PaymentStatusBadge, QuickActionCard, Reveal, SectionCard, StatusBadge } from '../../components/ui';
import { CASH_TYPE_LABELS, formatDT, formatQty } from '../../utils/format';
import { periodRange } from '../../utils/dateTime';
import { color, font, radius } from '../../theme/tokens';

type Period = 'today' | 'week' | 'month';
const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Aujourd’hui' },
  { value: 'week', label: 'Cette semaine' },
  { value: 'month', label: 'Ce mois' },
];

const greeting = () => {
  const h = new Date().getHours();
  return h >= 5 && h < 18 ? 'Bonjour' : 'Bonsoir';
};

function SummaryRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, py: 0.7 }}>
      <Typography variant="body2" sx={{ color: color.inkSoft, whiteSpace: 'nowrap' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, color: valueColor || color.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {value}
      </Typography>
    </Box>
  );
}

/** Pastilles de période (orange plein = actif), comme la référence. */
function PeriodPills({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <Box role="radiogroup" aria-label="Période" sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
      {PERIODS.map((p) => {
        const active = p.value === value;
        return (
          <ButtonBase
            key={p.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(p.value)}
            sx={{
              px: 1.75,
              py: 0.7,
              borderRadius: `${radius.pill}px`,
              fontSize: '0.8rem',
              fontWeight: 600,
              border: `1px solid ${active ? color.primary : color.borderStrong}`,
              bgcolor: active ? color.primary : color.surface,
              color: active ? '#fff' : color.ink,
              transition: 'all 140ms',
              '&:hover': { borderColor: color.primary },
            }}
          >
            {p.label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}

const DashboardPage = () => {
  const navigate = useNavigate();
  const { summary: s, user } = useAdminData();
  const { startTour } = useHelp();
  const [period, setPeriod] = useState<Period>('today');
  const range = useMemo(() => periodRange(period), [period]);
  const { stats, chart, loading } = useStatistics(range);

  const name = user?.firstName || '';
  const blocked = s?.orders.withMissingIngredients || 0;

  return (
    <Box>
      {/* Indicateurs du jour : dans la barre du haut sur ordinateur, ici sur téléphone */}
      <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 2 }}>
        <TopbarKpis compact />
      </Box>

      {/* 1. Accueil + citation */}
      <Reveal>
        <Box data-tour="dash-greeting" sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 2, alignItems: { lg: 'center' }, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
            <Box aria-hidden sx={{ fontSize: { xs: 36, md: 46 }, lineHeight: 1 }}>
              ☀️
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h4" component="h1" sx={{ fontSize: { xs: '1.6rem', md: '2rem' }, fontWeight: 800 }}>
                {greeting()}
                {name ? ` ${name}` : ''}
              </Typography>
              <Typography sx={{ color: color.inkSoft, fontSize: { xs: '1rem', md: '1.1rem' } }}>Que voulez-vous faire aujourd&apos;hui ?</Typography>
              {s && (blocked > 0 || s.stock.purchasesNeeded > 0) && (
                <Typography variant="body2" sx={{ mt: 0.5, color: color.dangerDark, fontWeight: 600 }}>
                  {blocked > 0 ? `${blocked} commande${blocked > 1 ? 's' : ''} bloquée${blocked > 1 ? 's' : ''} par un ingrédient manquant` : ''}
                  {blocked > 0 && s.stock.purchasesNeeded > 0 ? ' · ' : ''}
                  {s.stock.purchasesNeeded > 0 ? `${s.stock.purchasesNeeded} ingrédient${s.stock.purchasesNeeded > 1 ? 's' : ''} à acheter` : ''}
                </Typography>
              )}
            </Box>
          </Box>
          <Box
            sx={{
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center',
              gap: 2,
              px: 3,
              py: 2,
              borderRadius: `${radius.lg}px`,
              bgcolor: color.primarySoft,
              border: `1px solid ${color.primaryBorder}`,
              flex: { lg: '0 1 480px', xl: '0 1 580px' },
            }}
          >
            <Typography sx={{ fontFamily: font.brand, fontStyle: 'italic', color: color.primaryDark, fontSize: '1.05rem', flex: 1 }}>
              “Un petit gâteau peut rendre une grande journée encore meilleure.”
            </Typography>
            <FavoriteBorder sx={{ color: color.rose, fontSize: 22 }} />
          </Box>
        </Box>
      </Reveal>

      {/* 2. Actions rapides */}
      <Reveal delay={60}>
        <Box
          data-tour="dash-quick-actions"
          sx={{
            display: 'grid',
            gap: { xs: 1.25, md: 1.75 },
            gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', sm: 'repeat(3, minmax(0,1fr))', lg: 'repeat(6, minmax(0,1fr))' },
            mb: 3,
          }}
        >
          <QuickActionCard icon={<NoteAdd />} title="Nouvelle commande" tone="primary" onClick={() => navigate('/admin/orders/new')} />
          <QuickActionCard
            icon={<AssignmentOutlined />}
            title="Voir les commandes"
            tone="rose"
            status={s?.orders.pending ? <StatusBadge label={String(s.orders.pending)} tone="danger" /> : undefined}
            onClick={() => navigate('/admin/orders')}
          />
          <QuickActionCard
            icon={<ViewInAr />}
            title="Gérer le stock"
            tone="success"
            status={s?.stock.lowStock ? <StatusBadge label={`${s.stock.lowStock} bas`} tone="warning" /> : undefined}
            onClick={() => navigate('/admin/stock')}
          />
          <QuickActionCard
            icon={<ShoppingCart />}
            title="Liste de courses"
            tone="warning"
            status={s?.stock.purchasesNeeded ? <StatusBadge label={String(s.stock.purchasesNeeded)} tone="warning" /> : undefined}
            onClick={() => navigate('/admin/shopping-list')}
          />
          <QuickActionCard icon={<AccountBalanceWallet />} title="Caisse" tone="violet" onClick={() => navigate('/admin/cash')} />
          <QuickActionCard icon={<BarChart />} title="Statistiques" tone="info" onClick={() => navigate('/admin/statistics')} />
        </Box>
      </Reveal>

      {/* 3. Chiffre d'affaires + 4. Commandes du jour */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 7fr) minmax(0, 5fr)' }, mb: 2 }}>
        <Reveal delay={120}>
          <SectionCard tourId="dash-revenue" title="Chiffre d'affaires" icon={<BarChart />} sx={{ height: '100%' }} action={<PeriodPills value={period} onChange={setPeriod} />}>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 3fr) minmax(200px, 2fr)' }, alignItems: 'start', opacity: loading ? 0.6 : 1, transition: 'opacity 200ms' }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontFamily: font.heading, fontWeight: 800, fontSize: { xs: '2rem', md: '2.4rem' }, lineHeight: 1.1, mb: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {stats ? <AnimatedNumber value={stats.sales.revenue} format={(n) => formatDT(n)} /> : <Skeleton width={160} />}
                </Typography>
                {chart ? (
                  <LineChart
                    key={`${range.from}-${period}`}
                    labels={chart.labels}
                    longLabels={chart.longLabels}
                    values={chart.revenue}
                    color={CHART.sales}
                    format={(n) => formatDT(n)}
                    tooltipExtra={(i) => `${chart.counts[i]} vente${chart.counts[i] > 1 ? 's' : ''}`}
                    height={180}
                    dots
                    ariaLabel="Chiffre d'affaires de la période"
                  />
                ) : (
                  <Skeleton variant="rounded" height={180} />
                )}
              </Box>
              <Box sx={{ p: { xs: 2, lg: 1.5, xl: 2 }, borderRadius: `${radius.md}px`, bgcolor: color.surfaceMuted, border: `1px solid ${color.border}` }}>
                {stats ? (
                  <>
                    <SummaryRow label="Ventes (total)" value={formatDT(stats.sales.revenue)} />
                    <SummaryRow label="Encaissements" value={formatDT(stats.sales.collected)} valueColor={color.successDark} />
                    <SummaryRow label="À encaisser" value={formatDT(stats.sales.remaining)} valueColor={color.primary} />
                    <Box sx={{ height: 12 }} />
                    <SummaryRow label="Commandes" value={String(stats.sales.count)} />
                    <SummaryRow label="Panier moyen" value={formatDT(stats.sales.averageBasket ?? 0)} />
                  </>
                ) : (
                  <Skeleton variant="rounded" height={170} />
                )}
              </Box>
            </Box>
          </SectionCard>
        </Reveal>

        <Reveal delay={160}>
          <SectionCard tourId="dash-orders" title="Commandes du jour" icon={<TaskAltOutlined />} onAction={() => navigate('/admin/orders')} actionLabel="Voir toutes" sx={{ height: '100%' }}>
            {!s ? (
              <Skeleton variant="rounded" height={200} />
            ) : (s.orders.todayList || []).length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <Illustration name="cloche" sx={{ width: 72, height: 58, mb: 0.5 }} />
                <Typography sx={{ fontWeight: 700, color: color.inkSoft, fontSize: '1.02rem' }}>Aucune commande aujourd&apos;hui</Typography>
                <Typography variant="body2" sx={{ color: color.inkSoft }}>
                  Les nouvelles commandes apparaîtront ici.
                </Typography>
                <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/admin/orders/new')} sx={{ mt: 1.5, px: 3 }}>
                  Nouvelle commande
                </Button>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {(s.orders.todayList || []).map((o) => (
                  <ButtonBase
                    key={o._id}
                    onClick={() => navigate(`/admin/orders/${o._id}`)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      p: 1.1,
                      borderRadius: `${radius.md}px`,
                      border: `1px solid ${o.missingIngredients ? color.dangerBorder : color.border}`,
                      bgcolor: o.missingIngredients ? color.dangerSoft : color.surface,
                      textAlign: 'left',
                      '&:hover': { borderColor: color.borderStrong },
                    }}
                  >
                    <Typography sx={{ width: 46, flexShrink: 0, fontWeight: 800, fontSize: '0.92rem', fontFamily: font.heading, textAlign: 'center' }}>
                      {o.date ? new Date(o.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }} noWrap>
                        {o.orderRef} · {o.clientName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: color.inkSoft, display: 'block' }} noWrap>
                        {o.missingIngredients ? '⚠️ ingrédient manquant · ' : ''}
                        {o.items.join(', ')}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                      <OrderStatusBadge status={o.status} />
                      <PaymentStatusBadge status={o.paymentStatus} />
                    </Box>
                  </ButtonBase>
                ))}
              </Box>
            )}
          </SectionCard>
        </Reveal>
      </Box>

      {/* 5. Stock · 6. Caisse · 7. Action requise */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0,1fr))', lg: 'repeat(3, minmax(0,1fr))' }, mb: 2 }}>
        <Reveal delay={200}>
          <SectionCard tourId="dash-stock" title="Stock à surveiller" icon={<Inventory2 />} onAction={() => navigate('/admin/stock')} actionLabel={`Voir tout (${s?.stock.lowStock ?? 0})`} sx={{ height: '100%' }}>
            {!s ? (
              <Skeleton variant="rounded" height={140} />
            ) : (s.stock.lowStockItems || []).length === 0 ? (
              <Box sx={{ textAlign: 'center', p: 3, borderRadius: `${radius.md}px`, bgcolor: color.successSoft }}>
                <CheckCircle sx={{ color: color.success, fontSize: 44 }} />
                <Typography sx={{ fontWeight: 700, color: color.successDark, mt: 1 }}>Tout est OK !</Typography>
                <Typography variant="body2" sx={{ color: color.inkSoft }}>
                  Aucun ingrédient sous le seuil pour le moment.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {(s.stock.lowStockItems || []).map((i) => {
                  const pct = Math.max(0, Math.min(100, (i.stockQuantity / (i.minStock || 1)) * 100));
                  return (
                    <Box key={i._id}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                          {i.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: i.stockQuantity <= 0 ? color.dangerDark : color.warningDark, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {formatQty(i.stockQuantity)} / {formatQty(i.minStock)} {i.unit}
                        </Typography>
                      </Box>
                      <Box sx={{ height: 6, borderRadius: 3, bgcolor: color.bgSubtle, mt: 0.5, overflow: 'hidden' }}>
                        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: i.stockQuantity <= 0 ? color.danger : color.warning, borderRadius: 3, transition: 'width 600ms' }} />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </SectionCard>
        </Reveal>

        <Reveal delay={240}>
          <SectionCard tourId="dash-cash" title="Derniers mouvements de caisse" icon={<AccountBalanceWallet />} tone="neutral" onAction={() => navigate('/admin/cash')} sx={{ height: '100%' }}>
            {!s ? (
              <Skeleton variant="rounded" height={140} />
            ) : (s.recentMovements || []).length === 0 ? (
              <EmptyState compact icon={<DescriptionOutlined />} title="Aucun mouvement" description="Les entrées, sorties et achats apparaîtront ici." />
            ) : (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, p: 1.25, borderRadius: `${radius.md}px`, bgcolor: color.surfaceMuted }}>
                  <Typography variant="body2" sx={{ color: color.inkSoft }}>
                    Liquidité actuelle
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>
                    {formatDT(s.cashBalance)}
                  </Typography>
                </Box>
                {(s.recentMovements || []).map((m) => {
                  const isIn = m.direction === 'in';
                  return (
                    <Box key={m._id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 0.9, borderBottom: `1px solid ${color.border}`, '&:last-of-type': { borderBottom: 0 } }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: isIn ? color.success : color.danger, flexShrink: 0 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                          {m.reversalOf ? 'Correction' : CASH_TYPE_LABELS[m.type] || m.type}
                          {m.orderNumber ? ` · CMD-${m.orderNumber}` : ''}
                        </Typography>
                        <Typography variant="caption" sx={{ color: color.inkSoft }} noWrap component="div">
                          {new Date(m.occurredAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          {m.description ? ` · ${m.description}` : ''}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: isIn ? color.successDark : color.dangerDark, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {isIn ? '+' : '−'}
                        {formatDT(m.amount)}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            )}
          </SectionCard>
        </Reveal>

        <Reveal delay={280}>
          <SectionCard tourId="dash-action" title="Commandes nécessitant une action" icon={<WarningAmberRounded />} tone="danger" onAction={() => navigate('/admin/shopping-list')} sx={{ height: '100%' }}>
            <ActionRequiredSection
              limit={4}
              empty={
                <EmptyState compact icon={<ContentPasteOutlined />} title="Aucune commande en attente" description="Les commandes avec ingrédients manquants ou urgentes apparaîtront ici." />
              }
            />
          </SectionCard>
        </Reveal>
      </Box>

      {/* 8. Besoin d'aide ? */}
      <Reveal delay={320}>
        <Card
          data-tour="dash-help"
          sx={{
            position: 'relative',
            overflow: 'hidden',
            p: { xs: 2, md: 2.5 },
            pr: { md: 22 },
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { sm: 'center' },
            gap: 2,
            background: `linear-gradient(110deg, ${color.primarySoft} 0%, ${color.cream} 75%)`,
            borderColor: color.primaryBorder,
          }}
        >
          <Box aria-hidden sx={{ width: 60, height: 60, borderRadius: '50%', bgcolor: color.butter, display: 'grid', placeItems: 'center', fontSize: 30, flexShrink: 0 }}>
            💡
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, color: color.primaryDark, fontSize: '1.08rem' }}>
              <Box component="span" sx={{ color: color.primary, mr: 0.75 }}>
                ✦
              </Box>
              Besoin d&apos;aide ?
            </Typography>
            <Typography variant="body2" sx={{ color: color.inkSoft }}>
              Découvrez toutes les fonctionnalités avec notre assistant interactif.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="primary"
            endIcon={<ArrowForward />}
            onClick={() => startTour('dashboard-overview')}
            sx={{ bgcolor: color.surface, borderWidth: 1.5, fontWeight: 700, px: 2.5, position: 'relative', zIndex: 1 }}
          >
            Commencer la visite guidée
          </Button>
          <Illustration name="chocolateCake" sx={{ display: { xs: 'none', md: 'block' }, position: 'absolute', right: 24, bottom: -6, width: 150 }} />
        </Card>
      </Reveal>
    </Box>
  );
};

export default DashboardPage;
