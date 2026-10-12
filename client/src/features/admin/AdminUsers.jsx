import { useEffect, useState } from "react";
import { Search, Upload, UserPlus, X } from "lucide-react";
import api from "@/shared/api/client";
import Layout from "@/shared/components/layout/Layout";
import { CenterLoader, ErrorState } from "@/shared/components/ui";
import { useLoad } from "@/shared/hooks/useLoad";
import Select from "@/shared/components/ui/Select";
import Modal from "@/shared/components/ui/Modal";
import BulkImport from "@/features/admin/BulkImport";
import { useToast } from "@/shared/context/ToastContext";
import { useConfirm } from "@/shared/context/ConfirmContext";
import { useAuth } from "@/features/auth/AuthContext";
import { cap } from "@/shared/lib/format";
import { passwordProblem, PASSWORD_HINT } from "@/shared/lib/password";
import { useIsNarrow } from "@/shared/hooks/useMediaQuery";

export default function AdminUsers() {
  const { user: me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const narrow = useIsNarrow();
  const [roleFilter, setRoleFilter] = useState("");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  // "create" | "import" | null — the forms open on demand so the list of
  // people, which is what this page is for, is the first thing you see
  const [panel, setPanel] = useState(null);
  const toggle = (name) => setPanel((p) => (p === name ? null : name));

  // Resetting somebody's password. Kept as its own dialog rather than an inline
  // field, because it is the one action here that hands over an account.
  // Selection for bulk actions. Held as a Set of ids, and pruned against the
  // list on every render rather than cleared on filter changes — a selection
  // that quietly survives into a different filter and then acts on people the
  // admin can no longer see is the way this goes wrong.
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState("");

  const [pwFor, setPwFor] = useState(null); // the user being reset, or null
  const [newPw, setNewPw] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [draft, setDraft] = useState({ name: "", email: "", password: "", role: "teacher" });

  // Debounce the search box on its own, so the load itself keys off a settled
  // query rather than every keystroke.
  const [query, setQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const {
    status,
    data: users,
    error,
    reload: load,
  } = useLoad(() => {
    const params = {};
    if (roleFilter) params.role = roleFilter;
    if (query) params.q = query;
    return api.get("/users", { params }).then((r) => r.data.users);
  }, [roleFilter, query], { key: `users:${roleFilter}|${query}` });

  const create = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/users", draft);
      toast("Account created");
      setDraft({ name: "", email: "", password: "", role: "teacher" });
      load();
    } catch (e) {
      toast(e.message, "error");
    }
    setCreating(false);
  };

  const setRole = async (u, role) => {
    try {
      await api.patch(`/users/${u._id}/role`, { role });
      toast("Role updated");
      load();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const toggleActive = async (u) => {
    try {
      await api.patch(`/users/${u._id}/active`, { active: !u.active });
      load();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  // Only ever the people currently on screen, and never yourself: those are the
  // two ways a selection can act on somebody the admin did not mean.
  const selectable = (users || []).filter((u) => u._id !== me._id);
  const chosen = selectable.filter((u) => selected.has(u._id));
  const allChosen = selectable.length > 0 && chosen.length === selectable.length;

  const toggleOne = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(allChosen ? new Set() : new Set(selectable.map((u) => u._id)));

  const clearSelection = () => setSelected(new Set());

  const runBulk = async (action) => {
    if (!chosen.length) return;

    const verb = { activate: "Activate", deactivate: "Deactivate", delete: "Delete" }[action];
    const okToGo = await confirm({
      title: `${verb} ${chosen.length} ${chosen.length === 1 ? "account" : "accounts"}?`,
      message:
        action === "delete"
          ? "Their enrolments go too. This cannot be undone."
          : `They will be ${action === "activate" ? "able" : "unable"} to sign in.`,
      confirmLabel: verb,
      danger: action === "delete",
    });
    if (!okToGo) return;

    setBulkBusy(action);
    try {
      const { data } = await api.post("/users/bulk-action", {
        ids: chosen.map((u) => u._id),
        action,
      });

      // Say what actually happened, not what was asked for. A row that could not
      // be done — a teacher still owning courses — is the thing worth reading.
      const done = data.summary.done;
      if (data.skipped.length) {
        const why = data.skipped.map((x) => `${x.email || "one row"}: ${x.reason}`);
        toast(`${done} done · ${data.skipped.length} skipped — ${why[0]}${why.length > 1 ? ` (+${why.length - 1} more)` : ""}`, "error");
      } else {
        toast(`${done} ${done === 1 ? "account" : "accounts"} ${action}d`);
      }
      clearSelection();
      load();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBulkBusy("");
    }
  };

  const openReset = (u) => {
    setPwFor(u);
    setNewPw("");
    setPwErr("");
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwErr("");
    const weak = passwordProblem(newPw, pwFor);
    if (weak) return setPwErr(weak);

    setSavingPw(true);
    try {
      const { data } = await api.patch(`/users/${pwFor._id}/password`, { password: newPw });
      toast(data.message);
      setPwFor(null);
      setNewPw("");
    } catch (e2) {
      setPwErr(e2.message);
    } finally {
      setSavingPw(false);
    }
  };

  const del = async (u) => {
    const ok = await confirm({
      title: "Delete this account?",
      message: `${u.name} (${u.email}) will be permanently deleted.`,
      detail: "Their enrolments and course progress are removed with them. This can't be undone.",
      confirmLabel: "Delete account",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/users/${u._id}`);
      toast("User deleted");
      load();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });

  return (
    <Layout>
      <div className="head-with-actions">
        <h2>Users</h2>
        <div className="head-actions">
          <button
            type="button"
            className={"btn btn-secondary" + (panel === "import" ? " is-active" : "")}
            onClick={() => toggle("import")}
            aria-expanded={panel === "import"}
          >
            <Upload />
            Import CSV
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => toggle("create")}
            aria-expanded={panel === "create"}
          >
            <UserPlus />
            Add user
          </button>
        </div>
      </div>

      {panel === "create" && (
        <form onSubmit={create} className="card elev-sm panel-card" style={{ marginBottom: 20, maxWidth: 640 }}>
          <div className="panel-card-head">
            <div className="card-kicker">Create an account</div>
            <button type="button" className="icon-btn" onClick={() => setPanel(null)} aria-label="Close">
              <X />
            </button>
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Name</label>
              <input className="input" value={draft.name} onChange={set("name")} />
            </div>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={draft.email} onChange={set("email")} />
            </div>
            <div className="field">
              <label>Temp password</label>
              <input className="input" value={draft.password} onChange={set("password")} />
            </div>
            <div className="field">
              <label>Role</label>
              <Select
                aria-label="Role"
                value={draft.role}
                onChange={(v) => setDraft((d) => ({ ...d, role: v }))}
                options={[
                  { value: "student", label: "Student" },
                  { value: "teacher", label: "Teacher" },
                  { value: "admin", label: "Admin" },
                ]}
              />
            </div>
          </div>
          <p className="muted-sm" style={{ margin: "0 0 12px" }}>
            The password you type here is temporary — they'll be asked to choose their own the
            first time they sign in.
          </p>
          <button
            className={"btn btn-primary" + (creating ? " is-loading" : "")}
            style={{ width: "fit-content" }}
          >
            Create account
          </button>
        </form>
      )}

      {panel === "import" && <BulkImport onImported={load} onClose={() => setPanel(null)} />}

      <div className="list-toolbar">
        <label className="search-field">
          <Search aria-hidden="true" />
          <input
            className="input"
            type="search"
            placeholder="Search name or email"
            aria-label="Search users"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <div className="lt-filter">
          <Select
            aria-label="Filter by role"
            value={roleFilter}
            onChange={setRoleFilter}
            options={[
              { value: "", label: "All roles" },
              { value: "student", label: "Students" },
              { value: "teacher", label: "Teachers" },
              { value: "admin", label: "Admins" },
            ]}
          />
        </div>
      </div>

      {chosen.length > 0 && (
        <div className="bulk-bar" role="region" aria-label="Actions for selected accounts">
          <strong>{chosen.length} selected</strong>
          <button
            type="button"
            className={"btn btn-secondary" + (bulkBusy === "activate" ? " is-loading" : "")}
            onClick={() => runBulk("activate")}
            disabled={!!bulkBusy}
          >
            Activate
          </button>
          <button
            type="button"
            className={"btn btn-secondary" + (bulkBusy === "deactivate" ? " is-loading" : "")}
            onClick={() => runBulk("deactivate")}
            disabled={!!bulkBusy}
          >
            Deactivate
          </button>
          <button
            type="button"
            className={"btn btn-danger" + (bulkBusy === "delete" ? " is-loading" : "")}
            onClick={() => runBulk("delete")}
            disabled={!!bulkBusy}
          >
            Delete
          </button>
          <button type="button" className="btn btn-ghost" onClick={clearSelection} disabled={!!bulkBusy}>
            Clear
          </button>
        </div>
      )}

      {status === "error" ? (
        <ErrorState title="Couldn't load users" message={error.message} onRetry={load} />
      ) : !users ? (
        <CenterLoader variant="rows" />
      ) : narrow ? (
        /* The 6-column table pushed the role picker and both action buttons
           off-screen on a phone, so each account becomes a card. */
        <div className="mcard-list">
          {selectable.length > 0 && (
            <label className="muted-sm" style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 2px 4px" }}>
              <input type="checkbox" checked={allChosen} onChange={toggleAll} />
              Select all {selectable.length}
            </label>
          )}
          {users.length === 0 && <p className="muted-sm">No users match.</p>}
          {users.map((u) => {
            const self = u._id === me._id;
            return (
              <article
                key={u._id}
                className={"mcard card elev-sm" + (selected.has(u._id) ? " is-selected" : "")}
              >
                <div className="mcard-top">
                  <span className="mcard-title" style={{ cursor: "default", display: "flex", alignItems: "center", gap: 8 }}>
                    {!self && (
                      <input
                        type="checkbox"
                        aria-label={`Select ${u.name}`}
                        checked={selected.has(u._id)}
                        onChange={() => toggleOne(u._id)}
                      />
                    )}
                    {u.name}
                    {self && <span className="muted-sm"> (you)</span>}
                  </span>
                  <span className={"tag " + (u.active ? "tag-accent" : "tag-outline")}>
                    {u.active ? "Active" : "Off"}
                  </span>
                </div>
                <div className="mcard-sub">{u.email}</div>

                <div className="mcard-stats">
                  <div>
                    <b>{u.ownedCourses || 0}</b>
                    <span>{u.ownedCourses === 1 ? "Course" : "Courses"}</span>
                  </div>
                  <div className="mcard-role">
                    {self ? (
                      <span className="tag tag-neutral">{cap(u.role)}</span>
                    ) : (
                      <>
                        <label htmlFor={`role-${u._id}`}>Role</label>
                        <Select
                          id={`role-${u._id}`}
                          value={u.role}
                          onChange={(v) => setRole(u, v)}
                          options={[
                            { value: "student", label: "student" },
                            { value: "teacher", label: "teacher" },
                            { value: "admin", label: "admin" },
                          ]}
                        />
                      </>
                    )}
                  </div>
                </div>

                {!self && (
                  <div className="mcard-actions">
                    <button className="btn btn-secondary" onClick={() => openReset(u)}>
                      Set password
                    </button>
                    <button className="btn btn-secondary" onClick={() => toggleActive(u)}>
                      {u.active ? "Deactivate" : "Activate"}
                    </button>
                    <button className="btn btn-secondary mcard-del" onClick={() => del(u)}>
                      Delete
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
          <thead>
            <tr>
              <th style={{ width: 34 }}>
                <input
                  type="checkbox"
                  aria-label={allChosen ? "Clear selection" : "Select every account shown"}
                  checked={allChosen}
                  onChange={toggleAll}
                  disabled={selectable.length === 0}
                />
              </th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Courses</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = u._id === me._id;
              return (
                <tr key={u._id} className={selected.has(u._id) ? "is-selected" : undefined}>
                  <td>
                    {!self && (
                      <input
                        type="checkbox"
                        aria-label={`Select ${u.name}`}
                        checked={selected.has(u._id)}
                        onChange={() => toggleOne(u._id)}
                      />
                    )}
                  </td>
                  <td style={{ fontWeight: 700 }}>
                    {u.name}
                    {self && <span className="muted-sm"> (you)</span>}
                  </td>
                  <td className="text-muted">{u.email}</td>
                  <td>
                    {self ? (
                      cap(u.role)
                    ) : (
                      <Select
                        aria-label={`Role for ${u.name}`}
                        className="sel-compact"
                        style={{ width: 118 }}
                        value={u.role}
                        onChange={(v) => setRole(u, v)}
                        options={[
                            { value: "student", label: "student" },
                            { value: "teacher", label: "teacher" },
                            { value: "admin", label: "admin" },
                          ]}
                      />
                    )}
                  </td>
                  <td>{u.ownedCourses || 0}</td>
                  <td>
                    <span className={"tag " + (u.active ? "tag-accent" : "tag-outline")}>
                      {u.active ? "Active" : "Off"}
                    </span>
                  </td>
                  <td>
                    {!self && (
                      <div className="chip-row">
                        <button className="btn btn-ghost" onClick={() => openReset(u)}>
                          Set password
                        </button>
                        <button className="btn btn-ghost" onClick={() => toggleActive(u)}>
                          {u.active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ color: "var(--color-danger)" }}
                          onClick={() => del(u)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
      )}

      {pwFor && (
        <Modal title={`Set a password for ${pwFor.name}`} onClose={() => setPwFor(null)}>
          <form onSubmit={savePassword} noValidate>
            <p className="text-muted" style={{ marginTop: 0 }}>
              You'll need to tell {pwFor.name} the new password yourself — nothing is emailed.
              They'll be signed out everywhere.
            </p>

            {pwErr && <div className="form-error">{pwErr}</div>}

            <div className="field">
              <label htmlFor="admin-newpw">New password</label>
              <input
                id="admin-newpw"
                className="input"
                autoFocus
                autoComplete="off"
                value={newPw}
                onChange={(e) => {
                  setNewPw(e.target.value);
                  setPwErr("");
                }}
              />
              <div className="muted-sm" style={{ marginTop: 4 }}>{PASSWORD_HINT}</div>
            </div>

            <div className="form-actions">
              <button
                className={"btn btn-primary" + (savingPw ? " is-loading" : "")}
                disabled={savingPw || newPw.length < 8}
              >
                Set password
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setPwFor(null)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
