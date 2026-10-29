/**
 * jsdom cannot leave the page, and `location.assign`/`replace` are non-configurable, so
 * `window.location` is swapped for a stand-in that records those calls and forwards the
 * rest to the real location. The proxy wraps a plain object because proxy invariants
 * forbid reporting other values for the real location's non-configurable methods.
 */
export function stubLocationNavigation() {
  const real = window.location;
  const assign = vi.fn<(url: string | URL) => void>();
  const replace = vi.fn<(url: string | URL) => void>();
  const standIn = new Proxy({} as Location, {
    get(_, property) {
      if (property === 'assign') {
        return assign;
      }
      if (property === 'replace') {
        return replace;
      }
      const value: unknown = Reflect.get(real, property, real);
      return typeof value === 'function' ? value.bind(real) : value;
    },
  });
  vi.spyOn(window, 'location', 'get').mockReturnValue(standIn);
  return { assign, replace };
}
