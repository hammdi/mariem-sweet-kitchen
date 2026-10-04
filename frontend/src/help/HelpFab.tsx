import { useEffect, useState } from 'react';
import { Box, Fab, Tooltip, Zoom } from '@mui/material';
import { AutoAwesome, Close } from '@mui/icons-material';
import { color, layout } from '../theme/tokens';
import { useHelp } from './HelpContext';

const SEEN = 'mariem.help.seen';

/**
 * Bouton flottant ✨ de l'aide. Brille doucement 3 fois à la première visite,
 * puis reste calme (pas d'animation permanente). Toujours SOUS les fenêtres de
 * dialogue (z-index 1250 < 1300) et caché pendant une visite guidée.
 */
export default function HelpFab() {
  const { panelOpen, togglePanel, activeTourId, aiOpen, closeAi, reducedMotion } = useHelp();
  const [glow, setGlow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN)) {
        setGlow(true);
        localStorage.setItem(SEEN, '1');
      }
    } catch {
      /* stockage indisponible : pas d'animation d'accueil */
    }
  }, []);

  const open = panelOpen || aiOpen;
  return (
    <Zoom in={!activeTourId} appear={!reducedMotion}>
      <Box
        sx={{
          position: 'fixed',
          right: { xs: 16, md: 24 },
          bottom: { xs: `calc(${layout.bottomNavHeight + 16}px + env(safe-area-inset-bottom))`, md: 24 },
          zIndex: 1250,
        }}
      >
        {/* Étiquette « Aide » au-dessus du bouton, comme la référence (ordinateur) */}
        {!open && (
          <Box
            aria-hidden
            sx={{
              display: { xs: 'none', md: 'block' },
              position: 'absolute',
              bottom: 'calc(100% + 10px)',
              left: '50%',
              transform: 'translateX(-50%)',
              px: 1.5,
              py: 0.6,
              borderRadius: '10px',
              bgcolor: '#2A1F17',
              color: '#fff',
              fontSize: '0.8rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              '&::after': {
                content: '""',
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                border: '6px solid transparent',
                borderTopColor: '#2A1F17',
              },
            }}
          >
            Aide
          </Box>
        )}
        <Tooltip title={open ? 'Fermer l’aide' : 'Aide ✨'} placement="left">
          <Fab
            data-tour="help-fab"
            data-testid="help-fab"
            aria-label={open ? 'Fermer l’aide' : 'Ouvrir l’aide interactive'}
            aria-expanded={open}
            onClick={() => (aiOpen ? closeAi() : togglePanel())}
            sx={{
              width: 64,
              height: 64,
              border: `4px solid ${color.surface}`,
              color: '#fff',
              background: open ? '#2A1F17' : `linear-gradient(135deg, #F7931E 0%, ${color.primary} 55%, ${color.primaryDark} 100%)`,
              boxShadow: '0 10px 24px rgba(241,119,10,0.35)',
              '&:hover': { background: open ? '#000' : color.primaryDark },
              '& svg': { transition: 'transform 300ms cubic-bezier(0.2,0,0,1)' },
              '&:hover svg': { transform: open ? 'none' : 'rotate(-12deg) scale(1.08)' },
              ...(glow && !reducedMotion
                ? {
                    animation: 'help-glow 1.8s ease-out 3',
                    '@keyframes help-glow': {
                      '0%': { boxShadow: '0 0 0 0 rgba(241,119,10,0.45), 0 10px 24px rgba(241,119,10,0.35)' },
                      '100%': { boxShadow: '0 0 0 18px rgba(241,119,10,0), 0 10px 24px rgba(241,119,10,0.35)' },
                    },
                  }
                : {}),
            }}
          >
            {open ? <Close /> : <AutoAwesome />}
          </Fab>
        </Tooltip>
      </Box>
    </Zoom>
  );
}
