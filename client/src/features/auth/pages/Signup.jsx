import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "@/features/auth/components/AuthLayout";
import PasswordInput from "@/shared/components/ui/PasswordInput";
import { useAuth } from "@/features/auth/AuthContext";
import { roleHome } from "@/shared/lib/roles";
import { passwordProblem, PASSWORD_HINT } from "@/shared/lib/password";
import { emailOk, phoneOk } from "@/shared/lib/format";


export default function Signup() {
  const { register } = useAuth();
  const nav = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [apiErr, setApiErr] = useState("");
  const [busy, setBusy] = useState(false);

  const errors = {
    name: !form.name.trim()
      ? "Your name is required"
      : form.name.trim().length < 2
      ? "That name looks too short"
      : "",
    email: !form.email.trim()
      ? "Email is required"
      : !emailOk(form.email)
      ? "Enter a valid email"
      : "",
    phone: phoneOk(form.phone) ? "" : "Enter a valid phone number",
    password: !form.password
      ? "Password is required"
      : passwordProblem(form.password, form),
    // check "empty" before "mismatch" — an untouched field isn't a mismatch
    confirm: !form.confirm
      ? "Re-enter your password"
      : form.confirm !== form.password
      ? "Passwords don't match"
      : "",
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
    if (Object.values(errors).some(Boolean)) return;
    setBusy(true);
    try {
      const user = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      nav(roleHome(user.role), { replace: true });
    } catch (err) {
      setApiErr(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h2>Create your account</h2>
      <p className="auth-sub">Free — sign up as a student and start any course.</p>

      {apiErr && <div className="form-error">{apiErr}</div>}

      <form onSubmit={submit} noValidate>
        <div className="field">
          <label>Full name</label>
          <input
            className={"input" + (showErr("name") ? " has-err" : "")}
            autoComplete="name"
            autoFocus
            value={form.name}
            onChange={set("name")}
            onBlur={blur("name")}
          />
          {showErr("name") && <div className="field-err">{errors.name}</div>}
        </div>

        <div className="field">
          <label>Email</label>
          <input
            className={"input" + (showErr("email") ? " has-err" : "")}
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
            onBlur={blur("email")}
          />
          {showErr("email") && <div className="field-err">{errors.email}</div>}
        </div>

        <div className="field">
          <label>Phone <span className="text-muted">(optional)</span></label>
          <input
            className={"input" + (showErr("phone") ? " has-err" : "")}
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={set("phone")}
            onBlur={blur("phone")}
          />
          {showErr("phone") && <div className="field-err">{errors.phone}</div>}
        </div>

        <div className="field">
          <label>Password</label>
          <PasswordInput
            className={showErr("password") ? "has-err" : ""}
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            onBlur={blur("password")}
          />
          {showErr("password") ? (
            <div className="field-err">{errors.password}</div>
          ) : (
            <div className="muted-sm" style={{ marginTop: 4 }}>{PASSWORD_HINT}</div>
          )}
        </div>

        <div className="field">
          <label>Confirm password</label>
          <PasswordInput
            className={showErr("confirm") ? "has-err" : ""}
            autoComplete="new-password"
            value={form.confirm}
            onChange={set("confirm")}
            onBlur={blur("confirm")}
          />
          {showErr("confirm") && <div className="field-err">{errors.confirm}</div>}
        </div>

        <button
          className={"btn btn-primary btn-block" + (busy ? " is-loading" : "")}
          style={{ justifyContent: "center", marginTop: 4 }}
          disabled={busy}
        >
          Create account
        </button>
      </form>

      <p className="auth-foot">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
