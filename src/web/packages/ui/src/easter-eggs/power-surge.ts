import { EGG_GREEN, EGG_GREEN_LINE, EGG_TEAL } from './palette';

// The whole UI charges up: a pulsing green edge-glow, a short screen shake and
// two concentric charge ripples that settle in under two seconds.
export function play(reduceMotion: boolean): Promise<void> {
  return new Promise((resolve) => {
    const id = `spk${Math.random().toString(36).slice(2, 8)}`;
    const style = document.createElement('style');
    const host = document.createElement('div');
    host.id = id;
    host.setAttribute('aria-hidden', 'true');

    let frameId = 0;
    let done = false;
    function cleanup() {
      if (done) return;
      done = true;
      cancelAnimationFrame(frameId);
      [host, style].forEach((node) => node.parentNode?.removeChild(node));
      // The shake writes straight to <html> — always hand it back untouched.
      document.documentElement.style.transform = '';
      document.documentElement.style.willChange = '';
      resolve();
    }

    if (reduceMotion) {
      style.textContent =
        `#${id}{position:fixed;inset:0;z-index:2147483646;pointer-events:none;` +
        `box-shadow:inset 0 0 140px 34px ${EGG_GREEN}aa;opacity:0;transition:opacity .18s ease-out}` +
        `#${id}.on{opacity:1}`;
      document.head.appendChild(style);
      document.body.appendChild(host);
      host.getBoundingClientRect(); // force a frame so the transition runs
      host.className = 'on';
      setTimeout(() => {
        host.className = '';
      }, 260);
      setTimeout(cleanup, 620);
      return;
    }

    style.textContent = [
      `@keyframes ${id}-vig{0%{opacity:0}16%{opacity:1}50%{opacity:.9}100%{opacity:0}}`,
      `@keyframes ${id}-pulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.4)}}`,
      `@keyframes ${id}-ripple{0%{transform:translate(-50%,-50%) scale(.12);opacity:0}10%{opacity:.9}100%{transform:translate(-50%,-50%) scale(2.6);opacity:0}}`,
      `#${id}{position:fixed;inset:0;z-index:2147483646;pointer-events:none;overflow:hidden}`,
      `#${id} .vig{position:absolute;inset:0;box-shadow:inset 0 0 120px 26px ${EGG_GREEN}cc,inset 0 0 280px 90px ${EGG_GREEN_LINE}55;animation:${id}-vig 1.7s ease-out forwards,${id}-pulse .5s ease-in-out 2}`,
      `#${id} .rip{position:absolute;left:50%;top:50%;width:56vmax;height:56vmax;border-radius:50%;border:3px solid ${EGG_GREEN};box-shadow:0 0 44px 10px ${EGG_GREEN}aa,inset 0 0 34px ${EGG_TEAL}88;animation:${id}-ripple 1.4s cubic-bezier(.2,.7,.3,1) forwards}`,
      `#${id} .rip.b{border-color:${EGG_TEAL};animation-delay:.12s;animation-duration:1.55s}`,
    ].join('');

    for (const className of ['vig', 'rip', 'rip b']) {
      const node = document.createElement('div');
      node.className = className;
      host.appendChild(node);
    }
    document.head.appendChild(style);
    document.body.appendChild(host);

    const root = document.documentElement;
    const shakeStart = performance.now();
    const SHAKE_MS = 210;
    root.style.willChange = 'transform';

    function shake(now: number) {
      const t = (now - shakeStart) / SHAKE_MS;
      if (t >= 1) {
        root.style.transform = '';
        return;
      }
      const amplitude = (1 - t) * 5;
      const angle = now / 9;
      root.style.transform = `translate(${(Math.cos(angle) * amplitude).toFixed(2)}px,${(Math.sin(angle * 1.3) * amplitude).toFixed(2)}px)`;
      frameId = requestAnimationFrame(shake);
    }

    frameId = requestAnimationFrame(shake);
    setTimeout(cleanup, 1750);
  });
}
