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
  path: string;
  /** Path prefixes whose screens highlight this entry. */
  activeOn: string[];
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
  return { label: name, icon, path, activeOn: [path], module: key };
}

export const navigation: NavItem[] = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
    activeOn: ['/dashboard'],
  },
  moduleItem('mini-grids'),
  {
    label: 'Reports',
    icon: FileText,
    path: '/reports',
    activeOn: ['/reports'],
    permission: 'reports',
  },
  {
    label: 'Customers',
    icon: Users,
    path: '/customers',
    activeOn: ['/customers', '/contracts'],
    permission: 'customers',
  },
  {
    label: 'Transactions',
    icon: Wallet,
    path: '/transactions',
    activeOn: ['/transactions'],
    permission: 'transactions',
  },
  {
    label: 'Tickets',
    icon: Ticket,
    path: '/tickets',
    activeOn: ['/tickets'],
    permission: 'tickets',
  },
  moduleItem('tariffs'),
  moduleItem('meters'),
  {
    label: 'Solar Home Systems',
    icon: SunMedium,
    path: '/solar-home-systems',
    activeOn: ['/solar-home-systems'],
  },
  moduleItem('targets'),
  moduleItem('sms'),
  moduleItem('maintenance'),
  {
    label: 'Appliances',
    icon: Package,
    path: '/appliances',
    activeOn: ['/appliances'],
    permission: 'appliances',
  },
  { label: 'Agents', icon: Headset, path: '/agents', activeOn: ['/agents'] },
  moduleItem('e-bikes'),
  {
    label: 'Spark SHS',
    icon: Zap,
    path: '/spark-shs',
    activeOn: ['/spark-shs'],
    plugin: SPARK_SHS_PLUGIN_ID,
  },
  { label: 'Locations', icon: MapPin, path: '/locations', activeOn: ['/locations'] },
  moduleItem('connections'),
  {
    label: 'Settings',
    icon: Settings,
    path: '/settings',
    activeOn: ['/settings', '/profile'],
    permission: 'settings',
  },
];

/** Whether a menu entry owns the current path. */
export function isActive(item: NavItem, pathname: string): boolean {
  return item.activeOn.some((prefix) => pathname.startsWith(prefix));
}
