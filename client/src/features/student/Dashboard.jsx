import { Link } from "react-router-dom";
import { Play, Library, CheckCircle2, CalendarClock, Trophy, MessageCircleQuestion, Compass } from "lucide-react";
import api from "@/shared/api/client";
import Layout from "@/shared/components/layout/Layout";
import { Bar, CenterLoader, CourseThumb, ErrorState, Stat, Ring } from "@/shared/components/ui";
import { useLoad } from "@/shared/hooks/useLoad";
import { useAuth } from "@/features/auth/AuthContext";
import { typeMeta, fmtDuration } from "@/shared/lib/lessonTypes";
import { kindMeta, timeLeft } from "@/shared/lib/assessments";
import { greet, initials, todayLabel } from "@/shared/lib/format";

const WEEK_MS = 7 * 24 * 3600 * 1000;

/* The student dashboard, in priority order: what to do next, what's due,
   answers waiting, then progress, courses and suggestions. Every section is
   a direct child of .dash so CSS can place it per screen width without
   reordering the markup (see DASHBOARDS in refresh.css). */
export default function Dashboard() {
  const { user } = useAuth();
  // Enrolments gate the page — everything below is derived from them. The
  // others fill their own panels and report their own failure.
  const enrLoad = useLoad(() => api.get("/enrollments/mine").then((r) => r.data.enrollments));
  const doubtLoad = useLoad(() => api.get("/doubts/mine").then((r) => r.data.doubts));
  const discoverLoad = useLoad(() =>
    api.get("/courses", { params: { sort: "rating", limit: 8 } }).then((r) => r.data.courses)
  );
  // unsubmitted work with a deadline, soonest first
  const dueLoad = useLoad(() =>
    api.get("/assessments/mine").then((r) =>
      r.data.assessments
        .filter((a) => !a.submission && a.dueAt)
        .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
    )
  );

  if (enrLoad.status === "loading")
    return (
      <Layout>
        <CenterLoader variant="dashboard" />
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

  const enr = enrLoad.data;
  // new answers first, then ones still waiting, then the settled ones
  const RANK = { answered: 0, open: 1, resolved: 2 };
  const doubts = [...(doubtLoad.data || [])].sort((a, b) => (RANK[a.status] ?? 3) - (RANK[b.status] ?? 3));
  const due = dueLoad.data || [];
  const inProgress = enr.filter((e) => e.percent < 100);
  const completed = enr.filter((e) => e.percent >= 100);
  const cont = inProgress.find((e) => e.total > 0);
  const lessonsDone = enr.reduce((s, e) => s + e.completed, 0);
  const lessonsTotal = enr.reduce((s, e) => s + e.total, 0);
  const overall = lessonsTotal ? Math.round((lessonsDone / lessonsTotal) * 100) : 0;
  const mineIds = new Set(enr.map((e) => e.course._id));
  const recommend = (discoverLoad.data || []).filter((c) => !mineIds.has(c._id)).slice(0, 4);

  const now = Date.now();
  const gap = (a) => new Date(a.dueAt) - now;
  const overdue = due.filter((a) => gap(a) <= 0).length;
  const dueToday = due.filter((a) => gap(a) > 0 && gap(a) < 24 * 3600 * 1000).length;
  const dueWeek = due.filter((a) => gap(a) < WEEK_MS).length;
  const newAnswers = doubts.filter((d) => d.status === "answered").length;

  // the line of chips under the greeting — only the ones that say something
  const chips = [
    overdue > 0 && { tone: "danger", text: `${overdue} overdue — submit as soon as you can` },
    dueToday > 0 && { tone: "danger", text: `${dueToday} due in the next 24 hours` },
    newAnswers > 0 && { tone: "accent", text: `${newAnswers} new answer${newAnswers === 1 ? "" : "s"} to your doubts` },
    lessonsTotal > 0 && { tone: "success", text: `${lessonsDone} of ${lessonsTotal} lessons done` },
  ].filter(Boolean);

  return (
    <Layout>
      <div className="dash dash--student">
        {/* 1 · greeting + today */}
        <header className="dsh-head a-head">
          <div className="dsh-head-text">
            <span className="dsh-date">{todayLabel()}</span>
            <h2>
              {greet()}, {user.name.split(" ")[0]} <span aria-hidden="true">👋</span>
            </h2>
            {chips.length > 0 ? (
              <div className="today-chips">
                {chips.map((c) => (
                  <span key={c.text} className={"today-chip tone-" + c.tone}>
                    {c.text}
                  </span>
                ))}
              </div>
            ) : (
              <p className="sub">Browse the catalog to enrol in your first course.</p>
            )}
          </div>
        </header>

        {/* 2 · the one thing to do next */}
        <UpNext cont={cont} hasCourses={enr.length > 0} />

        {/* 3 · due soon, as a countdown */}
        <section className="card elev-sm a-due">
          <div className="dsh-card-h">
            <h4>Due soon</h4>
            {overdue > 0 ? (
              <span className="dsh-count tone-danger">{overdue} late</span>
            ) : (
              dueToday > 0 && <span className="dsh-count tone-danger">{dueToday} today</span>
            )}
            <Link className="dsh-link" to="/assignments">
              All tasks →
            </Link>
          </div>
          {dueLoad.status === "error" ? (
            <ErrorState compact title="Couldn't load what's due" onRetry={dueLoad.reload} />
          ) : !dueLoad.data ? (
            <CenterLoader variant="rows" />
          ) : due.length === 0 ? (
            <p className="dsh-quiet">
              <CheckCircle2 /> Nothing due — you're all caught up.
            </p>
          ) : (
            <ol className="timeline">
              {due.slice(0, 4).map((a) => {
                const left = timeLeft(a.dueAt);
                const { label } = kindMeta(a.kind);
                return (
                  <li key={a._id} className={"tl-item tone-" + left.tone}>
                    <Link className="tl-link" to={`/assignments/${a._id}`}>
                      <span className="tl-main">
                        <b>{a.title}</b>
                        <span>
                          {a.course?.title} · {label}
                        </span>
                      </span>
                      <span className="tl-left">
                        <b>{left.value}</b>
                        <small>{left.note}</small>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* 4 · doubts, as a conversation */}
        <section className="card elev-sm a-doubts">
          <div className="dsh-card-h">
            <h4>My doubts</h4>
            {newAnswers > 0 && <span className="dsh-count tone-accent">{newAnswers} new</span>}
            <Link className="dsh-link" to="/doubts">
              All →
            </Link>
          </div>
          {doubtLoad.status === "error" ? (
            <ErrorState compact title="Couldn't load your doubts" onRetry={doubtLoad.reload} />
          ) : !doubtLoad.data ? (
            <CenterLoader variant="rows" />
          ) : (
            <div className="chat">
              {doubts.slice(0, 2).map((d) => (
                <Link key={d._id} className="thread plain" to="/doubts">
                  <span className="thread-q">
                    You asked · <b>{d.text}</b>
                  </span>
                  {d.answer ? (
                    <span className={"bubble" + (d.status === "answered" ? " is-new" : "")}>
                      <span className="avatar avatar-initials">{initials(d.answeredBy?.name || "T")}</span>
                      <span className="bubble-text">
                        <b>{d.answeredBy?.name || "Your teacher"}</b>
                        {d.status === "answered" && <span className="new-tag">NEW</span>}
                        <span className="bubble-body">{d.answer}</span>
                      </span>
                    </span>
                  ) : (
                    <span className="thread-wait">⏳ Waiting for your teacher</span>
                  )}
                </Link>
              ))}
              <p className="chat-hint">
                <MessageCircleQuestion /> Stuck on something? Ask from inside any lesson.
              </p>
            </div>
          )}
        </section>

        {/* 5 · progress in numbers */}
        <div className="stat-strip a-stats">
          <Stat icon={Library} tone="accent" value={enr.length} label="Enrolled" hint={`${inProgress.length} in progress`} to="/my-learning" />
          <Stat
            icon={CheckCircle2}
            tone="success"
            value={lessonsDone}
            label="Lessons done"
            hint={lessonsTotal ? `of ${lessonsTotal} · ${overall}%` : "none yet"}
            to="/progress"
          />
          <Stat
            icon={CalendarClock}
            tone={overdue ? "danger" : dueWeek ? "warn" : "neutral"}
            value={dueLoad.data ? dueWeek : "—"}
            label="Due this week"
            hint={overdue ? `${overdue} overdue` : dueToday ? `${dueToday} in 24 hours` : "nothing urgent"}
            to="/assignments"
          />
          <Stat icon={Trophy} tone="success" value={completed.length} label="Completed" hint={completed.length ? "well done" : "keep going"} to="/progress" />
        </div>

        {/* 6 · every course, with its ring */}
        {enr.length > 0 && (
          <section className="a-courses">
            <div className="dsh-card-h">
              <h4>My courses</h4>
              <Link className="dsh-link" to="/my-learning">
                My Learning →
              </Link>
            </div>
            <div className="ring-courses">
              {[...inProgress, ...completed].map((e) => (
                <Link
                  key={e._id}
                  className="card elev-sm ring-course plain clickable"
                  to={e.currentLessonId && e.percent < 100 ? `/learn/${e.course._id}/${e.currentLessonId}` : `/courses/${e.course._id}`}
                >
                  <Ring value={e.percent} size={54} stroke={6} />
                  <span className="rc-text">
                    <b>{e.course.title}</b>
                    <span>
                      {e.percent >= 100
                        ? "Completed 🎉"
                        : e.completed === 0
                        ? "Not started"
                        : `${e.remaining} lesson${e.remaining === 1 ? "" : "s"} left`}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 7 · suggestions */}
        {recommend.length > 0 && (
          <section className="a-rec">
            <div className="dsh-card-h">
              <h4>Recommended for you</h4>
              <Link className="dsh-link" to="/courses">
                Browse all →
              </Link>
            </div>
            <div className="rec-strip">
              {recommend.map((c) => (
                <Link key={c._id} className="card elev-sm rec-card plain clickable" to={`/courses/${c._id}`}>
                  <CourseThumb src={c.thumbnailUrl} />
                  <span className="rec-why">
                    {c.reviewCount > 0 && c.rating >= 4.5 ? "Top rated" : c.category || "Popular"}
                  </span>
                  <b>{c.title}</b>
                  <span className="rec-by">
                    {c.teacherName || "—"}
                    {c.reviewCount > 0 ? ` · ★ ${c.rating.toFixed(1)}` : ""}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}

/* The dark "up next" card: the lesson to open now, or a way in when there's
   nothing in progress. */
function UpNext({ cont, hasCourses }) {
  if (!cont)
    return (
      <section className="card upnext a-hero is-empty">
        <span className="upnext-icon">
          <Compass />
        </span>
        <div className="upnext-body">
          <span className="upnext-kick">{hasCourses ? "ALL CAUGHT UP" : "START HERE"}</span>
          <h3>{hasCourses ? "You've finished everything you started" : "Pick your first course"}</h3>
          <span className="upnext-line">Every course in the catalog is free.</span>
          <Link className="btn upnext-btn" to="/courses">
            Browse courses
          </Link>
        </div>
      </section>
    );

  const l = cont.currentLesson;
  const meta = l ? typeMeta(l.type) : null;
  return (
    <Link className="card upnext a-hero plain" to={`/learn/${cont.course._id}/${cont.currentLessonId}`}>
      <span className="upnext-thumb">
        <CourseThumb src={cont.course.thumbnailUrl} />
        <span className="upnext-play" aria-hidden="true">
          <Play />
        </span>
      </span>
      <span className="upnext-body">
        <span className="upnext-kick">UP NEXT · PICK UP WHERE YOU LEFT OFF</span>
        <h3>{l?.title || cont.course.title}</h3>
        <span className="upnext-line">
          {cont.course.title}
          {meta ? ` · ${meta.label}` : ""}
          {l?.durationMin ? ` · ${fmtDuration(l.durationMin)}` : ""}
        </span>
        <span className="upnext-bar">
          <Bar value={cont.percent} />
        </span>
        <span className="upnext-meta">
          <span>Course {cont.percent}% done</span>
          <span>
            {cont.remaining} lesson{cont.remaining === 1 ? "" : "s"} left
          </span>
        </span>
        <span className="btn upnext-btn">
          <Play /> Continue lesson
        </span>
      </span>
    </Link>
  );
}
