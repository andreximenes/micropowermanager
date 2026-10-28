import { EGG_GREEN, EGG_NAVY, EGG_TEAL, OVERLAY_CSS } from './palette';

// A jagged green bolt streaks across the screen behind a white-to-green flash,
// then fades. The calm default for a utility tool.
export function play(reduceMotion: boolean): Promise<void> {
  return new Promise((resolve) => {
    const nodes: Node[] = [];

    const style = document.createElement('style');
    style.textContent = [
      '@keyframes spk-flash{0%{opacity:0}8%{opacity:.92}30%{opacity:.25}100%{opacity:0}}',
      '@keyframes spk-flash-soft{0%{opacity:0}40%{opacity:.35}100%{opacity:0}}',
      '@keyframes spk-draw{to{stroke-dashoffset:0}}',
      '@keyframes spk-bolt-fade{0%{opacity:1}60%{opacity:1}100%{opacity:0}}',
      '@keyframes spk-jitter{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}50%{transform:translateX(3px)}75%{transform:translateX(-2px)}}',
    ].join('');
    document.head.appendChild(style);
    nodes.push(style);

    const flash = document.createElement('div');
    flash.style.cssText =
      `${OVERLAY_CSS}z-index:2147483646;` +
      `background:radial-gradient(circle at 50% 20%, #ffffff 0%, ${EGG_GREEN} 45%, ${EGG_NAVY} 100%);` +
      `animation:${reduceMotion ? 'spk-flash-soft 0.6s' : 'spk-flash 1.1s'} ease-out forwards;`;
    document.body.appendChild(flash);
    nodes.push(flash);

    const width = window.innerWidth;
    const height = window.innerHeight;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.style.cssText =
      `${OVERLAY_CSS}width:100vw;height:100vh;` +
      (reduceMotion ? '' : 'animation:spk-jitter 0.28s ease-in-out 1;');

    // A jagged diagonal from the top down to the bottom right.
    const startX = width * 0.18;
    const endX = width * 0.82;
    const endY = height * 0.94;
    const segments = 7;
    let path = `M ${startX.toFixed(1)} 0`;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const x = startX + (endX - startX) * t + (Math.random() - 0.5) * width * 0.14;
      const y = endY * t + (Math.random() - 0.5) * height * 0.04;
      path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }

    const strokes: SVGPathElement[] = [
      { color: EGG_TEAL, width: '16', opacity: '0.55', blur: true },
      { color: EGG_GREEN, width: '5', opacity: '1', blur: false },
      { color: '#ffffff', width: '1.8', opacity: '1', blur: false },
    ].map((spec) => {
      const node = document.createElementNS(svgNS, 'path');
      node.setAttribute('d', path);
      node.setAttribute('fill', 'none');
      node.setAttribute('stroke', spec.color);
      node.setAttribute('stroke-width', spec.width);
      node.setAttribute('stroke-linecap', 'round');
      node.setAttribute('stroke-linejoin', 'round');
      node.setAttribute('opacity', spec.opacity);
      if (spec.blur) node.style.filter = 'blur(6px)';
      svg.appendChild(node);
      return node;
    });

    document.body.appendChild(svg);
    nodes.push(svg);

    if (reduceMotion) {
      strokes.forEach((node) => {
        node.style.animation = 'spk-flash-soft 0.6s ease-out forwards';
      });
    } else {
      let length = width + height;
      try {
        length = strokes[1]?.getTotalLength() || length;
      } catch {
        // getTotalLength is unavailable in some headless engines — the fallback
        // length still animates, just less precisely.
      }
      strokes.forEach((node) => {
        node.style.strokeDasharray = String(length);
        node.style.strokeDashoffset = String(length);
        node.style.animation =
          'spk-draw 0.22s ease-out forwards, spk-bolt-fade 1.0s ease-in 0.22s forwards';
      });
    }

    setTimeout(
      () => {
        nodes.forEach((node) => node.parentNode?.removeChild(node));
        resolve();
      },
      reduceMotion ? 750 : 1600,
    );
  });
}
