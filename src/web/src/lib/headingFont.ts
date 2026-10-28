/**
 * Sharp Grotesk is licensed and this repository is public, so the font file is never
 * committed. When a private URL is configured it is registered at runtime; otherwise
 * --font-heading falls back to the next family in its stack.
 */
export function registerHeadingFont(url: string | undefined, fonts: FontFaceSet = document.fonts): void {
  if (!url) {
    return;
  }
  const face = new FontFace('Sharp Grotesk', `url(${JSON.stringify(url)})`, {
    weight: '500 800',
    display: 'swap',
  });
  face
    .load()
    .then((loaded) => fonts.add(loaded))
    .catch((error: unknown) => {
      console.warn(`Heading font could not be loaded from ${url}`, error);
    });
}
