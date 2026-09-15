import Brand from "@/shared/components/layout/Brand";

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

// In-page loader, used once a route's shell is already on screen.
export function CenterLoader({ label = "Loading…" }) {
  return (
    <div className="loader-screen">
      <div className="loader-block">
        <span className="spinner" /> <span>{label}</span>
      </div>
    </div>
  );
}
