import { EGG_GREEN, EGG_GREEN_LINE, EGG_TEAL, OVERLAY_CSS } from './palette';

type Ember = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  sway: number;
  swaySpeed: number;
  radius: number;
  color: string;
  life: number;
};

// Green embers rain from the top, drifting and twinkling, and fade out before
// they reach the bottom.
export function play(reduceMotion: boolean): Promise<void> {
  return new Promise((resolve) => {
    const colors = [EGG_GREEN, EGG_TEAL, EGG_GREEN_LINE];
    const DURATION = reduceMotion ? 900 : 3000;

    const style = document.createElement('style');
    style.textContent =
      '@keyframes spk-ember-flash{0%{opacity:0}25%{opacity:.55}100%{opacity:0}}';
    document.head.appendChild(style);

    if (reduceMotion) {
      const flash = document.createElement('div');
      flash.style.cssText =
        `${OVERLAY_CSS}background:radial-gradient(circle at 50% 0%, rgba(81,230,50,.35), rgba(19,1,81,0) 60%);` +
        'animation:spk-ember-flash 900ms ease-out forwards;';
      document.body.appendChild(flash);
      setTimeout(() => {
        [flash, style].forEach((node) => node.parentNode?.removeChild(node));
        resolve();
      }, DURATION);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.style.cssText = OVERLAY_CSS;
    document.body.appendChild(canvas);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    resize();
    window.addEventListener('resize', resize);

    const context = canvas.getContext('2d');
    let frameId = 0;
    let done = false;
    function cleanup() {
      if (done) return;
      done = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      [canvas, style].forEach((node) => node.parentNode?.removeChild(node));
      resolve();
    }

    if (!context) {
      setTimeout(cleanup, 300);
      return;
    }

    function spawn(initial: boolean): Ember {
      return {
        x: Math.random() * width,
        y: initial ? Math.random() * -height : -10 - Math.random() * 40,
        vy: 40 + Math.random() * 90, // px/sec downward
        vx: (Math.random() - 0.5) * 30,
        sway: Math.random() * Math.PI * 2,
        swaySpeed: 1.5 + Math.random() * 2.5,
        radius: 1.2 + Math.random() * 2.6,
        color: colors[(Math.random() * colors.length) | 0] ?? EGG_GREEN,
        life: 1.5 + Math.random() * 1.6, // seconds before it burns out
      };
    }

    const count = Math.min(140, Math.round(width / 9));
    const embers = Array.from({ length: count }, () => spawn(true));

    const start = performance.now();
    let last = start;

    function frame(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const elapsed = now - start;
      // Fade everything over the last 700ms so nothing snaps away.
      const globalFade = Math.min(1, Math.max(0, (DURATION - elapsed) / 700));

      context!.clearRect(0, 0, canvas.width, canvas.height);
      context!.save();
      context!.scale(dpr, dpr);
      context!.globalCompositeOperation = 'lighter';

      for (let i = 0; i < embers.length; i++) {
        const ember = embers[i]!;
        ember.sway += ember.swaySpeed * dt;
        ember.y += ember.vy * dt;
        ember.x += (ember.vx + Math.sin(ember.sway) * 22) * dt;
        ember.life -= dt;

        const vertical = Math.max(0, 1 - ember.y / (height * 0.82));
        const twinkle = 0.55 + 0.45 * Math.sin(ember.sway * 2.3);
        const alpha = vertical * twinkle * globalFade;

        if (ember.life <= 0 || ember.y > height * 0.9 || alpha <= 0.01) {
          // Only respawn while the effect still has time left to show it.
          if (elapsed < DURATION - 900) embers[i] = spawn(false);
          continue;
        }

        const halo = context!.createRadialGradient(
          ember.x,
          ember.y,
          0,
          ember.x,
          ember.y,
          ember.radius * 3.5,
        );
        halo.addColorStop(0, ember.color);
        halo.addColorStop(1, 'rgba(19,1,81,0)');
        context!.globalAlpha = alpha;
        context!.fillStyle = halo;
        context!.beginPath();
        context!.arc(ember.x, ember.y, ember.radius * 3.5, 0, Math.PI * 2);
        context!.fill();

        context!.globalAlpha = Math.min(1, alpha + 0.2);
        context!.fillStyle = ember.color;
        context!.beginPath();
        context!.arc(ember.x, ember.y, ember.radius * 0.7, 0, Math.PI * 2);
        context!.fill();
      }

      context!.restore();
      if (elapsed < DURATION) frameId = requestAnimationFrame(frame);
      else cleanup();
    }

    frameId = requestAnimationFrame(frame);
    setTimeout(cleanup, DURATION + 500);
  });
}
