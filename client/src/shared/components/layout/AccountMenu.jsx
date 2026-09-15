import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { initials, cap } from "@/shared/lib/format";

/**
 * The signed-in user in the top bar, as a menu: Profile and Log out.
 *
 * Log out lives here rather than in the sidebar because it's an account
 * action, not a place to navigate to — and here it can't be mis-clicked while
 * reaching for the nav links. The menu is the only route to it below 900px,
 * where the sidebar is off-canvas.
 */
export default function AccountMenu() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const menuId = useId();
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);

  // On open: focus the first item, and watch for a click that lands outside.
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector("[role='menuitem']")?.focus();

    const onDown = (e) => {
      if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const close = (refocus) => {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  };

  const go = (to) => {
    close(false);
    nav(to);
  };

  const logOut = () => {
    close(false);
    logout();
    nav("/login", { replace: true });
  };

  // Roving focus across the items, the way a menu is expected to behave.
  const onMenuKeyDown = (e) => {
    const items = Array.from(menuRef.current?.querySelectorAll("[role='menuitem']") || []);
    const i = items.indexOf(document.activeElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  // Tab moves focus out on its own — close once it has actually left.
  const onBlur = (e) => {
    if (menuRef.current?.contains(e.relatedTarget) || e.relatedTarget === btnRef.current) return;
    setOpen(false);
  };

  return (
    <div className="topbar-account">
      <button
        ref={btnRef}
        type="button"
        className="topbar-user"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (!open && ["ArrowDown", "ArrowUp"].includes(e.key)) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${user.name} — account menu`}
      >
        <span className="topbar-name">{user.name}</span>
        <div className="avatar avatar-initials">{initials(user.name)}</div>
        <ChevronDown className={"acct-caret" + (open ? " is-open" : "")} aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          className="acct-menu elev-lg"
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKeyDown}
          onBlur={onBlur}
        >
          <div className="acct-head">
            <strong>{user.name}</strong>
            <small>{cap(user.role)}</small>
          </div>
          <button type="button" role="menuitem" className="acct-item" onClick={() => go("/profile")}>
            <UserRound aria-hidden="true" />
            Profile
          </button>
          <button type="button" role="menuitem" className="acct-item is-danger" onClick={logOut}>
            <LogOut aria-hidden="true" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
