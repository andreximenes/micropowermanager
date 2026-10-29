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
};

// Same order as the legacy sidebar, so moving between the two apps keeps things in place.
// Modules Spark does not run (mini-grid meters, tariffs, SMS, e-bikes, targets) are left out.
export const navigation: NavItem[] = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    to: { app: '/dashboard', activeOn: ['/dashboard'] },
  },
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
  {
    label: 'Solar Home Systems',
    icon: SunMedium,
    to: { app: '/solar-home-systems', activeOn: ['/solar-home-systems'] },
  },
  {
    label: 'Appliances',
    icon: Package,
    to: { app: '/appliances', activeOn: ['/appliances'] },
    permission: 'appliances',
  },
  { label: 'Agents', icon: Headset, to: { app: '/agents', activeOn: ['/agents'] } },
  {
    label: 'Spark SHS',
    icon: Zap,
    to: { app: '/spark-shs', activeOn: ['/spark-shs'] },
    plugin: SPARK_SHS_PLUGIN_ID,
  },
  { label: 'Locations', icon: MapPin, to: { legacy: '/locations/add-cluster' } },
  { label: 'Settings', icon: Settings, to: { legacy: '/settings/configuration' }, permission: 'settings' },
];

export function navHref(item: NavItem): string {
  return 'app' in item.to ? item.to.app : legacyHref(item.to.legacy);
}

/** Whether a rebuilt screen's menu entry owns the current path. */
export function isActive(item: NavItem, pathname: string): boolean {
  return 'app' in item.to && item.to.activeOn.some((prefix) => pathname.startsWith(prefix));
}
