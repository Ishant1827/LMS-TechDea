import { Link } from "react-router-dom";
import { MailWarning } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";

/**
 * Shown to a student whose address hasn't been confirmed yet.
 *
 * Deliberately a banner rather than a blocking screen. The account works —
 * browsing, reading, signing in — and only enrolling, submitting and asking a
 * doubt are held back. Locking the whole app would turn one undelivered email
 * into a dead account, and undelivered is currently a realistic outcome (G21).
 *
 * This is a prompt, not a protection. The server refuses those three actions
 * on its own (requireVerified); hiding them here would change nothing about
 * what the API accepts.
 */
export default function VerifyBanner() {
  const { user } = useAuth();
  if (!user || user.role !== "student" || user.emailVerifiedAt) return null;

  return (
    <div className="verify-banner" role="status">
      <MailWarning aria-hidden="true" />
      <div className="verify-banner-text">
        <strong>Confirm your email to start learning.</strong>
        <span>
          We sent a code to {user.email}. You'll need it before you can enrol in a course or
          submit work.
        </span>
      </div>
      <Link className="btn btn-primary" to="/verify-email">
        Enter code
      </Link>
    </div>
  );
}
