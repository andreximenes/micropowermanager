import { safeRedirect } from './redirect';

describe('safeRedirect', () => {
  it.each(['/', '/customers/7', '/customers/7?tab=payments#top'])(
    'follows the same-origin path %s',
    (path) => {
      expect(safeRedirect(path)).toBe(path);
    },
  );

  it.each([
    ['another origin', 'https://evil.example/'],
    ['a protocol-relative URL', '//evil.example'],
    ['a backslash trick', '/\\evil.example'],
    ['a relative path', 'customers/7'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['an empty string', ''],
    ['a non-string', 42],
    ['undefined', undefined],
  ])('rejects %s', (_, value) => {
    expect(safeRedirect(value)).toBeUndefined();
  });
});
