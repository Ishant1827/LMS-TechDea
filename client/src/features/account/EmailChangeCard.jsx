import { useState } from "react";
import { Mail } from "lucide-react";
import api from "@/shared/api/client";
import PasswordInput from "@/shared/components/ui/PasswordInput";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/shared/context/ToastContext";

/**
 * Changing the address on an account, in its own card because it is its own
 * flow — not a field on the details form.
 *
 *   password  ->  code sent to the new address  ->  confirmed
 *
 * The password is asked for first, and that is the part doing the work. The
 * token in localStorage is not enough on its own: without this, anyone holding
 * a stolen one could repoint the account's recovery channel at themselves and
 * keep it for good.
 *
 * A pending change survives a refresh, because the server remembers it — the
 * code arrives by email, and people read email on their phone.
 */

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());

export default function EmailChangeCard() {
  const { user, patchUser, features } = useAuth();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ newEmail: "", currentPassword: "" });
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const pending = user.pendingEmail || "";
  const clear = () => setErr("");

  // Changing an address is confirmed by a code sent to it. Without mail there is
  // no way to finish, so the card shows the address and points at the one route
  // that does work.
  const emailOff = !features?.email;

  const request = async (e) => {
    e.preventDefault();
    clear();
    if (!emailOk(form.newEmail)) return setErr("Enter a valid email address");
    if (!form.currentPassword) return setErr("Enter your current password");

    setBusy(true);
    try {
      await api.put("/auth/me/email", {
        newEmail: form.newEmail.trim(),
        currentPassword: form.currentPassword,
      });
      // Refresh rather than trust the local guess: pendingEmail is what drives
      // which half of this card renders, and the server owns it.
      const { data } = await api.get("/auth/me");
      patchUser(data.user);
      setForm({ newEmail: "", currentPassword: "" });
      setOpen(false);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e) => {
    e.preventDefault();
    clear();
    if (code.length !== 6) return setErr("Enter the 6-digit code");

    setBusy(true);
    try {
      const { data } = await api.post("/auth/me/email/verify", { code });
      patchUser(data.user);
      setCode("");
      toast("Email address updated");
    } catch (e2) {
      setErr(e2.message);
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    clear();
    setBusy(true);
    try {
      const { data } = await api.delete("/auth/me/email");
      patchUser(data.user);
      setCode("");
      toast("Email change cancelled");
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card elev-sm">
      <div className="card-kicker">Email address</div>

      {err && <div className="form-error">{err}</div>}

      <div className="field">
        <label>Current email</label>
        <div className="static-field">
          <Mail aria-hidden="true" />
          <span>{user.email}</span>
        </div>
        <div className="muted-sm" style={{ marginTop: 4 }}>
          You sign in with this address, and it's where account and recovery emails go.
        </div>
      </div>

      {emailOff && (
        <div className="muted-sm">
          Changing your email isn't available yet — ask an admin to update it for you.
        </div>
      )}

      {/* ── a change is waiting on a code ─────────────────────────────── */}
      {!emailOff && pending && (
        <form onSubmit={confirm} noValidate>
          <div className="form-note" style={{ marginTop: 4 }}>
            We sent a 6-digit code to <strong>{pending}</strong>. Enter it to finish moving your
            account across. Until then, nothing has changed.
          </div>

          <div className="field">
            <label htmlFor="ec-code">6-digit code</label>
            <input
              id="ec-code"
              className="input otp-input"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); clear(); }}
            />
          </div>

          <div className="form-actions">
            <button
              className={"btn btn-primary" + (busy ? " is-loading" : "")}
              disabled={busy || code.length !== 6}
            >
              Confirm new email
            </button>
            <button type="button" className="btn btn-ghost" onClick={cancel} disabled={busy}>
              Cancel change
            </button>
          </div>
        </form>
      )}

      {/* ── no change in flight ───────────────────────────────────────── */}
      {!emailOff && !pending && !open && (
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
            Change email
          </button>
        </div>
      )}

      {!emailOff && !pending && open && (
        <form onSubmit={request} noValidate>
          <div className="field">
            <label htmlFor="ec-new">New email</label>
            <input
              id="ec-new"
              className="input"
              type="email"
              autoComplete="email"
              autoFocus
              value={form.newEmail}
              onChange={(e) => { setForm({ ...form, newEmail: e.target.value }); clear(); }}
            />
            <div className="muted-sm" style={{ marginTop: 4 }}>
              We'll send a code there to make sure it reaches you.
            </div>
          </div>

          <div className="field">
            <label htmlFor="ec-pw">Current password</label>
            <PasswordInput
              id="ec-pw"
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={(e) => { setForm({ ...form, currentPassword: e.target.value }); clear(); }}
            />
            <div className="muted-sm" style={{ marginTop: 4 }}>
              Asked for because this address is how you'd recover the account.
            </div>
          </div>

          <div className="form-actions">
            <button
              className={"btn btn-primary" + (busy ? " is-loading" : "")}
              disabled={busy || !form.newEmail || !form.currentPassword}
            >
              Send code
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => { setOpen(false); setForm({ newEmail: "", currentPassword: "" }); clear(); }}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
