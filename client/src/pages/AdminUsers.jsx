import { useEffect, useState } from "react";
import api from "../api/client";
import Layout from "../components/Layout";
import { CenterLoader } from "../components/Bits";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { useAuth } from "../context/AuthContext";
import { cap } from "../lib/format";

export default function AdminUsers() {
  const { user: me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
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
            <select className="input" value={draft.role} onChange={set("role")}>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
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
        <select
          className="input"
          style={{ maxWidth: 160 }}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All roles</option>
          <option value="student">Students</option>
          <option value="teacher">Teachers</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {!users ? (
        <CenterLoader />
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
                      <select
                        className="input"
                        style={{ minHeight: 34, padding: "4px 8px", width: 110 }}
                        value={u.role}
                        onChange={(e) => setRole(u, e.target.value)}
                      >
                        <option value="student">student</option>
                        <option value="teacher">teacher</option>
                        <option value="admin">admin</option>
                      </select>
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
