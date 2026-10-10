export const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();

export const cap = (s = "") => s.charAt(0).toUpperCase() + s.slice(1);

export const pct = (done, total) => (total ? Math.round((done / total) * 100) : 0);

// "Oct 15, 2026" in the viewer's own zone, "—" when there is no date. (Due
// dates are different — they are pinned to IST; see lib/assessments.js.)
export const shortDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

export const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

export const qCount = (n) => `${n} question${n === 1 ? "" : "s"}`;

export const DOUBT_STATUS_TAG = { open: "tag-outline", answered: "tag-accent", resolved: "tag-neutral" };

export const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export const phoneOk = (v) => !v.trim() || /^[\d+\-\s()]{6,20}$/.test(v.trim());

// "Saturday · 10 October" — the kicker above a dashboard greeting
export const todayLabel = () => {
  const d = new Date();
  return `${d.toLocaleDateString("en-IN", { weekday: "long" })} · ${d.toLocaleDateString("en-IN", { day: "numeric", month: "long" })}`;
};

// "today" / "3 days ago" for a last-active timestamp
export const agoDays = (days) =>
  days >= 9999 ? "never" : days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;

// "just now" / "3h ago" / "2d ago" — for short, glanceable timestamps
export const timeAgo = (d) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};
