export const branding = {
  productName: "Spark CRM",
  poweredBy: "MicroPowerManager",
  poweredByUrl: "https://micropowermanager.io",
}

// Sharp Grotesk is a licensed face that must not live in this public repository,
// so it is loaded from wherever VUE_APP_HEADING_FONT_URL points. Without it the
// --font-heading stack falls back to Roboto.
export function registerHeadingFont() {
  const url = process.env.VUE_APP_HEADING_FONT_URL
  if (!url) {
    return
  }

  const font = new FontFace("Sharp Grotesk", `url(${JSON.stringify(url)})`, {
    weight: "500 800",
    display: "swap",
  })
  font
    .load()
    .then((loaded) => document.fonts.add(loaded))
    .catch((error) =>
      console.warn(`Heading font could not be loaded from ${url}`, error),
    )
}
