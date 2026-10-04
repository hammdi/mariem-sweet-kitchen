import { ReactNode, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Avatar,
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  ButtonBase,
  Dialog,
  Divider,
  Drawer,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  AccountBalanceWallet,
  AutoAwesome,
  CalendarMonthOutlined,
  Check,
  DarkModeOutlined,
  Home,
  KeyboardArrowDown,
  Language,
  LightModeOutlined,
  Logout,
  Menu as MenuIcon,
  NotificationsNoneOutlined,
  ReceiptLong,
  Search,
  ShoppingCart,
  Storefront,
  Category,
  OpenInNew,
} from '@mui/icons-material';
import { logout } from '../../store/slices/authSlice';
import { AdminDataProvider, useAdminData } from '../../context/AdminDataContext';
import { HelpProvider, useHelp } from '../../help/HelpContext';
import HelpFab from '../../help/HelpFab';
import HelpPanel, { FAB_CLEARANCE } from '../../help/HelpPanel';
import GuidedTour from '../../help/GuidedTour';
import AiAssistant from '../admin/AiAssistant';
import { ThemeModeProvider, useThemeMode } from '../../theme/ThemeModeContext';
import { color, font, layout, motion, radius, shadow } from '../../theme/tokens';
import Illustration from '../illustrations/Pastry';
import { formatDT } from '../../utils/format';
import TopbarKpis from './TopbarKpis';
import GlobalSearch from './GlobalSearch';
import { isActive, MAIN_NAV, NavItem, pageTitle, SETTINGS_NAV } from './navigation';

/**
 * Ossature de l'administration, calquée sur la maquette de référence :
 * menu latéral blanc (logo, navigation, illustration), barre du haut (recherche,
 * thème, langue, calendrier, notifications, profil), indicateurs du jour avec
 * la carte date et l'illustration croissant, aide ✨ flottante.
 */
export default function AdminLayout() {
  return (
    <ThemeModeProvider>
      <AdminDataProvider>
        <HelpProvider>
          <Shell />
        </HelpProvider>
      </AdminDataProvider>
    </ThemeModeProvider>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
      <Illustration name="chefHat" sx={{ width: compact ? 36 : 56, height: compact ? 36 : 56 }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontFamily: font.brand, fontWeight: 700, color: color.primary, lineHeight: 1.05, fontSize: compact ? '1rem' : '1.22rem' }}>
          Mariem&apos;s
        </Typography>
        <Typography sx={{ fontFamily: font.brand, fontWeight: 700, color: color.primary, lineHeight: 1.05, fontSize: compact ? '1rem' : '1.22rem', whiteSpace: 'nowrap' }}>
          Sweet Kitchen
        </Typography>
      </Box>
      {!compact && <Illustration name="wheat" sx={{ width: 20, height: 34, ml: -0.75, mt: -1.5 }} />}
    </Box>
  );
}

function Count({ n }: { n: number }) {
  return (
    <Box
      component="span"
      aria-label={`${n} en attente`}
      sx={{
        minWidth: 20,
        height: 20,
        px: 0.6,
        borderRadius: `${radius.pill}px`,
        bgcolor: color.danger,
        color: '#fff',
        fontSize: '0.7rem',
        fontWeight: 700,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {n > 99 ? '99+' : n}
    </Box>
  );
}

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { summary } = useAdminData();
  const active = isActive(item, pathname);
  const count = item.badge === 'pendingOrders' ? summary?.orders.pending || 0 : item.badge === 'purchasesNeeded' ? summary?.stock.purchasesNeeded || 0 : 0;

  const row = {
    position: 'relative',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 1.75,
    px: 1.75,
    py: 1.1,
    borderRadius: `${radius.md}px`,
    justifyContent: 'flex-start',
  } as const;

  if (item.soon) {
    return (
      <Tooltip title="Pas encore disponible : lots produits et vitrine (prévu)" placement="right">
        <Box aria-disabled sx={{ ...row, color: color.inkMuted, cursor: 'default' }}>
          <Box sx={{ display: 'flex', '& svg': { fontSize: 23 } }}>{item.icon}</Box>
          <Typography sx={{ fontWeight: 500, fontSize: '0.95rem', flex: 1 }}>{item.label}</Typography>
          <Box component="span" sx={{ fontSize: '0.62rem', fontWeight: 700, px: 0.75, py: 0.2, borderRadius: `${radius.pill}px`, bgcolor: color.bgSubtle, color: color.inkSoft }}>
            À venir
          </Box>
        </Box>
      </Tooltip>
    );
  }

  return (
    <ButtonBase
      onClick={() => {
        navigate(item.path!);
        onNavigate?.();
      }}
      aria-current={active ? 'page' : undefined}
      sx={{
        ...row,
        color: active ? color.primaryDark : color.ink,
        bgcolor: active ? color.primarySoft : 'transparent',
        transition: `background-color ${motion.fast}ms ${motion.ease}, color ${motion.fast}ms`,
        '&:hover': { bgcolor: active ? color.primarySoft : color.bgSubtle },
        '& svg': { color: active ? color.primary : color.ink },
        '&::before': active
          ? { content: '""', position: 'absolute', left: 0, top: 6, bottom: 6, width: 4, borderRadius: 4, bgcolor: color.primary }
          : {},
      }}
    >
      <Box sx={{ display: 'flex', '& svg': { fontSize: 23 } }}>{item.icon}</Box>
      <Typography sx={{ fontWeight: active ? 700 : 500, fontSize: '0.95rem', flex: 1, textAlign: 'left' }}>{item.label}</Typography>
      {count > 0 && <Count n={count} />}
    </ButtonBase>
  );
}

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const { openPanel } = useHelp();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 2.5, pt: 2.75, pb: 2.25 }}>
        <Brand />
      </Box>
      <Box component="nav" aria-label="Navigation principale" data-tour="nav-main" sx={{ px: 1.75, flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {MAIN_NAV.map((item) => (
            <NavLink key={item.id} item={item} onNavigate={onNavigate} />
          ))}
        </Box>
        <Divider sx={{ my: 1.5, mx: 1 }} />
        <NavLink item={SETTINGS_NAV} onNavigate={onNavigate} />
        <ButtonBase
          onClick={() => {
            onNavigate?.();
            openPanel();
          }}
          sx={{ width: '100%', display: 'flex', gap: 1.25, px: 1.75, py: 1.1, borderRadius: `${radius.md}px`, justifyContent: 'flex-start', color: color.ink, '&:hover': { bgcolor: color.bgSubtle } }}
        >
          <Box
            sx={{ width: 23, height: 23, borderRadius: '50%', background: `linear-gradient(135deg, #5AC8FA, ${color.info})`, display: 'grid', placeItems: 'center', color: '#fff', '& svg': { fontSize: 14 } }}
          >
            <AutoAwesome />
          </Box>
          <Typography sx={{ fontWeight: 500, fontSize: '0.95rem', textAlign: 'left', whiteSpace: 'nowrap', ml: 0.5 }}>Aide interactive</Typography>
          <AutoAwesome sx={{ fontSize: 16, color: color.warning }} />
          <Box sx={{ flex: 1 }} />
          <Box component="span" sx={{ fontSize: '0.62rem', fontWeight: 700, px: 0.7, py: 0.25, borderRadius: `${radius.pill}px`, bgcolor: color.butter, color: color.warningDark }}>
            Nouveau
          </Box>
        </ButtonBase>
      </Box>
      {/* Bas du menu : illustration pâtisserie décorative (comme la référence) */}
      <Box
        aria-hidden
        sx={{
          position: 'relative',
          height: 170,
          mt: 1.5,
          '@media (max-height: 860px)': { display: 'none' },
          overflow: 'hidden',
          background: `linear-gradient(180deg, ${color.surface} 0%, ${color.primarySoft} 55%, ${color.cream} 100%)`,
          flexShrink: 0,
        }}
      >
        <Typography sx={{ position: 'absolute', right: 18, top: 26, width: 128, textAlign: 'right', fontFamily: font.brand, fontStyle: 'italic', color: color.primaryDark, fontSize: '1.02rem', lineHeight: 1.3 }}>
          De bons gâteaux font de beaux moments <span style={{ color: '#D9364F' }}>♥</span>
        </Typography>
        <Illustration name="layerCake" sx={{ position: 'absolute', left: -28, bottom: -6, width: 190 }} />
      </Box>
    </Box>
  );
}

function ThemeToggle() {
  const { mode, toggle } = useThemeMode();
  return (
    <Tooltip title={mode === 'dark' ? 'Thème clair' : 'Thème sombre'}>
      <IconButton onClick={toggle} aria-label={mode === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'} sx={{ color: color.warning }}>
        {mode === 'dark' ? <DarkModeOutlined /> : <LightModeOutlined />}
      </IconButton>
    </Tooltip>
  );
}

function LanguageMenu() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <ButtonBase onClick={(e) => setAnchor(e.currentTarget)} aria-label="Langue" sx={{ gap: 0.75, px: 1, py: 0.75, borderRadius: `${radius.sm}px`, color: color.ink, '&:hover': { bgcolor: color.bgSubtle } }}>
        <Language sx={{ fontSize: 22 }} />
        <Typography sx={{ fontSize: '0.92rem', fontWeight: 500, display: { xs: 'none', xl: 'block' } }}>Français</Typography>
        <KeyboardArrowDown sx={{ fontSize: 18, display: { xs: 'none', xl: 'block' } }} />
      </ButtonBase>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <MenuItem selected onClick={() => setAnchor(null)}>
          <ListItemIcon>
            <Check fontSize="small" />
          </ListItemIcon>
          Français
        </MenuItem>
        {['English', 'العربية'].map((l) => (
          <MenuItem key={l} disabled>
            <ListItemIcon />
            <ListItemText primary={l} secondary="bientôt" />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function CalendarButton() {
  const navigate = useNavigate();
  return (
    <Tooltip title="Calendrier des commandes">
      <IconButton onClick={() => navigate('/admin/calendar')} aria-label="Ouvrir le calendrier" data-tour="header-calendar" sx={{ color: color.ink }}>
        <CalendarMonthOutlined />
      </IconButton>
    </Tooltip>
  );
}

/** Notifications : uniquement des informations réelles du jour (aucune donnée inventée). */
function Notifications() {
  const navigate = useNavigate();
  const { summary: s } = useAdminData();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const items = s
    ? [
        s.orders.actionRequired > 0 && { emoji: '⛔', text: `${s.orders.actionRequired} commande(s) urgente(s) bloquée(s) par un ingrédient`, to: '/admin' },
        (s.orders.pending || 0) > 0 && { emoji: '📝', text: `${s.orders.pending} commande(s) en attente de confirmation`, to: '/admin/orders?status=pending' },
        s.stock.purchasesNeeded > 0 && { emoji: '🛒', text: `${s.stock.purchasesNeeded} ingrédient(s) à acheter (≈ ${formatDT(s.stock.purchasesEstimatedCost)})`, to: '/admin/shopping-list' },
        s.stock.lowStock > 0 && { emoji: '📦', text: `${s.stock.lowStock} ingrédient(s) sous le seuil d’alerte`, to: '/admin/stock' },
        (s.orders.ready || 0) > 0 && { emoji: '🎂', text: `${s.orders.ready} commande(s) prête(s) à remettre`, to: '/admin/orders?status=ready' },
        s.outstanding > 0 && { emoji: '⏳', text: `${formatDT(s.outstanding)} à encaisser`, to: '/admin/cash?tab=receivables' },
      ].filter(Boolean)
    : [];
  const list = items as { emoji: string; text: string; to: string }[];
  return (
    <>
      <Tooltip title="Notifications">
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label={`Notifications (${list.length})`} sx={{ color: color.ink }}>
          <Badge badgeContent={list.length} color="error" max={9}>
            <NotificationsNoneOutlined />
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 340, maxWidth: 'calc(100vw - 24px)' } }}
      >
        <Typography sx={{ px: 2, py: 1, fontWeight: 700 }}>Notifications</Typography>
        {list.length === 0 && <Typography sx={{ px: 2, pb: 1.5, color: color.inkSoft, fontSize: '0.9rem' }}>Rien à signaler pour le moment 🎉</Typography>}
        {list.map((n) => (
          <MenuItem
            key={n.text}
            onClick={() => {
              setAnchor(null);
              navigate(n.to);
            }}
            sx={{ whiteSpace: 'normal', alignItems: 'flex-start', gap: 1.25, py: 1.1 }}
          >
            <span aria-hidden>{n.emoji}</span>
            <Typography sx={{ fontSize: '0.88rem' }}>{n.text}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user } = useAdminData();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const name = user?.firstName || 'Admin';
  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label="Menu du compte"
        sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 0.5, pr: compact ? 0.5 : 1, borderRadius: `${radius.pill}px`, '&:hover': { bgcolor: color.bgSubtle } }}
      >
        <Avatar sx={{ width: 42, height: 42, bgcolor: '#7A4A2E', fontWeight: 700, fontSize: '1.05rem' }}>{name[0]}</Avatar>
        {!compact && (
          <Box sx={{ display: { xs: 'none', lg: 'block' }, textAlign: 'left' }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', lineHeight: 1.2, color: color.ink }}>{name}</Typography>
            <Typography sx={{ fontSize: '0.8rem', color: color.inkSoft }}>Administratrice</Typography>
          </Box>
        )}
        {!compact && <KeyboardArrowDown sx={{ color: color.ink, display: { xs: 'none', lg: 'block' } }} />}
      </ButtonBase>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            navigate('/admin/settings');
          }}
        >
          <ListItemIcon>
            <Category fontSize="small" />
          </ListItemIcon>
          Paramètres
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            navigate('/admin/sources');
          }}
        >
          <ListItemIcon>
            <Storefront fontSize="small" />
          </ListItemIcon>
          Sources d&apos;achat
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            window.open('/', '_blank');
          }}
        >
          <ListItemIcon>
            <OpenInNew fontSize="small" />
          </ListItemIcon>
          Voir le site client
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchor(null);
            dispatch(logout());
            navigate('/auth/login');
          }}
        >
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          Déconnexion
        </MenuItem>
      </Menu>
    </>
  );
}

/** Carte date (cliquable → calendrier), comme dans la référence. */
function DateCard() {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(t);
  }, []);
  const day = now.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
  return (
    <ButtonBase
      onClick={() => navigate('/admin/calendar')}
      aria-label="Ouvrir le calendrier"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1.1,
        borderRadius: `${radius.md}px`,
        bgcolor: color.surface,
        border: `1px solid ${color.border}`,
        boxShadow: shadow.card,
        flexShrink: 0,
        position: 'relative',
        zIndex: 1,
        transition: `box-shadow ${motion.base}ms, transform ${motion.base}ms`,
        '&:hover': { boxShadow: shadow.raised, transform: 'translateY(-1px)' },
      }}
    >
      <CalendarMonthOutlined sx={{ color: color.primary, fontSize: 28 }} />
      <Box sx={{ textAlign: 'left' }}>
        <Typography sx={{ fontSize: '0.92rem', fontWeight: 600, lineHeight: 1.25, textTransform: 'capitalize', color: color.ink }}>{day}</Typography>
        <Typography sx={{ fontSize: '0.92rem', fontWeight: 600, color: color.ink }}>{now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Typography>
      </Box>
    </ButtonBase>
  );
}

function MobileBottomNav({ onMenu }: { onMenu: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { summary } = useAdminData();
  const items: { value: string; label: string; icon: ReactNode }[] = [
    { value: '/admin', label: 'Accueil', icon: <Home /> },
    {
      value: '/admin/orders',
      label: 'Commandes',
      icon: (
        <Badge color="error" badgeContent={summary?.orders.pending || 0} max={99}>
          <ReceiptLong />
        </Badge>
      ),
    },
    { value: '/admin/cash', label: 'Caisse', icon: <AccountBalanceWallet /> },
    {
      value: '/admin/shopping-list',
      label: 'Courses',
      icon: (
        <Badge color="warning" badgeContent={summary?.stock.purchasesNeeded || 0} max={99}>
          <ShoppingCart />
        </Badge>
      ),
    },
  ];
  const current =
    items
      .map((i) => i.value)
      .filter((v) => (v === '/admin' ? pathname === v : pathname.startsWith(v)))
      .sort((a, b) => b.length - a.length)[0] || 'menu';
  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        borderRadius: 0,
        borderTop: `1px solid ${color.border}`,
        pb: 'env(safe-area-inset-bottom)',
        display: { xs: 'block', md: 'none' },
        bgcolor: color.surface,
      }}
    >
      <BottomNavigation
        value={current}
        onChange={(_, v) => (v === 'menu' ? onMenu() : navigate(v))}
        showLabels
        sx={{
          height: layout.bottomNavHeight,
          bgcolor: color.surface,
          '& .MuiBottomNavigationAction-root': { minWidth: 0, px: 0.5, color: color.inkSoft },
          '& .Mui-selected': { color: color.primaryDark },
          '& .MuiBottomNavigationAction-label': { fontSize: '0.7rem', fontWeight: 600, '&.Mui-selected': { fontSize: '0.7rem' } },
        }}
      >
        {items.map((i) => (
          <BottomNavigationAction key={i.value} value={i.value} label={i.label} icon={i.icon} />
        ))}
        <BottomNavigationAction value="menu" label="Menu" icon={<MenuIcon />} />
      </BottomNavigation>
    </Paper>
  );
}

/** Bas de page discret : identité, aide, paramètres, version. */
function Footer() {
  const navigate = useNavigate();
  const { openPanel } = useHelp();
  const link = { fontSize: '0.8rem', color: color.inkSoft, fontWeight: 600, '&:hover': { color: color.primaryDark } } as const;
  return (
    <Box component="footer" sx={{ mt: 4, pt: 2, borderTop: `1px solid ${color.border}`, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: { xs: 1, sm: 2 }, color: color.inkMuted }}>
      <Typography sx={{ fontFamily: font.brand, fontWeight: 700, color: color.primary, fontSize: '0.92rem' }}>🧁 Mariem&apos;s Sweet Kitchen</Typography>
      <Box sx={{ flex: 1 }} />
      <ButtonBase onClick={openPanel} sx={link}>
        Aide interactive
      </ButtonBase>
      <ButtonBase onClick={() => navigate('/admin/settings')} sx={link}>
        Paramètres
      </ButtonBase>
      <Typography sx={{ fontSize: '0.75rem' }}>Version 1.0</Typography>
    </Box>
  );
}

function Shell() {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const wide = useMediaQuery(theme.breakpoints.up('lg'));
  const xwide = useMediaQuery(theme.breakpoints.up('xl'));
  const [drawer, setDrawer] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { pathname } = useLocation();
  const { openPanel } = useHelp();
  const pageName = pathname.replace('/admin', '').replace('/', '') || 'dashboard';

  // nouvelle page : revenir en haut, fermer le menu mobile
  useEffect(() => {
    window.scrollTo({ top: 0 });
    setDrawer(false);
  }, [pathname]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: color.bg, display: 'flex' }}>
      {/* Menu latéral (ordinateur) */}
      {desktop && (
        <Box sx={{ width: layout.sidebarWidth, flexShrink: 0, bgcolor: color.surface, borderRight: `1px solid ${color.border}` }}>
          <Box component="aside" sx={{ position: 'sticky', top: 0, height: '100vh' }}>
            <NavContent />
          </Box>
        </Box>
      )}

      {/* Menu mobile */}
      <Drawer open={drawer} onClose={() => setDrawer(false)} PaperProps={{ sx: { width: 'min(300px, 86vw)', bgcolor: color.surface } }}>
        <NavContent onNavigate={() => setDrawer(false)} />
      </Drawer>

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Barre du haut */}
        <Box component="header" sx={{ position: 'sticky', top: 0, zIndex: 1100, bgcolor: color.headerGlass, backdropFilter: 'saturate(1.4) blur(10px)', borderBottom: `1px solid ${color.border}` }}>
          {desktop ? (
            <Box sx={{ height: layout.topbarHeight, display: 'flex', alignItems: 'center', gap: 1.5, px: { md: 3, lg: 3.5 } }}>
              <Box sx={{ flex: '1 1 680px', maxWidth: 680, minWidth: 260 }}>
                <GlobalSearch />
              </Box>
              <Box sx={{ ml: 'auto' }} />
              <ThemeToggle />
              <LanguageMenu />
              <CalendarButton />
              <Notifications />
              <UserMenu />
            </Box>
          ) : (
            <Box sx={{ height: layout.mobileTopbarHeight, display: 'flex', alignItems: 'center', gap: 0.25, px: 1 }}>
              <IconButton onClick={() => setDrawer(true)} aria-label="Ouvrir le menu">
                <MenuIcon />
              </IconButton>
              <Typography sx={{ flex: 1, fontFamily: font.heading, fontWeight: 700, fontSize: '1.02rem', color: color.ink, minWidth: 0 }} noWrap>
                {pageTitle(pathname)}
              </Typography>
              <IconButton onClick={() => setSearchOpen(true)} aria-label="Rechercher" sx={{ color: color.ink }}>
                <Search />
              </IconButton>
              <CalendarButton />
              <Notifications />
              <IconButton onClick={openPanel} aria-label="Aide" sx={{ color: color.primary }}>
                <AutoAwesome />
              </IconButton>
            </Box>
          )}
        </Box>

        {/* Indicateurs du jour + carte date + illustration (comme la référence) */}
        {desktop && (
          <Box sx={{ position: 'relative', px: { md: 3, lg: 3.5 }, pt: 2.5, pr: { xl: 24 }, display: 'flex', alignItems: 'center', gap: 2.5, overflow: 'hidden', minHeight: 108 }}>
            <Box sx={{ flex: '0 1 820px', minWidth: 0 }}>
              <TopbarKpis />
            </Box>
            {wide && <DateCard />}
            {xwide && <Illustration name="croissant" sx={{ position: 'absolute', right: -6, top: 0, width: 176, opacity: 0.97 }} />}
          </Box>
        )}

        <Box
          component="main"
          key={pathname}
          sx={{
            flex: 1,
            width: '100%',
            maxWidth: layout.contentMaxWidth,
            mx: 'auto',
            px: layout.gutter,
            pt: { xs: 2, md: 3 },
            // espace en bas : le bouton d'aide (et la barre mobile) ne cachent jamais un bouton
            pb: { xs: `${FAB_CLEARANCE.xs}px`, md: `${FAB_CLEARANCE.md}px` },
            animation: `page-in ${motion.slow}ms ${motion.easeOut} both`,
            '@keyframes page-in': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
          }}
        >
          <Outlet />
          <Footer />
        </Box>
      </Box>

      {/* Recherche plein écran sur téléphone */}
      <Dialog open={searchOpen} onClose={() => setSearchOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { alignSelf: 'flex-start', mt: 2, p: 1.5, overflow: 'visible' } }}>
        <GlobalSearch autoFocus onDone={() => setSearchOpen(false)} />
      </Dialog>

      <MobileBottomNav onMenu={() => setDrawer(true)} />
      <HelpFab />
      <HelpPanel />
      <AiAssistant page={pageName} />
      <GuidedTour />
    </Box>
  );
}
