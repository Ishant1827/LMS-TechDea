import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BootLoader } from "./Bits";
import { roleHome } from "../lib/roles";

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) return <BootLoader label="Loading your learning hub…" />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />;
  return children;
}
