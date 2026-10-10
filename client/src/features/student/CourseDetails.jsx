import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BookOpen, Clock, Award, Play, ArrowLeft } from "lucide-react";
import api from "@/shared/api/client";
import Layout from "@/shared/components/layout/Layout";
import { CenterLoader, CourseThumb, ErrorState } from "@/shared/components/ui";
import { useLoad } from "@/shared/hooks/useLoad";
import LessonContent from "@/shared/components/lesson/LessonContent";
import Modal from "@/shared/components/ui/Modal";
import { StarsDisplay, StarsInput } from "@/shared/components/ui/Stars";
import { useToast } from "@/shared/context/ToastContext";
import { useConfirm } from "@/shared/context/ConfirmContext";
import { typeMeta, fmtDuration, groupByModule } from "@/shared/lib/lessonTypes";
import { cap, shortDate } from "@/shared/lib/format";


export default function CourseDetails() {
  const { id } = useParams();
  const toast = useToast();
  const confirm = useConfirm();
  const [owned, setOwned] = useState(false);
  // where "Go to Course" should land — the lesson the student left off on
  const [resumeLessonId, setResumeLessonId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { status, data, error, reload, setData } = useLoad(
    () =>
      Promise.all([api.get(`/courses/${id}`), api.get("/enrollments/mine")]).then(([c, m]) => {
        const mine = m.data.enrollments.find((e) => e.course._id === id);
        setOwned(!!mine);
        setResumeLessonId(mine?.currentLessonId || null);
        return c.data;
      }),
    [id]
  );

  // reviews — loaded separately so a reviews outage doesn't take the course
  // page with it
  const [rDraft, setRDraft] = useState({ rating: 0, text: "" });
  const [rSaving, setRSaving] = useState(false);
  const revLoad = useLoad(
    () =>
      api.get(`/courses/${id}/reviews`).then((r) => {
        if (r.data.mine) setRDraft({ rating: r.data.mine.rating, text: r.data.mine.text || "" });
        return r.data;
      }),
    [id]
  );
  const rev = revLoad.data; // { reviews, avg, count, mine }

  // the course carries the rating average, so it is refreshed alongside
  const refreshAfterReview = async () => {
    revLoad.reload();
    const r = await api.get(`/courses/${id}`);
    setData(r.data);
  };

  const enroll = async () => {
    setBusy(true);
    try {
      await api.post("/enrollments", { courseId: id });
      toast("Enrolled");
      setOwned(true);
    } catch (e) {
      toast(e.message, "error");
    }
    setBusy(false);
  };

  const saveReview = async (e) => {
    e.preventDefault();
    if (!rDraft.rating) return toast("Pick a star rating", "error");
    setRSaving(true);
    try {
      await api.post(`/courses/${id}/reviews`, rDraft);
      toast("Review saved");
      await refreshAfterReview();
    } catch (e) {
      toast(e.message, "error");
    }
    setRSaving(false);
  };

  const deleteReview = async () => {
    const ok = await confirm({
      title: "Remove your review?",
      message: "Your rating and comment will be deleted from this course.",
      confirmLabel: "Remove review",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/courses/${id}/reviews/mine`);
      setRDraft({ rating: 0, text: "" });
      await refreshAfterReview();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  // A failure here used to read as "Course not found" whatever went wrong —
  // only an actual 404 says that now.
  if (status === "error")
    return (
      <Layout>
        {error.status === 404 ? (
          <h3>Course not found</h3>
        ) : (
          <ErrorState
            title="Couldn't load this course"
            message={error.message}
            onRetry={reload}
          />
        )}
        <Link
          className="btn btn-secondary"
          to="/courses"
          style={{ width: "fit-content", marginTop: 14 }}
        >
          <ArrowLeft />
          Back to courses
        </Link>
      </Layout>
    );
  if (!data)
    return (
      <Layout>
        <CenterLoader variant="detail" />
      </Layout>
    );

  const { course, lessons } = data;
  const firstLesson = lessons[0];
  const groups = groupByModule(lessons);
  // resume where they left off; fall back to lesson 1 if the pointer is stale
  const resumeTarget =
    (resumeLessonId && lessons.some((l) => l._id === resumeLessonId) && resumeLessonId) ||
    firstLesson?._id ||
    null;
  const resumeHref = resumeTarget ? `/learn/${course._id}/${resumeTarget}` : "/my-learning";
  const resumeLabel =
    resumeLessonId && resumeLessonId !== firstLesson?._id ? "Resume course" : "Start learning";
  // Real lesson minutes are the truth; `hours` is only the teacher's estimate
  // while a course is still being built, so show it only when there's no content yet.
  const totalTime = course.minutes
    ? fmtDuration(course.minutes)
    : course.hours
    ? `~${course.hours}h`
    : "";

  return (
    <Layout bodyClass="has-cta-bar">
      <Link className="page-back" to="/courses">
        <ArrowLeft />
        Back to courses
      </Link>
      <div className="split">
        <div>
          <CourseThumb src={course.thumbnailUrl} style={{ marginBottom: 14 }} />

          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            {course.category && <span className="tag tag-neutral">{course.category}</span>}
            {course.difficulty && <span className="tag tag-outline">{cap(course.difficulty)}</span>}
          </div>

          <h2 style={{ marginBottom: 4 }}>{course.title}</h2>
          <div className="card-meta" style={{ marginBottom: 6 }}>
            Teacher: {course.teacherName || "—"} · {course.lessonCount} lessons
            {totalTime ? ` · ${totalTime}` : ""}
          </div>
          {course.reviewCount > 0 && (
            <div className="card-meta" style={{ marginBottom: 14 }}>
              <StarsDisplay value={course.rating} />
              <span>
                {course.rating.toFixed(1)} · {course.reviewCount} review
                {course.reviewCount === 1 ? "" : "s"}
              </span>
            </div>
          )}

          <p style={{ marginBottom: 16 }}>{course.description || "No description yet."}</p>

          {course.prerequisites?.length > 0 && (
            <>
              <h5>Prerequisites</h5>
              <ul style={{ fontSize: 13, paddingLeft: 18, marginBottom: 16 }}>
                {course.prerequisites.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </>
          )}

          {course.learn?.length > 0 && (
            <>
              <h5>What you'll learn</h5>
              <ul style={{ fontSize: 13, paddingLeft: 18, marginBottom: 16 }}>
                {course.learn.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </>
          )}

          <h5>Course Content</h5>
          {groups.length === 0 && <p className="muted-sm">No lessons published yet.</p>}
          {groups.map((g, i) => {
            const mins = g.items.reduce((s, l) => s + (Number(l.durationMin) || 0), 0);
            return (
              <div key={i} className="mod-section" style={{ marginTop: 10 }}>
                <div className="mod-head">
                  <span>
                    Module {i + 1} · {g.name}
                  </span>
                  <span className="count">
                    {g.items.length} lesson{g.items.length === 1 ? "" : "s"}
                    {mins ? ` · ${fmtDuration(mins)}` : ""}
                  </span>
                </div>
                {g.items.map((l) => {
                  const m = typeMeta(l.type);
                  return (
                    <div key={l._id} className="lesson-row">
                      <span className="type-chip" style={{ flex: "none" }}>
                        <m.Icon />
                      </span>
                      <span style={{ flex: 1, fontSize: 13 }}>{l.title}</span>
                      <span className="muted-sm">{fmtDuration(l.durationMin)}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* ── reviews ─────────────────────────────────────────── */}
          <h5 className="section-h">
            Reviews {rev?.count ? `(${rev.count})` : ""}
          </h5>

          {owned && (
            <form onSubmit={saveReview} className="card elev-sm" style={{ marginBottom: 12 }}>
              <div className="card-kicker">{rev?.mine ? "Your review" : "Write a review"}</div>
              <StarsInput value={rDraft.rating} onChange={(rating) => setRDraft((d) => ({ ...d, rating }))} />
              <textarea
                className="input"
                style={{ minHeight: 70, marginTop: 8 }}
                placeholder="What did you think? (optional)"
                value={rDraft.text}
                onChange={(e) => setRDraft((d) => ({ ...d, text: e.target.value }))}
              />
              <div className="chip-row" style={{ marginTop: 8 }}>
                <button className={"btn btn-primary" + (rSaving ? " is-loading" : "")}>
                  {rev?.mine ? "Update review" : "Post review"}
                </button>
                {rev?.mine && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ color: "var(--color-danger)" }}
                    onClick={deleteReview}
                  >
                    Remove
                  </button>
                )}
              </div>
            </form>
          )}

          {revLoad.status === "error" ? (
            <p className="muted-sm">
              Couldn't load reviews.{" "}
              <button className="linklike" onClick={revLoad.reload}>
                Try again
              </button>
            </p>
          ) : !rev ? (
            <p className="muted-sm">Loading reviews…</p>
          ) : rev.reviews.length === 0 ? (
            <p className="muted-sm">No reviews yet{owned ? " — be the first." : "."}</p>
          ) : (
            rev.reviews.map((r) => (
              <div key={r._id} className="card elev-sm" style={{ marginBottom: 8, padding: "12px 14px" }}>
                <div className="row" style={{ gap: 8 }}>
                  <strong style={{ fontSize: 13 }}>{r.student?.name || "Student"}</strong>
                  <StarsDisplay value={r.rating} />
                  <span className="muted-sm" style={{ marginLeft: "auto" }}>
                    {shortDate(r.createdAt)}
                  </span>
                </div>
                {r.text && <p style={{ fontSize: 13, margin: "6px 0 0" }}>{r.text}</p>}
              </div>
            ))
          )}
        </div>

        {/* ── sticky enrol box ──────────────────────────────────── */}
        <div className="card elev-md enrol-box">
          <div style={{ fontSize: 28, fontFamily: "var(--font-heading)", fontWeight: 800 }}>Free</div>
          {owned ? (
            <Link className="btn btn-primary btn-block" to={resumeHref}>
              <Play />
              {resumeLabel}
            </Link>
          ) : (
            <>
              <button
                className={"btn btn-primary btn-block" + (busy ? " is-loading" : "")}
                style={{ justifyContent: "center" }}
                onClick={enroll}
              >
                Enroll Free
              </button>
              {firstLesson && (
                <button
                  className="btn btn-secondary btn-block"
                  style={{ justifyContent: "center" }}
                  onClick={() => setPreviewOpen(true)}
                >
                  <Play />
                  Preview first lesson
                </button>
              )}
            </>
          )}
          <div className="hr" />
          {totalTime && (
            <div className="card-meta">
              <Clock />
              {totalTime} of content
            </div>
          )}
          <div className="card-meta">
            <BookOpen />
            {course.lessonCount} lessons
          </div>
          <div className="card-meta">
            <Award />
            Lifetime access
          </div>
        </div>
      </div>

      {/* Phones only: the enrol box above lands below every review on a
          narrow screen, so the main action rides along at the bottom. */}
      <div className="cta-bar">
        <div className="cta-bar-text">
          <strong>Free</strong>
          <span>
            {course.lessonCount} lessons{totalTime ? ` · ${totalTime}` : ""}
          </span>
        </div>
        {owned ? (
          <Link className="btn btn-primary" to={resumeHref}>
            <Play />
            {resumeLabel}
          </Link>
        ) : (
          <button className={"btn btn-primary" + (busy ? " is-loading" : "")} onClick={enroll}>
            Enroll Free
          </button>
        )}
      </div>

      {previewOpen && firstLesson && (
        <Modal title={`Preview — ${firstLesson.title}`} onClose={() => setPreviewOpen(false)}>
          <div className="lesson-preview">
            <LessonContent lesson={firstLesson} />
          </div>
          <div className="preview-cta">
            <span className="muted-sm">First lesson only — enrol to unlock the rest.</span>
            <button
              className={"btn btn-primary" + (busy ? " is-loading" : "")}
              onClick={async () => {
                await enroll();
                setPreviewOpen(false);
              }}
            >
              Enroll Free
            </button>
          </div>
        </Modal>
      )}
    </Layout>
  );
}
