import { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { Tone } from '../../theme/tokens';
import SoftIcon from './SoftIcon';

/** État vide : dit ce qui apparaîtra ici et, si utile, quoi faire. */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'neutral',
  compact = false,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: Tone;
  compact?: boolean;
}) {
  return (
    <Box
      sx={{
        textAlign: 'center',
        py: compact ? 2.5 : 5,
        px: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <SoftIcon tone={tone} size={compact ? 44 : 56}>
        {icon}
      </SoftIcon>
      <Typography sx={{ fontWeight: 700, mt: 0.5 }}>{title}</Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Box>
  );
}
