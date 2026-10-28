import { EGG_GREEN, EGG_GREEN_LINE, EGG_TEAL, OVERLAY_CSS } from './palette';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  color: string;
  twinkle: number;
};

// A fountain of sparks arcs out of the header, twinkles and falls away.
export function play(reduceMotion: boolean): Promise<void> {
  return new Promise((resolve) => {
    const colors = [EGG_GREEN, EGG_GREEN_LINE, EGG_TEAL];
    const width = window.innerWidth;
    const height = window.innerHeight;
    const originX = width / 2;
    const originY = Math.min(72, height * 0.12);

    const style = document.createElement('style');
    style.textContent =
      '@keyframes spk-burst-glow{0%{opacity:0}15%{opacity:.9}100%{opacity:0}}';
    document.head.appendChild(style);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.cssText = OVERLAY_CSS;
    document.body.appendChild(canvas);

    const glow = document.createElement('div');
    glow.style.cssText =
      `position:fixed;left:${originX}px;top:${originY}px;width:0;height:0;` +
      'z-index:2147483646;pointer-events:none;border-radius:50%;' +
      'box-shadow:0 0 60px 40px rgba(81,230,50,.55);' +
      'animation:spk-burst-glow 1s ease-out forwards;';
    document.body.appendChild(glow);

    let frameId = 0;
    let done = false;
    function cleanup() {
      if (done) return;
      done = true;
      cancelAnimationFrame(frameId);
      [canvas, glow, style].forEach((node) => node.parentNode?.removeChild(node));
      resolve();
    }

    const context = canvas.getContext('2d');
    if (reduceMotion || !context) {
      setTimeout(cleanup, 900);
      return;
    }

    const count = Math.min(150, Math.round((width * height) / 9000));
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.35;
      const speed = 5 + Math.random() * 11;
      particles.push({
        x: originX + (Math.random() - 0.5) * 12,
        y: originY + (Math.random() - 0.5) * 12,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.008 + Math.random() * 0.012,
        size: 1.4 + Math.random() * 2.6,
        color: colors[(Math.random() * colors.length) | 0] ?? EGG_GREEN,
        twinkle: Math.random() * Math.PI * 2,
      });
    }

    const gravity = 0.28;
    const start = performance.now();

    function frame(now: number) {
      context!.clearRect(0, 0, width, height);
      context!.globalCompositeOperation = 'lighter';
      let alive = false;

      for (const particle of particles) {
        if (particle.life <= 0) continue;
        alive = true;
        particle.vy += gravity;
        particle.vx *= 0.99;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= particle.decay;
        particle.twinkle += 0.4;

        const alpha =
          Math.max(0, particle.life) *
          (0.55 + 0.45 * Math.sin(particle.twinkle));

        // Motion trail, then the spark itself.
        context!.strokeStyle = particle.color;
        context!.globalAlpha = alpha * 0.5;
        context!.lineWidth = particle.size * 0.7;
        context!.beginPath();
        context!.moveTo(particle.x, particle.y);
        context!.lineTo(
          particle.x - particle.vx * 0.9,
          particle.y - particle.vy * 0.9,
        );
        context!.stroke();

        context!.globalAlpha = alpha;
        context!.fillStyle = particle.color;
        context!.beginPath();
        context!.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context!.fill();
      }

      context!.globalAlpha = 1;
      if (alive && now - start < 2800) frameId = requestAnimationFrame(frame);
      else cleanup();
    }

    frameId = requestAnimationFrame(frame);
    // Safety net: rAF is throttled in a background tab.
    setTimeout(cleanup, 3000);
  });
}
