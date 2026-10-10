import { Play, FileText, Download } from "lucide-react";
import { safeUrl } from "./safeUrl";

export const LESSON_TYPES = [
  { value: "video", label: "Video", Icon: Play },
  { value: "reading", label: "Reading", Icon: FileText },
  { value: "file", label: "File", Icon: Download },
];

export const typeMeta = (t) => LESSON_TYPES.find((x) => x.value === t) || LESSON_TYPES[1];

export const fmtDuration = (min) => {
  const m = Number(min) || 0;
  if (!m) return "";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
};

// Lessons in curriculum order, grouped under their module label in the order
// each module first appears: [{ name, items: [lesson, …] }, …].
export function groupByModule(lessons) {
  const out = [];
  for (const l of lessons) {
    let g = out.find((x) => x.name === l.module);
    if (!g) {
      g = { name: l.module, items: [] };
      out.push(g);
    }
    g.items.push(l);
  }
  return out;
}

// Turn a YouTube / Vimeo watch URL into an embeddable one. Anything else is
// returned unchanged (assumed already embeddable), "" if unparseable.
export function toEmbedUrl(url = "") {
  if (!url) return "";
  // Whatever falls through the host checks below goes straight into an
  // <iframe src>, so anything that isn't http(s) is dropped here.
  if (!safeUrl(url)) return "";
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname.startsWith("/embed/")) return url;
      const id = u.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }
    if (host === "youtu.be") return `https://www.youtube.com/embed${u.pathname}`;
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : url;
    }
    return url;
  } catch {
    return "";
  }
}
