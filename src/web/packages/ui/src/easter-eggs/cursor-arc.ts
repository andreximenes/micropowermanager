import { EGG_GREEN, EGG_GREEN_LINE, EGG_TEAL, OVERLAY_CSS } from './palette';

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
};

// Electric arcs crackle around the cursor for a few seconds, then vanish.
export function play(reduceMotion: boolean): Promise<void> {
  return new Promise((resolve) => {
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    let hasPointer = false;

    function onPointerMove(event: MouseEvent) {
      pointerX = event.clientX;
      pointerY = event.clientY;
      hasPointer = true;
    }
    document.addEventListener('mousemove', onPointerMove, true);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = OVERLAY_CSS;
    document.body.appendChild(canvas);

    const context = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    const DURATION = reduceMotion ? 900 : 2600;
    const start = performance.now();
    const sparks: Spark[] = [];
    let frameId = 0;
    let done = false;

    function cleanup() {
      if (done) return;
      done = true;
      cancelAnimationFrame(frameId);
      document.removeEventListener('mousemove', onPointerMove, true);
      window.removeEventListener('resize', resize);
      canvas.parentNode?.removeChild(canvas);
      resolve();
    }

    if (!context) {
      setTimeout(cleanup, 300);
      return;
    }

    // One jagged segment from the cursor outwards.
    function bolt(x2: number, y2: number, segments: number, jitter: number) {
      context!.beginPath();
      context!.moveTo(pointerX, pointerY);
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        context!.lineTo(
          pointerX + (x2 - pointerX) * t + (Math.random() - 0.5) * jitter,
          pointerY + (y2 - pointerY) * t + (Math.random() - 0.5) * jitter,
        );
      }
      context!.lineTo(x2, y2);
      context!.stroke();
    }

    function frame(now: number) {
      const life = 1 - (now - start) / DURATION;
      if (life <= 0) {
        cleanup();
        return;
      }

      // With no mouse movement yet, drift the effect around the middle so it is
      // visible to keyboard-only users too.
      if (!hasPointer) {
        const t = now / 1000;
        pointerX =
          window.innerWidth / 2 +
          Math.cos(t * 2.1) * Math.min(160, window.innerWidth * 0.18);
        pointerY =
          window.innerHeight / 2 +
          Math.sin(t * 3.3) * Math.min(120, window.innerHeight * 0.18);
      }

      context!.clearRect(0, 0, window.innerWidth, window.innerHeight);

      if (reduceMotion) {
        context!.globalAlpha = life * 0.8;
        context!.strokeStyle = EGG_GREEN;
        context!.lineWidth = 2;
        context!.shadowColor = EGG_GREEN;
        context!.shadowBlur = 18;
        context!.beginPath();
        context!.arc(pointerX, pointerY, 26, 0, Math.PI * 2);
        context!.stroke();
        context!.shadowBlur = 0;
        context!.globalAlpha = 1;
        frameId = requestAnimationFrame(frame);
        return;
      }

      for (let i = 0; i < 3; i++) {
        sparks.push({
          x: pointerX + (Math.random() - 0.5) * 8,
          y: pointerY + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 3,
          vy: (Math.random() - 0.5) * 3 - 1,
          life: 1,
          color:
            Math.random() < 0.5
              ? EGG_GREEN
              : Math.random() < 0.5
                ? EGG_TEAL
                : EGG_GREEN_LINE,
        });
      }

      context!.lineCap = 'round';
      for (let i = sparks.length - 1; i >= 0; i--) {
        const spark = sparks[i]!;
        spark.x += spark.vx;
        spark.y += spark.vy;
        spark.vy += 0.06;
        spark.life -= 0.045;
        if (spark.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        context!.globalAlpha = spark.life * life;
        context!.fillStyle = spark.color;
        context!.shadowColor = spark.color;
        context!.shadowBlur = 8;
        context!.beginPath();
        context!.arc(spark.x, spark.y, 1.6 * spark.life + 0.4, 0, Math.PI * 2);
        context!.fill();
      }

      context!.shadowBlur = 0;
      context!.globalAlpha = 1;
      for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2;
        const length = 18 + Math.random() * 30;
        const color = i % 2 ? EGG_TEAL : EGG_GREEN;
        context!.globalAlpha = (0.5 + Math.random() * 0.4) * life;
        context!.strokeStyle = color;
        context!.shadowColor = color;
        context!.shadowBlur = 12;
        context!.lineWidth = 1.4;
        bolt(
          pointerX + Math.cos(angle) * length,
          pointerY + Math.sin(angle) * length,
          4,
          10,
        );
      }

      if (Math.random() < 0.6) {
        const angle = Math.random() * Math.PI * 2;
        const length = 12 + Math.random() * 20;
        context!.globalAlpha = 0.9 * life;
        context!.strokeStyle = '#eaffe0';
        context!.shadowColor = EGG_GREEN;
        context!.shadowBlur = 14;
        context!.lineWidth = 1;
        bolt(
          pointerX + Math.cos(angle) * length,
          pointerY + Math.sin(angle) * length,
          3,
          7,
        );
      }

      context!.globalAlpha = life;
      context!.fillStyle = EGG_GREEN;
      context!.shadowColor = EGG_GREEN;
      context!.shadowBlur = 16;
      context!.beginPath();
      context!.arc(pointerX, pointerY, 2.6, 0, Math.PI * 2);
      context!.fill();
      context!.shadowBlur = 0;
      context!.globalAlpha = 1;

      frameId = requestAnimationFrame(frame);
    }

    frameId = requestAnimationFrame(frame);
    setTimeout(cleanup, DURATION + 400);
  });
}
