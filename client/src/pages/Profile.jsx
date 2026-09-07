import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import api from "../api/client";
import Layout from "../components/Layout";
import { roleHome } from "../lib/roles";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { initials, cap } from "../lib/format";

export default function Profile() {
  const { user, patchUser } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const goBack = () => (window.history.length > 1 ? nav(-1) : nav(roleHome(user.role)));
  const [p, setP] = useState({ name: user.name, email: user.email, phone: user.phone || "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [busy, setBusy] = useState(false);
  const [busyPw, setBusyPw] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.put("/auth/me", p);
      patchUser(data.user);
      toast("Changes saved");
    } catch (e) {
      toast(e.message);
    }
    setBusy(false);
  };

  const changePw = async (e) => {
    e.preventDefault();
    setBusyPw(true);
    try {
      await api.put("/auth/me/password", pw);
      setPw({ currentPassword: "", newPassword: "" });
      toast("Password updated");
    } catch (e) {
      toast(e.message);
    }
    setBusyPw(false);
  };

  return (
    <Layout>
      <button type="button" className="back" onClick={goBack} style={{ marginBottom: 14 }}>
        <ArrowLeft />
        Back
      </button>
      <h4 className="page-title">Profile</h4>
      <div style={{ maxWidth: 420 }}>
        <div className="row" style={{ marginBottom: 20 }}>
          <div
            className="avatar avatar-initials"
            style={{ width: 72, height: 72, fontSize: 20 }}
          >
            {initials(user.name)}
          </div>
          <div>
            <h4 style={{ marginBottom: 2 }}>{user.name}</h4>
            <span className="text-muted" style={{ fontSize: 13 }}>
              {cap(user.role)}
            </span>
          </div>
        </div>

        <form onSubmit={save}>
          <div className="field">
            <label>Full Name</label>
            <input
              className="input"
              value={p.name}
              onChange={(e) => setP({ ...p, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Email</label>
            <input
              className="input"
              type="email"
              value={p.email}
              onChange={(e) => setP({ ...p, email: e.target.value })}
            />
          </div>
          <div className="field" style={{ marginBottom: 18 }}>
            <label>Phone</label>
            <input
              className="input"
              value={p.phone}
              onChange={(e) => setP({ ...p, phone: e.target.value })}
            />
          </div>
          <button className={"btn btn-primary" + (busy ? " is-loading" : "")}>Save Changes</button>
        </form>

        <div className="hr" />
        <h5 className="section-h">Change Password</h5>
        <form onSubmit={changePw}>
          <div className="field">
            <label>Current Password</label>
            <input
              className="input"
              type="password"
              required
              value={pw.currentPassword}
              onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
            />
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>New Password</label>
            <input
              className="input"
              type="password"
              required
              minLength={6}
              value={pw.newPassword}
              onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
            />
          </div>
          <button className={"btn btn-secondary" + (busyPw ? " is-loading" : "")}>
            Update Password
          </button>
        </form>
      </div>
    </Layout>
  );
}
