import { useEffect, useState } from "react";
import api from "@/shared/api/client";
import Layout from "@/shared/components/layout/Layout";
import { CenterLoader } from "@/shared/components/ui";
import Select from "@/shared/components/ui/Select";
import { useToast } from "@/shared/context/ToastContext";
import { useConfirm } from "@/shared/context/ConfirmContext";
import { useAuth } from "@/features/auth/AuthContext";
import { cap } from "@/shared/lib/format";
import { useIsNarrow } from "@/shared/hooks/useMediaQuery";

export default function AdminUsers() {
  const { user: me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const narrow = useIsNarrow();
  const [users, setUsers] = useState(null);
  const [roleFilter, setRoleFilter] = useState("");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", email: "", password: "", role: "teacher" });

  const load = () => {
    const params = {};
    if (roleFilter) params.role = roleFilter;
    if (q.trim()) params.q = q.trim();
    api
      .get("/users", { params })
      .then((r) => setUsers(r.data.users))
      .catch(() => setUsers([]));
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, q]);

  const create = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/users", draft);
      toast("Account created");
      setDraft({ name: "", email: "", password: "", role: "teacher" });
      load();
    } catch (e) {
      toast(e.message);
    }
    setCreating(false);
  };

  const setRole = async (u, role) => {
    try {
      await api.patch(`/users/${u._id}/role`, { role });
      toast("Role updated");
      load();
    } catch (e) {
      toast(e.message);
    }
  };

  const toggleActive = async (u) => {
    try {
      await api.patch(`/users/${u._id}/active`, { active: !u.active });
      load();
    } catch (e) {
      toast(e.message);
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
      toast(e.message);
    }
  };

  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });

  return (
    <Layout>
      <h2 className="page-title">Users</h2>

      <form onSubmit={create} className="card elev-sm" style={{ marginBottom: 20, maxWidth: 640 }}>
        <div className="card-kicker">Create teacher / admin</div>
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
                { value: "teacher", label: "Teacher" },
                { value: "admin", label: "Admin" },
              ]}
            />
          </div>
        </div>
        <button
          className={"btn btn-primary" + (creating ? " is-loading" : "")}
          style={{ width: "fit-content" }}
        >
          Create account
        </button>
      </form>

      <div className="row" style={{ marginBottom: 12 }}>
        <input
          className="input"
          style={{ maxWidth: 240 }}
          placeholder="Search name or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div style={{ maxWidth: 180, flex: "1 1 140px" }}>
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

      {!users ? (
        <CenterLoader />
      ) : narrow ? (
        /* The 6-column table pushed the role picker and both action buttons
           off-screen on a phone, so each account becomes a card. */
        <div className="mcard-list">
          {users.length === 0 && <p className="muted-sm">No users match.</p>}
          {users.map((u) => {
            const self = u._id === me._id;
            return (
              <article key={u._id} className="mcard card elev-sm">
                <div className="mcard-top">
                  <span className="mcard-title" style={{ cursor: "default" }}>
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
                <tr key={u._id}>
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
    </Layout>
  );
}
