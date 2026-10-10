import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Play,
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
import { Bar, CenterLoader, CourseThumb, ErrorState, Stat, Ring } from "@/shared/components/ui";
import { useLoad } from "@/shared/hooks/useLoad";
import { StarsDisplay } from "@/shared/components/ui/Stars";
import { useAuth } from "@/features/auth/AuthContext";
import { typeMeta, fmtDuration } from "@/shared/lib/lessonTypes";
import { kindMeta, dueLabel, isOverdue } from "@/shared/lib/assessments";
import { greet, DOUBT_STATUS_TAG } from "@/shared/lib/format";

export default function Dashboard() {
  const { user } = useAuth();
  const [activityTab, setActivityTab] = useState("doubts");
  // Enrolments gate the page — everything below is derived from them. The
  // other three fill their own panels and report their own failure, so one
  // dead endpoint no longer turns the whole dashboard into a blank slate.
  const enrLoad = useLoad(() => api.get("/enrollments/mine").then((r) => r.data.enrollments));
  const doubtLoad = useLoad(() => api.get("/doubts/mine").then((r) => r.data.doubts.slice(0, 3)));
  const discoverLoad = useLoad(() =>
    api.get("/courses", { params: { sort: "rating", limit: 8 } }).then((r) => r.data.courses)
  );
  // "Due soon" — unsubmitted work that has a deadline, soonest first
  const dueLoad = useLoad(() =>
    api.get("/assessments/mine").then((r) =>
      r.data.assessments
        .filter((a) => !a.submission && a.dueAt)
        .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
        .slice(0, 4)
    )
  );

  const enr = enrLoad.data;
  const doubts = doubtLoad.data || [];
  const discover = discoverLoad.data || [];
  const due = dueLoad.data;

  if (enrLoad.status === "loading")
    return (
      <Layout>
        <CenterLoader />
      </Layout>
    );

  if (enrLoad.status === "error")
    return (
      <Layout>
        <ErrorState
          title="Couldn't load your dashboard"
          message={enrLoad.error.message}
          onRetry={enrLoad.reload}
        />
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

          <div className="learn-grid">
            {inProgress.map((e) => (
              <Link
                key={e._id}
                className="card elev-sm plain clickable learn-card"
                to={e.currentLessonId ? `/learn/${e.course._id}/${e.currentLessonId}` : `/courses/${e.course._id}`}
              >
                <CourseThumb src={e.course.thumbnailUrl} height={64} />
                <div className="lc-title">{e.course.title}</div>
                <div className="lc-progress">
                  <Bar value={e.percent} />
                  <span className="lc-pct">{e.percent}%</span>
                </div>
              </Link>
            ))}

            {completed.map((e) => (
              <Link
                key={e._id}
                className="card elev-sm plain clickable learn-card is-done"
                to={`/courses/${e.course._id}`}
              >
                <span className="lc-done-ic">
                  <CheckCircle2 />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="lc-title">{e.course.title}</div>
                  <div className="muted-sm" style={{ marginTop: 2 }}>Completed — review or leave a rating</div>
                </div>
                <span className="tag tag-accent" style={{ flex: "none" }}>
                  Done
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="sec-head">
            <MessageCircleQuestion />
            <h4>Activity</h4>
          </div>

          <div className="card elev-sm activity-card">
            <div className="seg" role="tablist">
              <label className="seg-opt">
                <input
                  type="radio"
                  name="dash-activity"
                  checked={activityTab === "doubts"}
                  onChange={() => setActivityTab("doubts")}
                />
                Doubts{doubts.length ? ` · ${doubts.length}` : ""}
              </label>
              <label className="seg-opt">
                <input
                  type="radio"
                  name="dash-activity"
                  checked={activityTab === "due"}
                  onChange={() => setActivityTab("due")}
                />
                Due soon{dueCount ? ` · ${dueCount}` : ""}
              </label>
            </div>

            <div className="activity-list">
              {activityTab === "doubts" ? (
                doubtLoad.status === "error" ? (
                  <ErrorState compact title="Couldn't load your doubts" onRetry={doubtLoad.reload} />
                ) : doubts.length === 0 ? (
                  <p className="muted-sm activity-empty">
                    No questions yet. Use “Ask a doubt” inside a lesson.
                  </p>
                ) : (
                  <>
                    {doubts.map((d) => (
                      <Link key={d._id} className="activity-row plain clickable" to="/doubts">
                        <div className="row" style={{ gap: 6 }}>
                          <span className="muted-sm" style={{ flex: 1, minWidth: 0 }}>
                            {d.course?.title || "Course"}
                          </span>
                          <span className={"tag " + (DOUBT_STATUS_TAG[d.status] || "tag-neutral")} style={{ flex: "none" }}>
                            {d.status}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, marginTop: 3 }}>{d.text}</div>
                      </Link>
                    ))}
                    <Link className="muted-sm activity-more" to="/doubts">
                      All doubts →
                    </Link>
                  </>
                )
              ) : dueLoad.status === "error" ? (
                <ErrorState compact title="Couldn't load what's due" onRetry={dueLoad.reload} />
              ) : !due ? (
                <p className="muted-sm activity-empty">Loading…</p>
              ) : due.length === 0 ? (
                <div className="activity-row activity-row--static">
                  <CalendarClock size={15} style={{ color: "var(--color-neutral-500)" }} />
                  <span className="muted-sm">Nothing due right now.</span>
                </div>
              ) : (
                <>
                  {due.map((a) => {
                    const { Icon, label } = kindMeta(a.kind);
                    const late = isOverdue(a.dueAt);
                    return (
                      <Link key={a._id} className="activity-row plain clickable" to={`/assignments/${a._id}`}>
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
                  <Link className="muted-sm activity-more" to="/assignments">
                    All assignments →
                  </Link>
                </>
              )}
            </div>
          </div>
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
