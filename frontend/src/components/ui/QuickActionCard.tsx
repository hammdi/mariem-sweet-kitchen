import { ReactNode } from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';
import { color, motion, radius, shadow, tone as tones, Tone } from '../../theme/tokens';

/**
 * Carte d'action rapide (comme la référence) : icône colorée centrée, titre,
 * chevron, état éventuel en pastille. Fond doux propre à chaque action.
 */
export default function QuickActionCard({
  icon,
  title,
  description,
  tone = 'primary',
  status,
  onClick,
  tourId,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  tone?: Tone;
  status?: ReactNode;
  onClick: () => void;
  tourId?: string;
}) {
  const t = tones[tone];
  return (
    <ButtonBase
      onClick={onClick}
      data-tour={tourId}
      focusRipple
      aria-label={description ? `${title} — ${description}` : title}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 110,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 1,
        px: 1.5,
        py: 2,
        borderRadius: `${radius.lg}px`,
        bgcolor: t.bg,
        border: `1px solid ${t.border}`,
        transition: `transform ${motion.base}ms ${motion.ease}, box-shadow ${motion.base}ms ${motion.ease}`,
        '&:hover': { transform: 'translateY(-3px)', boxShadow: shadow.raised },
        '&:hover .qa-icon': { transform: 'scale(1.08)' },
        '&:hover .qa-arrow': { transform: 'translateX(3px)' },
        '&.Mui-focusVisible': { boxShadow: shadow.focus },
      }}
    >
      {status && <Box sx={{ position: 'absolute', top: 8, right: 8 }}>{status}</Box>}
      <Box className="qa-icon" sx={{ color: t.accent, display: 'flex', transition: `transform ${motion.base}ms ${motion.ease}`, '& svg': { fontSize: 38 } }}>
        {icon}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: '100%' }}>
        <Typography sx={{ fontWeight: 700, color: tone === 'success' || tone === 'warning' ? color.ink : t.fg, lineHeight: 1.25, fontSize: '0.95rem' }}>{title}</Typography>
        <ChevronRight className="qa-arrow" sx={{ color: t.accent, fontSize: 20, flexShrink: 0, transition: `transform ${motion.base}ms ${motion.ease}` }} />
      </Box>
    </ButtonBase>
  );
}
