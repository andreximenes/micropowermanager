import { Users } from 'lucide-react';

import { isActive, navigation, type NavItem } from './navigation';

describe('isActive', () => {
  const customers: NavItem = {
    label: 'Customers',
    icon: Users,
    path: '/customers',
    activeOn: ['/customers', '/contracts'],
  };

  it('marks an entry active on any path it owns', () => {
    expect(isActive(customers, '/customers')).toBe(true);
    expect(isActive(customers, '/contracts/4')).toBe(true);
  });

  it('leaves an entry inactive on paths it does not own', () => {
    expect(isActive(customers, '/settings')).toBe(false);
  });
});

describe('navigation', () => {
  it('gives every entry a unique label', () => {
    const labels = navigation.map((item) => item.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('links every entry to an in-app path it owns', () => {
    for (const item of navigation) {
      expect(item.path.startsWith('/')).toBe(true);
      expect(isActive(item, item.path)).toBe(true);
    }
  });
});
