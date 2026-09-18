import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * A load that failed, shown in place of the content it was meant to fill.
 * Always offer the retry: most of these are a dropped connection, and a button
 * beats telling someone to refresh the whole page and lose their place.
 */
export function ErrorState({
  title = "Couldn't load this",
  message,
  onRetry,
  compact = false,
}) {
  return (
    <div className={`card elev-sm error-state${compact ? " error-state--compact" : ""}`} role="alert">
      <AlertTriangle />
      <div className="error-state-text">
        <b>{title}</b>
        {message && <span>{message}</span>}
      </div>
      {onRetry && (
        <button type="button" className="btn btn-secondary error-state-retry" onClick={onRetry}>
          <RotateCw />
          Try again
        </button>
      )}
    </div>
  );
}

export default ErrorState;
