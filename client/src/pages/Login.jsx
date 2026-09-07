import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import PasswordInput from "../components/PasswordInput";
import { useAuth } from "../context/AuthContext";
import { roleHome } from "../lib/roles";

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const [form, setForm] = useState({ email: "", password: "" });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [apiErr, setApiErr] = useState("");
  const [busy, setBusy] = useState(false);

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

  const submit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    setApiErr("");
    if (errors.email || errors.password) return;
    setBusy(true);
    try {
      const user = await login(form.email.trim(), form.password);
      nav(loc.state?.from || roleHome(user.role), { replace: true });
    } catch (err) {
      setApiErr(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h2>Welcome back</h2>
      <p className="auth-sub">Sign in to continue learning.</p>

      {apiErr && <div className="form-error">{apiErr}</div>}

      <form onSubmit={submit} noValidate>
        <div className="field">
          <label>Email</label>
          <input
            className={"input" + (showErr("email") ? " has-err" : "")}
            type="email"
            autoComplete="email"
            autoFocus
            value={form.email}
            onChange={set("email")}
            onBlur={blur("email")}
          />
          {showErr("email") && <div className="field-err">{errors.email}</div>}
        </div>

        <div className="field">
          <div className="field-head">
            <label>Password</label>
            <Link to="/forgot-password" className="field-link">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            className={showErr("password") ? "has-err" : ""}
            autoComplete="current-password"
            value={form.password}
            onChange={set("password")}
            onBlur={blur("password")}
          />
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
