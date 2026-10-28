import { EGG_GREEN, EGG_GREEN_LINE, EGG_TEAL } from './palette';

// A neon "SPARK" sign flickers to life, buzzes once and fades out.
export function play(reduceMotion: boolean): Promise<void> {
  return new Promise((resolve) => {
    const style = document.createElement('style');
    style.textContent = [
      '@keyframes spk-neon-flicker{0%{opacity:0}4%{opacity:1}6%{opacity:.15}9%{opacity:1}',
      '12%{opacity:.3}14%{opacity:1}20%{opacity:.6}22%{opacity:1}',
      '70%{opacity:1;filter:none}78%{opacity:1;filter:brightness(1.6)}',
      '84%{opacity:1;filter:none}100%{opacity:0}}',
      '@keyframes spk-neon-buzz{0%,100%{transform:translate(-50%,-50%)}',
      '76%{transform:translate(-50%,-50%)}',
      '78%{transform:translate(calc(-50% - 2px),calc(-50% + 1px))}',
      '80%{transform:translate(calc(-50% + 2px),calc(-50% - 1px))}',
      '82%{transform:translate(-50%,-50%)}}',
      '@keyframes spk-neon-soft{0%{opacity:0}25%{opacity:1}75%{opacity:1}100%{opacity:0}}',
      '.spk-neon{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);',
      'z-index:2147483647;pointer-events:none;font-weight:900;letter-spacing:.12em;',
      "font-family:'Sharp Grotesk','Arial Black',Impact,system-ui,sans-serif;",
      `font-size:clamp(56px,18vw,220px);line-height:1;color:${EGG_GREEN};`,
      `text-shadow:0 0 8px ${EGG_GREEN},0 0 20px ${EGG_GREEN},0 0 42px ${EGG_GREEN_LINE},0 0 78px ${EGG_TEAL},0 0 120px ${EGG_GREEN};`,
      `-webkit-text-stroke:1px ${EGG_TEAL}8c;}`,
      '.spk-neon-anim{animation:spk-neon-flicker 2.2s ease-out forwards,spk-neon-buzz 2.2s linear forwards}',
      '.spk-neon-static{animation:spk-neon-soft 1.6s ease-in-out forwards}',
    ].join('');
    document.head.appendChild(style);

    const sign = document.createElement('div');
    sign.className = `spk-neon ${reduceMotion ? 'spk-neon-static' : 'spk-neon-anim'}`;
    sign.setAttribute('aria-hidden', 'true');
    sign.textContent = 'SPARK';
    document.body.appendChild(sign);

    const duration = reduceMotion ? 1600 : 2200;
    setTimeout(() => {
      [sign, style].forEach((node) => node.parentNode?.removeChild(node));
      resolve();
    }, duration + 80);
  });
}
