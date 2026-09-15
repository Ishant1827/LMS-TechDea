// URLs here are user input — teachers paste lesson video/file links, students
// paste submission links — and they end up in href/iframe attributes on someone
// else's screen. A "javascript:" or "data:text/html" URL in those runs in our
// own origin, which means it can read the viewer's token out of localStorage.
// Only http(s) gets through.
const SAFE_PROTOCOLS = ["http:", "https:"];

// true for "" (an empty link is always fine — it just isn't rendered)
function isSafeUrl(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return true;
  try {
    return SAFE_PROTOCOLS.includes(new URL(s).protocol);
  } catch {
    return false; // relative or unparseable — not something we should link to
  }
}

// Course covers are stored inline as data: image URLs (client/src/lib/image.js
// downscales to a JPEG data URL), so they need a wider allowance than links.
// An <img src> can't execute script, so this stays safe.
const DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+/=\s]*$/i;

function isSafeImageUrl(raw) {
  const s = String(raw ?? "").trim();
  if (DATA_IMAGE.test(s)) return true;
  return isSafeUrl(s);
}

const LINK_ERROR = "Links must start with http:// or https://";

module.exports = { isSafeUrl, isSafeImageUrl, LINK_ERROR };
