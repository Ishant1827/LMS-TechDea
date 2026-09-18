import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import api from "@/shared/api/client";
import Layout from "@/shared/components/layout/Layout";
import PasswordInput from "@/shared/components/ui/PasswordInput";
import { roleHome } from "@/shared/lib/roles";
import { useAuth } from "@/features/auth/AuthContext";
import EmailChangeCard from "@/features/account/EmailChangeCard";
import { useToast } from "@/shared/context/ToastContext";
import { initials, cap } from "@/shared/lib/format";

const phoneOk = (v) => !v.trim() || /^[\d+\-\s()]{6,20}$/.test(v.trim());

export default function Profile() {
  const { user, patchUser, applyToken } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const goBack = () => (window.history.length > 1 ? nav(-1) : nav(roleHome(user.role)));

  const [p, setP] = useState({ name: user.name, phone: user.phone || "" });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwTouched, setPwTouched] = useState({});
  const [pwSubmitted, setPwSubmitted] = useState(false);
  const [pwErr, setPwErr] = useState("");
  const [busyPw, setBusyPw] = useState(false);

  // Inline validation, the same shape as the sign-up form: a field only shows
  // its error once it has been left or the form has been submitted.
  const errors = {
    name: !p.name.trim()
      ? "Your name is required"
      : p.name.trim().length < 2
      ? "That name looks too short"
      : "",
    phone: phoneOk(p.phone) ? "" : "Enter a valid phone number",
  };
  const showErr = (k) => (touched[k] || submitted) && errors[k];

  const pwErrors = {
    currentPassword: pw.currentPassword ? "" : "Enter your current password",
    newPassword: !pw.newPassword
      ? "Choose a new password"
      : pw.newPassword.length < 6
      ? "At least 6 characters"
      : pw.newPassword === pw.currentPassword
      ? "Pick something different from your current password"
      : "",
    confirm: !pw.confirm
      ? "Re-enter your new password"
      : pw.confirm !== pw.newPassword
      ? "Passwords don't match"
      : "",
  };
  const showPwErr = (k) => (pwTouched[k] || pwSubmitted) && pwErrors[k];

  const set = (k) => (e) => {
    setP({ ...p, [k]: e.target.value });
    setErr("");
  };
  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }));

  const setPwField = (k) => (e) => {
    setPw({ ...pw, [k]: e.target.value });
    setPwErr("");
  };
  const blurPw = (k) => () => setPwTouched((t) => ({ ...t, [k]: true }));

  // Nothing to save until something actually differs from the stored account.
  const dirty = p.name.trim() !== user.name || p.phone.trim() !== (user.phone || "");

  const save = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    setErr("");
    if (Object.values(errors).some(Boolean)) return;
    setBusy(true);
    try {
      // No email here — the address has its own flow, see EmailChangeCard.
      const { data } = await api.put("/auth/me", {
        name: p.name.trim(),
        phone: p.phone.trim(),
      });
      patchUser(data.user);
      // re-seed the form from the server so the fields can never drift from
      // what was actually stored
      setP({ name: data.user.name, phone: data.user.phone || "" });
      setTouched({});
      setSubmitted(false);
      toast("Changes saved");
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };

  const reset = () => {
    setP({ name: user.name, phone: user.phone || "" });
    setTouched({});
    setSubmitted(false);
    setErr("");
  };

  const changePw = async (e) => {
    e.preventDefault();
    setPwSubmitted(true);
    setPwErr("");
    if (Object.values(pwErrors).some(Boolean)) return;
    setBusyPw(true);
    try {
      const { data } = await api.put("/auth/me/password", {
        currentPassword: pw.currentPassword,
        newPassword: pw.newPassword,
      });
      // Changing the password signs out every other device. This tab gets a
      // replacement token in the response — without storing it, the next
      // request from here would 401 and dump the user at the sign-in screen.
      if (data?.token) applyToken(data.token);
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
      setPwTouched({});
      setPwSubmitted(false);
      toast("Password updated — other devices have been signed out");
    } catch (e) {
      setPwErr(e.message);
    }
    setBusyPw(false);
  };

  return (
    <Layout>
      <button type="button" className="back" onClick={goBack} style={{ marginBottom: 14 }}>
        <ArrowLeft />
        Back
      </button>
      <h2 className="page-title">Profile</h2>

      <div className="profile-wrap">
        <div className="profile-head card elev-sm">
          <div className="avatar avatar-initials profile-avatar">{initials(user.name)}</div>
          <div className="profile-id">
            <h4>{user.name}</h4>
            <span className="muted-sm">{user.email}</span>
          </div>
          <span className="tag tag-neutral">{cap(user.role)}</span>
        </div>

        <form onSubmit={save} className="card elev-sm" noValidate>
          <div className="card-kicker">Your details</div>

          {err && <div className="form-error">{err}</div>}

          <div className="field">
            <label htmlFor="pf-name">Full name</label>
            <input
              id="pf-name"
              className={"input" + (showErr("name") ? " has-err" : "")}
              autoComplete="name"
              value={p.name}
              onChange={set("name")}
              onBlur={blur("name")}
            />
            {showErr("name") && <div className="field-err">{errors.name}</div>}
          </div>

          <div className="field">
            <label htmlFor="pf-phone">Phone</label>
            <input
              id="pf-phone"
              className={"input" + (showErr("phone") ? " has-err" : "")}
              type="tel"
              autoComplete="tel"
              placeholder="Optional"
              value={p.phone}
              onChange={set("phone")}
              onBlur={blur("phone")}
            />
            {showErr("phone") && <div className="field-err">{errors.phone}</div>}
          </div>

          <div className="form-actions">
            <button
              className={"btn btn-primary" + (busy ? " is-loading" : "")}
              disabled={busy || !dirty}
            >
              Save changes
            </button>
            {dirty && !busy && (
              <button type="button" className="btn btn-ghost" onClick={reset}>
                Discard
              </button>
            )}
            <span className="muted-sm">{dirty ? "Unsaved changes" : "Everything saved"}</span>
          </div>
        </form>

        <EmailChangeCard />

        <form onSubmit={changePw} className="card elev-sm" noValidate>
          <div className="card-kicker">Change password</div>

          {pwErr && <div className="form-error">{pwErr}</div>}

          <div className="field">
            <label htmlFor="pf-current">Current password</label>
            <PasswordInput
              id="pf-current"
              className={showPwErr("currentPassword") ? "has-err" : ""}
              autoComplete="current-password"
              value={pw.currentPassword}
              onChange={setPwField("currentPassword")}
              onBlur={blurPw("currentPassword")}
            />
            {showPwErr("currentPassword") && (
              <div className="field-err">{pwErrors.currentPassword}</div>
            )}
          </div>

          <div className="field">
            <label htmlFor="pf-new">New password</label>
            <PasswordInput
              id="pf-new"
              className={showPwErr("newPassword") ? "has-err" : ""}
              autoComplete="new-password"
              value={pw.newPassword}
              onChange={setPwField("newPassword")}
              onBlur={blurPw("newPassword")}
            />
            {showPwErr("newPassword") ? (
              <div className="field-err">{pwErrors.newPassword}</div>
            ) : (
              <div className="muted-sm" style={{ marginTop: 4 }}>
                At least 6 characters.
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="pf-confirm">Confirm new password</label>
            <PasswordInput
              id="pf-confirm"
              className={showPwErr("confirm") ? "has-err" : ""}
              autoComplete="new-password"
              value={pw.confirm}
              onChange={setPwField("confirm")}
              onBlur={blurPw("confirm")}
            />
            {showPwErr("confirm") && <div className="field-err">{pwErrors.confirm}</div>}
          </div>

          <div className="form-actions">
            <button
              className={"btn btn-secondary" + (busyPw ? " is-loading" : "")}
              disabled={busyPw}
            >
              Update password
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
