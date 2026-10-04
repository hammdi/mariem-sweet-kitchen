import { ReactNode } from 'react';
import {
  AccountBalanceWalletOutlined,
  BarChartOutlined,
  BlenderOutlined,
  CakeOutlined,
  EggOutlined,
  HomeOutlined,
  Inventory2Outlined,
  PeopleOutline,
  PrecisionManufacturingOutlined,
  ReceiptLongOutlined,
  SettingsOutlined,
  ShoppingCartOutlined,
} from '@mui/icons-material';

/**
 * Navigation admin — source unique (menu latéral, menu mobile, aide, titres).
 * Même organisation que la maquette de référence. Les pages moins fréquentes
 * restent accessibles ailleurs : Calendrier (barre du haut), Sources d'achat
 * (page Ingrédients), Catégories (Paramètres).
 * `soon` : fonctionnalité pas encore disponible, affichée « À venir », sans lien.
 */
export interface NavItem {
  id: string;
  label: string;
  path?: string;
  icon: ReactNode;
  badge?: 'pendingOrders' | 'purchasesNeeded';
  soon?: boolean;
  exact?: boolean;
}

export const MAIN_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', path: '/admin', icon: <HomeOutlined />, exact: true },
  { id: 'orders', label: 'Commandes', path: '/admin/orders', icon: <ReceiptLongOutlined />, badge: 'pendingOrders' },
  { id: 'cash', label: 'Caisse', path: '/admin/cash', icon: <AccountBalanceWalletOutlined /> },
  { id: 'shopping', label: 'Liste de courses', path: '/admin/shopping-list', icon: <ShoppingCartOutlined />, badge: 'purchasesNeeded' },
  { id: 'ingredients', label: 'Ingrédients', path: '/admin/ingredients', icon: <EggOutlined /> },
  { id: 'stock', label: 'Stock', path: '/admin/stock', icon: <Inventory2Outlined /> },
  { id: 'recipes', label: 'Recettes', path: '/admin/recipes', icon: <CakeOutlined /> },
  { id: 'production', label: 'Production', icon: <PrecisionManufacturingOutlined />, soon: true },
  { id: 'appliances', label: 'Machines', path: '/admin/appliances', icon: <BlenderOutlined /> },
  { id: 'clients', label: 'Clients', path: '/admin/clients', icon: <PeopleOutline /> },
  { id: 'statistics', label: 'Statistiques', path: '/admin/statistics', icon: <BarChartOutlined /> },
];

export const SETTINGS_NAV: NavItem = {
  id: 'settings',
  label: 'Paramètres',
  path: '/admin/settings',
  icon: <SettingsOutlined />,
};

/** Pages hors menu (titres de la barre mobile). */
const OTHER_PAGES: { path: string; label: string }[] = [
  { path: '/admin/calendar', label: 'Calendrier' },
  { path: '/admin/sources', label: "Sources d'achat" },
  { path: '/admin/categories', label: 'Catégories' },
];

export const isActive = (item: NavItem, pathname: string) =>
  !!item.path && (item.exact ? pathname === item.path : pathname === item.path || pathname.startsWith(`${item.path}/`));

/** Titre de la page courante (barre mobile, aide). */
export function pageTitle(pathname: string): string {
  const other = OTHER_PAGES.find((p) => pathname.startsWith(p.path));
  if (other) return other.label;
  if (pathname.startsWith('/admin/sources')) return "Sources d'achat";
  const match = [...MAIN_NAV, SETTINGS_NAV]
    .filter((i) => isActive(i, pathname))
    .sort((a, b) => (b.path?.length || 0) - (a.path?.length || 0))[0];
  return match?.label || 'Administration';
}
