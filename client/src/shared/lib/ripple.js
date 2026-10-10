// A soft ripple from the point you pressed, on every filled/outlined button.
// One listener for the whole app instead of a prop on every <button>; the
// ripple is a throwaway span that removes itself. Off under reduced motion.
const SELECTOR = ".btn-primary, .btn-secondary, .btn-danger";

export function installRipple() {
  if (typeof window === "undefined") return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (reduce?.matches || e.button > 0) return;
      const btn = e.target.closest?.(SELECTOR);
      if (!btn || btn.disabled || btn.classList.contains("is-loading")) return;
      const r = btn.getBoundingClientRect();
      const size = Math.max(r.width, r.height);
      const dot = document.createElement("span");
      dot.className = "btn-ripple";
      dot.setAttribute("aria-hidden", "true");
      dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
      btn.appendChild(dot);
      setTimeout(() => dot.remove(), 600);
    },
    { passive: true }
  );
}
