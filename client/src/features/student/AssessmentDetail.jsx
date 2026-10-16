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
import { qCount } from "@/shared/lib/format";


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
// `showKey` is false until the server releases the answer key (after the due
// date). Until then only the student's own picks are marked, neither right
// nor wrong — the score in the banner already says how they did.
function QuizReview({ questions, answers, showKey, dueAt }) {
  return (
    <>
    {!showKey && (
      <p className="muted-sm">
        {dueAt
          ? `Correct answers will be shown after ${fmtDateTime(dueAt)}.`
          : "Correct answers aren't shown for this quiz."}
      </p>
    )}
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
              const correct = showKey && q.correctIndex === oi;
              if (!showKey) {
                return (
                  <div key={oi} className={"qz-opt is-static" + (picked ? " is-chosen" : "")}>
                    <span className="mark" />
                    {opt}
                    {picked && <span className="tag-you">Your answer</span>}
                  </div>
                );
              }
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
    </>
  );
}

/* ── take / submit ─────────────────────────────────────────────────────── */
// Seconds left on a timed attempt. `endsAt` comes from the server (already cut
// short by the due date) and `offsetMs` is how far the server's clock is ahead
// of this device's, so a wrong phone clock can't add or take away time.
const secondsLeft = (endsAt, offsetMs) =>
  Math.max(0, Math.ceil((new Date(endsAt).getTime() - (Date.now() + offsetMs)) / 1000));

// Picked answers are kept for this tab, so a refresh mid-quiz doesn't wipe
// them now that it no longer resets the clock either.
const answersKey = (id) => `quiz-answers:${id}`;
const readSavedAnswers = (id, count) => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(answersKey(id)) || "null");
    if (Array.isArray(saved) && saved.length === count) return saved;
  } catch {
    /* storage blocked or garbled — start blank */
  }
  return null;
};

function AttemptForm({ a, onDone, previous, attempt, offsetMs }) {
  const toast = useToast();
  const confirm = useConfirm();
  // A returned assignment comes back with what they wrote last time, so fixing
  // one broken link doesn't mean typing the whole answer again.
  const [text, setText] = useState(previous?.text || "");
  const [link, setLink] = useState(previous?.link || "");
  const [answers, setAnswers] = useState(
    () => readSavedAnswers(a._id, (a.questions || []).length) || (a.questions || []).map(() => -1)
  );
  const [busy, setBusy] = useState(false);
  // Counts down to the end the server set when the quiz was started, so a
  // refresh carries on where it was instead of starting again.
  const timed = a.kind === "quiz" && !!attempt;
  const [left, setLeft] = useState(() => (timed ? secondsLeft(attempt.endsAt, offsetMs) : 0));
  const submittedRef = useRef(false);

  useEffect(() => {
    if (a.kind !== "quiz") return;
    try {
      sessionStorage.setItem(answersKey(a._id), JSON.stringify(answers));
    } catch {
      /* storage blocked — a refresh just loses the picks */
    }
  }, [a._id, a.kind, answers]);

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
      try {
        sessionStorage.removeItem(answersKey(a._id));
      } catch {
        /* nothing to clean */
      }
      toast(auto ? "Time's up — quiz submitted" : a.kind === "quiz" ? "Quiz submitted" : "Assignment submitted");
      onDone(data.submission);
    } catch (e) {
      submittedRef.current = false;
      toast(e.message, "error");
      setBusy(false);
    }
  };

  // The interval only counts down. Submitting happens in the effect below,
  // which runs after a render and so sees the answers as they are now. Calling
  // `send` from inside the interval used the copy from the first render, whose
  // answers were all still blank — a timed-out quiz scored 0.
  // Re-reading the clock each tick (rather than subtracting one) keeps it
  // right when a phone throttles timers in a background tab.
  useEffect(() => {
    if (!timed) return;
    const id = setInterval(() => {
      const s = secondsLeft(attempt.endsAt, offsetMs);
      setLeft(s);
      if (s <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (timed && left === 0) send(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <>
      {timed && (
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

/* ── a timed quiz, before the clock starts ──────────────────────────────── */
// The questions stay hidden until this button is pressed, because pressing it
// is what starts the server's clock.
function StartQuiz({ a, onStarted }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      await api.post(`/assessments/${a._id}/start`);
      onStarted();
    } catch (e) {
      toast(e.message, "error");
      setBusy(false);
    }
  };

  return (
    <>
      {a.instructions && <p className="prompt-body">{a.instructions}</p>}
      <div className="result-banner is-pending">
        <Clock />
        <div>
          <div className="rb-label">You'll have {a.timeLimitMin} min once you start</div>
          <div style={{ fontSize: 13 }}>
            The timer keeps running if you leave or refresh the page, and the quiz is
            submitted for you when time is up.
          </div>
        </div>
      </div>
      <div className="asmt-submitbar">
        <button className={"btn btn-primary" + (busy ? " is-loading" : "")} disabled={busy} onClick={start}>
          Start quiz
        </button>
      </div>
    </>
  );
}

/* ── a timed quiz whose time ran out with nothing handed in ─────────────── */
function TimeUpNotice({ a }) {
  return (
    <>
      {a.instructions && <p className="prompt-body">{a.instructions}</p>}
      <div className="result-banner is-fail">
        <Lock />
        <div>
          <div className="rb-label">Time ran out on this quiz</div>
          <div style={{ fontSize: 13 }}>
            It wasn't submitted in time. Ask your teacher if you need another chance.
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
  // { a, sub, needsStart, attempt, offsetMs }
  const { status, data, error, reload } = useLoad(
    () =>
      api.get(`/assessments/${id}`).then((r) => ({
        a: r.data.assessment,
        sub: r.data.submission,
        answersShown: !!r.data.answersShown,
        needsStart: !!r.data.needsStart,
        attempt: r.data.attempt,
        // how far the server's clock is ahead of this device's
        offsetMs: r.data.serverNow ? new Date(r.data.serverNow).getTime() - Date.now() : 0,
      })),
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
        <button className="page-back" onClick={() => nav("/assignments")}>
          <ArrowLeft /> Back to assignments
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

  const { a, sub, answersShown, needsStart, attempt, offsetMs } = data;
  const { label } = kindMeta(a.kind);
  // Closed only when nothing was handed in. Work the teacher sent back stays
  // open past the due date: reopening it was their choice, not the student's.
  const closed = !sub && isOverdue(a.dueAt);
  // Started, never submitted, and past the time the server will still take it.
  const timeUp =
    !sub &&
    !!attempt &&
    Date.now() + offsetMs > new Date(attempt.endsAt).getTime() + (attempt.graceMs || 0);

  return (
    <Layout>
      <button className="page-back" onClick={() => nav("/assignments")}>
        <ArrowLeft /> Back to assignments
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

      {timeUp ? (
        <TimeUpNotice a={a} />
      ) : closed && !attempt ? (
        <ClosedNotice a={a} />
      ) : needsStart ? (
        <StartQuiz a={a} onStarted={reload} />
      ) : !sub || sub.status === "returned" ? (
        <AttemptForm a={a} onDone={finish} previous={sub} attempt={attempt} offsetMs={offsetMs} />
      ) : a.kind === "quiz" ? (
        <>
          {a.instructions && <p className="prompt-body">{a.instructions}</p>}
          {a.questions?.length ? <QuizReview questions={a.questions} answers={sub.answers || []} showKey={answersShown} dueAt={a.dueAt} /> : null}
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
