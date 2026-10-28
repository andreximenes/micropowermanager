// The "type SPARK" egg catalog. Every Spark app wires up ONE of these, and a
// DIFFERENT one from its siblings — the egg is the app's signature.
//
// Each entry is a lazy import, so the effect only reaches the browser when
// someone actually types the word.
export const SPARK_EGGS = {
  'lightning-strike': () => import('./lightning-strike'),
  'spark-burst': () => import('./spark-burst'),
  'power-surge': () => import('./power-surge'),
  'ember-rain': () => import('./ember-rain'),
  'neon-sign': () => import('./neon-sign'),
  'cursor-arc': () => import('./cursor-arc'),
} as const;

export type SparkEggName = keyof typeof SPARK_EGGS;

// Shown on the Hub so an app owner can see which eggs are still free.
export const SPARK_EGG_CATALOG: Record<SparkEggName, string> = {
  'lightning-strike':
    'A jagged green bolt streaks across the screen behind a white-to-green flash. The calm default.',
  'spark-burst':
    'A fountain of green sparks arcs out of the header, twinkles and falls away.',
  'power-surge':
    'The whole UI charges up: green edge-glow, a short screen shake and two charge ripples.',
  'ember-rain':
    'Green embers rain from the top, drifting and twinkling before they fade out midway down.',
  'neon-sign':
    'A neon SPARK sign flickers to life in Spark green, buzzes once, then fades.',
  'cursor-arc':
    'Electric green arcs crackle and trail around the cursor for a few seconds.',
};
