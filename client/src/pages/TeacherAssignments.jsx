import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Inbox,
  X,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import api from "../api/client";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import { CenterLoader } from "../components/Bits";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { kindMeta, fmtDate, fmtDateTime } from "../lib/assessments";

const dateValue = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const blankQuestion = () => ({ text: "", options: ["", ""], correctIndex: 0 });

/* ══ builder ═══════════════════════════════════════════════════════════════ */
function Builder({ courseId, kind, existing, onClose, onSaved }) {
  const toast = useToast();
  const edit = !!existing;
  const { label } = kindMeta(kind);
  const [f, setF] = useState({
    title: existing?.title || "",
    instructions: existing?.instructions || "",
    dueAt: dateValue(existing?.dueAt),
    published: existing?.published || false,
    points: existing?.points || 100,
    passPercent: existing?.passPercent ?? 60,
    timeLimitMin: existing?.timeLimitMin || 0,
    questions: existing?.questions?.length ? existing.questions.map((q) => ({ ...q })) : [blankQuestion()],
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const setQ = (i, patch) => set("questions", f.questions.map((q, x) => (x === i ? { ...q, ...patch } : q)));
  const setOpt = (qi, oi, val) =>
    setQ(qi, { options: f.questions[qi].options.map((o, x) => (x === oi ? val : o)) });
  const addOpt = (qi) => {
    if (f.questions[qi].options.length >= 6) return;
    setQ(qi, { options: [...f.questions[qi].options, ""] });
  };
  const delOpt = (qi, oi) => {
    const q = f.questions[qi];
    if (q.options.length <= 2) return;
    const options = q.options.filter((_, x) => x !== oi);
    setQ(qi, { options, correctIndex: Math.min(q.correctIndex, options.length - 1) });
  };

  const save = async () => {
    if (!f.title.trim()) return toast("Give it a title");
    const payload = {
      title: f.title.trim(),
      instructions: f.instructions,
      dueAt: f.dueAt || null,
      published: f.published,
    };
    if (kind === "assignment") {
      payload.points = Number(f.points) || 100;
    } else {
      payload.passPercent = Number(f.passPercent) || 0;
      payload.timeLimitMin = Number(f.timeLimitMin) || 0;
      payload.questions = f.questions
        .map((q) => ({
          text: q.text.trim(),
          options: q.options.map((o) => o.trim()).filter(Boolean),
          correctIndex: q.correctIndex,
        }))
        .filter((q) => q.text && q.options.length >= 2);
      if (f.published && !payload.questions.length) {
        return toast("Add at least one complete question before publishing");
      }
    }
    setBusy(true);
    try {
      const { data } = edit
        ? await api.put(`/assessments/${existing._id}`, payload)
        : await api.post("/assessments", { courseId, kind, ...payload });
      onSaved(data.assessment);
      toast(edit ? "Saved" : `${label} created`);
    } catch (e) {
      toast(e.message);
      setBusy(false);
    }
  };

  const completeQs = f.questions.filter(
    (q) => q.text.trim() && q.options.filter((o) => o.trim()).length >= 2
  ).length;

  return (
    <Modal title={`${edit ? "Edit" : "New"} ${label.toLowerCase()}`} onClose={onClose} wide>
      <div className="bld-section" style={{ marginTop: 0 }}>
        <div className="bld-section-h">Details</div>
        <div className="field">
          <label>Title</label>
          <input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>
            Instructions <span className="text-muted">(optional)</span>
          </label>
          <textarea
            className="input"
            style={{ minHeight: 90 }}
            value={f.instructions}
            onChange={(e) => set("instructions", e.target.value)}
            placeholder={
              kind === "assignment"
                ? "What should students do, and how is it marked?"
                : "A short note shown above the questions."
            }
          />
        </div>
        <div className="form-grid">
          <div className="field">
            <label>
              Due date <span className="text-muted">(optional)</span>
            </label>
            <input
              className="input"
              type="date"
              value={f.dueAt}
              onChange={(e) => set("dueAt", e.target.value)}
            />
          </div>
          {kind === "assignment" ? (
            <div className="field">
              <label>Marks (out of)</label>
              <input
                className="input"
                type="number"
                min="1"
                max="1000"
                value={f.points}
                onChange={(e) => set("points", e.target.value)}
              />
            </div>
          ) : (
            <div className="field">
              <label>Pass mark (%)</label>
              <input
                className="input"
                type="number"
                min="0"
                max="100"
                value={f.passPercent}
                onChange={(e) => set("passPercent", e.target.value)}
              />
            </div>
          )}
        </div>
        {kind === "quiz" && (
          <div className="field" style={{ maxWidth: 240 }}>
            <label>
              Time limit — minutes <span className="text-muted">(0 = untimed)</span>
            </label>
            <input
              className="input"
              type="number"
              min="0"
              max="600"
              value={f.timeLimitMin}
              onChange={(e) => set("timeLimitMin", e.target.value)}
            />
          </div>
        )}
      </div>

      {kind === "quiz" && (
        <div className="bld-section">
          <div className="bld-section-h">
            Questions{completeQs ? ` · ${completeQs} ready` : ""}
          </div>
          {f.questions.map((q, qi) => (
            <div key={qi} className="bld-q">
              <div className="bld-q-top">
                <span className="qn">{qi + 1}</span>
                <input
                  className="input"
                  placeholder="Question"
                  value={q.text}
                  onChange={(e) => setQ(qi, { text: e.target.value })}
                />
                {f.questions.length > 1 && (
                  <button
                    className="btn btn-ghost btn-icon"
                    style={{ color: "var(--color-danger)", flex: "none" }}
                    onClick={() => set("questions", f.questions.filter((_, x) => x !== qi))}
                    aria-label="Remove question"
                  >
                    <Trash2 />
                  </button>
                )}
              </div>
              {q.options.map((opt, oi) => (
                <div key={oi} className="bld-opt">
                  <label className={"correct-toggle" + (q.correctIndex === oi ? " is-on" : "")}>
                    <input
                      type="radio"
                      name={`correct-${qi}`}
                      checked={q.correctIndex === oi}
                      onChange={() => setQ(qi, { correctIndex: oi })}
                    />
                    <Check />
                    correct
                  </label>
                  <input
                    className="input"
                    placeholder={`Option ${oi + 1}`}
                    value={opt}
                    onChange={(e) => setOpt(qi, oi, e.target.value)}
                  />
                  {q.options.length > 2 && (
                    <button
                      className="btn btn-ghost btn-icon"
                      style={{ flex: "none" }}
                      onClick={() => delOpt(qi, oi)}
                      aria-label="Remove option"
                    >
                      <X />
                    </button>
                  )}
                </div>
              ))}
              {q.options.length < 6 && (
                <button className="btn btn-ghost" style={{ marginTop: 2 }} onClick={() => addOpt(qi)}>
                  <Plus /> Option
                </button>
              )}
            </div>
          ))}
          <button
            className="btn btn-secondary"
            onClick={() => set("questions", [...f.questions, blankQuestion()])}
          >
            <Plus /> Add question
          </button>
        </div>
      )}

      <div className="modal-foot">
        <label className="check-row">
          <input type="checkbox" checked={f.published} onChange={(e) => set("published", e.target.checked)} />
          Published — visible to enrolled students
        </label>
        <span className="spacer" />
        <button className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button className={"btn btn-primary" + (busy ? " is-loading" : "")} disabled={busy} onClick={save}>
          {edit ? "Save changes" : `Create ${label.toLowerCase()}`}
        </button>
      </div>
    </Modal>
  );
}

/* ══ one submission row in the inbox ══════════════════════════════════════ */
function GradeRow({ a, sub, onGraded }) {
  const toast = useToast();
  const max = a.kind === "quiz" ? 100 : a.points;
  const [score, setScore] = useState(sub.score ?? "");
  const [feedback, setFeedback] = useState(sub.feedback || "");
  const [busy, setBusy] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.patch(`/submissions/${sub._id}/grade`, {
        score: score === "" ? null : Number(score),
        feedback,
      });
      onGraded(data.submission);
      toast("Grade saved");
    } catch (e) {
      toast(e.message);
    }
    setBusy(false);
  };

  const perQ =
    a.kind === "quiz" && a.questions?.length
      ? a.questions.map((q, i) => (sub.answers?.[i] === q.correctIndex ? "ok" : "no"))
      : [];
  const correct = perQ.filter((x) => x === "ok").length;

  return (
    <div className="sub-card">
      <div className="sub-card-head">
        <span className="who">{sub.student?.name}</span>
        <span className="when">
          {sub.student?.email} · {fmtDateTime(sub.submittedAt)}
        </span>
        <span
          className={"tag " + (sub.status === "graded" ? "tag-neutral" : "tag-accent")}
          style={{ flex: "none" }}
        >
          {sub.status}
        </span>
      </div>

      {a.kind === "quiz" ? (
        <>
          <div className="muted-sm">
            Auto-score <strong style={{ color: "var(--color-text)" }}>{sub.autoScore}%</strong>
            {perQ.length ? ` · ${correct}/${perQ.length} correct` : ""}
          </div>
          {perQ.length > 0 && (
            <div className="qz-mini">
              {perQ.map((x, i) => (
                <i key={i} className={x} title={`Q${i + 1}`}>
                  {i + 1}
                </i>
              ))}
            </div>
          )}
          {a.questions?.length > 0 && (
            <>
              <button
                className="btn btn-ghost"
                style={{ marginTop: 6 }}
                aria-expanded={showAnswers}
                onClick={() => setShowAnswers((s) => !s)}
              >
                {showAnswers ? <ChevronUp /> : <ChevronDown />}
                {showAnswers ? "Hide answers" : "Show answers"}
              </button>
              {showAnswers && (
                <ol className="qz-review">
                  {a.questions.map((q, i) => {
                    const picked = sub.answers?.[i];
                    const right = picked === q.correctIndex;
                    return (
                      <li key={q._id || i}>
                        <div className="qz-review-q">{q.text}</div>
                        <div className={"qz-review-a" + (right ? " is-right" : " is-wrong")}>
                          {right ? <Check /> : <X />}
                          <span>
                            {picked >= 0 && q.options[picked] != null
                              ? q.options[picked]
                              : "No answer"}
                          </span>
                        </div>
                        {!right && (
                          <div className="qz-review-key">
                            Correct: {q.options[q.correctIndex]}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <div className={"asmt-answer" + (sub.text ? "" : " is-empty")} style={{ marginTop: 6 }}>
            {sub.text || "No written answer"}
          </div>
          {sub.link && (
            <p style={{ fontSize: 13, margin: "8px 0 0" }}>
              <a href={sub.link} target="_blank" rel="noreferrer">
                {sub.link}
              </a>
            </p>
          )}
        </>
      )}

      <div className="sub-grade-row">
        <div className="field score-field">
          <label>Score / {max}</label>
          <input
            className="input"
            type="number"
            min="0"
            max={max}
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
        </div>
        <div className="field fb-field">
          <label>Feedback</label>
          <input
            className="input"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Optional note to the student"
          />
        </div>
        <button className={"btn btn-primary" + (busy ? " is-loading" : "")} disabled={busy} onClick={save}>
          Save
        </button>
      </div>
    </div>
  );
}

/* ══ submissions inbox ═══════════════════════════════════════════════════ */
function SubmissionsInbox({ assessmentId, onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api
      .get(`/assessments/${assessmentId}/submissions`)
      .then((r) => setData(r.data))
      .catch(() => setData({ error: true }));
  }, [assessmentId]);

  const patch = (s) =>
    setData((d) => ({
      ...d,
      submissions: d.submissions.map((x) => (x._id === s._id ? { ...x, ...s } : x)),
    }));

  const a = data?.assessment;
  const graded = (data?.submissions || []).filter((s) => s.status === "graded").length;

  return (
    <Modal title={a ? `Submissions · ${a.title}` : "Submissions"} onClose={onClose} wide>
      {!data ? (
        <CenterLoader />
      ) : data.error ? (
        <p className="muted-sm">Couldn't load submissions.</p>
      ) : (
        <>
          <div className="inbox-stats">
            <div className="inbox-stat">
              <b>{data.submissions.length}</b>
              <span>Submitted</span>
            </div>
            <div className="inbox-stat">
              <b>{graded}</b>
              <span>Graded</span>
            </div>
            <div className="inbox-stat">
              <b>{data.submissions.length - graded}</b>
              <span>To grade</span>
            </div>
            <div className="inbox-stat">
              <b>{data.missing.length}</b>
              <span>Not submitted</span>
            </div>
          </div>

          {data.submissions.length === 0 ? (
            <p className="muted-sm">No submissions yet.</p>
          ) : (
            data.submissions.map((s) => <GradeRow key={s._id} a={a} sub={s} onGraded={patch} />)
          )}

          {data.missing.length > 0 && (
            <div className="bld-section">
              <div className="bld-section-h">Not submitted ({data.missing.length})</div>
              <div className="miss-chips">
                {data.missing.map((m) => (
                  <span key={m._id} className="miss-chip" title={m.email}>
                    {m.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

/* ══ page ═══════════════════════════════════════════════════════════════ */
export default function TeacherAssignments() {
  const toast = useToast();
  const confirm = useConfirm();
  const [courses, setCourses] = useState(null);
  const [courseId, setCourseId] = useState("");
  const [list, setList] = useState(null);
  const [builder, setBuilder] = useState(null); // { kind, existing? }
  const [inboxId, setInboxId] = useState(null);

  useEffect(() => {
    api
      .get("/courses/manage")
      .then((r) => {
        setCourses(r.data.courses);
        if (r.data.courses[0]) setCourseId(r.data.courses[0]._id);
      })
      .catch(() => setCourses([]));
  }, []);

  const loadList = () => {
    if (!courseId) return;
    setList(null);
    api
      .get("/assessments", { params: { courseId } })
      .then((r) => setList(r.data.assessments))
      .catch(() => setList([]));
  };
  useEffect(loadList, [courseId]);

  const upsert = (a) => {
    setList((l) => {
      const has = l.some((x) => x._id === a._id);
      return has
        ? l.map((x) => (x._id === a._id ? { ...x, ...a } : x))
        : [{ ...a, submittedCount: 0, gradedCount: 0 }, ...l];
    });
    setBuilder(null);
  };

  const togglePublish = async (a) => {
    try {
      const { data } = await api.patch(`/assessments/${a._id}/publish`, { published: !a.published });
      setList((l) => l.map((x) => (x._id === a._id ? { ...x, published: data.assessment.published } : x)));
      toast(data.assessment.published ? "Published" : "Moved to draft");
    } catch (e) {
      toast(e.message);
    }
  };

  const remove = async (a) => {
    const n = a.submittedCount || 0;
    const ok = await confirm({
      title: `Delete this ${kindMeta(a.kind).label.toLowerCase()}?`,
      message: `"${a.title}" will be permanently deleted.`,
      detail: n
        ? `${n} student submission${n === 1 ? "" : "s"}, including any grades and feedback, will be deleted with it. This can't be undone.`
        : "Nothing has been submitted yet. This can't be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/assessments/${a._id}`);
      setList((l) => l.filter((x) => x._id !== a._id));
      toast("Deleted");
    } catch (e) {
      toast(e.message);
    }
  };

  const stats = useMemo(() => {
    const l = list || [];
    return {
      total: l.length,
      published: l.filter((a) => a.published).length,
      drafts: l.filter((a) => !a.published).length,
      toGrade: l.reduce((s, a) => s + Math.max(0, (a.submittedCount || 0) - (a.gradedCount || 0)), 0),
    };
  }, [list]);

  if (!courses)
    return (
      <Layout>
        <CenterLoader />
      </Layout>
    );

  return (
    <Layout>
      <div className="asmt-head">
        <div>
          <h2>Assignments &amp; Quizzes</h2>
          <div className="asmt-sub">Build them per course, publish, then grade what comes in.</div>
        </div>
        {courses.length > 0 && (
          <div className="asmt-actions">
            <button className="btn btn-secondary" onClick={() => setBuilder({ kind: "assignment" })}>
              <Plus /> Assignment
            </button>
            <button className="btn btn-primary" onClick={() => setBuilder({ kind: "quiz" })}>
              <Plus /> Quiz
            </button>
          </div>
        )}
      </div>

      {courses.length === 0 ? (
        <div className="card elev-sm" style={{ alignItems: "flex-start" }}>
          <div className="card-title">No courses yet</div>
          <div className="card-meta">Assignments and quizzes attach to a course — create one first.</div>
        </div>
      ) : (
        <>
          <div className="asmt-toolbar">
            <div className="course-select">
              <label>Course</label>
              <select className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                {courses.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.title}
                    {c.published ? "" : " (draft)"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="stat-strip">
            <div className="card elev-sm stat">
              <div className="card-title">{stats.total}</div>
              <div className="card-meta">Total</div>
            </div>
            <div className="card elev-sm stat">
              <div className="card-title">{stats.published}</div>
              <div className="card-meta">Published</div>
            </div>
            <div className="card elev-sm stat">
              <div className="card-title">{stats.drafts}</div>
              <div className="card-meta">Drafts</div>
            </div>
            <div className="card elev-sm stat">
              <div className="card-title">{stats.toGrade}</div>
              <div className="card-meta">Awaiting grade</div>
            </div>
          </div>

          {!list ? (
            <CenterLoader />
          ) : list.length === 0 ? (
            <div className="card elev-sm" style={{ alignItems: "flex-start" }}>
              <div className="card-title">Nothing for this course yet</div>
              <div className="card-meta" style={{ marginBottom: 10 }}>
                Use “Assignment” or “Quiz” above to create the first one.
              </div>
              <button className="btn btn-primary" onClick={() => setBuilder({ kind: "quiz" })}>
                <Plus /> New quiz
              </button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th className="t-num">Submitted</th>
                    <th className="t-num">Graded</th>
                    <th className="t-status">Status</th>
                    <th className="t-actions" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => {
                    const { Icon, label } = kindMeta(a.kind);
                    return (
                      <tr key={a._id}>
                        <td>
                          <span className="t-primary">
                            <button
                              className="linklike"
                              onClick={() => setBuilder({ kind: a.kind, existing: a })}
                            >
                              {a.title}
                            </button>
                            <span className="t-sub" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                              <Icon style={{ width: 12, height: 12 }} />
                              {label}
                              {a.kind === "quiz" && ` · ${a.questions?.length || 0} Q · pass ${a.passPercent}%`}
                              {a.dueAt && ` · due ${fmtDate(a.dueAt)}`}
                            </span>
                          </span>
                        </td>
                        <td className="t-num">{a.submittedCount}</td>
                        <td className="t-num">{a.gradedCount}</td>
                        <td className="t-status">
                          <span className={"tag " + (a.published ? "tag-accent" : "tag-neutral")}>
                            {a.published ? "Published" : "Draft"}
                          </span>
                        </td>
                        <td className="t-actions">
                          <span className="act-group">
                            <button className="btn btn-secondary" onClick={() => setInboxId(a._id)}>
                              <Inbox /> Submissions
                            </button>
                            <button className="btn btn-secondary act-toggle" onClick={() => togglePublish(a)}>
                              {a.published ? <EyeOff /> : <Eye />}
                              {a.published ? "Unpublish" : "Publish"}
                            </button>
                            <button
                              className="btn btn-ghost"
                              onClick={() => setBuilder({ kind: a.kind, existing: a })}
                            >
                              <Pencil /> Edit
                            </button>
                            <button
                              className="btn btn-ghost btn-icon"
                              style={{ color: "var(--color-danger)" }}
                              onClick={() => remove(a)}
                              aria-label="Delete"
                            >
                              <Trash2 />
                            </button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {builder && (
        <Builder
          courseId={courseId}
          kind={builder.kind}
          existing={builder.existing}
          onClose={() => setBuilder(null)}
          onSaved={upsert}
        />
      )}
      {inboxId && <SubmissionsInbox assessmentId={inboxId} onClose={() => setInboxId(null)} />}
    </Layout>
  );
}
