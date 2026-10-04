import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, ButtonBase, Typography } from '@mui/material';
import { AssignmentLate } from '@mui/icons-material';
import api from '../../services/api';
import type { ActionRequiredOrder } from '../../types/admin';
import { formatDate, formatQty } from '../../utils/format';
import { color, radius, Tone, tone as tones } from '../../theme/tokens';
import { EmptyState, OrderStatusBadge, StatusBadge } from '../ui';

const URGENCY: Record<ActionRequiredOrder['urgency'], { label: (o: ActionRequiredOrder) => string; tone: Tone }> = {
  overdue: { label: () => 'Date dépassée', tone: 'danger' },
  urgent: { label: (o) => `Dans ${Math.max(0, o.hoursLeft || 0)} h`, tone: 'danger' },
  upcoming: { label: (o) => `Dans ${Math.round((o.hoursLeft || 0) / 24)} j`, tone: 'warning' },
  no_date: { label: () => 'Sans date', tone: 'neutral' },
};

/**
 * Commandes enregistrées dont il manque des ingrédients (les plus urgentes en haut).
 * Information seulement : aucune action automatique (pas d'achat, pas d'annulation).
 */
export default function ActionRequiredSection({ limit, empty }: { limit?: number; empty?: React.ReactNode }) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ActionRequiredOrder[] | null>(null);

  useEffect(() => {
    api
      .get('/orders/action-required')
      .then((res) => setOrders(res.data.data?.orders || []))
      .catch(() => setOrders([]));
  }, []);

  if (orders === null) return null;
  if (orders.length === 0) {
    if (empty) return <>{empty}</>;
    return (
      <EmptyState
        compact
        tone="success"
        icon={<AssignmentLate />}
        title="Aucune commande bloquée"
        description="Les commandes avec un ingrédient manquant ou urgentes apparaîtront ici."
      />
    );
  }
  const shown = limit ? orders.slice(0, limit) : orders;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {shown.map((o) => {
        const u = URGENCY[o.urgency];
        const t = tones[u.tone];
        return (
          <ButtonBase
            key={o.orderId}
            onClick={() => navigate(`/admin/orders/${o.orderId}`)}
            sx={{
              display: 'block',
              textAlign: 'left',
              p: 1.25,
              pl: 1.5,
              borderRadius: `${radius.md}px`,
              border: `1px solid ${t.border}`,
              borderLeft: `4px solid ${t.accent}`,
              bgcolor: u.tone === 'neutral' ? color.surface : t.bg,
              transition: 'transform 140ms',
              '&:hover': { transform: 'translateX(2px)' },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', mr: 'auto' }}>
                {o.orderRef} · {o.clientName}
              </Typography>
              <OrderStatusBadge status={o.status} />
              <StatusBadge label={u.label(o)} tone={u.tone} />
            </Box>
            <Typography variant="caption" sx={{ color: color.inkSoft, display: 'block', mt: 0.25 }}>
              {o.date ? `Prévue le ${formatDate(o.date, true)} · ` : ''}
              {o.items.map((i) => `${i.recipeName}${i.sizeName ? ` ${i.sizeName}` : ''} ×${i.quantity}`).join(', ')}
            </Typography>
            {o.missing.map((m) => (
              <Typography key={m.ingredientId} variant="body2" sx={{ mt: 0.25, fontSize: '0.84rem' }}>
                ⚠️ <strong>{m.name}</strong> : manque {formatQty(m.missing)} {m.unit}
                <Box component="span" sx={{ color: color.inkSoft }}>
                  {' '}
                  · achat : {m.purchaseStatus.replace('a acheter', 'à acheter').replace('achete', 'acheté')}
                </Box>
              </Typography>
            ))}
            {o.unitProblems.length > 0 && (
              <Typography variant="body2" sx={{ color: color.dangerDark, fontSize: '0.84rem' }}>
                Unité incompatible à corriger : {o.unitProblems.join(', ')}
              </Typography>
            )}
          </ButtonBase>
        );
      })}
      {limit && orders.length > limit && (
        <Typography variant="caption" sx={{ color: color.inkSoft, textAlign: 'center' }}>
          + {orders.length - limit} autre{orders.length - limit > 1 ? 's' : ''}
        </Typography>
      )}
    </Box>
  );
}
