// The server rejects non-http(s) links on the way in (server/src/utils/url.js),
// but rows written before that check — or by anything that bypasses it — are
// still in the database. React 18 only *warns* about a "javascript:" href in
// development; a production build renders it, and clicking one runs script in
// our origin with access to the token in localStorage. So check again here,
// at the point where a URL becomes an href or an iframe src.
const SAFE_PROTOCOLS = ["http:", "https:"];

export function safeUrl(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  try {
    return SAFE_PROTOCOLS.includes(new URL(s).protocol) ? s : "";
  } catch {
    return "";
  }
}

// Course covers are inline data: image URLs (see lib/image.js). An <img src>
// can't execute script, so those are allowed through.
export function safeImageUrl(raw) {
  const s = String(raw ?? "").trim();
  if (/^data:image\//i.test(s)) return s;
  return safeUrl(s);
}
