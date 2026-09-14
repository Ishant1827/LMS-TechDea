import { useState } from "react";
import { Play, BookOpen } from "lucide-react";

export function Bar({ value = 0 }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="pbar">
      <div className="pfill" style={{ width: `${v}%` }} />
    </div>
  );
}

// Full-screen splash while the session is restored — the first thing anyone
// sees, so it carries the brand rather than a bare spinner.
export function BootLoader({ label = "Loading…" }) {
  return (
    <div className="loader-screen loader-screen--boot">
      <span className="brand">
        <img className="brand-mark" src="/techdea-logo.png" alt="" width="44" height="44" />
        <span className="brand-word">
          Tech<span>Dea</span>
        </span>
      </span>
      <div className="loader-block">
        <span className="spinner" /> <span>{label}</span>
      </div>
    </div>
  );
}

export function CenterLoader({ label = "Loading…" }) {
  return (
    <div className="loader-screen">
      <div className="loader-block">
        <span className="spinner" /> <span>{label}</span>
      </div>
    </div>
  );
}

// Course cover image. Falls back to a book-icon placeholder when there's no
// URL or the image fails to load.
export function CourseThumb({ src, height = 90, style }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return (
      <img
        className="course-thumb"
        src={src}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        style={{ height, ...style }}
      />
    );
  }
  return (
    <div className="ph" style={{ height, ...style }}>
      <BookOpen />
    </div>
  );
}

// The lesson video is never uploaded/stored — this stands in for the player.
export function VideoPlaceholder({ height = 220 }) {
  return (
    <div
      className="media"
      style={{ height, marginBottom: 16, flexDirection: "column", gap: 8 }}
    >
      <Play />
      <span style={{ fontSize: 12 }}>Video placeholder</span>
    </div>
  );
}
