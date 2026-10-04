import { ReactNode } from 'react';
import { Box } from '@mui/material';
import { ORDER_STATUS, PAYMENT_STATUS, radius, tone as tones, Tone } from '../../theme/tokens';

/** Badge de statut : couleur = sens (voir tokens). */
export default function StatusBadge({
  label,
  tone = 'neutral',
  icon,
  dot = false,
  size = 'small',
}: {
  label: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  dot?: boolean;
  size?: 'small' | 'medium';
}) {
  const t = tones[tone];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: size === 'small' ? 1 : 1.25,
        py: size === 'small' ? 0.25 : 0.5,
        borderRadius: `${radius.pill}px`,
        bgcolor: t.bg,
        color: t.fg,
        border: `1px solid ${t.border}`,
        fontSize: size === 'small' ? '0.75rem' : '0.82rem',
        fontWeight: 700,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        '& svg': { fontSize: size === 'small' ? 14 : 16 },
      }}
    >
      {dot && (
        <Box
          component="span"
          sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: t.accent, flexShrink: 0 }}
        />
      )}
      {icon}
      {label}
    </Box>
  );
}

export function OrderStatusBadge({ status, size }: { status: string; size?: 'small' | 'medium' }) {
  const s = ORDER_STATUS[status] || { label: status, tone: 'neutral' as Tone };
  return <StatusBadge label={s.label} tone={s.tone} dot size={size} />;
}

export function PaymentStatusBadge({
  status,
  size,
}: {
  status?: string | null;
  size?: 'small' | 'medium';
}) {
  const s = PAYMENT_STATUS[status || 'unpaid'] || PAYMENT_STATUS.unpaid;
  return <StatusBadge label={s.label} tone={s.tone} size={size} />;
}
