import { ReactNode } from 'react';
import { Box, ButtonBase, Card, Typography } from '@mui/material';
import { TrendingDown, TrendingFlat, TrendingUp } from '@mui/icons-material';
import { color, motion, shadow, Tone } from '../../theme/tokens';
import AnimatedNumber from '../charts/AnimatedNumber';
import SoftIcon from './SoftIcon';

/**
 * Indicateur compact. `value` numérique → apparition animée (respecte « réduire
 * les animations »). `delta` : variation par rapport à la période précédente.
 */
export default function KpiCard({
  label,
  value,
  format = (n) => String(Math.round(n)),
  icon,
  tone = 'primary',
  hint,
  delta,
  onClick,
  valueColor,
  tourId,
}: {
  label: string;
  value: number | string;
  format?: (n: number) => string;
  icon?: ReactNode;
  tone?: Tone;
  hint?: ReactNode;
  delta?: { value: number; label: string; positiveIsGood?: boolean } | null;
  onClick?: () => void;
  valueColor?: string;
  tourId?: string;
}) {
  const content = (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', width: '100%', minWidth: 0 }}>
      {icon && (
        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
          <SoftIcon tone={tone} size={40}>
            {icon}
          </SoftIcon>
        </Box>
      )}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, fontSize: { xs: '0.78rem', sm: '0.875rem' }, lineHeight: 1.3 }}>
          {label}
        </Typography>
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.45rem' },
            lineHeight: 1.25,
            color: valueColor || 'text.primary',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          style={{ fontFamily: '"Plus Jakarta Sans", Inter, sans-serif' }}
        >
          {typeof value === 'number' ? <AnimatedNumber value={value} format={format} /> : value}
        </Typography>
        {delta && <Delta {...delta} />}
        {hint && (
          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' }, mt: 0.25 }}>
            {hint}
          </Typography>
        )}
      </Box>
    </Box>
  );
  return (
    <Card
      data-tour={tourId}
      sx={{
        p: 0,
        height: '100%',
        transition: `box-shadow ${motion.base}ms ${motion.ease}, transform ${motion.base}ms ${motion.ease}`,
        ...(onClick ? { '&:hover': { boxShadow: shadow.raised, transform: 'translateY(-2px)' } } : {}),
      }}
    >
      {onClick ? (
        <ButtonBase
          onClick={onClick}
          sx={{ p: { xs: 1.5, sm: 2 }, width: '100%', height: '100%', textAlign: 'left', alignItems: 'flex-start' }}
        >
          {content}
        </ButtonBase>
      ) : (
        <Box sx={{ p: { xs: 1.5, sm: 2 } }}>{content}</Box>
      )}
    </Card>
  );
}

function Delta({
  value,
  label,
  positiveIsGood = true,
}: {
  value: number;
  label: string;
  positiveIsGood?: boolean;
}) {
  const flat = Math.abs(value) < 0.005;
  const good = flat ? null : value > 0 === positiveIsGood;
  const Icon = flat ? TrendingFlat : value > 0 ? TrendingUp : TrendingDown;
  return (
    <Typography
      variant="caption"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.4,
        mt: 0.25,
        fontWeight: 600,
        color: good === null ? color.inkSoft : good ? color.successDark : color.dangerDark,
      }}
    >
      <Icon sx={{ fontSize: 15 }} />
      {label}
    </Typography>
  );
}
