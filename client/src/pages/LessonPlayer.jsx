import { useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  GraduationCap,
  X,
  Check,
  Play,
  Circle,
  ChevronLeft,
  ChevronRight,
  PartyPopper,
  MessageCircleQuestion,
} from "lucide-react";
import api from "../api/client";
import { BootLoader } from "../components/Bits";
import LessonContent from "../components/LessonContent";
import Modal from "../components/Modal";
import { useToast } from "../context/ToastContext";
import { typeMeta, fmtDuration } from "../lib/lessonTypes";

function Centered({ children }) {
  return (
    <div className="app">
      <div className="main">
        <main className="body center">{children}</main>
      </div>
    </div>
  );
}

export default function LessonPlayer() {
  const { courseId, lessonId } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [state, setState] = useState(null); // { course, lessons, doneSet }
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const visited = useRef(new Set());

  // notes
  const notesRef = useRef({});
  const [noteDraft, setNoteDraft] = useState("");
  const [noteState, setNoteState] = useState(""); // "", "Unsaved", "Saving…", "Saved"

  // ask a doubt
  const [askOpen, setAskOpen] = useState(false);
  const [doubtText, setDoubtText] = useState("");
  const [doubtSending, setDoubtSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get(`/courses/${courseId}`),
      api.get("/enrollments/mine"),
      api.get(`/enrollments/${courseId}/notes`).catch(() => ({ data: { notes: {} } })),
    ])
      .then(([c, m, n]) => {
        if (cancelled) return;
        const mine = m.data.enrollments.find((e) => e.course._id === courseId);
        if (!mine) return setErr("not-enrolled");
        notesRef.current = n.data.notes || {};
        setState({
          course: c.data.course,
          lessons: c.data.lessons,
          doneSet: new Set((mine.completedLessonIds || []).map(String)),
        });
      })
      .catch(() => !cancelled && setErr("not-found"));
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  // load this lesson's note + remember position, once per lesson visit
  useEffect(() => {
    if (!state || !lessonId) return;
    setNoteDraft(notesRef.current[lessonId] || "");
    setNoteState("");
    if (!visited.current.has(lessonId)) {
      visited.current.add(lessonId);
      api.post(`/enrollments/${courseId}/visit`, { lessonId }).catch(() => {});
    }
  }, [state, courseId, lessonId]);

  if (err === "not-enrolled")
    return (
      <Centered>
        <h3>You're not enrolled in this course</h3>
        <Link className="btn btn-primary" to={`/courses/${courseId}`} style={{ justifyContent: "center" }}>
          View course
        </Link>
      </Centered>
    );
  if (err === "not-found")
    return (
      <Centered>
        <h3>Course not found</h3>
        <Link className="btn btn-secondary" to="/my-learning" style={{ justifyContent: "center" }}>
          My Learning
        </Link>
      </Centered>
    );
  if (!state) return <BootLoader label="Opening lesson…" />;

  const { course, lessons, doneSet } = state;

  if (!lessons.length)
    return (
      <Centered>
        <h3>This course has no lessons yet</h3>
        <Link className="btn btn-secondary" to="/my-learning" style={{ justifyContent: "center" }}>
          My Learning
        </Link>
      </Centered>
    );

  const idx = lessons.findIndex((l) => l._id === lessonId);
  if (idx < 0) {
    nav(`/learn/${courseId}/${lessons[0]._id}`, { replace: true });
    return null;
  }
  const lesson = lessons[idx];
  const isDone = doneSet.has(String(lesson._id));
  const courseComplete = doneSet.size >= lessons.length;
  const meta = typeMeta(lesson.type);

  const modules = [];
  lessons.forEach((l) => {
    let m = modules.find((x) => x.name === l.module);
    if (!m) {
      m = { name: l.module, items: [] };
      modules.push(m);
    }
    m.items.push(l);
  });

  const rowIcon = (l) => {
    if (doneSet.has(String(l._id))) return <Check className="done" />;
    if (l._id === lessonId) return <Play />;
    return <Circle className="todo" />;
  };

  const go = (i) => {
    if (lessons[i]) nav(`/learn/${courseId}/${lessons[i]._id}`);
  };

  const complete = async () => {
    if (isDone) return go(idx + 1);
    setSaving(true);
    try {
      const { data } = await api.post(`/enrollments/${courseId}/complete`, { lessonId: lesson._id });
      setState((s) => ({ ...s, doneSet: new Set((data.completedLessonIds || []).map(String)) }));
      toast(data.justCompletedCourse ? "Course complete! 🎉" : "Lesson complete");
      if (lessons[idx + 1]) go(idx + 1);
    } catch (e) {
      toast(e.message);
    }
    setSaving(false);
  };

  const saveNote = async () => {
    if ((notesRef.current[lessonId] || "") === noteDraft) return;
    setNoteState("Saving…");
    try {
      await api.put(`/enrollments/${courseId}/notes/${lessonId}`, { text: noteDraft });
      notesRef.current[lessonId] = noteDraft;
      setNoteState("Saved");
    } catch (e) {
      toast(e.message);
      setNoteState("Unsaved");
    }
  };

  const sendDoubt = async () => {
    if (!doubtText.trim()) return toast("Write your question first");
    setDoubtSending(true);
    try {
      await api.post("/doubts", { courseId, lessonId, text: doubtText });
      toast("Doubt sent to your teacher");
      setDoubtText("");
      setAskOpen(false);
    } catch (e) {
      toast(e.message);
    }
    setDoubtSending(false);
  };

  return (
    <div className="learn-shell">
      <header className="flowbar">
        <Link className="brand" to="/">
          <span className="brand-mark">
            <GraduationCap />
          </span>
          <span className="brand-word">
            Tech<span>Dea</span>
          </span>
        </Link>
        <span className="title">{course.title}</span>
        <span className="text-muted spacer" style={{ fontSize: 13 }}>
          {lesson.module} · Lesson {idx + 1} of {lessons.length}
        </span>
        <Link className="back" to="/my-learning" aria-label="Close">
          <X />
        </Link>
      </header>

      <div className="lesson-wrap">
        <aside className="curriculum">
          {modules.map((m) => (
            <div key={m.name}>
              <div className="mod-label">{m.name}</div>
              {m.items.map((l) => {
                const lm = typeMeta(l.type);
                return (
                  <Link
                    key={l._id}
                    to={`/learn/${courseId}/${l._id}`}
                    className={l._id === lessonId ? "on" : undefined}
                  >
                    {rowIcon(l)}
                    <span className="lesson-line">
                      <span>{l.title}</span>
                      <span className="lesson-dur">
                        {lm.label}
                        {l.durationMin ? ` · ${fmtDuration(l.durationMin)}` : ""}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </aside>

        <div className="lesson-main">
          <div className="lesson-body">
            {courseComplete && (
              <div className="done-banner">
                <PartyPopper />
                You've completed every lesson in this course.
              </div>
            )}

            <LessonContent lesson={lesson} />

            <div className="row" style={{ gap: 12, marginBottom: 16 }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>{lesson.title}</h3>
                <div className="type-chip">
                  <meta.Icon />
                  {meta.label}
                  {lesson.durationMin ? ` · ${fmtDuration(lesson.durationMin)}` : ""}
                </div>
              </div>
              <button
                className="btn btn-secondary"
                style={{ marginLeft: "auto" }}
                onClick={() => setAskOpen(true)}
              >
                <MessageCircleQuestion />
                Ask a doubt
              </button>
            </div>

            <div className="lesson-nav">
              <button className="btn btn-secondary" onClick={() => go(idx - 1)} disabled={idx === 0}>
                <ChevronLeft />
                Previous
              </button>
              <button
                className={"btn btn-primary" + (saving ? " is-loading" : "")}
                onClick={complete}
                disabled={isDone && idx === lessons.length - 1}
              >
                <Check />
                {isDone ? "Completed" : "Mark as Complete"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => go(idx + 1)}
                disabled={idx === lessons.length - 1}
              >
                Next
                <ChevronRight />
              </button>
            </div>

            <div className="notes-block">
              <div className="row" style={{ marginBottom: 6 }}>
                <h5 style={{ margin: 0 }}>Your notes</h5>
                <span className="muted-sm" style={{ marginLeft: "auto" }}>
                  {noteState}
                </span>
              </div>
              <textarea
                className="input"
                style={{ minHeight: 96 }}
                value={noteDraft}
                onChange={(e) => {
                  setNoteDraft(e.target.value);
                  setNoteState("Unsaved");
                }}
                onBlur={saveNote}
                placeholder="Private notes for this lesson — only you can see them"
              />
            </div>
          </div>
        </div>
      </div>

      {askOpen && (
        <Modal title="Ask a doubt" onClose={() => setAskOpen(false)}>
          <p className="muted-sm" style={{ marginBottom: 10 }}>
            About “{lesson.title}” in {course.title}. Your teacher will see it.
          </p>
          <textarea
            className="input"
            style={{ minHeight: 120 }}
            value={doubtText}
            onChange={(e) => setDoubtText(e.target.value)}
            placeholder="What's confusing you?"
            autoFocus
          />
          <div className="chip-row" style={{ marginTop: 12 }}>
            <button
              className={"btn btn-primary" + (doubtSending ? " is-loading" : "")}
              onClick={sendDoubt}
            >
              Send
            </button>
            <button className="btn btn-secondary" onClick={() => setAskOpen(false)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
