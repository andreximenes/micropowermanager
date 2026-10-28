'use client';

import { useEffect } from 'react';

import { SPARK_EGGS, type SparkEggName } from './easter-eggs';
import { prefersReducedMotion } from './easter-eggs/palette';

type SparkEasterEggProps = {
  // Pick one no sibling app uses — see SPARK_EGG_CATALOG.
  egg: SparkEggName;
};

// Typing "spark" anywhere on the page fires a short, on-brand effect.
// Renders nothing; installs one keydown listener and lazy-loads the effect the
// first time it triggers.
export function SparkEasterEgg({ egg }: SparkEasterEggProps) {
  useEffect(() => {
    const WORD = 'spark';
    let buffer = '';
    let running = false;

    function onKeyDown(event: KeyboardEvent) {
      // Single letters only: this must not fight with shortcuts or IME input.
      if (!event.key || event.key.length !== 1 || !/[a-z]/i.test(event.key))
        return;

      buffer = (buffer + event.key.toLowerCase()).slice(-WORD.length);
      if (buffer !== WORD || running) return;

      buffer = '';
      running = true;
      void SPARK_EGGS[egg]()
        .then((module) => module.play(prefersReducedMotion()))
        .catch(() => {
          // An egg is decoration — a failed chunk load must never surface.
        })
        .finally(() => {
          running = false;
        });
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [egg]);

  return null;
}
