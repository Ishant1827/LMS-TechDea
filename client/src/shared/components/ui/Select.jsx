import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

/**
 * A styled replacement for <select>. A native select's open list is drawn by
 * the OS and can't be themed, so this renders its own listbox.
 *
 * The list is portalled to <body> and positioned with fixed coordinates, so it
 * can't be clipped by an overflow container (e.g. a scrolling table wrapper).
 *
 *   options: [{ value, label }]  — value is compared with ===
 */
export default function Select({
  value,
  onChange,
  options = [],
  placeholder = "Select…",
  className = "",
  style,
  id,
  "aria-label": ariaLabel,
  disabled = false,
}) {
  const autoId = useId();
  const listId = `${id || autoId}-list`;
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0); // keyboard-highlighted row
  const [pos, setPos] = useState(null);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 6;
    const maxH = 280;
    const below = window.innerHeight - r.bottom - gap;
    const above = r.top - gap;
    // flip up when there isn't room below and there's more room above
    const flip = below < Math.min(maxH, 160) && above > below;
    setPos({
      left: r.left,
      width: r.width,
      top: flip ? undefined : r.bottom + gap,
      bottom: flip ? window.innerHeight - r.top + gap : undefined,
      maxHeight: Math.max(120, Math.min(maxH, flip ? above : below)),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    // keep it pinned to the trigger while the page moves
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target) || listRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // keep the highlighted row in view
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-i="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const pick = (i) => {
    const o = options[i];
    if (!o) return;
    onChange?.(o.value);
    setOpen(false);
    btnRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      btnRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  // Focus stays on the trigger while the list is open, so the active option
  // has to be pointed at from there. On the listbox it announces nothing,
  // because nothing inside the listbox is ever focused.
  const activeDescendant = open ? `${listId}-${active}` : undefined;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        id={id}
        className={"sel-trigger input " + className}
        style={style}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={activeDescendant}
        aria-label={ariaLabel}
      >
        <span className={"sel-value" + (selected ? "" : " is-placeholder")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={"sel-caret" + (open ? " is-open" : "")} />
      </button>

      {open &&
        pos &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            className="sel-list elev-lg"
            role="listbox"
            style={{
              position: "fixed",
              left: pos.left,
              width: pos.width,
              top: pos.top,
              bottom: pos.bottom,
              maxHeight: pos.maxHeight,
            }}
          >
            {options.length === 0 && <li className="sel-empty">Nothing to choose</li>}
            {options.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                data-i={i}
                role="option"
                aria-selected={o.value === value}
                className={
                  "sel-opt" +
                  (i === active ? " is-active" : "") +
                  (o.value === value ? " is-selected" : "")
                }
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(i)}
              >
                <span>{o.label}</span>
                {o.value === value && <Check />}
              </li>
            ))}
          </ul>,
          document.body
        )}
    </>
  );
}
