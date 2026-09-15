import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ title, onClose, children, wide = false }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const restoreRef = useRef(null);

  // Every caller passes an inline arrow for onClose, so it's a new function on
  // each render. Read it through a ref instead of depending on it, or the
  // effect below tears down and re-runs on every ancestor re-render — which
  // would yank focus back to the first field (a toast alone is enough to
  // trigger it) and leave restoreRef pointing at a node inside the dialog.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Remember where focus came from, captured on the first render. This can't
  // wait for the effect below: React honours autoFocus (several dialogs use it
  // on their first field) during the commit, before passive effects run, so by
  // then document.activeElement is already inside the dialog — capturing there
  // hands focus back to a node that no longer exists, dropping the user on
  // <body> when the dialog closes.
  if (restoreRef.current === null) restoreRef.current = document.activeElement;

  useEffect(() => {
    const dialog = dialogRef.current;
    const focusables = () => Array.from(dialog?.querySelectorAll(FOCUSABLE) || []);

    // move focus into the dialog — the first real control, else the dialog itself
    const first = focusables().find((el) => !el.classList.contains("icon-btn"));
    (first || dialog)?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") return closeRef.current();
      if (e.key !== "Tab") return;
      // keep Tab inside the dialog
      const items = focusables();
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === firstEl || !dialog.contains(document.activeElement))) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      // only if it's still in the document — the opener can be gone by now
      const back = restoreRef.current;
      if (back?.isConnected) back.focus?.();
    };
    // mount/unmount only — see closeRef above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className={"modal elev-lg" + (wide ? " modal--wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h4 id={titleId} style={{ margin: 0 }}>
            {title}
          </h4>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
