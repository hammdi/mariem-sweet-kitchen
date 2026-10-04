import { alpha, createTheme } from '@mui/material/styles';
import { color, cssVars, font, motion, palettes, radius, shadow, ThemeMode } from './tokens';

/**
 * Thème MUI construit uniquement à partir des tokens : changer une couleur,
 * un rayon ou une ombre dans tokens.ts change toute l'application.
 */
export const createAppTheme = (mode: ThemeMode = 'light') => {
  const p = palettes[mode];
  return createTheme({
  palette: {
    mode,
    primary: { main: p.primary, dark: palettes.light.primaryDark, light: '#F59A45', contrastText: '#fff' },
    secondary: { main: p.info, dark: p.infoDark, light: '#6E9FEA', contrastText: '#fff' },
    success: { main: p.success, dark: palettes.light.successDark, light: '#5DBB87', contrastText: '#fff' },
    error: { main: p.danger, dark: palettes.light.dangerDark, light: '#E8696D', contrastText: '#fff' },
    warning: { main: p.warning, dark: palettes.light.warningDark, light: '#F2B53D', contrastText: '#fff' },
    info: { main: p.info, dark: palettes.light.infoDark, light: '#6E9FEA', contrastText: '#fff' },
    background: { default: p.bg, paper: p.surface },
    text: { primary: p.ink, secondary: p.inkSoft, disabled: p.inkMuted },
    divider: p.border,
  },
  shape: { borderRadius: radius.sm },
  typography: {
    fontFamily: font.body,
    h1: { fontFamily: font.heading, fontWeight: 800, letterSpacing: '-0.02em' },
    h2: { fontFamily: font.heading, fontWeight: 800, letterSpacing: '-0.02em' },
    h3: { fontFamily: font.heading, fontWeight: 800, letterSpacing: '-0.015em' },
    h4: { fontFamily: font.heading, fontWeight: 800, letterSpacing: '-0.015em' },
    h5: { fontFamily: font.heading, fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontFamily: font.heading, fontWeight: 700, letterSpacing: '-0.005em' },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: 'none', letterSpacing: 0 },
    overline: { fontWeight: 700, letterSpacing: '0.08em' },
  },
  transitions: {
    easing: {
      easeInOut: motion.ease,
      easeOut: motion.easeOut,
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      sharp: motion.ease,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': cssVars('light'),
        ':root[data-mk-theme="dark"]': { ...cssVars('dark'), colorScheme: 'dark' },
        body: { backgroundColor: color.bg, color: color.ink },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.001ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.001ms !important',
            scrollBehavior: 'auto !important',
          },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { rounded: { borderRadius: radius.lg } },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: radius.lg,
          border: `1px solid ${color.border}`,
          boxShadow: shadow.card,
          backgroundColor: color.surface,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: radius.md,
          fontWeight: 600,
          paddingInline: 16,
          minHeight: 40,
          transition: `background-color ${motion.fast}ms ${motion.ease}, box-shadow ${motion.fast}ms ${motion.ease}, transform ${motion.fast}ms ${motion.ease}`,
          '&:active': { transform: 'translateY(1px)' },
          '&.Mui-focusVisible': { boxShadow: shadow.focus },
        },
        sizeSmall: { minHeight: 32, paddingInline: 12, borderRadius: radius.sm },
        sizeLarge: { minHeight: 48, paddingInline: 22 },
        containedPrimary: {
          boxShadow: `0 4px 12px ${alpha(p.primary, 0.28)}`,
          '&:hover': { backgroundColor: palettes.light.primaryDark, boxShadow: `0 6px 16px ${alpha(p.primary, 0.32)}` },
        },
        outlined: { borderColor: color.borderStrong, backgroundColor: color.surface },
        outlinedPrimary: {
          borderColor: alpha(p.primary, 0.45),
          '&:hover': { backgroundColor: color.primarySoft, borderColor: color.primary },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: radius.sm, '&.Mui-focusVisible': { boxShadow: shadow.focus } },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: radius.pill, fontWeight: 600 },
        sizeSmall: { height: 24, fontSize: '0.75rem' },
        outlined: { borderColor: color.borderStrong },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: radius.md,
          backgroundColor: color.surface,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: color.borderStrong },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: color.inkMuted },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: color.primary, borderWidth: 1.5 },
          '&.Mui-focused': { boxShadow: shadow.focus },
        },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { fontWeight: 500 } } },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: radius.xl, boxShadow: shadow.floating },
        paperFullScreen: { borderRadius: 0 },
      },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { fontFamily: font.heading, fontWeight: 700, fontSize: '1.15rem' } },
    },
    MuiDialogActions: { styleOverrides: { root: { padding: '12px 24px 20px', gap: 8 } } },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 44 },
        indicator: { height: 3, borderRadius: 3, backgroundColor: color.primary },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          minHeight: 44,
          color: color.inkSoft,
          '&.Mui-selected': { color: color.ink },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${color.border}`, paddingTop: 12, paddingBottom: 12 },
        head: {
          fontWeight: 700,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: color.inkSoft,
          backgroundColor: color.surfaceMuted,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: `background-color ${motion.fast}ms ${motion.ease}`,
          '&.MuiTableRow-hover:hover': { backgroundColor: color.surfaceMuted },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: mode === 'dark' ? '#3A2E25' : '#2A1F17',
          borderRadius: radius.sm,
          fontSize: '0.78rem',
          padding: '8px 10px',
        },
        arrow: { color: mode === 'dark' ? '#3A2E25' : '#2A1F17' },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: radius.md, alignItems: 'center' },
        standardWarning: { backgroundColor: color.warningSoft, color: color.warningDark },
        standardError: { backgroundColor: color.dangerSoft, color: color.dangerDark },
        standardSuccess: { backgroundColor: color.successSoft, color: color.successDark },
        standardInfo: { backgroundColor: color.infoSoft, color: color.infoDark },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderColor: color.borderStrong,
          '&.Mui-selected': {
            backgroundColor: color.primarySoft,
            color: color.primaryDark,
            '&:hover': { backgroundColor: color.primaryTint },
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: { root: { borderRadius: radius.pill, backgroundColor: color.bgSubtle } },
    },
    MuiSkeleton: { styleOverrides: { root: { backgroundColor: color.bgSubtle } } },
    MuiMenu: {
      styleOverrides: {
        paper: { borderRadius: radius.md, border: `1px solid ${color.border}`, boxShadow: shadow.raised },
      },
    },
  },
});
};

export const theme = createAppTheme('light');
