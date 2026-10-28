/**
 * Screens not rebuilt yet still live in the legacy Vue app, served on the same origin
 * under /legacy with hash routing, so the session carries over.
 */
export function legacyHref(path: string): string {
  return `/legacy/#${path.startsWith('/') ? path : `/${path}`}`;
}

export type NavItem = {
  label: string;
  /** In-app route when the screen is rebuilt, otherwise a legacy path. */
  to: { app: string } | { legacy: string };
  permission?: string;
};

export const navigation: NavItem[] = [
  { label: 'Dashboard', to: { legacy: '/' } },
  { label: 'Customers', to: { legacy: '/people' }, permission: 'customers' },
  { label: 'Transactions', to: { legacy: '/transactions' }, permission: 'transactions' },
  { label: 'Solar Home Systems', to: { legacy: '/solar-home-systems' } },
  { label: 'Appliances', to: { legacy: '/appliances' }, permission: 'appliances' },
  { label: 'Tickets', to: { legacy: '/tickets' }, permission: 'tickets' },
  { label: 'Agents', to: { legacy: '/agents' } },
  { label: 'Reports', to: { legacy: '/reports' }, permission: 'reports' },
  { label: 'Settings', to: { legacy: '/settings/configuration' }, permission: 'settings' },
];

export function navHref(item: NavItem): string {
  return 'app' in item.to ? item.to.app : legacyHref(item.to.legacy);
}
