import { Link } from "react-router-dom";
import AuthLayout from "@/features/auth/components/AuthLayout";

/**
 * There is no self-service reset, because there is no email.
 *
 * A reset by code existed and worked; it was removed along with the rest of the
 * email feature, because nothing could deliver the code — the free hosting plan
 * blocks outbound SMTP ports, and a free mail domain cannot be authenticated to
 * send from. Recovery is therefore an admin setting a new password from
 * Admin > Users, which also signs the account out everywhere and requires the
 * owner to choose their own password on the way back in.
 *
 * If email ever returns, the flow to restore is in the git history.
 */
export default function ForgotPassword() {
  return (
    <AuthLayout>
      <h2>Reset your password</h2>
      <p className="auth-sub">Resetting by email isn't available.</p>

      <div className="form-note" style={{ marginBottom: 16 }}>
        Ask an admin to set a new password for you. They can do it from
        <strong> Admin &rsaquo; Users</strong>, and you'll be asked to choose your own the first
        time you sign in.
      </div>

      <p className="text-muted" style={{ fontSize: 13.5 }}>
        If you can still sign in, you can change your password yourself from your Profile page.
      </p>

      <Link to="/login" className="btn btn-primary btn-block" style={{ justifyContent: "center" }}>
        Back to sign in
      </Link>
    </AuthLayout>
  );
}
