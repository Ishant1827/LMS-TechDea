import { useState } from "react";
import { KeyRound } from "lucide-react";
import AuthLayout from "@/features/auth/components/AuthLayout";
import PasswordInput from "@/shared/components/ui/PasswordInput";
import api from "@/shared/api/client";
import { useAuth } from "@/features/auth/AuthContext";

/**
 * Shown instead of the whole app when the account is still carrying a password
 * somebody else chose — an admin's reset, or a bulk import where the password
 * is built from the person's own name and is therefore guessable by anyone who
 * knows it (G27).
 *
 * This is a prompt, not the protection. The server refuses every other endpoint
 * while the hold is on (see `protect`), so hiding the app here is about not
 * showing someone a dashboard whose every button would fail — R1 still holds.
 */
export default function ForcePasswordChange() {
  const { user, refreshUser, applyToken, logout } = useAuth();

  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    setErr("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    if (!form.current) return setErr("Enter the password you were given");
    if (form.next.length < 6) return setErr("Your new password must be at least 6 characters");
    if (form.next === form.current) return setErr("Choose something different from the one you were given");
    if (form.next !== form.confirm) return setErr("The two new passwords don't match");

    setBusy(true);
    try {
      const { data } = await api.put("/auth/me/password", {
        currentPassword: form.current,
        newPassword: form.next,
      });
      // Changing a password ends every other session, this one included — the
      // replacement token is what keeps the tab the user is looking at signed in.
      if (data?.token) applyToken(data.token);
      // Pulls the account down again with the hold cleared, which is what takes
      // this screen away.
      await refreshUser();
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h2>Choose your own password</h2>
      <p className="auth-sub">
        The password you signed in with was set for you, so other people could work it out.
        Pick one only you know and you're in.
      </p>

      {err && <div className="form-error">{err}</div>}

      <div className="form-note" style={{ marginBottom: 16 }}>
        <KeyRound aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: "-2px" }} />{" "}
        Signed in as <strong>{user?.email}</strong>
      </div>

      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="fp-current">The password you were given</label>
          <PasswordInput
            id="fp-current"
            autoFocus
            autoComplete="current-password"
            value={form.current}
            onChange={set("current")}
          />
        </div>

        <div className="field">
          <label htmlFor="fp-next">New password</label>
          <PasswordInput
            id="fp-next"
            autoComplete="new-password"
            value={form.next}
            onChange={set("next")}
          />
          <div className="muted-sm" style={{ marginTop: 4 }}>At least 6 characters.</div>
        </div>

        <div className="field">
          <label htmlFor="fp-confirm">Confirm new password</label>
          <PasswordInput
            id="fp-confirm"
            autoComplete="new-password"
            value={form.confirm}
            onChange={set("confirm")}
          />
        </div>

        <button
          className={"btn btn-primary btn-block" + (busy ? " is-loading" : "")}
          style={{ justifyContent: "center", marginTop: 4 }}
          disabled={busy}
        >
          Save and continue
        </button>
      </form>

      <p className="auth-foot">
        Not you?{" "}
        <button type="button" className="btn btn-ghost" onClick={logout}>
          Sign out
        </button>
      </p>
    </AuthLayout>
  );
}
