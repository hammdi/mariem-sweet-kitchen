import { ReactNode } from 'react';
import { Box, Button, Card, Typography } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';
import { Tone, tone as tones } from '../../theme/tokens';

/** Carte de section : en-tête (icône, titre, lien « Voir tout ») + contenu. */
export default function SectionCard({
  title,
  subtitle,
  icon,
  tone = 'primary',
  action,
  onAction,
  actionLabel = 'Voir tout',
  children,
  padding = 2.5,
  tourId,
  sx,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  action?: ReactNode;
  onAction?: () => void;
  actionLabel?: string;
  children: ReactNode;
  padding?: number;
  tourId?: string;
  sx?: object;
}) {
  return (
    <Card
      data-tour={tourId}
      sx={{ p: padding, display: 'flex', flexDirection: 'column', minWidth: 0, ...sx }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 2, minWidth: 0 }}>
        {icon && (
          <Box aria-hidden sx={{ display: 'flex', color: tones[tone].accent, '& svg': { fontSize: 26 } }}>
            {icon}
          </Box>
        )}
        <Box sx={{ flex: '1 1 140px', minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontSize: '1rem', lineHeight: 1.3 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {action}
        {onAction && (
          <Button
            size="small"
            onClick={onAction}
            endIcon={<ChevronRight />}
            sx={{ flexShrink: 0, color: 'primary.main', fontWeight: 600, px: 0.75, minWidth: 0, '& .MuiButton-endIcon': { ml: 0.25 } }}
          >
            {actionLabel}
          </Button>
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </Card>
  );
}
