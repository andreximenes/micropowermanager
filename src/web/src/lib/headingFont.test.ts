import { registerHeadingFont } from './headingFont';

type FakeFace = { family: string; source: string; descriptors: FontFaceDescriptors };

// jsdom has no FontFace, so a stand-in records how the face was declared.
function stubFontFace(load: () => Promise<unknown>) {
  const created: FakeFace[] = [];
  vi.stubGlobal(
    'FontFace',
    class {
      constructor(family: string, source: string, descriptors: FontFaceDescriptors) {
        created.push({ family, source, descriptors });
      }

      load() {
        return load().then(() => this);
      }
    },
  );
  return created;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('registerHeadingFont', () => {
  it('does nothing without a URL', () => {
    const created = stubFontFace(() => Promise.resolve());
    const fonts = { add: vi.fn() } as unknown as FontFaceSet;

    registerHeadingFont(undefined, fonts);
    registerHeadingFont('', fonts);

    expect(created).toHaveLength(0);
    expect(fonts.add).not.toHaveBeenCalled();
  });

  it('loads the face from the URL and adds it to the document fonts', async () => {
    const created = stubFontFace(() => Promise.resolve());
    const fonts = { add: vi.fn() } as unknown as FontFaceSet;

    registerHeadingFont('https://fonts.example/sharp.woff2', fonts);

    await vi.waitFor(() => expect(fonts.add).toHaveBeenCalledTimes(1));
    expect(created).toEqual([
      {
        family: 'Sharp Grotesk',
        source: 'url("https://fonts.example/sharp.woff2")',
        descriptors: { weight: '500 800', display: 'swap' },
      },
    ]);
  });

  it('warns instead of failing when the font cannot load', async () => {
    stubFontFace(() => Promise.reject(new Error('403')));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fonts = { add: vi.fn() } as unknown as FontFaceSet;

    registerHeadingFont('https://fonts.example/sharp.woff2', fonts);

    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    expect(warn.mock.calls[0]?.[0]).toContain('https://fonts.example/sharp.woff2');
    expect(fonts.add).not.toHaveBeenCalled();
  });
});
