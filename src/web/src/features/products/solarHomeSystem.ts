import type { ListedSolarHomeSystem, MappingStatus, Owner } from '@/api/solarHomeSystems';

type Pill = { status: 'success' | 'warning' | 'error' | 'neutral'; label: string };

export function ownerOf(solarHomeSystem: ListedSolarHomeSystem): Owner | null {
  return solarHomeSystem.device?.person ?? null;
}

export function ownershipPill(solarHomeSystem: ListedSolarHomeSystem): Pill {
  return ownerOf(solarHomeSystem)
    ? { status: 'success', label: 'With customer' }
    : { status: 'neutral', label: 'In stock' };
}

export const mappingPill: Record<MappingStatus, Pill> = {
  mapped: { status: 'success', label: 'Mapped' },
  not_mapped: { status: 'error', label: 'Not mapped' },
  unsupported: { status: 'neutral', label: 'No manufacturer API' },
  unknown: { status: 'neutral', label: 'Not checked' },
};

/** Tokens are read out to customers in groups of four digits. */
export function groupDigits(token: string): string {
  return token.replace(/(.{4})(?=.)/g, '$1 ');
}
