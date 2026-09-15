import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Play,
  ArrowRight,
  CalendarClock,
  Library,
  CheckCircle2,
  ClipboardList,
  Trophy,
  BookOpen,
  MessageCircleQuestion,
} from "lucide-react";
import api from "@/shared/api/client";
import Layout from "@/shared/components/layout/Layout";
import { Bar, CenterLoader, CourseThumb, Stat, Ring } from "@/shared/components/ui";
import { StarsDisplay } from "@/shared/components/ui/Stars";
import { useAuth } from "@/features/auth/AuthContext";
import { typeMeta, fmtDuration } from "@/shared/lib/lessonTypes";
import { kindMeta, dueLabel, isOverdue } from "@/shared/lib/assessments";

const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

const STATUS_TAG = { open: "tag-outline", answered: "tag-accent", resolved: "tag-neutral" };

export default function Dashboard() {
  const { user } = useAuth();
  const [enr, setEnr] = useState(null);
  const [doubts, setDoubts] = useState([]);
  const [discover, setDiscover] = useState([]);
  const [due, setDue] = useState(null); // null = still loading

  useEffect(() => {
    api.get("/enrollments/mine").then((r) => setEnr(r.data.enrollments)).catch(() => setEnr([]));
    api.get("/doubts/mine").then((r) => setDoubts(r.data.doubts.slice(0, 3))).catch(() => {});
    api
      .get("/courses", { params: { sort: "rating", limit: 8 } })
      .then((r) => setDiscover(r.data.courses))
      .catch(() => {});
    // "Due soon" — unsubmitted work that has a deadline, soonest first
    api
      .get("/assessments/mine")
      .then((r) =>
        setDue(
          r.data.assessments
            .filter((a) => !a.submission && a.dueAt)
            .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
            .slice(0, 4)
        )
      )
      .catch(() => setDue([]));
  }, []);

  if (!enr)
    return (
      <Layout>
        <CenterLoader />
      </Layout>
    );

  const inProgress = enr.filter((e) => e.percent < 100);
  const completed = enr.filter((e) => e.percent >= 100);
  const cont = inProgress.find((e) => e.total > 0);
  const lessonsDone = enr.reduce((s, e) => s + e.completed, 0);
  const lessonsTotal = enr.reduce((s, e) => s + e.total, 0);
  const overall = lessonsTotal ? Math.round((lessonsDone / lessonsTotal) * 100) : 0;
  const mineIds = new Set(enr.map((e) => e.course._id));
  const recommend = discover.filter((c) => !mineIds.has(c._id)).slice(0, 6);
  const dueCount = (due || []).length;

  const nextLine = (e) => {
    if (!e.currentLesson) return `${e.remaining} lesson${e.remaining === 1 ? "" : "s"} left`;
    const m = typeMeta(e.currentLesson.type);
    const d = e.currentLesson.durationMin ? ` · ${fmtDuration(e.currentLesson.durationMin)}` : "";
    return `Next: ${e.currentLesson.title} · ${m.label}${d}`;
  };

  return (
    <Layout>
      <div className="dash-head">
        <div className="dash-head-text">
          <h2>
            {greet()}, {user.name.split(" ")[0]}
          </h2>
          <p className="sub">
            {enr.length
              ? `You're enrolled in ${enr.length} course${enr.length === 1 ? "" : "s"}.`
              : "Browse the catalog to enrol in your first course."}
          </p>
        </div>
        {enr.length > 0 && <Ring value={overall} sublabel="overall" />}
      </div>

      {/* ── continue learning ─────────────────────────────── */}
      {cont ? (
        <Link
          className="card elev-sm continue-card plain clickable"
          to={`/learn/${cont.course._id}/${cont.currentLessonId}`}
          style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" }}
        >
          <CourseThumb src={cont.course.thumbnailUrl} height={72} style={{ width: 120, flex: "none" }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="card-kicker">Continue learning</div>
            <div className="card-title">{cont.course.title}</div>
            <div className="card-meta" style={{ marginTop: 2 }}>
              {nextLine(cont)}
            </div>
            <div style={{ marginTop: 8, maxWidth: 320 }}>
              <Bar value={cont.percent} />
            </div>
            <div className="muted-sm" style={{ marginTop: 4 }}>
              {cont.percent}% · {cont.remaining} lesson{cont.remaining === 1 ? "" : "s"} left
            </div>
          </div>
          <span className="btn btn-primary" style={{ flex: "none" }}>
            <Play />
            Continue
          </span>
        </Link>
      ) : enr.length === 0 ? (
        <div className="card elev-sm" style={{ alignItems: "flex-start", marginBottom: 20 }}>
          <div className="card-title">Start learning</div>
          <div className="card-meta" style={{ marginBottom: 10 }}>
            Pick a course from the catalog — they're all free.
          </div>
          <Link className="btn btn-primary" to="/courses">
            Browse Courses
          </Link>
        </div>
      ) : null}

      {/* ── stat strip ────────────────────────────────────── */}
      {enr.length > 0 && (
        <div className="stat-strip">
          <Stat
            icon={Library}
            tone="accent"
            value={enr.length}
            label="Enrolled"
            hint={`${inProgress.length} in progress`}
            to="/my-learning"
          />
          <Stat
            icon={CheckCircle2}
            tone="success"
            value={
              <>
                {lessonsDone}
                <small>/{lessonsTotal}</small>
              </>
            }
            label="Lessons done"
            hint={lessonsTotal - lessonsDone > 0 ? `${lessonsTotal - lessonsDone} to go` : "all finished"}
            to="/progress"
          />
          <Stat
            icon={ClipboardList}
            tone={dueCount ? "warn" : "neutral"}
            value={dueCount}
            label="Due soon"
            hint={dueCount ? "with a deadline" : "nothing pending"}
            to="/assignments"
          />
          <Stat
            icon={Trophy}
            tone="neutral"
            value={completed.length}
            label="Completed"
            hint={completed.length ? "well done" : "keep going"}
            to="/progress"
          />
        </div>
      )}

      {/* ── two-column grid ───────────────────────────────── */}
      <div className="dash-grid">
        <div>
          <div className="sec-head">
            <BookOpen />
            <h4>My Learning</h4>
            <Link className="sec-link" to="/my-learning">All courses →</Link>
          </div>
          {enr.length === 0 && <p className="muted-sm">Nothing yet.</p>}

          {inProgress.length > 0 && <div className="muted-sm dash-sub">In progress</div>}
          {inProgress.map((e) => (
            <Link
              key={e._id}
              className="card elev-sm plain clickable mini-row"
              to={e.currentLessonId ? `/learn/${e.course._id}/${e.currentLessonId}` : `/courses/${e.course._id}`}
            >
              <CourseThumb src={e.course.thumbnailUrl} height={44} style={{ width: 64, flex: "none" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{e.course.title}</div>
                <div style={{ marginTop: 4 }}>
                  <Bar value={e.percent} />
                </div>
                <div className="muted-sm" style={{ marginTop: 3 }}>
                  {e.completed}/{e.total} lessons · {e.percent}%
                </div>
              </div>
            </Link>
          ))}

          {completed.length > 0 && <div className="muted-sm dash-sub">Completed</div>}
          {completed.map((e) => (
            <Link
              key={e._id}
              className="card elev-sm plain clickable mini-row"
              to={`/courses/${e.course._id}`}
            >
              <CourseThumb src={e.course.thumbnailUrl} height={44} style={{ width: 64, flex: "none" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{e.course.title}</div>
                <div className="muted-sm" style={{ marginTop: 2 }}>Completed — review or leave a rating</div>
              </div>
              <span className="tag tag-accent" style={{ flex: "none" }}>
                Done
              </span>
            </Link>
          ))}
        </div>

        <div>
          <div className="sec-head">
            <MessageCircleQuestion />
            <h4>Your doubts</h4>
          </div>
          {doubts.length === 0 ? (
            <p className="muted-sm">
              No questions yet. Use “Ask a doubt” inside a lesson.
            </p>
          ) : (
            <>
              {doubts.map((d) => (
                <Link
                  key={d._id}
                  className="card elev-sm plain clickable"
                  style={{ marginBottom: 8, padding: "10px 12px" }}
                  to="/doubts"
                >
                  <div className="row" style={{ gap: 6 }}>
                    <span className="muted-sm" style={{ flex: 1, minWidth: 0 }}>
                      {d.course?.title || "Course"}
                    </span>
                    <span className={"tag " + (STATUS_TAG[d.status] || "tag-neutral")} style={{ flex: "none" }}>
                      {d.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, marginTop: 3 }}>{d.text}</div>
                </Link>
              ))}
              <Link className="muted-sm" to="/doubts">
                All doubts →
              </Link>
            </>
          )}

          <div className="sec-head">
            <CalendarClock />
            <h4>Due soon</h4>
          </div>
          {!due ? (
            <div className="card elev-sm" style={{ padding: "12px 14px" }}>
              <div className="muted-sm">Loading…</div>
            </div>
          ) : due.length === 0 ? (
            <div className="card elev-sm" style={{ padding: "12px 14px" }}>
              <div className="muted-sm">Nothing due right now.</div>
            </div>
          ) : (
            <>
              {due.map((a) => {
                const { Icon, label } = kindMeta(a.kind);
                const late = isOverdue(a.dueAt);
                return (
                  <Link
                    key={a._id}
                    className="card elev-sm plain clickable"
                    style={{ marginBottom: 8, padding: "10px 12px" }}
                    to={`/assignments/${a._id}`}
                  >
                    <div className="row" style={{ gap: 6 }}>
                      <span className="muted-sm" style={{ flex: 1, minWidth: 0 }}>
                        <Icon size={12} /> {label} · {a.course?.title}
                      </span>
                      <span
                        className={"due-chip" + (late ? " is-overdue" : "")}
                        style={{ flex: "none" }}
                      >
                        <CalendarClock />
                        {dueLabel(a.dueAt)}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 3 }}>{a.title}</div>
                  </Link>
                );
              })}
              <Link className="muted-sm" to="/assignments">
                All assignments →
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── discover strip ────────────────────────────────── */}
      {recommend.length > 0 && (
        <>
          <div className="row" style={{ marginTop: 24, marginBottom: 10 }}>
            <h4 className="section-h" style={{ margin: 0 }}>
              Discover courses
            </h4>
            <Link className="muted-sm" to="/courses" style={{ marginLeft: "auto" }}>
              Browse all →
            </Link>
          </div>
          <div className="hscroll">
            {recommend.map((c) => (
              <div key={c._id} className="card elev-sm mini-course">
                <Link className="plain clickable" to={`/courses/${c._id}`} style={{ display: "block" }}>
                  <CourseThumb src={c.thumbnailUrl} height={90} />
                </Link>
                <Link className="card-title plain clickable" to={`/courses/${c._id}`} style={{ fontSize: 14 }}>
                  {c.title}
                </Link>
                <div className="card-meta">{c.teacherName || "—"}</div>
                {c.reviewCount > 0 && (
                  <div className="card-meta">
                    <StarsDisplay value={c.rating} />
                    <span>{c.rating.toFixed(1)}</span>
                  </div>
                )}
                <Link
                  className="btn btn-secondary btn-block"
                  style={{ justifyContent: "center" }}
                  to={`/courses/${c._id}`}
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
