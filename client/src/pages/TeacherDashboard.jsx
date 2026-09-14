import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  MessageCircleQuestion,
  Users,
  BookOpen,
  Library,
  GraduationCap,
  UserPlus,
  FileWarning,
  UserX,
  ArrowRight,
  Inbox,
  BarChart3,
  ClipboardList,
} from "lucide-react";
import api from "../api/client";
import Layout from "../components/Layout";
import { CenterLoader, Stat } from "../components/Bits";
import { useAuth } from "../context/AuthContext";
import { initials } from "../lib/format";

const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};
const today = () =>
  new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

const STATUS_TAG = { open: "tag-outline", answered: "tag-accent", resolved: "tag-neutral" };

const JUMP = [
  ["/manage", Library, "Courses"],
  ["/teach/assignments", ClipboardList, "Assignments"],
  ["/teach/students", Users, "Students"],
  ["/teach/doubts", Inbox, "Doubts"],
  ["/teach/performance", BarChart3, "Performance"],
  ["/manage/courses/new", Plus, "New course"],
];

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
  const attention = [
    ...emptyDrafts.map((c) => ({ c, icon: FileWarning, tone: "warn", why: "Draft with no lessons" })),
    ...noStudents.map((c) => ({ c, icon: UserX, tone: "neutral", why: "Published but no one enrolled" })),
  ];

  return (
    <Layout>
      <div className="dash-head">
        <div className="dash-head-text">
          <h2>
            {greet()}, {user.name.split(" ")[0]}
          </h2>
          <p className="sub">{today()}</p>
        </div>
        <Link className="btn btn-primary" to="/manage/courses/new">
          <Plus />
          New Course
        </Link>
      </div>

      <div className="stat-strip">
        <Stat
          icon={GraduationCap}
          tone="accent"
          value={courses.length}
          label={courses.length === 1 ? "Course" : "Courses"}
          hint={`${published.length} published`}
          to="/manage"
        />
        <Stat
          icon={Users}
          tone="success"
          value={students ? students.length : "—"}
          label="Students"
          hint={stalled ? `${stalled} stalled` : "all active"}
          to="/teach/students"
        />
        <Stat
          icon={MessageCircleQuestion}
          tone={openDoubts.length ? "warn" : "neutral"}
          value={openDoubts.length}
          label="Doubts"
          hint={openDoubts.length ? `${openDoubts.length} waiting on you` : "all answered"}
          to="/teach/doubts"
        />
        <Stat
          icon={UserPlus}
          tone="neutral"
          value={enrolments}
          label="Enrolments"
          hint="across courses"
          to="/teach/performance"
        />
      </div>

      <div className="dash-grid">
        <div>
          <div className="sec-head">
            <MessageCircleQuestion />
            <h4>Latest doubts</h4>
            <Link className="sec-link" to="/teach/doubts">
              All doubts →
            </Link>
          </div>

          {doubts.length === 0 ? (
            <div className="card elev-sm quiet-note">
              <BookOpen />
              <div>
                <b>No questions yet</b>
                <span>When a student asks something, it lands here.</span>
              </div>
            </div>
          ) : (
            doubts.slice(0, 4).map((d) => (
              <Link key={d._id} className="card elev-sm clickable doubt-row" to="/teach/doubts">
                <span className="avatar avatar-initials">{initials(d.student?.name || "?")}</span>
                <span className="dr-body">
                  <span className="dr-meta">
                    <span className="who">{d.student?.name || "Student"}</span>
                    <span className="where">{d.course?.title}</span>
                    <span className={"tag " + (STATUS_TAG[d.status] || "tag-neutral")}>{d.status}</span>
                  </span>
                  <span className="dr-text">{d.text}</span>
                </span>
              </Link>
            ))
          )}
        </div>

        <div>
          <div className="sec-head">
            <FileWarning />
            <h4>Needs attention</h4>
          </div>
          {attention.length === 0 ? (
            <div className="card elev-sm quiet-note">
              <BookOpen />
              <div>
                <b>All clear</b>
                <span>Nothing needs your attention right now.</span>
              </div>
            </div>
          ) : (
            attention.map(({ c, icon: Icon, tone, why }) => (
              <Link
                key={c._id + why}
                className={"card elev-sm clickable attn-row tone-" + tone}
                to={`/manage/courses/${c._id}`}
              >
                <span className="ai">
                  <Icon />
                </span>
                <span className="at">
                  <b>{c.title}</b>
                  <span>{why}</span>
                </span>
                <ArrowRight size={15} style={{ color: "var(--color-neutral-500)", flex: "none" }} />
              </Link>
            ))
          )}

          <div className="sec-head">
            <ArrowRight />
            <h4>Jump to</h4>
          </div>
          <div className="jump-grid">
            {JUMP.map(([to, Icon, label]) => (
              <Link key={to} className="card elev-sm clickable jump-tile" to={to}>
                <span className="ji">
                  <Icon />
                </span>
                <b>{label}</b>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
