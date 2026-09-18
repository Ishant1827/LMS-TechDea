import { Component } from "react";
import { useLocation } from "react-router-dom";

/**
 * Last line of defence for a throw during render. Without it a single bad
 * value — a null course, an unparseable date — blanks the whole app with no
 * route back.
 *
 * The fallback deliberately uses no Layout, no auth, and no <Link>: this
 * boundary sits above the providers precisely so it can catch a throw from one
 * of them, and a fallback that needed them would fail while failing.
 */
class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[render error]", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="loader-screen loader-screen--boot">
        <div className="boundary-card">
          <h3>Something broke on this page</h3>
          <p className="text-muted">
            The rest of the app is fine. Reload to try again, or head back to the start.
          </p>
          <div className="boundary-actions">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload page
            </button>
            <a className="btn btn-secondary" href="/">
              Back to start
            </a>
          </div>
        </div>
      </div>
    );
  }
}

// Re-mounting on navigation is what makes the boundary recoverable: without a
// changing key the error state sticks and every later route renders it too.
export default function RouteErrorBoundary({ children }) {
  const { pathname } = useLocation();
  return <ErrorBoundary key={pathname}>{children}</ErrorBoundary>;
}
