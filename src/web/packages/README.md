# Vendored Spark packages

`ui` and `design-tokens` are copied from the Spark Apps Hub (`packages/`, commit `b3788d1`), so this app looks like every other Spark tool.

Changes from the Hub copy:

- The Sharp Grotesk font file and its `@font-face` are removed.
  The font is licensed and this repository is public.
  `VITE_HEADING_FONT_URL` loads it at runtime from a private origin instead.
- `SparkThemeScript` and the `next` peer dependency are removed.
  The pre-paint theme script lives inline in `index.html`.

To re-sync, copy the Hub's `packages/ui` and `packages/design-tokens` over these folders, excluding `*.otf`, then reapply the changes above.
