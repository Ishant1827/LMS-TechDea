import { Link } from "react-router-dom";
import Layout from "../components/Layout";

export default function NotFound() {
  return (
    <Layout>
      <h3>Page not found</h3>
      <p className="text-muted">That screen doesn't exist.</p>
      <Link className="btn btn-secondary" to="/" style={{ width: "fit-content" }}>
        Back to Dashboard
      </Link>
    </Layout>
  );
}
