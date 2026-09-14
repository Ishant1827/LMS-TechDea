import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ title, onClose, children, wide = false }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    // remember where focus came from so we can hand it back on close
    restoreRef.current = document.activeElement;

    const dialog = dialogRef.current;
    const focusables = () => Array.from(dialog?.querySelectorAll(FOCUSABLE) || []);

    // move focus into the dialog — the first real control, else the dialog itself
    const first = focusables().find((el) => !el.classList.contains("icon-btn"));
    (first || dialog)?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") return onClose();
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
      restoreRef.current?.focus?.();
    };
  }, [onClose]);

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
