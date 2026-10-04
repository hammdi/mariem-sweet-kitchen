import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Backdrop,
  Box,
  ButtonBase,
  Fade,
  IconButton,
  Paper,
  Switch,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { ArrowBack, AutoAwesome, ChevronRight, Close, Forum } from '@mui/icons-material';
import { useAdminData } from '../context/AdminDataContext';
import { color, layout, radius, shadow } from '../theme/tokens';
import { useHelp } from './HelpContext';
import { helpForPath } from './pages';
import { FLOWS } from './flows';
import { HelpAction } from './types';
import AnimatedFlow from './AnimatedFlow';

/**
 * Panneau d'aide contextuel : « Bonjour 👋 Que voulez-vous faire ? »
 * Propose des visites guidées, des schémas animés et l'ouverture de pages.
 * Aucune action du panneau ne modifie de données.
 */
export default function HelpPanel() {
  const { panelOpen, closePanel, startTour, flowId, showFlow, openAi, reducedMotion, userReducedMotion, setUserReducedMotion } =
    useHelp();
  const { user } = useAdminData();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const page = helpForPath(location.pathname);
  const name = user?.firstName || '';

  const run = (a: HelpAction) => {
    if (a.kind === 'tour' && a.tourId) startTour(a.tourId);
    else if (a.kind === 'flow' && a.flowId) showFlow(a.flowId);
    else if (a.kind === 'navigate' && a.to) {
      closePanel();
      navigate(a.to);
    }
  };

  const flow = flowId ? FLOWS[flowId] : null;

  // Échap ferme le panneau
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closePanel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen, closePanel]);

  return (
    <>
      {mobile && <Backdrop open={panelOpen} onClick={closePanel} sx={{ zIndex: 1255, bgcolor: 'rgba(28,18,10,0.35)' }} />}
      <Fade in={panelOpen} timeout={reducedMotion ? 0 : 200} unmountOnExit>
        <Paper
          role="dialog"
          aria-label="Aide interactive"
          data-testid="help-panel"
          sx={{
            position: 'fixed',
            zIndex: 1260, // au-dessus du bouton d'aide, sous les fenêtres de dialogue (1300)
            right: { xs: 0, md: 24 },
            left: { xs: 0, md: 'auto' },
            bottom: { xs: 0, md: 96 },
            width: { xs: '100%', md: 400 },
            maxHeight: { xs: '82vh', md: 'calc(100vh - 128px)' },
            display: 'flex',
            flexDirection: 'column',
            borderRadius: { xs: `${radius.xl}px ${radius.xl}px 0 0`, md: `${radius.xl}px` },
            boxShadow: shadow.floating,
            border: `1px solid ${color.border}`,
            overflow: 'hidden',
            pb: { xs: `calc(env(safe-area-inset-bottom) + 8px)`, md: 0 },
          }}
        >
          {/* En-tête */}
          <Box
            sx={{
              px: 2.25,
              pt: 2,
              pb: 1.75,
              background: `linear-gradient(135deg, ${color.primarySoft} 0%, ${color.cream} 100%)`,
              borderBottom: `1px solid ${color.border}`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
            }}
          >
            {flow ? (
              <IconButton onClick={() => showFlow(null)} aria-label="Retour aux propositions" size="small" sx={{ mt: 0.25 }}>
                <ArrowBack />
              </IconButton>
            ) : (
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  bgcolor: color.primary,
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <AutoAwesome fontSize="small" />
              </Box>
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontSize: '1.05rem', lineHeight: 1.3 }}>
                {flow ? flow.title : `Bonjour${name ? ` ${name}` : ''} 👋`}
              </Typography>
              <Typography variant="body2" sx={{ color: color.inkSoft }}>
                {flow ? 'Schéma animé' : 'Que voulez-vous faire ?'}
              </Typography>
            </Box>
            <IconButton onClick={closePanel} aria-label="Fermer l'aide" size="small">
              <Close />
            </IconButton>
          </Box>

          <Box sx={{ overflowY: 'auto', px: 2.25, py: 2, flex: 1 }}>
            {flow ? (
              <AnimatedFlow flow={flow} reduced={reducedMotion} />
            ) : (
              <>
                <Typography variant="overline" sx={{ color: color.inkMuted, fontSize: '0.68rem' }}>
                  Sur cette page · {page.title}
                </Typography>
                <Typography variant="body2" sx={{ color: color.inkSoft, mb: 1.5 }}>
                  {page.intro}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {page.actions.map((a) => (
                    <ButtonBase
                      key={a.id}
                      onClick={() => run(a)}
                      data-testid={`help-action-${a.id}`}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.25,
                        borderRadius: `${radius.md}px`,
                        border: `1px solid ${color.border}`,
                        bgcolor: color.surface,
                        textAlign: 'left',
                        transition: 'background-color 140ms, border-color 140ms, transform 140ms',
                        '&:hover': { bgcolor: color.primarySoft, borderColor: color.primaryTint, transform: 'translateX(2px)' },
                      }}
                    >
                      <Box
                        aria-hidden
                        sx={{ width: 36, height: 36, borderRadius: `${radius.sm}px`, bgcolor: color.bgSubtle, display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0 }}
                      >
                        {a.icon}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.92rem' }}>{a.label}</Typography>
                        <Typography variant="caption" sx={{ color: color.inkSoft }}>
                          {a.description || (a.kind === 'tour' ? 'Visite guidée' : a.kind === 'flow' ? 'Schéma animé' : 'Ouvrir la page')}
                        </Typography>
                      </Box>
                      <ChevronRight sx={{ color: color.inkMuted }} />
                    </ButtonBase>
                  ))}
                </Box>

                <Typography variant="overline" sx={{ color: color.inkMuted, fontSize: '0.68rem', display: 'block', mt: 2.5 }}>
                  Comprendre en images
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                  {(['sale', 'purchase', 'missing', 'order-check', 'payment', 'cash', 'stock', 'stats', 'recipe', 'cancel'] as const).map((id) => (
                    <ButtonBase
                      key={id}
                      onClick={() => showFlow(id)}
                      sx={{
                        px: 1.25,
                        py: 0.6,
                        borderRadius: `${radius.pill}px`,
                        border: `1px solid ${color.borderStrong}`,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: color.inkSoft,
                        '&:hover': { borderColor: color.primary, color: color.primaryDark },
                      }}
                    >
                      {FLOWS[id].nodes[0].emoji} {FLOWS[id].title}
                    </ButtonBase>
                  ))}
                </Box>

                <ButtonBase
                  onClick={openAi}
                  sx={{
                    mt: 2.5,
                    width: '100%',
                    display: 'flex',
                    gap: 1.25,
                    p: 1.25,
                    borderRadius: `${radius.md}px`,
                    bgcolor: color.bgSubtle,
                    textAlign: 'left',
                    '&:hover': { bgcolor: color.primarySoft },
                  }}
                >
                  <Forum sx={{ color: color.primary }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Poser une question à l’assistant</Typography>
                    <Typography variant="caption" sx={{ color: color.inkSoft }}>
                      Réponse écrite (IA) — il ne modifie rien
                    </Typography>
                  </Box>
                  <ChevronRight sx={{ color: color.inkMuted }} />
                </ButtonBase>
              </>
            )}
          </Box>

          <Box
            sx={{
              px: 2.25,
              py: 1,
              borderTop: `1px solid ${color.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: color.surfaceMuted,
            }}
          >
            <Typography variant="caption" sx={{ color: color.inkSoft, flex: 1 }}>
              🔒 L’aide ne modifie jamais vos données.
            </Typography>
            <Typography component="label" htmlFor="help-reduce-motion" variant="caption" sx={{ color: color.inkSoft }}>
              Moins d’animations
            </Typography>
            <Switch
              id="help-reduce-motion"
              size="small"
              checked={userReducedMotion}
              onChange={(e) => setUserReducedMotion(e.target.checked)}
            />
          </Box>
        </Paper>
      </Fade>
    </>
  );
}

/** Espace réservé en bas des pages pour que le bouton d'aide ne cache jamais un bouton. */
export const FAB_CLEARANCE = { xs: layout.bottomNavHeight + 80, md: 96 };
