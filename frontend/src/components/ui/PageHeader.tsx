import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, IconButton, ListItemIcon, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import { ArrowBack, AutoAwesome, HelpOutline, PlayCircleOutline } from '@mui/icons-material';
import { color, Tone } from '../../theme/tokens';
import { useHelp } from '../../help/HelpContext';
import { FlowId } from '../../help/types';
import SoftIcon from './SoftIcon';

/**
 * En-tête de page (dans le contenu, sous la barre du haut) :
 * retour éventuel, icône, titre, sous-titre, aide contextuelle « Comment ça marche ? », actions.
 */
export default function PageHeader({
  title,
  subtitle,
  icon,
  tone = 'primary',
  backTo,
  actions,
  tourId,
  helpTour,
  helpFlow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  backTo?: string;
  actions?: ReactNode;
  tourId?: string;
  /** visite guidée de la page (tours.ts) */
  helpTour?: string;
  /** schéma animé expliquant la logique de la page (flows.ts) */
  helpFlow?: FlowId;
}) {
  const navigate = useNavigate();
  const help = useHelp();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const hasHelp = !!(helpTour || helpFlow);

  const helpButton = hasHelp && (
    <>
      <Tooltip title="L’aide explique et montre, elle ne modifie rien">
        <Button
          size="small"
          data-testid="page-help"
          startIcon={<HelpOutline />}
          onClick={(e) => (helpTour && helpFlow ? setAnchor(e.currentTarget) : helpTour ? help.startTour(helpTour) : (help.openPanel(), help.showFlow(helpFlow!)))}
          sx={{ color: color.primaryDark, flex: '0 0 auto !important', whiteSpace: 'nowrap' }}
        >
          Comment ça marche ?
        </Button>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        {helpFlow && (
          <MenuItem
            onClick={() => {
              setAnchor(null);
              help.openPanel();
              help.showFlow(helpFlow);
            }}
          >
            <ListItemIcon>
              <PlayCircleOutline fontSize="small" />
            </ListItemIcon>
            Voir le schéma animé
          </MenuItem>
        )}
        {helpTour && (
          <MenuItem
            onClick={() => {
              setAnchor(null);
              help.startTour(helpTour);
            }}
          >
            <ListItemIcon>
              <AutoAwesome fontSize="small" />
            </ListItemIcon>
            Visite guidée de la page
          </MenuItem>
        )}
      </Menu>
    </>
  );

  return (
    <Box
      data-tour={tourId}
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { xs: 'stretch', md: 'center' },
        justifyContent: 'space-between',
        gap: 2,
        mb: 3,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
        {backTo && (
          <Tooltip title="Retour">
            <IconButton
              onClick={() => navigate(backTo)}
              aria-label="Retour"
              sx={{ border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}
            >
              <ArrowBack />
            </IconButton>
          </Tooltip>
        )}
        {icon && !backTo && (
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <SoftIcon tone={tone} size={46}>
              {icon}
            </SoftIcon>
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h1" sx={{ fontSize: { xs: '1.45rem', md: '1.75rem' }, lineHeight: 1.2 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography color="text.secondary" sx={{ mt: 0.25, fontSize: '0.95rem' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
      {(actions || hasHelp) && (
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: { xs: 'stretch', md: 'flex-end' },
            '& > *': { flex: { xs: '1 1 auto', md: '0 0 auto' } },
          }}
        >
          {helpButton}
          {actions}
        </Box>
      )}
    </Box>
  );
}
