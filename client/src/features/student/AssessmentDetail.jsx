import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, CheckCircle2, XCircle, Undo2, Lock } from "lucide-react";
import api from "@/shared/api/client";
import Layout from "@/shared/components/layout/Layout";
import { CenterLoader, ErrorState } from "@/shared/components/ui";
import { useLoad } from "@/shared/hooks/useLoad";
import { useToast } from "@/shared/context/ToastContext";
import { useConfirm } from "@/shared/context/ConfirmContext";
import { kindMeta, fmtDateTime, isOverdue } from "@/shared/lib/assessments";
import { safeUrl } from "@/shared/lib/safeUrl";

const qCount = (n) => `${n} question${n === 1 ? "" : "s"}`;

/* ── banner shown once a submission exists ───────────────────────────────── */
function ResultBanner({ a, sub }) {
  if (!sub) return null;

  // Sent back: this is the one banner that asks for something, so it says what
  // the teacher wants changed rather than only that it came back.
  if (sub.status === "returned") {
    return (
      <div className="result-banner is-fail">
        <Undo2 />
        <div>
          <div className="rb-label">Your teacher asked you to redo this</div>
          {sub.feedback ? (
            <div style={{ fontSize: 13 }}>{sub.feedback}</div>
          ) : (
            <div style={{ fontSize: 12 }}>Make your changes below and submit again.</div>
          )}
        </div>
      </div>
    );
  }

  if (sub.status !== "graded") {
    return (
      <div className="result-banner is-pending">
        <Clock />
        <div>
          <div className="rb-label">Submitted {fmtDateTime(sub.submittedAt)}</div>
          <div style={{ fontSize: 12 }}>Waiting on your teacher to grade it.</div>
        </div>
      </div>
    );
  }

  const fail = sub.passed === false;
  const scoreText =
    a.kind === "quiz"
      ? `${sub.percent}%`
      : `${sub.score ?? "—"} / ${a.points}${sub.percent != null ? `  ·  ${sub.percent}%` : ""}`;

  return (
    <div className={"result-banner" + (fail ? " is-fail" : "")}>
      {fail ? <XCircle /> : <CheckCircle2 />}
      <div>
        <div className="rb-score">{scoreText}</div>
        <div className="rb-label">
          {a.kind === "quiz" && sub.passed != null
            ? sub.passed
              ? "Passed"
              : `Below the ${a.passPercent}% pass mark`
            : "Graded"}
        </div>
      </div>
    </div>
  );
}

/* ── read-only quiz review (answers vs key) ──────────────────────────────── */
function QuizReview({ questions, answers }) {
  return (
    <ol className="qz-qs">
      {questions.map((q, i) => (
        <li key={q._id || i} className="qz-q">
          <div className="qz-q-head">
            <span className="qz-q-num">{i + 1}</span>
            <span className="qz-q-text">{q.text}</span>
          </div>
          <div className="qz-opts">
            {q.options.map((opt, oi) => {
              const picked = answers[i] === oi;
              const correct = q.correctIndex === oi;
              return (
                <div
                  key={oi}
                  className={
                    "qz-opt is-static" +
                    (correct ? " is-correct" : "") +
                    (picked && !correct ? " is-wrong" : "")
                  }
                >
                  {correct ? (
                    <CheckCircle2 className="mark-ic" />
                  ) : picked ? (
                    <XCircle className="mark-ic" />
                  ) : (
                    <span className="mark" />
                  )}
                  {opt}
                  {picked && <span className="tag-you">Your answer</span>}
                </div>
              );
            })}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ── take / submit ─────────────────────────────────────────────────────── */
function AttemptForm({ a, onDone, previous }) {
  const toast = useToast();
  const confirm = useConfirm();
  // A returned assignment comes back with what they wrote last time, so fixing
  // one broken link doesn't mean typing the whole answer again.
  const [text, setText] = useState(previous?.text || "");
  const [link, setLink] = useState(previous?.link || "");
  const [answers, setAnswers] = useState(() => (a.questions || []).map(() => -1));
  const [busy, setBusy] = useState(false);
  // The countdown can never outlive the due date. A 30-minute quiz opened five
  // minutes before it closes gets five minutes, and auto-submits while the work
  // is still accepted — rather than running its full half hour and being
  // refused at the end with everything typed into it.
  const [left, setLeft] = useState(() => {
    if (a.kind !== "quiz" || !a.timeLimitMin) return 0;
    const limit = a.timeLimitMin * 60;
    if (!a.dueAt) return limit;
    const toDue = Math.floor((new Date(a.dueAt).getTime() - Date.now()) / 1000);
    return Math.max(1, Math.min(limit, toDue));
  });
  const submittedRef = useRef(false);

  const total = (a.questions || []).length;
  const answered = answers.filter((v) => v >= 0).length;

  const send = async (auto = false) => {
    if (submittedRef.current) return;
    if (a.kind === "assignment" && !text.trim() && !link.trim()) {
      toast("Write an answer or paste a link first", "error");
      return;
    }
    if (!auto && a.kind === "quiz" && answered < total) {
      const left = total - answered;
      const ok = await confirm({
        title: "Submit with unanswered questions?",
        message: `${left} question${left === 1 ? "" : "s"} still unanswered.`,
        detail: "You get one attempt, so unanswered questions will be marked wrong.",
        confirmLabel: "Submit anyway",
        danger: true,
      });
      if (!ok) return;
    }
    submittedRef.current = true;
    setBusy(true);
    try {
      const body = a.kind === "assignment" ? { text, link } : { answers };
      const { data } = await api.post(`/assessments/${a._id}/submit`, body);
      toast(auto ? "Time's up — quiz submitted" : a.kind === "quiz" ? "Quiz submitted" : "Assignment submitted");
      onDone(data.submission);
    } catch (e) {
      submittedRef.current = false;
      toast(e.message, "error");
      setBusy(false);
    }
  };

  useEffect(() => {
    if (a.kind !== "quiz" || !a.timeLimitMin) return;
    const id = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          send(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <>
      {a.kind === "quiz" && a.timeLimitMin > 0 && (
        <div className={"qz-timerbar" + (left <= 30 ? " is-low" : "")}>
          <span className="qz-timer">
            <Clock /> {mm}:{ss}
          </span>
          <span className="qz-progress">
            {answered} / {total} answered
          </span>
        </div>
      )}

      {a.instructions && <p className="prompt-body">{a.instructions}</p>}

      {a.kind === "assignment" ? (
        <>
          <div className="field">
            <label>Your answer</label>
            <textarea
              className="input"
              style={{ minHeight: 180 }}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your response…"
            />
          </div>
          <div className="field">
            <label>
              Link <span className="text-muted">(optional — Google Doc, GitHub, Figma…)</span>
            </label>
            <input
              className="input"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…"
            />
          </div>
        </>
      ) : (
        <ol className="qz-qs">
          {(a.questions || []).map((q, i) => (
            <li key={q._id || i} className="qz-q">
              <div className="qz-q-head">
                <span className="qz-q-num">{i + 1}</span>
                <span className="qz-q-text">{q.text}</span>
              </div>
              <div className="qz-opts">
                {q.options.map((opt, oi) => (
                  <label key={oi} className={"qz-opt" + (answers[i] === oi ? " is-chosen" : "")}>
                    <input
                      type="radio"
                      name={`q${i}`}
                      checked={answers[i] === oi}
                      onChange={() => setAnswers((prev) => prev.map((v, x) => (x === i ? oi : v)))}
                    />
                    <span className="mark" />
                    {opt}
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="asmt-submitbar">
        <button
          className={"btn btn-primary" + (busy ? " is-loading" : "")}
          disabled={busy}
          onClick={() => send(false)}
        >
          {a.kind === "quiz" ? "Submit quiz" : previous ? "Submit again" : "Submit assignment"}
        </button>
        {a.kind === "quiz" && (
          <span className="muted-sm">One attempt only — you can't change answers after this.</span>
        )}
      </div>
    </>
  );
}

/* ── the due date has passed and nothing was handed in ───────────────────── */
// Shown instead of the form, because a form that cannot be submitted is worse
// than no form: it lets someone type an answer before telling them it is too
// late. The way back is the teacher's — they can move the due date, or send
// back a submission — so that is what this says.
function ClosedNotice({ a }) {
  return (
    <>
      {a.instructions && <p className="prompt-body">{a.instructions}</p>}
      <div className="result-banner is-fail">
        <Lock />
        <div>
          <div className="rb-label">This closed on {fmtDateTime(a.dueAt)}</div>
          <div style={{ fontSize: 13 }}>
            You didn't submit before the deadline. Ask your teacher to extend it if you
            still need to hand this in.
          </div>
        </div>
      </div>
    </>
  );
}

/* ── page ──────────────────────────────────────────────────────────────── */
export default function AssessmentDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  // { a, sub }
  const { status, data, error, reload } = useLoad(
    () =>
      api
        .get(`/assessments/${id}`)
        .then((r) => ({ a: r.data.assessment, sub: r.data.submission })),
    [id]
  );

  // A quiz's answer key is only revealed after an attempt — re-fetch so the
  // review renders correctly.
  const finish = () => reload();

  if (status === "loading")
    return (
      <Layout>
        <CenterLoader />
      </Layout>
    );

  if (status === "error")
    return (
      <Layout>
        <button className="back" onClick={() => nav("/assignments")}>
          <ArrowLeft /> Assignments
        </button>
        {error.status === 404 || error.status === 403 ? (
          <p className="muted-sm">Couldn't load this — it may have been removed or unpublished.</p>
        ) : (
          <ErrorState
            title="Couldn't load this assignment"
            message={error.message}
            onRetry={reload}
          />
        )}
      </Layout>
    );

  const { a, sub } = data;
  const { label } = kindMeta(a.kind);
  // Closed only when nothing was handed in. Work the teacher sent back stays
  // open past the due date: reopening it was their choice, not the student's.
  const closed = !sub && isOverdue(a.dueAt);

  return (
    <Layout>
      <button className="back" onClick={() => nav("/assignments")} style={{ marginBottom: 14 }}>
        <ArrowLeft /> Assignments
      </button>

      <div className="asmt-detail-head">
        <span className="tag tag-neutral">{label}</span>
        <h2>{a.title}</h2>
        <div className="asmt-card-meta">
          <span>{a.course?.title}</span>
          {a.kind === "quiz" && a.questionCount ? (
            <>
              <span>·</span>
              <span>{qCount(a.questionCount)}</span>
            </>
          ) : null}
          {a.kind === "quiz" && a.timeLimitMin ? (
            <>
              <span>·</span>
              <span>{a.timeLimitMin} min limit</span>
            </>
          ) : null}
          {a.kind === "assignment" ? (
            <>
              <span>·</span>
              <span>{a.points} marks</span>
            </>
          ) : null}
          {a.dueAt && (
            <>
              <span>·</span>
              <span>due {fmtDateTime(a.dueAt)}</span>
            </>
          )}
        </div>
      </div>

      <ResultBanner a={a} sub={sub} />

      {closed ? (
        <ClosedNotice a={a} />
      ) : !sub || sub.status === "returned" ? (
        <AttemptForm a={a} onDone={finish} previous={sub} />
      ) : a.kind === "quiz" ? (
        <>
          {a.instructions && <p className="prompt-body">{a.instructions}</p>}
          {a.questions?.length ? <QuizReview questions={a.questions} answers={sub.answers || []} /> : null}
          {sub.feedback && (
            <div className="fb-box">
              <div className="fb-label">Teacher feedback</div>
              <p>{sub.feedback}</p>
            </div>
          )}
        </>
      ) : (
        <>
          {a.instructions && <p className="prompt-body">{a.instructions}</p>}
          <div className="field">
            <label>Your submission</label>
            <div className={"asmt-answer" + (sub.text ? "" : " is-empty")}>
              {sub.text || "No written answer"}
            </div>
          </div>
          {safeUrl(sub.link) && (
            <p style={{ fontSize: 13 }}>
              Link:{" "}
              <a href={safeUrl(sub.link)} target="_blank" rel="noreferrer">
                {sub.link}
              </a>
            </p>
          )}
          {sub.feedback && (
            <div className="fb-box">
              <div className="fb-label">Teacher feedback</div>
              <p>{sub.feedback}</p>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
