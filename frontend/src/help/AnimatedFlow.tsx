import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Replay } from '@mui/icons-material';
import { color, radius, tone as tones } from '../theme/tokens';
import { Flow } from './types';

/**
 * Schéma animé d'un flux métier : les étapes apparaissent l'une après l'autre,
 * un point descend le long des flèches. Une seule fois (bouton « Revoir »).
 * Mouvement réduit : tout est affiché d'un coup, sans animation.
 */
export default function AnimatedFlow({
  flow,
  reduced,
  compact = false,
}: {
  flow: Flow;
  reduced: boolean;
  compact?: boolean;
}) {
  const [play, setPlay] = useState(0);
  const stepMs = 420;
  return (
    <Box>
      {!compact && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {flow.summary}
        </Typography>
      )}
      <Box key={play} role="list" aria-label={flow.title} sx={{ display: 'flex', flexDirection: 'column' }}>
        {flow.nodes.map((n, i) => {
          const t = tones[n.tone || 'neutral'];
          const delay = i * stepMs;
          return (
            <Box key={`${n.label}-${i}`} role="listitem">
              {i > 0 && (
                <Box
                  aria-hidden
                  sx={{
                    position: 'relative',
                    height: compact ? 14 : 20,
                    width: 2,
                    ml: compact ? '17px' : '21px',
                    bgcolor: color.borderStrong,
                    overflow: 'visible',
                    ...(reduced
                      ? {}
                      : {
                          '&::after': {
                            content: '""',
                            position: 'absolute',
                            left: -3,
                            top: 0,
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: color.primary,
                            opacity: 0,
                            animation: `flow-dot ${stepMs}ms ease-in ${delay - stepMs / 2}ms 1 both`,
                          },
                          '@keyframes flow-dot': {
                            '0%': { opacity: 0, transform: 'translateY(-4px)' },
                            '30%': { opacity: 1 },
                            '100%': { opacity: 0, transform: `translateY(${compact ? 10 : 16}px)` },
                          },
                        }),
                  }}
                />
              )}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  p: compact ? 0.75 : 1,
                  pr: 1.5,
                  borderRadius: `${radius.md}px`,
                  bgcolor: t.bg,
                  border: `1.5px ${n.conditional ? 'dashed' : 'solid'} ${t.border}`,
                  ...(reduced
                    ? {}
                    : {
                        animation: `flow-node 380ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms both`,
                        '@keyframes flow-node': {
                          from: { opacity: 0, transform: 'translateY(6px) scale(0.98)' },
                          to: { opacity: 1, transform: 'none' },
                        },
                      }),
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: compact ? 28 : 34,
                    height: compact ? 28 : 34,
                    borderRadius: '50%',
                    bgcolor: color.surface,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: compact ? 15 : 18,
                    flexShrink: 0,
                  }}
                >
                  {n.emoji}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, color: t.fg, fontSize: compact ? '0.85rem' : '0.92rem', lineHeight: 1.25 }}>
                    {n.label}
                  </Typography>
                  {n.caption && (
                    <Typography sx={{ color: color.inkSoft, fontSize: compact ? '0.75rem' : '0.8rem', lineHeight: 1.3 }}>
                      {n.caption}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
      {flow.note && (
        <Typography
          variant="body2"
          sx={{ mt: 1.5, p: 1.25, borderRadius: `${radius.sm}px`, bgcolor: color.bgSubtle, color: color.inkSoft, fontSize: compact ? '0.78rem' : undefined }}
        >
          💡 {flow.note}
        </Typography>
      )}
      {!reduced && (
        <Button size="small" startIcon={<Replay />} onClick={() => setPlay((p) => p + 1)} sx={{ mt: 1 }}>
          Revoir l’animation
        </Button>
      )}
    </Box>
  );
}
