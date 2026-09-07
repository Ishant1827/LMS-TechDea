import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { roleHome } from "../lib/roles";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const user = await login(form.email, form.password);
      nav(loc.state?.from || roleHome(user.role), { replace: true });
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="brand" style={{ marginBottom: 24 }}>
        <span className="brand-mark">
          <GraduationCap />
        </span>
        <span className="brand-word">
          Tech<span>Dea</span>
        </span>
      </div>

      <div className="card elev-sm">
        <h3 style={{ marginBottom: 4 }}>Sign in</h3>
        <p className="text-muted" style={{ marginBottom: 16, fontSize: 13 }}>
          Welcome back. Enter your details.
        </p>
        {err && <div className="form-error">{err}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input
              className="input"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <button
            className={"btn btn-primary btn-block" + (busy ? " is-loading" : "")}
            style={{ justifyContent: "center" }}
          >
            Sign in
          </button>
        </form>
      </div>

      <p className="text-muted" style={{ fontSize: 13, marginTop: 14 }}>
        New here? <Link to="/signup">Create a student account</Link>
      </p>
    </div>
  );
}
