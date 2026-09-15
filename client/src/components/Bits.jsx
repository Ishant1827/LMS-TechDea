import { useState } from "react";
import { Link } from "react-router-dom";
import { Play, BookOpen } from "lucide-react";
import Brand from "./Brand";
import { safeImageUrl } from "../lib/safeUrl";

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
        <Brand size={44} />
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
  src = safeImageUrl(src);
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

/* ── dashboard stat tile ──────────────────────────────────────────────────
   A number on its own reads as filler. This pairs it with a toned icon, a
   label and an optional bit of context, and links where there's somewhere
   useful to go. */
export function Stat({ icon: Icon, value, label, hint, tone = "neutral", to }) {
  const inner = (
    <>
      <span className={"stat-ic tone-" + tone}>
        <Icon />
      </span>
      <span className="stat-body">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
        {hint ? <span className="stat-hint">{hint}</span> : null}
      </span>
    </>
  );
  return to ? (
    <Link className="card elev-sm statx clickable plain" to={to}>
      {inner}
    </Link>
  ) : (
    <div className="card elev-sm statx">{inner}</div>
  );
}

/* Donut progress — the same number as a bar, but readable at a glance. */
export function Ring({ value = 0, size = 76, stroke = 8, sublabel }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const mid = size / 2;
  return (
    <span className="ring-wrap">
      <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}
           role="img" aria-label={`${v}% complete`}>
        <circle cx={mid} cy={mid} r={r} fill="none" strokeWidth={stroke} className="ring-track" />
        <circle
          cx={mid} cy={mid} r={r} fill="none" strokeWidth={stroke} className="ring-fill"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - v / 100)}
          strokeLinecap="round" transform={`rotate(-90 ${mid} ${mid})`}
        />
        <text x={mid} y={mid} className="ring-text" textAnchor="middle" dominantBaseline="central">
          {v}%
        </text>
      </svg>
      {sublabel ? <span className="ring-sub">{sublabel}</span> : null}
    </span>
  );
}
