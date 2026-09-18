import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "@/features/auth/components/AuthLayout";
import PasswordInput from "@/shared/components/ui/PasswordInput";
import api from "@/shared/api/client";
import { useAuth } from "@/features/auth/AuthContext";

/**
 * Forgotten-password recovery, in three steps on one screen.
 *
 *   email  ->  code  ->  new password
 *
 * The middle step is not decoration. Entering the code exchanges it for a
 * short-lived token held only in this component's state; that token is what
 * authorises the change. The code itself is never sent again, and nothing that
 * can reset a password is written to localStorage.
 */

const COOLDOWN_SEC = 60; // mirrors the server's resend cooldown
const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());

export default function ForgotPassword() {
  const nav = useNavigate();
  const { features } = useAuth();

  const [step, setStep] = useState("email"); // email | code | password | done
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState({ next: "", confirm: "" });

  // Never persisted. A page refresh loses it and the user starts again, which is
  // the correct trade for a credential that can take over an account.
  const [actionToken, setActionToken] = useState("");

  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const codeRef = useRef(null);

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
    // The password step focuses itself: PasswordInput wraps its <input> and does
    // not forward a ref, but it does spread props, so autoFocus reaches it.
  }, [step]);

  const clear = () => { setErr(""); setNote(""); };

  // ── step 1: ask for a code ──────────────────────────────────────────────
  const requestCode = async (e) => {
    e.preventDefault();
    clear();
    if (!emailOk(email)) return setErr("Enter a valid email address");

    setBusy(true);
    try {
      await api.post("/auth/otp/request", { email: email.trim(), purpose: "password_reset" });
      // Moves on regardless of whether an account exists. The server answers
      // identically either way, and branching here would rebuild the account
      // checker it is carefully avoiding being.
      setStep("code");
      setCooldown(COOLDOWN_SEC);
      setNote("If that address has an account, a code is on its way.");
    } catch (e2) {
      // The server is the authority: if mail was switched off after this page
      // loaded, its answer says so and the message is the one to show.
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    clear();
    setCooldown(COOLDOWN_SEC);
    try {
      await api.post("/auth/otp/request", { email: email.trim(), purpose: "password_reset" });
    } catch (e2) {
      if (e2.isNetwork) setErr(e2.message);
    }
    setNote("If that address has an account, a new code is on its way.");
  };

  // ── step 2: spend the code ──────────────────────────────────────────────
  const submitCode = async (e) => {
    e.preventDefault();
    clear();
    if (code.length !== 6) return setErr("Enter the 6-digit code from your email");

    setBusy(true);
    try {
      const { data } = await api.post("/auth/otp/verify", {
        email: email.trim(),
        purpose: "password_reset",
        code,
      });
      setActionToken(data.actionToken);
      setStep("password");
      setNote(`Choose a new password — you have about ${data.expiresMinutes || 5} minutes.`);
    } catch (e2) {
      setErr(e2.message);
      setCode("");
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  // ── step 3: set the new password ────────────────────────────────────────
  const submitPassword = async (e) => {
    e.preventDefault();
    clear();
    if (pw.next.length < 6) return setErr("Password must be at least 6 characters");
    if (pw.next !== pw.confirm) return setErr("Passwords don't match");

    setBusy(true);
    try {
      await api.post("/auth/password/reset", {
        email: email.trim(),
        actionToken,
        newPassword: pw.next,
      });
      setActionToken("");
      setPw({ next: "", confirm: "" });
      setStep("done");
    } catch (e2) {
      setErr(e2.message);
      // The five-minute window is the only thing that expires here, and when it
      // does there is nothing to retry — the code is already spent.
      if (e2.status === 400) {
        setActionToken("");
        setStep("email");
        setCode("");
      }
    } finally {
      setBusy(false);
    }
  };

  // No mail configured means no code can reach anyone, so the whole flow is a
  // dead end. Say so plainly and point at the route that does work, rather than
  // letting someone type an address and wait for a message that is not coming.
  if (!features?.email) {
    return (
      <AuthLayout>
        <h2>Reset your password</h2>
        <p className="auth-sub">Password reset by email isn't available yet.</p>

        <div className="form-note" style={{ marginBottom: 16 }}>
          Ask an admin to set a new password for you. If you can still sign in, you can change it
          yourself from your Profile page.
        </div>

        <Link to="/login" className="btn btn-primary btn-block" style={{ justifyContent: "center" }}>
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  if (step === "done") {
    return (
      <AuthLayout>
        <h2>Password updated</h2>
        <p className="auth-sub">
          You've been signed out on every device, including any you don't recognise. Sign in with
          your new password.
        </p>
        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ justifyContent: "center" }}
          onClick={() => nav("/login", { replace: true })}
        >
          Go to sign in
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h2>Reset your password</h2>
      <p className="auth-sub">
        {step === "email" && "We'll email you a 6-digit code to confirm it's you."}
        {step === "code" && <>Enter the code we sent to <strong>{email}</strong>.</>}
        {step === "password" && "Almost done — pick a new password."}
      </p>

      {err && <div className="form-error">{err}</div>}
      {note && !err && <div className="form-note">{note}</div>}

      {step === "email" && (
        <form onSubmit={requestCode} noValidate>
          <div className="field">
            <label>Email</label>
            <input
              className="input"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => { setEmail(e.target.value); clear(); }}
            />
          </div>
          <button
            className={"btn btn-primary btn-block" + (busy ? " is-loading" : "")}
            style={{ justifyContent: "center" }}
            disabled={busy}
          >
            Send code
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={submitCode} noValidate>
          <div className="field">
            <label>6-digit code</label>
            <input
              ref={codeRef}
              className="input otp-input"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); clear(); }}
            />
          </div>
          <button
            className={"btn btn-primary btn-block" + (busy ? " is-loading" : "")}
            style={{ justifyContent: "center" }}
            disabled={busy || code.length !== 6}
          >
            Continue
          </button>

          <p className="auth-foot">
            Didn't get it?{" "}
            {cooldown > 0 ? (
              <span className="text-muted">Resend in {cooldown}s</span>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={resend}>
                Send a new code
              </button>
            )}
          </p>
          <p className="auth-foot">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => { setStep("email"); setCode(""); clear(); }}
            >
              Use a different email
            </button>
          </p>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={submitPassword} noValidate>
          <div className="field">
            <label>New password</label>
            <PasswordInput
              autoFocus
              autoComplete="new-password"
              value={pw.next}
              onChange={(e) => { setPw({ ...pw, next: e.target.value }); clear(); }}
            />
            <div className="muted-sm" style={{ marginTop: 4 }}>At least 6 characters.</div>
          </div>

          <div className="field">
            <label>Confirm new password</label>
            <PasswordInput
              autoComplete="new-password"
              value={pw.confirm}
              onChange={(e) => { setPw({ ...pw, confirm: e.target.value }); clear(); }}
            />
          </div>

          <button
            className={"btn btn-primary btn-block" + (busy ? " is-loading" : "")}
            style={{ justifyContent: "center" }}
            disabled={busy || !pw.next || !pw.confirm}
          >
            Update password
          </button>
        </form>
      )}

      <p className="auth-foot">
        Remembered it? <Link to="/login">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
