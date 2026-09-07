import { Star } from "lucide-react";

export function StarsDisplay({ value = 0, size = 14 }) {
  const full = Math.round(value);
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= full ? "on" : undefined}>
          <Star width={size} height={size} />
        </span>
      ))}
    </span>
  );
}

export function StarsInput({ value = 0, onChange, size = 24 }) {
  return (
    <span className="stars stars--input">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          className={n <= value ? "on" : undefined}
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star width={size} height={size} />
        </button>
      ))}
    </span>
  );
}
