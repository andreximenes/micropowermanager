import { Bike, Cable, Gauge, type LucideIcon, MessageSquare, Network, Receipt, Target, Wrench } from 'lucide-react';

/** Mirrors `App\Enums\AppModule` in the backend, which validates the stored keys. */
export const moduleKeys = [
  'mini-grids',
  'tariffs',
  'meters',
  'targets',
  'sms',
  'maintenance',
  'e-bikes',
  'connections',
] as const;
export type ModuleKey = (typeof moduleKeys)[number];

export type AppModule = { key: ModuleKey; name: string; description: string; icon: LucideIcon };

export const appModules: Record<ModuleKey, AppModule> = {
  'mini-grids': {
    key: 'mini-grids',
    name: 'Mini-grids',
    description: 'Cluster and mini-grid dashboards with revenue, energy and battery charts.',
    icon: Network,
  },
  tariffs: {
    key: 'tariffs',
    name: 'Tariffs',
    description: 'Energy tariffs with time-of-use prices and social tariffs for meters.',
    icon: Receipt,
  },
  meters: {
    key: 'meters',
    name: 'Meters',
    description: 'Smart meters, their readings and tokens, and the meter types they use.',
    icon: Gauge,
  },
  targets: {
    key: 'targets',
    name: 'Targets',
    description: 'Revenue and connection targets per mini-grid or cluster.',
    icon: Target,
  },
  sms: {
    key: 'sms',
    name: 'SMS',
    description: 'Sent and received SMS, bulk messages and the SMS templates and gateways.',
    icon: MessageSquare,
  },
  maintenance: {
    key: 'maintenance',
    name: 'Maintenance',
    description: 'Maintenance jobs assigned to external technicians.',
    icon: Wrench,
  },
  'e-bikes': {
    key: 'e-bikes',
    name: 'E-bikes',
    description: 'Electric bikes rented or sold to customers, with their battery status.',
    icon: Bike,
  },
  connections: {
    key: 'connections',
    name: 'Connections',
    description: 'Connection groups and connection types used to classify meter customers.',
    icon: Cable,
  },
};

/** Keys the backend sends that this app does not know are dropped, not trusted. */
export function enabledModuleKeys(stored: readonly string[] | null | undefined): ModuleKey[] {
  return moduleKeys.filter((key) => (stored ?? []).includes(key));
}
