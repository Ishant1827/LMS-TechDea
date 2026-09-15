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
