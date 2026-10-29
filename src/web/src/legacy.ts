/**
 * Screens not rebuilt yet still live in the legacy Vue app, served on the same origin
 * under /legacy with hash routing, so the session carries over.
 */
export function legacyHref(path: string): string {
  return `/legacy/#${path.startsWith('/') ? path : `/${path}`}`;
}

import {
  FileText,
  Headset,
  LayoutDashboard,
  type LucideIcon,
  MapPin,
  Package,
  Settings,
  SunMedium,
  Ticket,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';

import { appModules, type ModuleKey } from '@/features/modules/catalog';

/** `MpmPlugin::SPARK_SHS` in the backend: plugin ids are fixed in `mpm_plugins`. */
export const SPARK_SHS_PLUGIN_ID = 28;

export type NavItem = {
  label: string;
  icon: LucideIcon;
  /** In-app route when the screen is rebuilt, otherwise a legacy path. */
  to: { app: string; activeOn: string[] } | { legacy: string };
  permission?: string;
  /** Shown only when the company has this plugin switched on. */
  plugin?: number;
  /** Shown only when the company has this module switched on in Settings > Modules. */
  module?: ModuleKey;
};

/** A module without a rebuilt screen opens a placeholder that points to LEGACY_SCREENS.md. */
function moduleItem(key: ModuleKey): NavItem {
  const { name, icon } = appModules[key];
  const path = `/modules/${key}`;
  return { label: name, icon, to: { app: path, activeOn: [path] }, module: key };
}

// Same order as the legacy sidebar.
export const navigation: NavItem[] = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    to: { app: '/dashboard', activeOn: ['/dashboard'] },
  },
  moduleItem('mini-grids'),
  {
    label: 'Reports',
    icon: FileText,
    to: { app: '/reports', activeOn: ['/reports'] },
    permission: 'reports',
  },
  {
    label: 'Customers',
    icon: Users,
    to: { app: '/customers', activeOn: ['/customers', '/contracts'] },
    permission: 'customers',
  },
  {
    label: 'Transactions',
    icon: Wallet,
    to: { app: '/transactions', activeOn: ['/transactions'] },
    permission: 'transactions',
  },
  {
    label: 'Tickets',
    icon: Ticket,
    to: { app: '/tickets', activeOn: ['/tickets'] },
    permission: 'tickets',
  },
  moduleItem('tariffs'),
  moduleItem('meters'),
  {
    label: 'Solar Home Systems',
    icon: SunMedium,
    to: { app: '/solar-home-systems', activeOn: ['/solar-home-systems'] },
  },
  moduleItem('targets'),
  moduleItem('sms'),
  moduleItem('maintenance'),
  {
    label: 'Appliances',
    icon: Package,
    to: { app: '/appliances', activeOn: ['/appliances'] },
    permission: 'appliances',
  },
  { label: 'Agents', icon: Headset, to: { app: '/agents', activeOn: ['/agents'] } },
  moduleItem('e-bikes'),
  {
    label: 'Spark SHS',
    icon: Zap,
    to: { app: '/spark-shs', activeOn: ['/spark-shs'] },
    plugin: SPARK_SHS_PLUGIN_ID,
  },
  { label: 'Locations', icon: MapPin, to: { app: '/locations', activeOn: ['/locations'] } },
  moduleItem('connections'),
  {
    label: 'Settings',
    icon: Settings,
    to: { app: '/settings', activeOn: ['/settings', '/profile'] },
    permission: 'settings',
  },
];

export function navHref(item: NavItem): string {
  return 'app' in item.to ? item.to.app : legacyHref(item.to.legacy);
}

/** Whether a rebuilt screen's menu entry owns the current path. */
export function isActive(item: NavItem, pathname: string): boolean {
  return 'app' in item.to && item.to.activeOn.some((prefix) => pathname.startsWith(prefix));
}
