import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, MessageCircleQuestion, Users, BookOpen } from "lucide-react";
import api from "../api/client";
import Layout from "../components/Layout";
import { CenterLoader } from "../components/Bits";
import { useAuth } from "../context/AuthContext";

const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};
const STATUS_TAG = { open: "tag-outline", answered: "tag-accent", resolved: "tag-neutral" };

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState(null);
  const [doubts, setDoubts] = useState([]);
  const [students, setStudents] = useState(null);

  useEffect(() => {
    api.get("/courses/manage").then((r) => setCourses(r.data.courses)).catch(() => setCourses([]));
    api.get("/doubts/teaching").then((r) => setDoubts(r.data.doubts)).catch(() => {});
    api.get("/students").then((r) => setStudents(r.data.students)).catch(() => {});
  }, []);

  if (!courses)
    return (
      <Layout>
        <CenterLoader />
      </Layout>
    );

  const published = courses.filter((c) => c.published);
  const enrolments = courses.reduce((s, c) => s + (c.enrollmentCount || 0), 0);
  const openDoubts = doubts.filter((d) => d.status === "open");
  const emptyDrafts = courses.filter((c) => !c.published && c.lessonCount === 0);
  const noStudents = published.filter((c) => c.enrollmentCount === 0);
  const stalled = (students || []).filter((s) => s.stalled).length;

  return (
    <Layout>
      <div className="row" style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0 }}>
          {greet()}, {user.name.split(" ")[0]}
        </h2>
        <Link className="btn btn-primary" to="/manage/courses/new" style={{ marginLeft: "auto" }}>
          <Plus />
          New Course
        </Link>
      </div>

      <div className="stat-strip">
        <div className="card elev-sm stat">
          <div className="card-title">{courses.length}</div>
          <div className="card-meta">{published.length} published</div>
        </div>
        <div className="card elev-sm stat">
          <div className="card-title">{students ? students.length : "—"}</div>
          <div className="card-meta">Students{stalled ? ` · ${stalled} stalled` : ""}</div>
        </div>
        <div className="card elev-sm stat">
          <div className="card-title">{openDoubts.length}</div>
          <div className="card-meta">Open doubts</div>
        </div>
        <div className="card elev-sm stat">
          <div className="card-title">{enrolments}</div>
          <div className="card-meta">Enrolments</div>
        </div>
      </div>

      <div className="dash-grid">
        <div>
          <div className="row">
            <h4 className="section-h" style={{ margin: 0 }}>
              Latest doubts
            </h4>
            <Link className="muted-sm" to="/teach/doubts" style={{ marginLeft: "auto" }}>
              All doubts →
            </Link>
          </div>
          {doubts.length === 0 ? (
            <p className="muted-sm">No questions yet.</p>
          ) : (
            doubts.slice(0, 4).map((d) => (
              <Link
                key={d._id}
                className="card elev-sm plain clickable"
                style={{ marginBottom: 8, padding: "10px 12px" }}
                to="/teach/doubts"
              >
                <div className="row" style={{ gap: 6 }}>
                  <span className="muted-sm" style={{ flex: 1, minWidth: 0 }}>
                    {d.student?.name} · {d.course?.title}
                  </span>
                  <span className={"tag " + (STATUS_TAG[d.status] || "tag-neutral")} style={{ flex: "none" }}>
                    {d.status}
                  </span>
                </div>
                <div style={{ fontSize: 13, marginTop: 3 }}>{d.text}</div>
              </Link>
            ))
          )}
        </div>

        <div>
          <h4 className="section-h">Needs attention</h4>
          {emptyDrafts.length === 0 && noStudents.length === 0 ? (
            <p className="muted-sm">Nothing right now.</p>
          ) : (
            <>
              {emptyDrafts.map((c) => (
                <Link
                  key={c._id}
                  className="card elev-sm plain clickable"
                  style={{ marginBottom: 8, padding: "10px 12px" }}
                  to={`/manage/courses/${c._id}`}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.title}</div>
                  <div className="card-meta">Draft with no lessons</div>
                </Link>
              ))}
              {noStudents.map((c) => (
                <Link
                  key={c._id}
                  className="card elev-sm plain clickable"
                  style={{ marginBottom: 8, padding: "10px 12px" }}
                  to={`/manage/courses/${c._id}`}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.title}</div>
                  <div className="card-meta">Published but no one enrolled</div>
                </Link>
              ))}
            </>
          )}

          <h4 className="section-h">Jump to</h4>
          {[
            ["/manage", BookOpen, "Courses"],
            ["/teach/students", Users, "Students"],
            ["/teach/doubts", MessageCircleQuestion, "Answer doubts"],
          ].map(([to, Icon, label]) => (
            <Link
              key={to}
              className="card elev-sm plain clickable"
              style={{ marginBottom: 8, padding: "10px 12px" }}
              to={to}
            >
              <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <Icon size={14} />
                {label}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
