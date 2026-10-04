import { useEffect, useState } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { reducedMotion } from './chartTheme';

export interface HBarRow {
  key: string;
  label: string;
  value: number;
  valueLabel: string; // valeur affichee a l'extremite de la barre
  tooltip?: string;
  onClick?: () => void;
}

// Barres horizontales : base unique a gauche, extremite arrondie 4 px, valeur en bout de barre
export default function HBarChart({ rows, color }: { rows: HBarRow[]; color: string }) {
  const [drawn, setDrawn] = useState(reducedMotion());
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {rows.map((r) => (
        <Tooltip key={r.key} title={r.tooltip || ''} placement="top" disableInteractive>
          <Box
            onClick={r.onClick}
            role={r.onClick ? 'link' : undefined}
            tabIndex={r.onClick ? 0 : undefined}
            onKeyDown={(e) => r.onClick && e.key === 'Enter' && r.onClick()}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '96px 1fr', sm: '140px 1fr' },
              alignItems: 'center',
              gap: 1,
              py: 0.5,
              px: 0.5,
              borderRadius: 1.5,
              cursor: r.onClick ? 'pointer' : 'default',
              '&:hover': { bgcolor: 'rgba(11,11,11,0.04)' },
            }}
          >
            <Typography variant="body2" noWrap title={r.label}>
              {r.label}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <Box
                sx={{
                  height: 16,
                  borderRadius: '0 4px 4px 0',
                  bgcolor: color,
                  // barres plus courtes sur mobile : la valeur doit tenir en bout de barre
                  width: drawn
                    ? {
                        xs: `${Math.max(2, (r.value / max) * 45)}%`,
                        sm: `${Math.max(2, (r.value / max) * 72)}%`,
                      }
                    : '0%',
                  transition: reducedMotion() ? 'none' : 'width 650ms cubic-bezier(.2,.7,.2,1)',
                  flexShrink: 0,
                }}
              />
              <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                {r.valueLabel}
              </Typography>
            </Box>
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
}
