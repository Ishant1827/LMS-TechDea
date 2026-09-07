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

export function BootLoader({ label = "Loading…" }) {
  return (
    <div className="loader-screen loader-screen--boot">
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
