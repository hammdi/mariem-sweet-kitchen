import { ReactNode } from 'react';
import { Box } from '@mui/material';

/**
 * Apparition douce (fondu + léger glissement), une seule fois.
 * Désactivée automatiquement si « réduire les animations » est actif (CssBaseline).
 */
export default function Reveal({
  children,
  delay = 0,
  sx,
}: {
  children: ReactNode;
  delay?: number;
  sx?: object;
}) {
  return (
    <Box
      sx={{
        animation: 'reveal-up 420ms cubic-bezier(0.16, 1, 0.3, 1) both',
        animationDelay: `${delay}ms`,
        '@keyframes reveal-up': {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to: { opacity: 1, transform: 'none' },
        },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
