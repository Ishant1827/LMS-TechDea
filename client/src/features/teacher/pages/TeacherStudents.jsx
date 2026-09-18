import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import api from "@/shared/api/client";
import Layout from "@/shared/components/layout/Layout";
import Modal from "@/shared/components/ui/Modal";
import { Bar, CenterLoader, ErrorState } from "@/shared/components/ui";
import { useLoad } from "@/shared/hooks/useLoad";
import Select from "@/shared/components/ui/Select";
import { useIsNarrow } from "@/shared/hooks/useMediaQuery";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

const idle = (days) =>
  days >= 9999 ? "never" : days === 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function TeacherStudents() {
  const narrow = useIsNarrow();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sel, setSel] = useState(null);

  // Debounce the search box separately so the loader keys off a settled query
  // rather than firing a request per keystroke.
  const [query, setQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { status, data, error, reload } = useLoad(() => {
    const params = {};
    if (query) params.q = query;
    if (filter !== "all") params.filter = filter;
    return api.get("/students", { params }).then((r) => r.data);
  }, [query, filter]);

  // Only the first load blanks the page; a re-search keeps the previous rows
  // on screen, which is how this behaved before.
  if (status === "loading" && !data)
    return (
      <Layout>
        <CenterLoader />
      </Layout>
    );

  if (status === "error")
    return (
      <Layout>
        <h2 className="page-title">Students</h2>
        <ErrorState title="Couldn't load students" message={error.message} onRetry={reload} />
      </Layout>
    );

  const rows = data.students;
  const stalled = rows.filter((r) => r.stalled).length;
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.overall, 0) / rows.length) : 0;

  const exportCsv = () => {
    const head = ["Name", "Email", "Courses", "Overall %", "Completed", "Last active", "Stalled"];
    const lines = rows.map((r) =>
      [
        r.student.name,
        r.student.email,
        r.enrolledCount,
        r.overall,
        r.completedCount,
        fmtDate(r.lastActive),
        r.stalled ? "yes" : "",
      ]
        .map(csvEscape)
        .join(",")
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <h2 className="page-title">Students</h2>

      <div className="stat-strip" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="card elev-sm stat">
          <div className="card-title">{rows.length}</div>
          <div className="card-meta">Students</div>
        </div>
        <div className="card elev-sm stat">
          <div className="card-title">{stalled}</div>
          <div className="card-meta">Stalled (14d+ idle)</div>
        </div>
        <div className="card elev-sm stat">
          <div className="card-title">{avg}%</div>
          <div className="card-meta">Avg progress</div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <input
          className="input"
          style={{ maxWidth: 240 }}
          placeholder="Search name or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div style={{ maxWidth: 190, flex: "1 1 150px" }}>
          <Select
            aria-label="Filter students"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "notstarted", label: "Not started" },
              { value: "stalled", label: "Stalled" },
              { value: "completed", label: "Completed something" },
            ]}
          />
        </div>
        <button className="btn btn-secondary" style={{ marginLeft: "auto" }} onClick={exportCsv}>
          <Download />
          Export CSV
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="muted-sm">No students match.</p>
      ) : narrow ? (
        /* The roster table hid the progress bar and status tags on a phone. */
        <div className="mcard-list">
          {rows.map((r) => (
            <button
              key={r.student._id}
              className="mcard card elev-sm mcard-tappable"
              onClick={() => setSel(r)}
            >
              <div className="mcard-top">
                <span className="mcard-title">{r.student.name}</span>
                <span className="muted-sm" style={{ flex: "none" }}>
                  {r.overall}%
                </span>
              </div>
              <div className="mcard-sub">{r.student.email}</div>

              <div style={{ margin: "10px 0 8px" }}>
                <Bar value={r.overall} />
              </div>

              <div className="mcard-meta-row">
                <span className="muted-sm">
                  {r.enrolledCount} course{r.enrolledCount === 1 ? "" : "s"} · active{" "}
                  {idle(r.daysIdle)}
                </span>
                <span className="chip-row" style={{ flex: "none" }}>
                  {r.stalled && <span className="tag tag-outline">Stalled</span>}
                  {r.completedCount > 0 && <span className="tag tag-accent">Completed</span>}
                  {r.notStarted && <span className="tag tag-neutral">Not started</span>}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th className="t-num">Courses</th>
                <th>Progress</th>
                <th>Last active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.student._id} className="clickable" onClick={() => setSel(r)}>
                  <td>
                    <span className="t-primary">
                      <span style={{ fontWeight: 700 }}>{r.student.name}</span>
                      <span className="t-sub">{r.student.email}</span>
                    </span>
                  </td>
                  <td className="t-num">{r.enrolledCount}</td>
                  <td style={{ minWidth: 150 }}>
                    <Bar value={r.overall} />
                    <span className="muted-sm">{r.overall}%</span>
                  </td>
                  <td className="text-muted">{idle(r.daysIdle)}</td>
                  <td>
                    {r.stalled && <span className="tag tag-outline">Stalled</span>}
                    {r.completedCount > 0 && <span className="tag tag-accent">Completed</span>}
                    {r.notStarted && <span className="tag tag-neutral">Not started</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sel && (
        <Modal title={sel.student.name} onClose={() => setSel(null)}>
          <div className="muted-sm" style={{ marginBottom: 12 }}>
            {sel.student.email} · last active {idle(sel.daysIdle)}
          </div>
          {sel.courses.map((c) => (
            <div key={c.courseId} className="card elev-sm" style={{ marginBottom: 8, padding: "10px 12px" }}>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, flex: 1, minWidth: 0 }}>{c.title}</span>
                <span className={"tag " + (c.status === "completed" ? "tag-accent" : "tag-neutral")}>
                  {c.status}
                </span>
              </div>
              <div style={{ marginTop: 6 }}>
                <Bar value={c.percent} />
              </div>
              <div className="muted-sm" style={{ marginTop: 3 }}>
                {c.completed}/{c.total} lessons · {c.percent}% · active {fmtDate(c.lastActive)}
              </div>
            </div>
          ))}
        </Modal>
      )}
    </Layout>
  );
}
