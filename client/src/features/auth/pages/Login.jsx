import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Sun, CloudSun, Moon, ArrowBigUp } from "lucide-react";
import AuthLayout from "@/features/auth/components/AuthLayout";
import PasswordInput from "@/shared/components/ui/PasswordInput";
import { useAuth } from "@/features/auth/AuthContext";
import { roleHome } from "@/shared/lib/roles";
import { emailOk } from "@/shared/lib/format";

// The email this device last signed in with, for the "Continue as" shortcut.
const LAST_EMAIL_KEY = "techdea-last-email";
const lastEmail = {
  get() { try { return localStorage.getItem(LAST_EMAIL_KEY) || ""; } catch { return ""; } },
  set(v) { try { localStorage.setItem(LAST_EMAIL_KEY, v); } catch { /* storage blocked */ } },
  clear() { try { localStorage.removeItem(LAST_EMAIL_KEY); } catch { /* storage blocked */ } },
};

function Greeting() {
  const h = new Date().getHours();
  const [text, Icon] = h < 12 ? ["Good morning", Sun] : h < 17 ? ["Good afternoon", CloudSun] : ["Good evening", Moon];
  return <div className="auth-greet"><Icon />{text}</div>;
}

// Phones skip autofocus: it would pop the keyboard over the page on arrival.
const wantsAutoFocus = () => !window.matchMedia("(max-width: 680px)").matches;

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const [remembered, setRemembered] = useState(lastEmail.get);
  const [form, setForm] = useState(() => ({ email: lastEmail.get(), password: "" }));
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [apiErr, setApiErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [caps, setCaps] = useState(false);
  const [shake, setShake] = useState(0);
  const [autoFocus] = useState(wantsAutoFocus);

  const errors = {
    email: !form.email.trim()
      ? "Email is required"
      : !emailOk(form.email)
      ? "Enter a valid email"
      : "",
    password: !form.password ? "Password is required" : "",
  };
  const showErr = (k) => (touched[k] || submitted) && errors[k];

  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    setApiErr("");
  };
  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }));
  const checkCaps = (e) => setCaps(!!e.getModifierState?.("CapsLock"));

  const notYou = () => {
    lastEmail.clear();
    setRemembered("");
    setForm({ email: "", password: "" });
    setTouched({});
    setSubmitted(false);
    setTimeout(() => document.getElementById("login-email")?.focus(), 0);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    setApiErr("");
    if (errors.email || errors.password) return;
    setBusy(true);
    try {
      const email = form.email.trim();
      const user = await login(email, form.password);
      lastEmail.set(email);
      nav(loc.state?.from || roleHome(user.role), { replace: true });
    } catch (err) {
      setApiErr(err.message);
      setBusy(false);
      setShake((n) => n + 1);
      // clear the password for a retry without flagging it as "required"
      setForm((f) => ({ ...f, password: "" }));
      setSubmitted(false);
      setTouched((t) => ({ ...t, password: false }));
      setTimeout(() => document.getElementById("login-password")?.focus(), 0);
    }
  };

  return (
    <AuthLayout shake={shake}>
      <Greeting />
      <h2>Welcome back</h2>
      <p className="auth-sub">Sign in to continue learning.</p>

      {apiErr && <div className="form-error">{apiErr}</div>}

      <form onSubmit={submit} noValidate>
        {remembered ? (
          <div className="auth-remembered">
            <span className="avatar avatar-initials" aria-hidden="true">
              {remembered[0].toUpperCase()}
            </span>
            <div className="auth-remembered-who">
              <small>Continue as</small>
              <strong>{remembered}</strong>
            </div>
            <button type="button" onClick={notYou}>Not you?</button>
          </div>
        ) : (
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className={"input" + (showErr("email") ? " has-err" : "")}
              type="email"
              autoComplete="email"
              autoFocus={autoFocus}
              value={form.email}
              onChange={set("email")}
              onBlur={blur("email")}
            />
            {showErr("email") && <div className="field-err">{errors.email}</div>}
          </div>
        )}

        <div className="field">
          <div className="field-head">
            <label htmlFor="login-password">Password</label>
            <Link to="/forgot-password" className="field-link">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="login-password"
            className={showErr("password") ? "has-err" : ""}
            autoComplete="current-password"
            autoFocus={autoFocus && !!remembered}
            value={form.password}
            onChange={set("password")}
            onKeyDown={checkCaps}
            onKeyUp={checkCaps}
            onBlur={() => { blur("password")(); setCaps(false); }}
          />
          {caps && (
            <div className="caps-warn"><ArrowBigUp />Caps Lock is on</div>
          )}
          {showErr("password") && <div className="field-err">{errors.password}</div>}
        </div>

        <button
          className={"btn btn-primary btn-block" + (busy ? " is-loading" : "")}
          style={{ justifyContent: "center", marginTop: 4 }}
          disabled={busy}
        >
          Sign in
        </button>
      </form>

      <p className="auth-foot">
        New to TechDea? <Link to="/signup">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
