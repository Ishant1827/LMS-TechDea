import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BookOpen, Clock, Award, Play } from "lucide-react";
import api from "../api/client";
import Layout from "../components/Layout";
import { CenterLoader, CourseThumb } from "../components/Bits";
import LessonContent from "../components/LessonContent";
import Modal from "../components/Modal";
import { StarsDisplay, StarsInput } from "../components/Stars";
import { useToast } from "../context/ToastContext";
import { typeMeta, fmtDuration } from "../lib/lessonTypes";

function groupByModule(lessons) {
  const out = [];
  for (const l of lessons) {
    let g = out.find((x) => x.name === l.module);
    if (!g) {
      g = { name: l.module, items: [] };
      out.push(g);
    }
    g.items.push(l);
  }
  return out;
}

const cap = (s = "") => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function CourseDetails() {
  const { id } = useParams();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [owned, setOwned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // reviews
  const [rev, setRev] = useState(null); // { reviews, avg, count, mine }
  const [rDraft, setRDraft] = useState({ rating: 0, text: "" });
  const [rSaving, setRSaving] = useState(false);

  const loadReviews = () =>
    api.get(`/courses/${id}/reviews`).then((r) => {
      setRev(r.data);
      if (r.data.mine) setRDraft({ rating: r.data.mine.rating, text: r.data.mine.text || "" });
    });

  useEffect(() => {
    Promise.all([api.get(`/courses/${id}`), api.get("/enrollments/mine")])
      .then(([c, m]) => {
        setData(c.data);
        setOwned(m.data.enrollments.some((e) => e.course._id === id));
      })
      .catch(() => setNotFound(true));
    loadReviews();
  }, [id]);

  const enroll = async () => {
    setBusy(true);
    try {
      await api.post("/enrollments", { courseId: id });
      toast("Enrolled");
      setOwned(true);
    } catch (e) {
      toast(e.message);
    }
    setBusy(false);
  };

  const saveReview = async (e) => {
    e.preventDefault();
    if (!rDraft.rating) return toast("Pick a star rating");
    setRSaving(true);
    try {
      await api.post(`/courses/${id}/reviews`, rDraft);
      toast("Review saved");
      await Promise.all([loadReviews(), api.get(`/courses/${id}`).then((r) => setData(r.data))]);
    } catch (e) {
      toast(e.message);
    }
    setRSaving(false);
  };

  const deleteReview = async () => {
    if (!window.confirm("Remove your review?")) return;
    try {
      await api.delete(`/courses/${id}/reviews/mine`);
      setRDraft({ rating: 0, text: "" });
      await Promise.all([loadReviews(), api.get(`/courses/${id}`).then((r) => setData(r.data))]);
    } catch (e) {
      toast(e.message);
    }
  };

  if (notFound)
    return (
      <Layout>
        <h3>Course not found</h3>
        <Link className="btn btn-secondary" to="/courses" style={{ width: "fit-content" }}>
          Back to courses
        </Link>
      </Layout>
    );
  if (!data)
    return (
      <Layout>
        <CenterLoader />
      </Layout>
    );

  const { course, lessons } = data;
  const firstLesson = lessons[0];
  const groups = groupByModule(lessons);
  const totalTime = course.minutes ? fmtDuration(course.minutes) : `${course.hours}h`;

  return (
    <Layout>
      <div className="split">
        <div>
          <CourseThumb src={course.thumbnailUrl} height={200} style={{ marginBottom: 14 }} />

          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            {course.category && <span className="tag tag-neutral">{course.category}</span>}
            {course.difficulty && <span className="tag tag-outline">{cap(course.difficulty)}</span>}
          </div>

          <h2 style={{ marginBottom: 4 }}>{course.title}</h2>
          <div className="card-meta" style={{ marginBottom: 6 }}>
            Teacher: {course.teacherName || "—"} · {course.lessonCount} lessons · {totalTime}
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

          {!rev ? (
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
                    {fmtDate(r.createdAt)}
                  </span>
                </div>
                {r.text && <p style={{ fontSize: 13, margin: "6px 0 0" }}>{r.text}</p>}
              </div>
            ))
          )}
        </div>

        {/* ── sticky enrol box ──────────────────────────────────── */}
        <div className="card elev-md" style={{ height: "fit-content", position: "sticky", top: 16 }}>
          <div style={{ fontSize: 28, fontFamily: "var(--font-heading)", fontWeight: 800 }}>Free</div>
          {owned ? (
            <Link
              className="btn btn-secondary btn-block"
              style={{ justifyContent: "center" }}
              to={firstLesson ? `/learn/${course._id}/${firstLesson._id}` : "/my-learning"}
            >
              Go to Course
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
          <div className="card-meta">
            <Clock />
            {totalTime} of content
          </div>
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
