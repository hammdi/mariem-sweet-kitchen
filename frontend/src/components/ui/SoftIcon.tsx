import { ReactNode } from 'react';
import { Box } from '@mui/material';
import { radius, tone as tones, Tone } from '../../theme/tokens';

/** Icône dans une pastille arrondie teintée (le ton porte le sens). */
export default function SoftIcon({
  children,
  tone = 'primary',
  size = 40,
}: {
  children: ReactNode;
  tone?: Tone;
  size?: number;
}) {
  const t = tones[tone];
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: `${Math.round(size * 0.3)}px`,
        bgcolor: t.bg,
        color: t.accent,
        display: 'grid',
        placeItems: 'center',
        '& svg': { fontSize: Math.round(size * 0.55) },
        border: `1px solid ${t.border}`,
        ...(size >= 56 ? { borderRadius: `${radius.lg}px` } : {}),
      }}
    >
      {children}
    </Box>
  );
}
