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
