import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { roleHome } from "../lib/roles";

export default function Signup() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const user = await register(form);
      nav(roleHome(user.role), { replace: true });
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
        <h3 style={{ marginBottom: 4 }}>Create your account</h3>
        <p className="text-muted" style={{ marginBottom: 16, fontSize: 13 }}>
          Sign up as a student — it's free.
        </p>
        {err && <div className="form-error">{err}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Full name</label>
            <input className="input" required value={form.name} onChange={set("name")} />
          </div>
          <div className="field">
            <label>Email</label>
            <input
              className="input"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={set("email")}
            />
          </div>
          <div className="field">
            <label>Phone (optional)</label>
            <input className="input" value={form.phone} onChange={set("phone")} />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={form.password}
              onChange={set("password")}
            />
          </div>
          <button
            className={"btn btn-primary btn-block" + (busy ? " is-loading" : "")}
            style={{ justifyContent: "center" }}
          >
            Create account
          </button>
        </form>
      </div>

      <p className="text-muted" style={{ fontSize: 13, marginTop: 14 }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}
