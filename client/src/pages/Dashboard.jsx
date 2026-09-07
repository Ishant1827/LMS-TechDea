import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Play, ArrowRight } from "lucide-react";
import api from "../api/client";
import Layout from "../components/Layout";
import { Bar, CenterLoader, CourseThumb } from "../components/Bits";
import { StarsDisplay } from "../components/Stars";
import { useAuth } from "../context/AuthContext";
import { typeMeta, fmtDuration } from "../lib/lessonTypes";

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

  useEffect(() => {
    api.get("/enrollments/mine").then((r) => setEnr(r.data.enrollments)).catch(() => setEnr([]));
    api.get("/doubts/mine").then((r) => setDoubts(r.data.doubts.slice(0, 3))).catch(() => {});
    api
      .get("/courses", { params: { sort: "rating", limit: 8 } })
      .then((r) => setDiscover(r.data.courses))
      .catch(() => {});
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

  const nextLine = (e) => {
    if (!e.currentLesson) return `${e.remaining} lesson${e.remaining === 1 ? "" : "s"} left`;
    const m = typeMeta(e.currentLesson.type);
    const d = e.currentLesson.durationMin ? ` · ${fmtDuration(e.currentLesson.durationMin)}` : "";
    return `Next: ${e.currentLesson.title} · ${m.label}${d}`;
  };

  return (
    <Layout>
      <h2 style={{ marginBottom: 2 }}>
        {greet()}, {user.name.split(" ")[0]}
      </h2>
      <p className="text-muted" style={{ marginBottom: 18 }}>
        {enr.length
          ? `You're enrolled in ${enr.length} course${enr.length === 1 ? "" : "s"}.`
          : "Browse the catalog to enrol in your first course."}
      </p>

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
          <div className="card elev-sm stat">
            <div className="card-title">{enr.length}</div>
            <div className="card-meta">Enrolled</div>
          </div>
          <div className="card elev-sm stat">
            <div className="card-title">
              {lessonsDone}
              <span className="muted-sm">/{lessonsTotal}</span>
            </div>
            <div className="card-meta">Lessons done</div>
          </div>
          <div className="card elev-sm stat">
            <div className="card-title">{overall}%</div>
            <div className="card-meta">Overall progress</div>
          </div>
          <div className="card elev-sm stat">
            <div className="card-title">{completed.length}</div>
            <div className="card-meta">Courses completed</div>
          </div>
        </div>
      )}

      {/* ── two-column grid ───────────────────────────────── */}
      <div className="dash-grid">
        <div>
          <h4 className="section-h">My Learning</h4>
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
          <h4 className="section-h">Your doubts</h4>
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

          <h4 className="section-h">Due soon</h4>
          <div className="card elev-sm" style={{ padding: "12px 14px" }}>
            <div className="muted-sm">
              Assignments &amp; quizzes with due dates will show up here.
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
