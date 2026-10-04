import { ReactNode, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, ButtonBase, Skeleton, Tooltip, Typography } from '@mui/material';
import { ChevronRight, Inventory2, ReceiptLong, BarChart } from '@mui/icons-material';
import { useAdminData } from '../../context/AdminDataContext';
import { formatDT } from '../../utils/format';
import { color, motion, radius, shadow, Tone } from '../../theme/tokens';
import SoftIcon from '../ui/SoftIcon';
import AnimatedNumber from '../charts/AnimatedNumber';

const Row = ({ label, value, valueColor }: { label: string; value: ReactNode; valueColor?: string }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 3, py: 0.3 }}>
    <Typography variant="body2" sx={{ color: color.inkSoft }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ fontWeight: 700, color: valueColor || color.ink, whiteSpace: 'nowrap' }}>
      {value}
    </Typography>
  </Box>
);

/**
 * Indicateur de la barre du haut. Survol = détail ; clic = ouvre la page.
 * Au toucher : 1er appui = détail, « Ouvrir » dans le détail pour naviguer.
 */
function Kpi({
  icon,
  tone,
  label,
  value,
  context,
  title,
  details,
  path,
  tourId,
  compact,
  valueColor,
}: {
  compact?: boolean;
  valueColor?: string;
  icon: ReactNode;
  tone: Tone;
  label: string;
  value: ReactNode;
  context?: ReactNode;
  title: string;
  details: ReactNode;
  path: string;
  tourId?: string;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pointer = useRef('mouse');
  return (
    <Tooltip
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      disableTouchListener
      placement="bottom-start"
      enterDelay={150}
      componentsProps={{
        tooltip: {
          sx: {
            bgcolor: color.surface,
            color: color.ink,
            border: `1px solid ${color.border}`,
            boxShadow: shadow.raised,
            borderRadius: `${radius.md}px`,
            p: 1.75,
            minWidth: 260,
          },
        },
      }}
      title={
        <Box>
          <Typography sx={{ fontWeight: 700, mb: 0.75 }}>{title}</Typography>
          {details}
          <ButtonBase
            onClick={() => navigate(path)}
            sx={{ mt: 1, color: color.primaryDark, fontWeight: 700, fontSize: '0.8rem', gap: 0.25 }}
          >
            Ouvrir <ChevronRight sx={{ fontSize: 16 }} />
          </ButtonBase>
        </Box>
      }
    >
      <ButtonBase
        data-tour={tourId}
        onPointerDown={(e) => (pointer.current = e.pointerType)}
        onClick={() => {
          if (pointer.current === 'touch') setOpen(!open);
          else navigate(path);
        }}
        aria-label={`${label} : ouvrir`}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: compact ? 1 : 1.5,
          pl: compact ? 1.25 : 1.25,
          pr: compact ? 0.75 : 1.25,
          py: compact ? 0.9 : 1.1,
          minWidth: 0,
          borderRadius: `${radius.md}px`,
          bgcolor: color.surface,
          border: `1px solid ${color.border}`,
          boxShadow: shadow.card,
          textAlign: 'left',
          transition: `box-shadow ${motion.base}ms ${motion.ease}, transform ${motion.base}ms ${motion.ease}, border-color ${motion.base}ms`,
          '&:hover': { boxShadow: shadow.raised, transform: 'translateY(-1px)', borderColor: color.borderStrong },
          '&.Mui-focusVisible': { boxShadow: shadow.focus },
        }}
      >
        {!compact && (
          <SoftIcon tone={tone} size={46}>
            {icon}
          </SoftIcon>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: compact ? '0.72rem' : '0.82rem', color: color.inkSoft, fontWeight: 600, lineHeight: 1.25 }} noWrap>
            {label}
          </Typography>
          <Typography
            sx={{ fontWeight: 800, fontSize: compact ? '0.86rem' : '1.2rem', lineHeight: 1.3, fontVariantNumeric: 'tabular-nums', color: valueColor || color.ink }}
            style={{ fontFamily: '"Plus Jakarta Sans", Inter, sans-serif' }}
            noWrap={!compact}
          >
            {value}
          </Typography>
          {context && (
            <Typography sx={{ fontSize: '0.7rem', color: color.inkMuted, lineHeight: 1.2 }} noWrap>
              {context}
            </Typography>
          )}
        </Box>
        {!compact && <ChevronRight sx={{ color: color.ink, fontSize: 22, ml: 'auto' }} />}
      </ButtonBase>
    </Tooltip>
  );
}

const variation = (now: number, before: number | undefined, unit: 'DT' | 'cmd') => {
  if (before === undefined) return null;
  const diff = now - before;
  if (Math.abs(diff) < 0.005) return 'comme hier';
  const sign = diff > 0 ? '+' : '−';
  return unit === 'DT'
    ? `${sign}${Math.abs(diff).toFixed(2)} DT vs hier`
    : `${sign}${Math.abs(diff)} vs hier`;
};

/** CA du jour · Commandes · Stock — avec contexte (vs hier) et détail au survol. */
export default function TopbarKpis({ dense = false, compact = false }: { dense?: boolean; compact?: boolean }) {
  const { summary: s } = useAdminData();
  if (!s) {
    return (
      <Box sx={{ display: 'flex', gap: 1.5 }} aria-busy>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" width={dense ? 150 : 190} height={56} />
        ))}
      </Box>
    );
  }
  const urgent = s.orders.actionRequired;
  const stockAlert = s.stock.purchasesNeeded > 0 || s.stock.lowStock > 0;
  return (
    <Box
      data-tour="topbar-kpis"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 1.25,
        minWidth: 0,
        width: '100%',
        maxWidth: compact ? 'none' : dense ? 700 : 820,
        ...(compact ? { gap: 1 } : {}),
      }}
    >
      <Kpi
        compact={compact}
        icon={<BarChart />}
        tone="primary"
        label="CA du jour"
        value={<AnimatedNumber value={s.today.revenue} format={(n) => formatDT(n)} />}
        context={variation(s.today.revenue, s.yesterday?.revenue, 'DT')}
        title="Aujourd'hui"
        path="/admin/statistics"
        details={
          <>
            <Row label="Chiffre d'affaires (ventes)" value={formatDT(s.today.revenue)} />
            <Row label="Encaissé aujourd'hui" value={formatDT(s.today.collected)} valueColor={color.successDark} />
            <Row label="Sorties de caisse" value={formatDT(s.today.outflows)} valueColor={color.dangerDark} />
            <Row label="Reste à encaisser (tout)" value={formatDT(s.outstanding)} valueColor={color.warningDark} />
            <Row label="Liquidité de la caisse" value={formatDT(s.cashBalance)} />
          </>
        }
      />
      <Kpi
        compact={compact}
        icon={<ReceiptLong />}
        tone={urgent ? 'danger' : 'rose'}
        label="Commandes"
        value={urgent ? `${urgent} urgente${urgent > 1 ? 's' : ''}` : `${s.orders.today} aujourd'hui`}
        context={urgent ? 'ingrédients manquants' : variation(s.orders.today, s.yesterday?.orders, 'cmd')}
        title="Commandes"
        path="/admin/orders"
        details={
          <>
            <Row label="Prévues aujourd'hui" value={s.orders.today} />
            <Row label="En attente de confirmation" value={s.orders.pending ?? '—'} />
            <Row label="En préparation" value={s.orders.preparing ?? '—'} />
            <Row label="Prêtes (à remettre)" value={s.orders.ready ?? '—'} />
            <Row
              label="Bloquées (ingrédient manquant)"
              value={s.orders.withMissingIngredients}
              valueColor={s.orders.withMissingIngredients ? color.dangerDark : undefined}
            />
          </>
        }
      />
      <Kpi
        compact={compact}
        icon={<Inventory2 />}
        tone={stockAlert ? 'warning' : 'success'}
        label="Stock"
        valueColor={stockAlert ? color.warningDark : color.successDark}
        value={
          s.stock.purchasesNeeded
            ? `${s.stock.purchasesNeeded} à acheter`
            : s.stock.lowStock
              ? `${s.stock.lowStock} à surveiller`
              : 'OK'
        }
        context={
          s.stock.purchasesNeeded
            ? `≈ ${formatDT(s.stock.purchasesEstimatedCost)}`
            : s.stock.lowStock
              ? 'sous le seuil'
              : 'rien ne manque'
        }
        title="Stock"
        path={s.stock.purchasesNeeded ? '/admin/shopping-list' : '/admin/stock'}
        details={
          <>
            <Row label="Ingrédients à acheter" value={s.stock.purchasesNeeded} />
            {s.stock.purchasesNeeded > 0 && (
              <Row label="Coût estimé" value={formatDT(s.stock.purchasesEstimatedCost)} />
            )}
            <Row
              label="Sous le seuil d'alerte"
              value={s.stock.lowStock}
              valueColor={s.stock.lowStock ? color.warningDark : undefined}
            />
          </>
        }
      />
    </Box>
  );
}
