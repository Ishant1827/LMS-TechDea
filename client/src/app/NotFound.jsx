import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Layout from "@/shared/components/layout/Layout";
import { roleHome } from "@/shared/lib/roles";
import { useAuth } from "@/features/auth/AuthContext";

export default function NotFound() {
  const { user } = useAuth();
  const home = user ? roleHome(user.role) : "/login";

  return (
    <Layout>
      <h3>Page not found</h3>
      <p className="text-muted">That screen doesn't exist.</p>
      <Link className="btn btn-secondary" to={home} style={{ width: "fit-content" }}>
        <ArrowLeft />
        Back to Dashboard
      </Link>
    </Layout>
  );
}
