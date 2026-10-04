import { ReactNode } from 'react';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Close } from '@mui/icons-material';

/**
 * Fenêtre de dialogue qui ne dépasse jamais l'écran : plein écran sur
 * téléphone, contenu défilant, actions toujours visibles.
 */
export default function ResponsiveDialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  actions,
  maxWidth = 'sm',
  tourId,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg';
  tourId?: string;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={maxWidth}
      fullScreen={fullScreen}
      scroll="paper"
      PaperProps={{ 'data-tour': tourId } as object}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, pr: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {title}
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, fontWeight: 400 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} aria-label="Fermer" size="small" sx={{ mt: -0.25 }}>
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
      {actions && (
        <DialogActions
          sx={{
            flexWrap: 'wrap',
            '& > :not(style) ~ :not(style)': { ml: 0 },
            '& > *': { flex: { xs: '1 1 auto', sm: '0 0 auto' } },
          }}
        >
          {actions}
        </DialogActions>
      )}
    </Dialog>
  );
}
