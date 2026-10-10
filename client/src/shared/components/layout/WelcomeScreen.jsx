import { useCallback, useEffect, useRef, useState } from "react";
import { WELCOME_KEY } from "@/features/auth/AuthContext";

const HOLD_MS = 2000; // how long the greeting stays before it lifts
const LEAVE_MS = 700; // slide-up length, plus a little slack

// A one-off curtain right after signing in: logo + greeting, then it slides
// up to reveal the dashboard, which has been loading underneath the whole
// time. Shown only when AuthContext queued it at sign-in — never on refresh
// or for a session that was already open. Tap, click or Esc skips it.
export default function WelcomeScreen({ user }) {
  // Read in the initializer (pure — StrictMode may call it twice) and cleared
  // only once the curtain is gone. Clearing it on mount lost the welcome on
  // sign-in: Login navigates straight after, ErrorBoundary remounts the tree
  // on every navigation, and the remounted copy found the flag already spent.
  const [state] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(WELCOME_KEY) || "null");
    } catch {
      return null;
    }
  });
  const [phase, setPhase] = useState(state ? "in" : "gone"); // in → leaving → gone
  useEffect(() => {
    if (phase !== "leaving" && phase !== "gone") return;
    try {
      sessionStorage.removeItem(WELCOME_KEY);
    } catch {
      /* nothing to clear */
    }
  }, [phase]);
  const timers = useRef([]);

  const lift = useCallback(() => {
    setPhase((p) => (p === "in" ? "leaving" : p));
  }, []);

  useEffect(() => {
    if (phase === "in") {
      timers.current.push(setTimeout(lift, HOLD_MS + 600));
    } else if (phase === "leaving") {
      // don't wait on animationend alone: a backgrounded tab pauses animations
      timers.current.push(setTimeout(() => setPhase("gone"), LEAVE_MS));
    }
  }, [phase, lift]);

  useEffect(() => {
    if (phase === "gone") return;
    const onKey = (e) => e.key === "Escape" && lift();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, lift]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  if (phase === "gone" || !user) return null;

  const firstName = (user.name || "").split(" ")[0] || "there";
  const first = !!state?.first;

  return (
    <div
      className={"welcome-screen" + (phase === "leaving" ? " is-leaving" : "")}
      onClick={lift}
      onAnimationEnd={(e) => e.target === e.currentTarget && phase === "leaving" && setPhase("gone")}
      role="status"
      aria-live="polite"
      style={{ "--hold": `${HOLD_MS}ms` }}
    >
      <img className="ws-logo" src="/techdea-logo.png" alt="TechDea" width="104" height="104" />
      <div className="ws-hi">{first ? "Welcome to TechDea" : "Welcome back"}</div>
      <div className="ws-name">
        {first ? `Hi, ${firstName}` : firstName} <span aria-hidden="true">👋</span>
      </div>
      <div className="ws-line">
        {first ? "Let's start learning something new" : "Picking up where you left off…"}
      </div>
      <div className="ws-bar" aria-hidden="true">
        <i />
      </div>
      <div className="ws-skip">Tap anywhere to skip</div>
    </div>
  );
}
