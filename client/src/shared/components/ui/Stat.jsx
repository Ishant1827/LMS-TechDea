import { Link } from "react-router-dom";
import { CountUp } from "./Motion";

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
        <span className="stat-value">
          <CountUp value={value} />
        </span>
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
