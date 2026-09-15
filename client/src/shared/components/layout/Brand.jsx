// The TechDea lockup: badge + wordmark + tagline.
// Rendered inside whatever <Link>/<span> the caller needs, so the brand stays
// identical everywhere it appears (sidebar, auth screens, boot splash).
export default function Brand({ size = 32, tagline = true }) {
  return (
    <>
      <img className="brand-mark" src="/techdea-logo.png" alt="" width={size} height={size} />
      <span className="brand-text">
        <span className="brand-word">
          Tech<span>Dea</span>
        </span>
        {tagline && <span className="brand-tag">Converts Ideas Into Technologies</span>}
      </span>
    </>
  );
}
