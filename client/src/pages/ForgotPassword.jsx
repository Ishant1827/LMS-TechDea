import { Link } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";

// Placeholder — the reset-by-email flow isn't wired up yet. For now, an admin
// can set a new password from Admin › Users, or a signed-in user can change
// theirs from Profile.
export default function ForgotPassword() {
  return (
    <AuthLayout>
      <h2>Reset your password</h2>
      <p className="auth-sub">
        Password reset by email isn't available yet.
      </p>

      <div className="card-meta" style={{ marginBottom: 16 }}>
        In the meantime, ask an admin to set a new password for you, or — if you
        can still sign in — change it from your Profile page.
      </div>

      <Link to="/login" className="btn btn-primary btn-block" style={{ justifyContent: "center" }}>
        Back to sign in
      </Link>
    </AuthLayout>
  );
}
