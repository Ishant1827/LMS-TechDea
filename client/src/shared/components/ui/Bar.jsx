/* Horizontal progress bar — the compact form of a completion percentage. */
export function Bar({ value = 0 }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="pbar">
      <div className="pfill" style={{ width: `${v}%` }} />
    </div>
  );
}
