import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams, useNavigate } from "react-router-dom";
import {
  X,
  Check,
  Play,
  Circle,
  ChevronLeft,
  ChevronRight,
  PartyPopper,
  MessageCircleQuestion,
  Menu,
  ListTree,
} from "lucide-react";
import api from "../api/client";
import { BootLoader } from "../components/Bits";
import Brand from "../components/Brand";
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
  // curriculum drawer — only reachable below 900px, where the sidebar is off-canvas
  const [navOpen, setNavOpen] = useState(false);

  // notes
  const notesRef = useRef({}); // server-confirmed { lessonId: text }
  const draftRef = useRef(""); // latest textarea value, for stale-closure-free saves
  const saveTimer = useRef(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteState, setNoteState] = useState(""); // "", "Unsaved", "Saving…", "Saved"

  const noteKey = (lid) => `lms:note:${courseId}:${lid}`;
  const readLocalNote = (lid) => {
    try {
      return localStorage.getItem(noteKey(lid));
    } catch {
      return null;
    }
  };

  // Persist one lesson's note. `silent` saves without touching the status line —
  // used when leaving the lesson, so a slow response can't mislabel the next one.
  const flushNote = useCallback(
    async (lid, text, { silent = false } = {}) => {
      if (!lid) return;
      clearTimeout(saveTimer.current);
      if ((notesRef.current[lid] || "") === text) return;
      if (!silent) setNoteState("Saving…");
      try {
        await api.put(`/enrollments/${courseId}/notes/${lid}`, { text });
        notesRef.current[lid] = text;
        try {
          localStorage.removeItem(noteKey(lid));
        } catch {
          /* private mode / quota — the note is on the server, ignore */
        }
        if (!silent && draftRef.current === text) setNoteState("Saved");
      } catch (e) {
        if (!silent) {
          toast(e.message);
          setNoteState("Unsaved");
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courseId]
  );

  // debounced autosave while typing
  useEffect(() => {
    if (noteState !== "Unsaved") return;
    const lid = lessonId;
    const text = noteDraft;
    saveTimer.current = setTimeout(() => flushNote(lid, text), 800);
    return () => clearTimeout(saveTimer.current);
  }, [noteDraft, noteState, lessonId, flushNote]);

  // warn before a full page unload if something is still pending
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (noteState === "Unsaved" || noteState === "Saving…") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [noteState]);

  // the drawer is a navigation surface — close it once a lesson is picked
  useEffect(() => setNavOpen(false), [lessonId]);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e) => e.key === "Escape" && setNavOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);

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

  // load this lesson's note + remember position, once per lesson visit.
  // keyed on `ready` (not `state`) so completing a lesson doesn't reset the draft.
  const ready = !!state;
  useEffect(() => {
    if (!ready || !lessonId) return;
    const server = notesRef.current[lessonId] || "";
    // recover an unsynced draft left by a crash / hard refresh
    const local = readLocalNote(lessonId);
    const initial = local != null && local !== server ? local : server;
    setNoteDraft(initial);
    draftRef.current = initial;
    setNoteState(initial === server ? "" : "Unsaved");
    if (!visited.current.has(lessonId)) {
      visited.current.add(lessonId);
      api.post(`/enrollments/${courseId}/visit`, { lessonId }).catch(() => {});
    }
    // save this lesson's note before switching away or unmounting
    return () => flushNote(lessonId, draftRef.current, { silent: true });
  }, [ready, courseId, lessonId, flushNote]);

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
  // Redirect declaratively — calling nav() here would be a state update during render.
  if (idx < 0) return <Navigate to={`/learn/${courseId}/${lessons[0]._id}`} replace />;
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

  const onNoteChange = (e) => {
    const v = e.target.value;
    setNoteDraft(v);
    draftRef.current = v;
    setNoteState("Unsaved");
    try {
      localStorage.setItem(noteKey(lessonId), v);
    } catch {
      /* private mode / quota — autosave to the server still covers it */
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
        <button
          className="icon-btn menu-btn"
          onClick={() => setNavOpen(true)}
          aria-label="Lessons in this course"
          aria-expanded={navOpen}
        >
          <Menu />
        </button>
        <Link className="brand" to="/">
          <Brand size={28} tagline={false} />
        </Link>
        <span className="title">{course.title}</span>
        <span className="text-muted spacer" style={{ fontSize: 13 }}>
          {lesson.module} · Lesson {idx + 1} of {lessons.length}
        </span>
        <Link className="back" to="/my-learning" aria-label="Close">
          <X />
        </Link>
      </header>

      <div
        className={"scrim" + (navOpen ? " show" : "")}
        onClick={() => setNavOpen(false)}
      />

      <div className="lesson-wrap">
        <aside className={"curriculum" + (navOpen ? " open" : "")}>
          <div className="curriculum-head">
            <ListTree />
            <strong>
              {lessons.length} lesson{lessons.length === 1 ? "" : "s"}
            </strong>
            <button className="icon-btn" onClick={() => setNavOpen(false)} aria-label="Close lessons">
              <X />
            </button>
          </div>
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
            <div className="lesson-top">
              {courseComplete && (
                <div className="done-banner">
                  <PartyPopper />
                  You've completed every lesson in this course.
                </div>
              )}

              <div>
                <h3 style={{ marginBottom: 6 }}>{lesson.title}</h3>
                <div className="type-chip">
                  <meta.Icon />
                  {meta.label}
                  {lesson.durationMin ? ` · ${fmtDuration(lesson.durationMin)}` : ""}
                </div>
              </div>
            </div>

            <div className="lesson-content-area">
              <LessonContent lesson={lesson} />
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

            <aside className="lesson-aside">
              <div className="notes-block">
                <div className="row" style={{ marginBottom: 6 }}>
                  <h5 style={{ margin: 0 }}>Your notes</h5>
                  <span
                    className={"note-status" + (noteState === "Unsaved" ? " is-unsaved" : "")}
                  >
                    {noteState === "Saved" && <Check />}
                    {noteState}
                  </span>
                </div>
                <textarea
                  className="input"
                  style={{ minHeight: 160 }}
                  value={noteDraft}
                  onChange={onNoteChange}
                  onBlur={() => flushNote(lessonId, draftRef.current)}
                  placeholder="Private notes for this lesson — only you can see them"
                />
                <div className="note-foot muted-sm">
                  {noteDraft.trim() ? `${noteDraft.trim().split(/\s+/).length} words` : "Autosaves as you type"}
                </div>
              </div>
              <button
                className="btn btn-secondary"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => setAskOpen(true)}
              >
                <MessageCircleQuestion />
                Ask a doubt
              </button>
            </aside>
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
