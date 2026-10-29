import type { ListedUser, Role } from '@/api/users';
import { can, type Session } from '@/auth/session';

const roleLabels: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  'financial-manager': 'Financial manager',
  user: 'User',
};

/** `financial-manager` → "Financial manager"; roles added later read the same way. */
export function roleLabel(name: string): string {
  if (roleLabels[name]) {
    return roleLabels[name];
  }
  const words = name.replace(/[-_]/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Permission names from RolesPermissionsPopulator, in the order a person reads them.
const permissionLabels: [string, string][] = [
  ['customers', 'customers'],
  ['appliances', 'products'],
  ['tickets', 'tickets'],
  ['payments', 'payments'],
  ['transactions', 'transactions'],
  ['reports', 'reports'],
  ['exports', 'exports'],
  ['users', 'users'],
  ['settings', 'settings'],
  ['plugins', 'plugins'],
  ['settings.api-keys', 'API keys'],
];

/** What a role lets someone work with, e.g. "Customers, products and tickets." */
export function roleSummary(role: Role): string {
  if (role.permissions.includes('users.manage-owner')) {
    return 'Everything, including managing other owners.';
  }
  if (role.permissions.includes('users.manage-admin')) {
    return 'Everything except managing owners.';
  }
  const areas = permissionLabels
    .filter(([permission]) => role.permissions.includes(permission))
    .map(([, label]) => label);
  if (areas.length === 0) {
    return 'No access to any area yet.';
  }
  const last = areas.pop() ?? '';
  const text = areas.length > 0 ? `${areas.join(', ')} and ${last}` : last;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

/** Mirrors `UserPolicy::assignRole`, so the form offers only roles the server accepts. */
export function canAssignRole(session: Session | null, role: string): boolean {
  if (role === 'owner') {
    return can(session, 'users.manage-owner');
  }
  if (role === 'admin') {
    return can(session, 'users.manage-admin');
  }
  return can(session, 'users');
}

/** Mirrors `UserPolicy::update`, including its refusal to touch a company's only owner. */
export function canEditUser(
  session: Session | null,
  user: ListedUser,
  ownerCount: number,
): boolean {
  if (user.roles.includes('owner')) {
    return ownerCount > 1 && can(session, 'users.manage-owner');
  }
  if (user.roles.includes('admin')) {
    return can(session, 'users.manage-admin');
  }
  return session?.user.id === user.id || can(session, 'users');
}

/** Mirrors `UserPolicy::delete`. */
export function canDeleteUser(session: Session | null, user: ListedUser): boolean {
  if (session?.user.id === user.id) {
    return false;
  }
  if (user.roles.includes('owner')) {
    return can(session, 'users.manage-owner');
  }
  if (user.roles.includes('admin')) {
    return can(session, 'users.manage-admin');
  }
  return can(session, 'users');
}

/** A user has one name field; the avatar reads its first and last words. */
export function personOf(name: string): { name: string; surname: string } {
  const words = name.trim().split(/\s+/);
  return { name: words[0] ?? '', surname: words.length > 1 ? (words.at(-1) ?? '') : '' };
}
