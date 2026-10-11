import { useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, Users, MessageCircleQuestion, UserPlus, Plus, ClipboardList, CheckCircle2 } from "lucide-react";
import api from "@/shared/api/client";
import Layout from "@/shared/components/layout/Layout";
import { Bar, CenterLoader, ErrorState, Stat } from "@/shared/components/ui";
import { useLoad } from "@/shared/hooks/useLoad";
import { useAuth } from "@/features/auth/AuthContext";
import { initials, greet, todayLabel, timeAgo, agoDays } from "@/shared/lib/format";

const QUEUE_PREVIEW = 5;
const PRIORITY = { high: "HIGH", medium: "MEDIUM", low: "LOW" };

/* Teacher / admin dashboard, in priority order: the numbers, what needs you
   now (sorted high → low), doubts, how each course is doing, and who's been
   active. Sections are direct children of .dash so CSS places them per
   screen width (DASHBOARDS in refresh.css). */
export default function TeacherDashboard() {
  const { user } = useAuth();
  const [allQueue, setAllQueue] = useState(false);
  // Courses gate the page; the rest fill panels and fail on their own so one
  // dead endpoint doesn't blank a dashboard that is otherwise fine.
  const courseLoad = useLoad(() => api.get("/courses/manage").then((r) => r.data.courses), [], { key: "tdash:courses" });
  const doubtLoad = useLoad(() => api.get("/doubts/teaching").then((r) => r.data.doubts), [], { key: "tdash:doubts" });
  const studentLoad = useLoad(() => api.get("/students").then((r) => r.data.students), [], { key: "tdash:students" });
  const gradingLoad = useLoad(() => api.get("/submissions/pending").then((r) => r.data), [], { key: "tdash:grading" });

  const courses = courseLoad.data;
  const doubts = doubtLoad.data || [];
  const students = studentLoad.data;
  const grading = gradingLoad.data;

  if (courseLoad.status === "loading")
    return (
      <Layout>
        <CenterLoader variant="dashboard" />
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
  const stalledList = (students || []).filter((s) => s.stalled);
  const toGrade = grading?.courses || [];

  // What needs the teacher, most urgent first. A student waiting on an answer
  // or a mark is high; a student drifting away is medium; tidying a course is
  // low. Each row carries its own way to deal with it.
  const queue = [
    ...openDoubts.slice(0, 3).map((d) => ({
      key: "doubt-" + d._id,
      level: "high",
      title: `${d.student?.name?.split(" ")[0] || "A student"} is waiting for an answer`,
      why: `“${d.text}” · ${d.course?.title || "Course"} · ${timeAgo(d.createdAt)}`,
      to: "/teach/doubts",
      action: "Reply",
    })),
    ...(openDoubts.length > 3
      ? [{ key: "doubt-more", level: "high", title: `${openDoubts.length - 3} more doubts waiting`, why: "Oldest first in Doubts", to: "/teach/doubts", action: "Open" }]
      : []),
    ...toGrade.map((c) => ({
      key: "grade-" + c._id,
      level: "high",
      title: `${c.pending} submission${c.pending === 1 ? "" : "s"} to grade`,
      why: c.title,
      to: "/teach/assignments",
      action: "Grade",
    })),
    ...stalledList.slice(0, 3).map((s) => ({
      key: "stalled-" + s.student._id,
      level: "medium",
      title: `${s.student.name} has stalled`,
      why: `No activity for ${s.daysIdle} days · ${s.overall}% done`,
      to: "/teach/students",
      action: "View",
    })),
    ...emptyDrafts.map((c) => ({
      key: "draft-" + c._id,
      level: "low",
      title: `“${c.title}” has no lessons`,
      why: "Draft — add a lesson to publish it",
      to: `/manage/courses/${c._id}`,
      action: "Add lessons",
    })),
    ...(noStudents.length
      ? [
          {
            key: "empty",
            level: "low",
            title:
              noStudents.length === 1
                ? `“${noStudents[0].title}” has no students yet`
                : `${noStudents.length} courses have no students yet`,
            why: noStudents.map((c) => c.title).join(", "),
            to: "/manage",
            action: "Review",
          },
        ]
      : []),
  ];
  const shownQueue = allQueue ? queue : queue.slice(0, QUEUE_PREVIEW);

  // per-course average progress, worked out from the student roster
  const progressByCourse = new Map();
  for (const s of students || []) {
    for (const c of s.courses) {
      const k = String(c.courseId);
      const cur = progressByCourse.get(k) || { sum: 0, n: 0, people: [] };
      cur.sum += c.percent;
      cur.n += 1;
      cur.people.push(s.student.name);
      progressByCourse.set(k, cur);
    }
  }
  const perf = [...courses]
    .sort((a, b) => (b.enrollmentCount || 0) - (a.enrollmentCount || 0) || Number(b.published) - Number(a.published))
    .slice(0, 5);

  // open doubts first, then the most recent of the rest
  const doubtsShown = [...openDoubts, ...doubts.filter((d) => d.status !== "open")].slice(0, 3);

  return (
    <Layout>
      <div className="dash dash--teacher">
        {/* 1 · greeting + the four numbers (kept as they were) */}
        <header className="dsh-head a-head">
          <div className="dsh-head-text">
            <span className="dsh-date">{todayLabel()}</span>
            <h2>
              {greet()}, {user.name.split(" ")[0]}
            </h2>
          </div>
          <div className="dsh-actions">
            <Link className="btn btn-secondary" to="/teach/assignments">
              <Plus />
              New quiz
            </Link>
            <Link className="btn btn-primary" to="/manage/courses/new">
              <Plus />
              New Course
            </Link>
          </div>
        </header>

        <div className="stat-strip a-stats">
          <Stat icon={GraduationCap} tone="accent" value={courses.length} label={courses.length === 1 ? "Course" : "Courses"} hint={`${published.length} published`} to="/manage" />
          <Stat
            icon={Users}
            tone="success"
            value={students ? students.length : "—"}
            label="Students"
            hint={studentLoad.status === "error" ? "count unavailable" : stalledList.length ? `${stalledList.length} stalled` : "all active"}
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
          <Stat icon={UserPlus} tone="neutral" value={enrolments} label="Enrolments" hint="across courses" to="/teach/performance" />
        </div>

        {/* 2 · needs you now */}
        <section className="card elev-sm a-queue">
          <div className="dsh-card-h">
            <h4>Needs you now</h4>
            {queue.length > 0 && <span className="dsh-count tone-danger">{queue.length}</span>}
            <span className="dsh-link is-static">sorted by priority</span>
          </div>
          {queue.length === 0 ? (
            gradingLoad.status === "error" ? (
              <ErrorState compact title="Couldn't check for ungraded work" onRetry={gradingLoad.reload} />
            ) : (
              <p className="dsh-quiet">
                <CheckCircle2 /> All clear — nothing needs you right now.
              </p>
            )
          ) : (
            <ul className="queue">
              {shownQueue.map((q) => (
                <li key={q.key} className="queue-item">
                  <span className={"prio prio--" + q.level}>{PRIORITY[q.level]}</span>
                  <span className="queue-main">
                    <b>{q.title}</b>
                    <span>{q.why}</span>
                  </span>
                  <Link className={"btn " + (q.level === "high" ? "btn-primary" : "btn-secondary") + " queue-btn"} to={q.to}>
                    {q.action}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {queue.length > QUEUE_PREVIEW && (
            <button type="button" className="list-more" onClick={() => setAllQueue((v) => !v)}>
              {allQueue ? "Show fewer" : `Show all ${queue.length}`}
            </button>
          )}
        </section>

        {/* 3 · doubts, as a conversation */}
        <section className="card elev-sm a-doubts">
          <div className="dsh-card-h">
            <h4>Doubts</h4>
            {openDoubts.length > 0 && <span className="dsh-count tone-danger">{openDoubts.length} open</span>}
            <Link className="dsh-link" to="/teach/doubts">
              All →
            </Link>
          </div>
          {doubtLoad.status === "error" ? (
            <ErrorState compact title="Couldn't load doubts" onRetry={doubtLoad.reload} />
          ) : !doubtLoad.data ? (
            <CenterLoader variant="rows" />
          ) : doubtsShown.length === 0 ? (
            <p className="dsh-quiet">
              <MessageCircleQuestion /> No questions yet — they land here when students ask.
            </p>
          ) : (
            <div className="chat">
              {doubtsShown.map((d) => (
                <div key={d._id} className="thread">
                  <span className="thread-q">
                    <b>{d.student?.name || "Student"}</b> · {d.course?.title || "Course"} · {timeAgo(d.createdAt)}
                    {d.status !== "open" && (
                      <span className={"tag " + (d.status === "resolved" ? "tag-neutral" : "tag-accent")}>{d.status}</span>
                    )}
                  </span>
                  <span className={"bubble" + (d.status === "open" ? " is-new" : "")}>
                    <span className="avatar avatar-initials">{initials(d.student?.name || "?")}</span>
                    <span className="bubble-text">
                      <span className="bubble-body">{d.text}</span>
                    </span>
                  </span>
                  {d.status === "open" && (
                    <Link className="btn btn-primary thread-btn" to="/teach/doubts">
                      Reply
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 4 · how each course is doing */}
        <section className="card elev-sm a-perf">
          <div className="dsh-card-h">
            <h4>Course performance</h4>
            <Link className="dsh-link" to="/teach/performance">
              Performance →
            </Link>
          </div>
          {courses.length === 0 ? (
            <p className="dsh-quiet">
              <ClipboardList /> No courses yet.{" "}
              <Link to="/manage/courses/new">Create your first one</Link>
            </p>
          ) : (
            <ul className="perf">
              {perf.map((c) => {
                const p = progressByCourse.get(String(c._id));
                const avg = p && p.n ? Math.round(p.sum / p.n) : 0;
                return (
                  <li key={c._id}>
                    <Link className="perf-row plain" to={`/manage/courses/${c._id}`}>
                      <span className="perf-name">
                        <b>{c.title}</b>
                        <span>
                          {c.published ? "Published" : "Draft"} · {c.lessonCount} lesson{c.lessonCount === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className="perf-bar">
                        <Bar value={avg} />
                        <em>{c.enrollmentCount ? `${avg}%` : "—"}</em>
                      </span>
                      <span className="perf-people">
                        {c.enrollmentCount ? (
                          <span className="avatar-stack" title={`${c.enrollmentCount} enrolled`}>
                            {(p?.people || []).slice(0, 3).map((n, i) => (
                              <span key={i} className="avatar avatar-initials">
                                {initials(n)}
                              </span>
                            ))}
                            {c.enrollmentCount > 3 && <span className="avatar avatar-more">+{c.enrollmentCount - 3}</span>}
                          </span>
                        ) : (
                          <span className="tag tag-neutral">No students</span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 5 · who's been active */}
        <section className="card elev-sm a-activity">
          <div className="dsh-card-h">
            <h4>Student activity</h4>
            <Link className="dsh-link" to="/teach/students">
              Students →
            </Link>
          </div>
          {studentLoad.status === "error" ? (
            <ErrorState compact title="Couldn't load students" onRetry={studentLoad.reload} />
          ) : !students ? (
            <CenterLoader variant="rows" />
          ) : students.length === 0 ? (
            <p className="dsh-quiet">
              <Users /> No students enrolled yet.
            </p>
          ) : (
            <ul className="activity">
              {students.slice(0, 5).map((s) => {
                const state = s.overall >= 100 ? "done" : s.stalled ? "stalled" : s.daysIdle <= 1 ? "active" : "idle";
                return (
                  <li key={s.student._id} className="activity-item">
                    <span className={"presence presence--" + state}>
                      <span className="avatar avatar-initials">{initials(s.student.name)}</span>
                    </span>
                    <span className="activity-main">
                      <b>{s.student.name}</b>
                      <span>
                        Active {agoDays(s.daysIdle)} · {s.overall}% overall
                      </span>
                    </span>
                    {state === "done" && <span className="tag tag-success">Finished 🎉</span>}
                    {state === "stalled" && <span className="tag tag-danger">Stalled</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Layout>
  );
}
