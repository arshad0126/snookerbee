import { useEffect, useRef, useState } from 'react';

/**
 * Opening screen — plays once when the app is opened, then fades away into
 * whatever screen is underneath. One of four "Racking up" animations is
 * picked at random, never the same one twice in a row.
 *
 * iPhones open web apps in portrait, so it waits until the phone has been
 * turned to landscape (the rotate prompt shows meanwhile), lets the rotation
 * settle, and only then plays. It holds on the finished logo for a moment
 * before fading out.
 *
 * Shown once per launch (a reload after Google sign-in doesn't replay it).
 * With Reduce Motion on, it's a short plain fade.
 */

type Variant = 'rack' | 'bloom' | 'gather' | 'ripple';
const VARIANTS: Variant[] = ['rack', 'bloom', 'gather', 'ripple'];
const SHOWN_KEY = 'sb-splash-shown';
const LAST_KEY = 'sb-splash-last';

function pickVariant(): Variant {
  let last: string | null = null;
  try { last = localStorage.getItem(LAST_KEY); } catch { /* private mode */ }
  const pool = VARIANTS.filter((v) => v !== last);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  try { localStorage.setItem(LAST_KEY, pick); } catch { /* ignore */ }
  return pick;
}

function shouldShow(): boolean {
  try {
    if (sessionStorage.getItem(SHOWN_KEY)) return false;
    sessionStorage.setItem(SHOWN_KEY, '1');
  } catch { /* still show */ }
  return true;
}

/** A real spring (like iOS), sampled into a CSS linear() easing. */
function spring(stiffness: number, damping: number): string {
  const ok = typeof CSS !== 'undefined' && CSS.supports?.('animation-timing-function', 'linear(0, 1)');
  if (!ok) return 'cubic-bezier(.2,.9,.25,1.1)';
  const raw: number[] = [];
  let x = 0, v = 0;
  const dt = 1 / 240;
  for (let t = 0; t < 1.6; t += dt) { const a = -stiffness * (x - 1) - damping * v; v += a * dt; x += v * dt; raw.push(x); }
  const pts: string[] = [];
  for (let i = 0; i <= 60; i += 1) pts.push(raw[Math.round((i / 60) * (raw.length - 1))].toFixed(4));
  pts[pts.length - 1] = '1';
  return `linear(${pts.join(', ')})`;
}

const RACK: [number, number][] = [];
[1, 2, 3, 4, 5].forEach((n, row) => { for (let i = 0; i < n; i += 1) RACK.push([row, i - (n - 1) / 2]); });

const EASE_OUT = 'cubic-bezier(.16,1,.3,1)';
/** Everything plays this much slower than the raw timings (1.4 = 40% slower). */
const PACE = 1.4;
/** How long the finished logo stays before fading. */
const HOLD = 700;
/** Let the rotation animation finish before starting. */
const SETTLE = 350;

const isLandscape = () => window.innerWidth > window.innerHeight;

export default function Splash() {
  const [show] = useState(shouldShow);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Wait for landscape, then a beat for the rotation to settle.
  useEffect(() => {
    if (!show || ready) return;
    let timer = 0;
    const check = () => {
      window.clearTimeout(timer);
      if (isLandscape()) timer = window.setTimeout(() => { if (isLandscape()) setReady(true); }, SETTLE);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, [show, ready]);

  useEffect(() => {
    if (!show || !ready) return;
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const rack = root.querySelector<HTMLDivElement>('.sp-rack')!;
    const word = root.querySelector<HTMLDivElement>('.sp-word')!;
    const mark = root.querySelector<HTMLSpanElement>('.sp-mark')!;
    const txt = root.querySelector<HTMLSpanElement>('.sp-txt')!;
    const credit = root.querySelector<HTMLDivElement>('.sp-credit')!;
    const SOFT = spring(140, 17), SNAPPY = spring(240, 20), GLIDE = spring(90, 16);

    const anim = (el: Element, kf: Keyframe[], o: KeyframeAnimationOptions) =>
      el.animate(kf, {
        fill: 'both', ...o,
        duration: Number(o.duration ?? 0) * (reduce ? 1 : PACE),
        delay: (o.delay ?? 0) * (reduce ? 1 : PACE),
      });
    const fadeUp = (el: Element, delay: number) => anim(el,
      [{ opacity: 0, transform: 'translateY(6px)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
      { duration: 620, delay, easing: EASE_OUT });
    const makeBalls = (ox: number, oy: number, sx: number, sy: number, size: number) =>
      RACK.map(([r, i]) => {
        const b = document.createElement('span');
        b.className = 'sp-ball';
        b.style.left = `${ox + r * sx}%`;
        b.style.top = `${oy + i * sy}%`;
        b.style.width = b.style.height = `${size}cqh`;
        b.style.margin = `-${size / 2}cqh 0 0 -${size / 2}cqh`;
        b.style.opacity = '0';
        rack.appendChild(b);
        return b;
      });

    let end: number;
    if (reduce) {
      anim(word, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
      anim(credit, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
      end = 700;
    } else {
      const variant = pickVariant();
      if (variant === 'rack') {
        makeBalls(84, 46, 3.6, 8.2, 7.6).forEach((b, k) => anim(b,
          [{ opacity: 0, transform: 'scale(.2)', filter: 'blur(6px)' }, { opacity: 0.2, transform: 'scale(1)', filter: 'blur(0)' }],
          { duration: 700, delay: k * 34, easing: SOFT }));
        anim(word, [{ opacity: 0, transform: 'scale(.96)', filter: 'blur(10px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
          { duration: 800, delay: 280, easing: SOFT });
        fadeUp(credit, 720);
        end = 1500;
      } else if (variant === 'bloom') {
        const ox = 41, oy = 46, sx = 5.4, sy = 12.4;
        makeBalls(ox, oy, sx, sy, 11).forEach((b, k) => {
          const [r, i] = RACK[k];
          anim(b, [{ opacity: 0, transform: 'scale(.3)', filter: 'blur(8px)' }, { opacity: 0.55, transform: 'scale(1)', filter: 'blur(0)' }],
            { duration: 720, delay: Math.hypot(r - 2.67, i * 1.2) * 70, easing: SNAPPY });
        });
        rack.style.transformOrigin = `${ox + 2.5 * sx}% ${oy}%`;
        anim(rack, [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: 'translate(36cqw, 0) scale(.6)', opacity: 0.32 }],
          { duration: 1000, delay: 560, easing: GLIDE });
        anim(word, [{ opacity: 0, transform: 'translateX(-2cqw)', filter: 'blur(12px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
          { duration: 900, delay: 640, easing: SOFT });
        fadeUp(credit, 1000);
        end = 1750;
      } else if (variant === 'gather') {
        const ox = 41, oy = 46, sx = 4.8, sy = 11;
        const balls = makeBalls(ox, oy, sx, sy, 9.5);
        word.style.opacity = '1';
        anim(mark, [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 600, delay: 760, easing: SNAPPY });
        anim(txt, [{ opacity: 0, transform: 'translateX(-4cqw)', clipPath: 'inset(0 100% 0 0)', filter: 'blur(6px)' },
          { opacity: 1, transform: 'none', clipPath: 'inset(0 0 0 0)', filter: 'blur(0)' }], { duration: 760, delay: 860, easing: SOFT });
        fadeUp(credit, 1180);
        const sr = root.getBoundingClientRect();
        const mr = mark.getBoundingClientRect();
        const mx = ((mr.left + mr.width / 2 - sr.left) / sr.width) * 100;
        const my = ((mr.top + mr.height / 2 - sr.top) / sr.height) * 100;
        balls.forEach((b, k) => {
          const [r, i] = RACK[k];
          const dx = ((mx - (ox + r * sx)) * sr.width) / 100;
          const dy = ((my - (oy + i * sy)) * sr.height) / 100;
          anim(b, [
            { opacity: 0, transform: 'translate(0,0) scale(.3)', offset: 0 },
            { opacity: 0.6, transform: 'translate(0,0) scale(1)', offset: 0.42 },
            { opacity: 0.6, transform: 'translate(0,0) scale(1)', offset: 0.55 },
            { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(.25)`, offset: 1 },
          ], { duration: 1300, delay: k * 18, easing: 'cubic-bezier(.65,0,.35,1)' });
        });
        end = 1900;
      } else {
        makeBalls(86, 46, 3.6, 8.2, 7.6).forEach((b, k) => {
          const [r, i] = RACK[k];
          anim(b, [
            { opacity: 0, transform: 'translateY(-5cqh) scale(.6)', filter: 'blur(5px)', offset: 0 },
            { opacity: 0.7, transform: 'translateY(0) scale(1.08)', filter: 'blur(0)', offset: 0.45 },
            { opacity: 0.2, transform: 'scale(1)', filter: 'blur(0)', offset: 1 },
          ], { duration: 1100, delay: r * 80 + Math.abs(i) * 22, easing: 'cubic-bezier(.22,1,.36,1)' });
        });
        anim(word, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 260, easing: 'ease-out' });
        anim(txt, [{ letterSpacing: '0.24em', filter: 'blur(8px)' }, { letterSpacing: '-0.035em', filter: 'blur(0)' }],
          { duration: 1000, delay: 260, easing: GLIDE });
        fadeUp(credit, 820);
        end = 1650;
      }
    }

    // Same exit for all four: fade, a touch of zoom and blur, into the app.
    const out = root.animate(
      [{ opacity: 1, transform: 'scale(1)', filter: 'blur(0)' }, { opacity: 0, transform: 'scale(1.04)', filter: 'blur(6px)' }],
      { duration: reduce ? 250 : 700, delay: reduce ? end : end * PACE + HOLD, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' },
    );
    out.finished.then(() => setDone(true)).catch(() => setDone(true));
    return () => { root.getAnimations({ subtree: true }).forEach((a) => a.cancel()); };
  }, [show, ready]);

  // Rendered (blank, in the app's colour) from the start so the home screen
  // never flashes; in portrait the rotate prompt sits on top of it. The
  // animation itself only begins once `ready`.
  if (!show || done) return null;

  return (
    <div className="sp-root" ref={rootRef} aria-hidden="true">
      <div className="sp-rack" />
      <div className="sp-center">
        <div className="sp-word"><span className="sp-mark" /><span className="sp-txt">SnookerBee</span></div>
      </div>
      <div className="sp-credit">by <b>Arshad Khan</b></div>
    </div>
  );
}
