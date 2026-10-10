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
