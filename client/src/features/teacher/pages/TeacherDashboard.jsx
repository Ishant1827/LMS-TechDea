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
import api from "@/shared/api/client";
import Layout from "@/shared/components/layout/Layout";
import { CenterLoader, ErrorState, Stat } from "@/shared/components/ui";
import { useLoad } from "@/shared/hooks/useLoad";
import { useAuth } from "@/features/auth/AuthContext";
import { initials } from "@/shared/lib/format";

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
  // Courses gate the page; the other two fill panels and fail on their own so
  // one dead endpoint doesn't blank a dashboard that is otherwise fine.
  const courseLoad = useLoad(() => api.get("/courses/manage").then((r) => r.data.courses));
  const doubtLoad = useLoad(() => api.get("/doubts/teaching").then((r) => r.data.doubts));
  const studentLoad = useLoad(() => api.get("/students").then((r) => r.data.students));
  const gradingLoad = useLoad(() => api.get("/submissions/pending").then((r) => r.data));

  const courses = courseLoad.data;
  const doubts = doubtLoad.data || [];
  const students = studentLoad.data;
  const grading = gradingLoad.data;

  if (courseLoad.status === "loading")
    return (
      <Layout>
        <CenterLoader />
      </Layout>
    );

  if (courseLoad.status === "error")
    return (
      <Layout>
        <ErrorState
          title="Couldn't load your dashboard"
          message={courseLoad.error.message}
          onRetry={courseLoad.reload}
        />
      </Layout>
    );

  const published = courses.filter((c) => c.published);
  const enrolments = courses.reduce((s, c) => s + (c.enrollmentCount || 0), 0);
  const openDoubts = doubts.filter((d) => d.status === "open");
  const emptyDrafts = courses.filter((c) => !c.published && c.lessonCount === 0);
  const noStudents = published.filter((c) => c.enrollmentCount === 0);
  const stalled = (students || []).filter((s) => s.stalled).length;
  const toGrade = grading?.courses || [];

  // Work waiting on the teacher comes first — a dashboard that says "all clear"
  // while a student waits on a mark is the one thing this panel must never do.
  // Each row carries its own destination: grading opens the assignments screen,
  // a stalled cohort opens the roster, a course problem opens that course.
  const attention = [
    ...toGrade.map((c) => ({
      key: "grade-" + c._id,
      icon: ClipboardList,
      tone: "warn",
      title: c.title,
      why: `${c.pending} submission${c.pending === 1 ? "" : "s"} waiting to be graded`,
      to: "/teach/assignments",
    })),
    ...(stalled
      ? [
          {
            key: "stalled",
            icon: UserX,
            tone: "warn",
            title:
              stalled === 1 ? "1 student has stalled" : `${stalled} students have stalled`,
            why: "No activity for 14 days or more",
            to: "/teach/students",
          },
        ]
      : []),
    ...emptyDrafts.map((c) => ({
      key: "draft-" + c._id,
      icon: FileWarning,
      tone: "warn",
      title: c.title,
      why: "Draft with no lessons",
      to: `/manage/courses/${c._id}`,
    })),
    ...noStudents.map((c) => ({
      key: "empty-" + c._id,
      icon: UserX,
      tone: "neutral",
      title: c.title,
      why: "Published but no one enrolled",
      to: `/manage/courses/${c._id}`,
    })),
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
          hint={studentLoad.status === "error" ? "count unavailable" : stalled ? `${stalled} stalled` : "all active"}
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

          {doubtLoad.status === "error" ? (
            <ErrorState
              compact
              title="Couldn't load doubts"
              message={doubtLoad.error.message}
              onRetry={doubtLoad.reload}
            />
          ) : doubts.length === 0 ? (
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
              {/* Only claim "all clear" if the grading check actually answered —
                  otherwise say so, rather than reporting silence as good news. */}
              {gradingLoad.status === "error" ? (
                <div>
                  <b>Couldn't check for ungraded work</b>
                  <span>Everything else looks fine. Open Assignments to be sure.</span>
                </div>
              ) : (
                <div>
                  <b>All clear</b>
                  <span>Nothing needs your attention right now.</span>
                </div>
              )}
            </div>
          ) : (
            attention.map(({ key, icon: Icon, tone, title, why, to }) => (
              <Link key={key} className={"card elev-sm clickable attn-row tone-" + tone} to={to}>
                <span className="ai">
                  <Icon />
                </span>
                <span className="at">
                  <b>{title}</b>
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
