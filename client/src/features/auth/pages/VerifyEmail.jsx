import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "@/features/auth/components/AuthLayout";
import { useAuth } from "@/features/auth/AuthContext";
import api from "@/shared/api/client";
import { roleHome } from "@/shared/lib/roles";

// Matches the server's resend cooldown. Purely a courtesy — the real limit lives
// in the OtpToken document, because a counter the client owns is a counter an
// attacker owns.
const COOLDOWN_SEC = 60;

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());

export default function VerifyEmail() {
  const { user, refreshUser } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  // Three ways to know the address: signed in, handed over by the signup
  // redirect, or typed. The third exists because the code arrives by email, and
  // people open email on a different device from the one they signed up on.
  const passed = loc.state?.email || "";
  const [email, setEmail] = useState(user?.email || passed);
  const knownEmail = Boolean(user?.email || passed);

  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Whether a code has just been sent, without trusting navigation state to
  // survive the trip: registering signs the user in, and the redirect that wins
  // the race may be the router's rather than signup's, which carries nothing.
  //
  // A brand-new account is proof enough — registration sends a code — so the
  // account's own age gives the honest answer.
  const [cooldown, setCooldown] = useState(() => {
    if (loc.state?.justSent) return COOLDOWN_SEC;
    const createdAt = user?.createdAt ? new Date(user.createdAt).getTime() : 0;
    const age = Math.floor((Date.now() - createdAt) / 1000);
    return createdAt && age < COOLDOWN_SEC ? COOLDOWN_SEC - age : 0;
  });
  const codeRef = useRef(null);

  useEffect(() => {
    if (user?.emailVerifiedAt) nav(roleHome(user.role), { replace: true });
  }, [user, nav]);

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (knownEmail) codeRef.current?.focus();
  }, [knownEmail]);

  const onCode = (e) => {
    setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
    setErr("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setNote("");
    if (!emailOk(email)) return setErr("Enter the email address you signed up with");
    if (code.length !== 6) return setErr("Enter the 6-digit code from your email");

    setBusy(true);
    try {
      await api.post("/auth/otp/verify", {
        email: email.trim(),
        purpose: "email_verify",
        code,
      });
      setDone(true);
      if (user) {
        // Pull the account down again so emailVerifiedAt is current; the
        // redirect in the effect above then takes over.
        await refreshUser();
      }
    } catch (e2) {
      setErr(e2.message);
      setCode("");
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setErr("");
    setNote("");
    if (!emailOk(email)) return setErr("Enter the email address you signed up with");

    setCooldown(COOLDOWN_SEC);
    try {
      await api.post("/auth/otp/request", { email: email.trim(), purpose: "email_verify" });
    } catch (e2) {
      // The endpoint answers the same way whether or not the address needs a
      // code, so there is nothing here worth reporting except a real outage.
      if (e2.isNetwork) setErr(e2.message);
    }
    // Deliberately unconditional, and deliberately vague. Confirming "sent"
    // only for real accounts would turn this button into an address checker.
    setNote("If that address needs a code, it's on its way.");
  };

  if (done && !user) {
    return (
      <AuthLayout>
        <h2>Email confirmed</h2>
        <p className="auth-sub">Your address is verified. Sign in to pick up where you left off.</p>
        <Link to="/login" className="btn btn-primary btn-block" style={{ justifyContent: "center" }}>
          Go to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h2>Confirm your email</h2>
      <p className="auth-sub">
        {knownEmail ? (
          <>
            We sent a 6-digit code to <strong>{email}</strong>. It expires in 10 minutes.
          </>
        ) : (
          <>Enter your email and the 6-digit code we sent you.</>
        )}
      </p>

      {err && <div className="form-error">{err}</div>}
      {note && <div className="form-note">{note}</div>}

      <form onSubmit={submit} noValidate>
        {!knownEmail && (
          <div className="field">
            <label>Email</label>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErr("");
              }}
            />
          </div>
        )}

        <div className="field">
          <label>6-digit code</label>
          <input
            ref={codeRef}
            className="input otp-input"
            // Lets iOS and Android offer the code straight from the message,
            // which is the difference between typing it and tapping once.
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={onCode}
          />
        </div>

        <button
          className={"btn btn-primary btn-block" + (busy ? " is-loading" : "")}
          style={{ justifyContent: "center", marginTop: 4 }}
          disabled={busy || code.length !== 6}
        >
          Confirm email
        </button>
      </form>

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
        Check your spam folder too — and <Link to={user ? roleHome(user.role) : "/login"}>
          {user ? "keep browsing" : "sign in"}
        </Link>{" "}
        meanwhile.
      </p>
    </AuthLayout>
  );
}
