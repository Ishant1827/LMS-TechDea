import { useEffect, useRef, useState } from "react";

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ── count-up ─────────────────────────────────────────────────────────────
   Rolls a number from where it was (0 on first show) to `target`. Easing
   out, so it slows into the real value instead of stopping dead. */
export function useCountUp(target, ms = 800) {
  const [shown, setShown] = useState(reducedMotion() ? target : 0);
  const from = useRef(reducedMotion() ? target : 0);

  useEffect(() => {
    if (reducedMotion() || typeof target !== "number" || !Number.isFinite(target)) {
      setShown(target);
      from.current = target;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf;
    const step = (t) => {
      const k = Math.min(1, (t - start) / ms);
      const v = a + (target - a) * (1 - Math.pow(1 - k, 3));
      setShown(Math.round(v));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    // a hidden tab never runs rAF — land on the real value regardless
    const settle = setTimeout(() => {
      setShown(target);
      from.current = target;
    }, ms + 200);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settle);
    };
  }, [target, ms]);

  return shown;
}

// "12", 12 or "50%" count up; anything else ("—", "1h 50m") is shown as is.
export function CountUp({ value, ms }) {
  const m = typeof value === "number" ? [null, String(value), ""] : /^(\d+)(%?)$/.exec(String(value ?? ""));
  const n = useCountUp(m ? Number(m[1]) : 0, ms);
  if (!m) return value;
  return (
    <>
      {n}
      {m[2]}
    </>
  );
}

/* ── confetti ─────────────────────────────────────────────────────────────
   A one-second burst from the middle of the screen, for finishing a
   course. Plain DOM, cleaned up after itself; skipped under reduced motion. */
const COLORS = ["#6d28d9", "#8b5cf6", "#f5a524", "#138a5b", "#ec4899", "#38bdf8"];

export function burstConfetti({ pieces = 70 } = {}) {
  if (reducedMotion() || typeof document === "undefined") return;
  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  layer.setAttribute("aria-hidden", "true");
  const spread = Math.min(window.innerWidth, 900);
  for (let i = 0; i < pieces; i++) {
    const c = document.createElement("i");
    const ang = Math.random() * Math.PI * 2;
    const dist = spread * (0.18 + Math.random() * 0.32);
    c.style.cssText =
      `background:${COLORS[i % COLORS.length]};` +
      `--x:${Math.cos(ang) * dist}px;--y:${Math.sin(ang) * dist * 0.75 - 60}px;` +
      `--r:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * 0.1}s;` +
      (i % 3 === 0 ? "border-radius:50%;width:9px;height:9px;" : "");
    layer.appendChild(c);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 1700);
}

/* ── empty state ──────────────────────────────────────────────────────────
   A small floating illustration instead of a bare "Nothing here". */
export function EmptyState({ title, text, children, compact = false }) {
  return (
    <div className={"empty-state" + (compact ? " is-compact" : "")}>
      <div className="es-art" aria-hidden="true">
        <span className="es-book" />
        <i className="es-spark" />
        <i className="es-spark" />
        <i className="es-spark" />
      </div>
      <b className="es-title">{title}</b>
      {text && <span className="es-text">{text}</span>}
      {children && <div className="es-action">{children}</div>}
    </div>
  );
}
