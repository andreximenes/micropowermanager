import { Ticket } from 'lucide-react';

import { legacyHref, navHref, navigation } from './legacy';

describe('legacyHref', () => {
  it('points at the legacy app hash route', () => {
    expect(legacyHref('/people')).toBe('/legacy/#/people');
  });

  it('adds the leading slash when missing', () => {
    expect(legacyHref('people/7')).toBe('/legacy/#/people/7');
  });
});

describe('navHref', () => {
  it('links legacy screens into the legacy app', () => {
    expect(navHref({ label: 'Tickets', icon: Ticket, to: { legacy: '/tickets' } })).toBe('/legacy/#/tickets');
  });

  it('links rebuilt screens to the in-app route', () => {
    expect(navHref({ label: 'Customer', icon: Ticket, to: { app: '/customers/7' } })).toBe('/customers/7');
  });

  it('gives every navigation item a unique label', () => {
    const labels = navigation.map((item) => item.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
